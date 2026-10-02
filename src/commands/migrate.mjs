import { parseArgs } from 'node:util';
import { resolve } from 'node:path';
import { color, success, warn } from '../lib/ui.mjs';
import * as prompt from '../lib/prompt.mjs';
import { readMeta } from '../lib/config.mjs';
import { migrateDir, profileExists, validateProfileName } from '../lib/profile.mjs';
import { existingClaudeSources } from './init.mjs';

export async function migrate(profileName, argv = []) {
  const { values, positionals } = parseArgs({
    args: argv,
    options: { from: { type: 'string' } },
    allowPositionals: true,
  });
  const meta = readMeta();
  if (meta.profiles.length === 0) {
    throw new Error('No profiles found. Run claude-account-switch init first.');
  }
  if (positionals.length > 1) throw new Error('Usage: claude-account-switch migrate [profile] --from <path>');
  let target = positionals[0] || (profileName && !profileName.startsWith('-') ? profileName : undefined);
  if (!target) target = await prompt.select('Copy into which profile?', meta.profiles);
  if (!target) return;
  const error = validateProfileName(target);
  if (error) throw new Error(error);
  if (!profileExists(target) || !meta.profiles.includes(target)) {
    throw new Error(`Profile "${target}" does not exist.`);
  }

  let source = values.from;
  if (source !== undefined && !source.trim()) throw new Error('Source path cannot be empty.');
  if (!source) {
    const choices = existingClaudeSources().map(path => ({ label: path, value: path }));
    choices.push({ label: 'Enter a custom path', value: '__custom__' });
    source = await prompt.select('Which configuration do you want to copy?', choices);
    if (!source) return;
    if (source === '__custom__') source = await prompt.text('Enter the full path to the directory:', '');
    if (!source.trim()) throw new Error('Source path cannot be empty.');
  }
  source = resolve(source);
  console.log();
  console.log(`  Source : ${color.cyan(source)}`);
  console.log(`  Profile: ${color.cyan(target)}`);
  console.log('  Existing conflicting data will stop migration. The source will be preserved.');
  const confirmed = await prompt.confirm(`Copy configuration into "${target}"?`, true);
  if (!confirmed) {
    console.log('  Cancelled.');
    return;
  }
  migrateDir(source, target, meta.shareSettings !== false);
  success(`Copied ${source} → profile: ${target}`);
  warn('Original configuration was preserved. macOS Keychain credentials are not copied.');
  console.log('  Claude will check authentication when you launch this profile.');
  console.log();
}
