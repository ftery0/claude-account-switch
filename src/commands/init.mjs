import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { color, box, success, warn } from '../lib/ui.mjs';
import * as prompt from '../lib/prompt.mjs';
import { readMeta, writeMeta } from '../lib/config.mjs';
import { createProfile, validateProfileName, migrateDir, profileExists } from '../lib/profile.mjs';
import { PROFILES_DIR, DEFAULT_CLAUDE_DIR, HOME, IS_WINDOWS } from '../lib/constants.mjs';
import { installShellIntegration } from '../lib/shell.mjs';

// Known existing profile directories to detect for migration
const homeLabel = IS_WINDOWS ? '%USERPROFILE%' : '~';
const KNOWN_DIRS = [
  { path: join(HOME, '.claude'), label: `${homeLabel}/.claude` },
  { path: join(HOME, '.claude-work'), label: `${homeLabel}/.claude-work` },
  { path: join(HOME, '.claude-personal'), label: `${homeLabel}/.claude-personal` },
];

export async function init() {
  console.log();
  console.log(box([
    `Welcome to ${color.bold('Claude Switch!')}`,
    `Multi-account manager for Claude Code`,
  ]));
  console.log();

  // Check if already initialized
  if (existsSync(PROFILES_DIR)) {
    const meta = readMeta();
    if (meta.profiles.length > 0) {
      warn('claude-account-switch is already initialized.');
      console.log(`  Profiles: ${meta.profiles.join(', ')}`);
      console.log(`  Active: ${meta.activeProfile}`);
      console.log();
      const proceed = await prompt.confirm('Reinitialize? This will not delete existing profiles', false);
      if (!proceed) return;
      console.log();
    }
  }

  // Step 1: How many profiles?
  const count = await prompt.number('How many profiles do you want to set up?', 2);
  console.log();

  // Step 2: Profile names
  const names = [];
  if (count === 1) {
    // Single profile mode — auto-name as the user chooses or use simple name
    const name = await askProfileName('Profile name:', 'main', names);
    names.push(name);
  } else {
    for (let i = 0; i < count; i++) {
      const defaultName = i === 0 ? 'work' : i === 1 ? 'personal' : '';
      const name = await askProfileName(`Profile ${i + 1} name:`, defaultName, names);
      names.push(name);
    }
  }
  console.log();

  // Step 3: Default active profile
  let activeProfile;
  if (names.length === 1) {
    activeProfile = names[0];
  } else {
    activeProfile = await prompt.select(
      'Which profile should be active by default?',
      names,
    );
    console.log();
  }

  // Step 4: Share settings?
  const shareSettings = await prompt.confirm('Share settings across profiles? (recommended)', true);
  console.log();

  // Step 5: Shell integration
  const shellChoices = IS_WINDOWS
    ? [
        { label: "Yes - PowerShell  (recommended for Windows)", value: 'powershell' },
        { label: "Yes - bash (~/.bashrc)   [Git Bash / WSL]", value: 'bash' },
        { label: "Yes - zsh (~/.zshrc)    [WSL]", value: 'zsh' },
        { label: "Yes - fish (~/.config/fish/config.fish)", value: 'fish' },
        { label: "No, I'll do it later", value: 'no' },
      ]
    : [
        { label: "Yes - zsh (~/.zshrc)", value: 'zsh' },
        { label: "Yes - bash (~/.bashrc)", value: 'bash' },
        { label: "Yes - fish (~/.config/fish/config.fish)", value: 'fish' },
        { label: "No, I'll do it later", value: 'no' },
      ];

  const shellChoice = await prompt.select(
    "Install shell integration? (enables 'claude' command switching)",
    shellChoices,
  );
  console.log();

  // Step 6: Detect existing directories for migration
  const existingDirs = KNOWN_DIRS.filter(d => existsSync(d.path) && existsSync(join(d.path, '.claude.json')));
  const migrations = [];

  if (existingDirs.length > 0) {
    for (const dir of existingDirs) {
      const choices = [
        ...names.map(n => ({ label: `Yes, migrate to "${n}"`, value: n })),
        { label: 'No, skip', value: 'skip' },
      ];
      const target = await prompt.select(
        `Existing ${dir.label} detected. Migrate to a profile?`,
        choices,
      );
      if (target !== 'skip') {
        migrations.push({ source: dir.path, target });
      }
      console.log();
    }
  }

  // Execute
  console.log();

  // Perform migrations first
  const migrated = new Set();
  for (const m of migrations) {
    migrateDir(m.source, m.target, shareSettings);
    migrated.add(m.target);
    success(`Migrated ${m.source} → profile: ${m.target}`);
    warn(`Original ${m.source} was NOT deleted. Once you verify everything works, you can remove it manually.`);
  }

  // Create remaining profiles
  for (const name of names) {
    if (!migrated.has(name)) {
      createProfile(name, shareSettings);
    }
    success(`Created profile: ${name}`);
  }

  // Update meta
  const meta = readMeta();
  meta.activeProfile = activeProfile;
  meta.shareSettings = shareSettings;
  writeMeta(meta);

  if (shareSettings) {
    success('Shared settings linked');
  }

  // Shell integration
  if (shellChoice !== 'no') {
    installShellIntegration(shellChoice);
    success('Shell integration installed');
  }

  success(`Active profile: ${activeProfile}`);

  // Next steps
  console.log();
  console.log(`  ${color.bold('Next steps:')}`);
  if (shellChoice !== 'no') {
    const activateCmd = {
      powershell: '. $PROFILE',
      fish:       'source ~/.config/fish/config.fish',
      zsh:        'source ~/.zshrc',
      bash:       'source ~/.bashrc',
    }[shellChoice];
    console.log(`    1. Open a new terminal (or run: ${color.cyan(activateCmd)})`);
  }
  console.log(`    2. Run ${color.cyan('claude')} to authenticate your "${activeProfile}" profile`);
  if (names.length > 1) {
    const otherProfile = names.find(n => n !== activeProfile);
    const chainCmd = shellChoice === 'powershell'
      ? `cpf ${otherProfile}; claude`
      : `cpf ${otherProfile} && claude`;
    console.log(`    3. Run ${color.cyan(chainCmd)} to authenticate "${otherProfile}"`);
  }
  console.log();
}

async function askProfileName(message, defaultVal, existingNames = []) {
  while (true) {
    const name = await prompt.text(message, defaultVal);
    const err = validateProfileName(name);
    if (err) {
      console.log(`  ${color.red(err)}`);
      continue;
    }
    if (existingNames.includes(name)) {
      console.log(`  ${color.red(`"${name}" is already used — choose a different name`)}`);
      continue;
    }
    return name;
  }
}
