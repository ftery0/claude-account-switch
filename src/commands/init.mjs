import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { color, box, success, warn } from '../lib/ui.mjs';
import * as prompt from '../lib/prompt.mjs';
import { readMeta, writeMeta } from '../lib/config.mjs';
import { createProfile, profileExists, validateProfileName, migrateDir, migrationSource } from '../lib/profile.mjs';
import { HOME, DEFAULT_CLAUDE_DIR, IS_WINDOWS } from '../lib/constants.mjs';
import { installAllShells } from '../lib/shell.mjs';

export function existingClaudeSources() {
  const candidates = [
    process.env.CLAUDE_CONFIG_DIR,
    DEFAULT_CLAUDE_DIR,
    join(HOME, '.claude-work'),
    join(HOME, '.claude-personal'),
  ].filter(Boolean);
  return [...new Set(candidates.map(path => resolve(path)))].filter(path => {
    const source = migrationSource(path);
    return existsSync(source.directory) || existsSync(source.userConfig);
  });
}

export async function init() {
  const current = readMeta();
  if (current.profiles.length > 0) {
    warn('claude-account-switch is already initialized.');
    console.log(`  Profiles: ${current.profiles.join(', ')}`);
    console.log(`  Active: ${current.activeProfile || 'none'}`);
    console.log(`  Add an account: ${color.cyan('claude-account-switch add <name>')}`);
    console.log(`  Repair shell integration: ${color.cyan('claude-account-switch install-shell')}`);
    return;
  }

  console.log();
  console.log(box([
    `Welcome to ${color.bold('Claude Switch!')}`,
    'Multi-account manager for Claude Code',
  ]));
  console.log();
  const count = await prompt.number('How many profiles do you want to set up?', 2);
  console.log();
  const names = [];
  for (let index = 0; index < count; index++) {
    const defaultName = count === 1 ? 'main' : index === 0 ? 'work' : index === 1 ? 'personal' : '';
    const message = count === 1 ? 'Profile name:' : `Profile ${index + 1} name:`;
    names.push(await askProfileName(message, defaultName, names));
  }
  console.log();
  const activeProfile = names.length === 1
    ? names[0]
    : await prompt.select('Which profile should be active by default?', names);
  if (!activeProfile) return;
  const shareSettings = await prompt.confirm('Share settings.json and commands across profiles?', true);
  const sources = existingClaudeSources();
  let migration;
  if (sources.length > 0) {
    const source = await prompt.select('Copy an existing Claude configuration?', [
      ...sources.map(path => ({ label: path, value: path })),
      { label: 'Skip', value: '__skip__' },
    ]);
    if (!source) return;
    if (source !== '__skip__') {
      const target = names.length === 1 ? names[0] : await prompt.select('Copy into which profile?', names);
      if (!target) return;
      migration = { source, target };
    }
  }
  for (const name of names) {
    if (profileExists(name)) throw new Error(`Profile directory "${name}" already exists. Choose another name.`);
  }
  if (migration) {
    migrateDir(migration.source, migration.target, shareSettings);
    success(`Copied ${migration.source} → profile: ${migration.target}`);
  }
  for (const name of names) {
    if (migration?.target !== name) createProfile(name, shareSettings);
    success(`Profile ready: ${name}`);
  }
  writeMeta({ ...readMeta(), activeProfile, shareSettings });
  const { newlyInstalled, alreadyInstalled } = installAllShells();
  const shells = [...newlyInstalled, ...alreadyInstalled];
  if (shells.length > 0) success(`Shell integration installed (${shells.join(', ')})`);
  success(`Active profile: ${activeProfile}`);
  console.log();
  console.log(`  Open a new terminal and run ${color.cyan('claude')}. Claude will check authentication.`);
  if (names.length > 1) {
    const other = names.find(name => name !== activeProfile);
    const command = IS_WINDOWS ? `cpf ${other}; claude` : `cpf ${other} && claude`;
    console.log(`  To use another profile: ${color.cyan(command)}`);
  }
  if (migration) {
    warn('Original configuration was preserved. macOS Keychain credentials are not copied.');
  }
  console.log();
}

async function askProfileName(message, defaultName, names) {
  while (true) {
    const name = await prompt.text(message, defaultName);
    const error = validateProfileName(name);
    if (error || names.includes(name) || profileExists(name)) {
      console.log(`  ${color.red(error || `"${name}" is already used — choose a different name`)}`);
      continue;
    }
    return name;
  }
}
