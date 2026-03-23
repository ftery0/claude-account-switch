import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { color, success, warn, error } from '../lib/ui.mjs';
import * as prompt from '../lib/prompt.mjs';
import { readMeta } from '../lib/config.mjs';
import { migrateDir, profileExists, profileDir, validateProfileName } from '../lib/profile.mjs';
import { HOME, DEFAULT_CLAUDE_DIR, IS_WINDOWS } from '../lib/constants.mjs';

export async function migrate(profileName) {
  const meta = readMeta();

  if (meta.profiles.length === 0) {
    error('No profiles found. Run claude-account-switch init first.');
    process.exit(1);
  }

  // Pick source directory
  const h = IS_WINDOWS ? '%USERPROFILE%' : '~';
  const commonSources = [
    { label: `${h}/.claude  (default Claude Code directory)`, value: DEFAULT_CLAUDE_DIR },
    { label: `${h}/.claude-work`, value: join(HOME, '.claude-work') },
    { label: `${h}/.claude-personal`, value: join(HOME, '.claude-personal') },
    { label: 'Enter a custom path', value: '__custom__' },
  ].filter(s => s.value === '__custom__' || existsSync(s.value));

  if (commonSources.length === 1) {
    // Only custom option left — no known dirs found
    error(`No existing Claude directories found (checked ${h}/.claude, ${h}/.claude-work, ${h}/.claude-personal).`);
    console.log(`  Specify a path manually with: ${color.cyan('claude-account-switch migrate <profile> --from <path>')}`);
    process.exit(1);
  }

  console.log();
  const sourceChoice = await prompt.select('Which directory do you want to migrate from?', commonSources);

  let sourceDir = sourceChoice;
  if (sourceChoice === '__custom__') {
    sourceDir = await prompt.text('Enter the full path to the directory:', '');
    if (!sourceDir) {
      error('Path cannot be empty.');
      process.exit(1);
    }
  }

  if (!existsSync(sourceDir)) {
    error(`Directory not found: ${sourceDir}`);
    process.exit(1);
  }

  // Pick target profile
  let targetProfile = profileName;
  if (!targetProfile) {
    console.log();
    targetProfile = await prompt.select(
      'Migrate into which profile?',
      meta.profiles,
    );
  } else {
    const validationError = validateProfileName(targetProfile);
    if (validationError) {
      error(validationError);
      process.exit(1);
    }
    if (!profileExists(targetProfile)) {
      error(`Profile "${targetProfile}" does not exist.`);
      process.exit(1);
    }
  }

  console.log();
  console.log(`  Source : ${color.cyan(sourceDir)}`);
  console.log(`  Profile: ${color.cyan(targetProfile)}`);
  console.log();

  // Warn if target profile already has auth data — migration would overwrite it
  const targetAuthFile = join(profileDir(targetProfile), '.claude.json');
  if (existsSync(targetAuthFile)) {
    warn(`Profile "${targetProfile}" already has credentials (.claude.json).`);
    warn('Migrating will overwrite existing profile data.');
  }

  const confirmed = await prompt.confirm(
    `This will copy data from ${sourceDir} into the "${targetProfile}" profile. Continue?`,
    true,
  );
  if (!confirmed) {
    console.log('  Cancelled.');
    return;
  }

  console.log();
  migrateDir(sourceDir, targetProfile, meta.shareSettings);
  success(`Migrated ${sourceDir} → profile: ${targetProfile}`);
  warn(`Original ${sourceDir} was NOT deleted. Once you verify everything works, you can remove it manually.`);
  console.log();
  console.log(`  ${color.bold('What was migrated:')}`);
  console.log(`    • .claude.json, settings.local.json  (auth & local settings)`);
  console.log(`    • plugins/, projects/, plans/         (profile data)`);
  if (meta.shareSettings) {
    console.log(`    • settings.json, commands/            (copied to _shared, symlinked)`);
  }
  console.log();
}
