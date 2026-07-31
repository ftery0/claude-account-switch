import { spawn, execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { getActiveProfile, setActiveProfile } from '../lib/config.mjs';
import { HOME, IS_WINDOWS, PROFILES_DIR } from '../lib/constants.mjs';
import { installAllShells } from '../lib/shell.mjs';
import { listProfiles, profileDir, profileExists } from '../lib/profile.mjs';
import { color, error, info, success } from '../lib/ui.mjs';
import * as prompt from '../lib/prompt.mjs';
import { maybePromptSelfUpdate } from '../lib/self-update.mjs';

export async function shell(argv = []) {
  const [subcommand, ...args] = argv;
  switch (subcommand) {
    case 'launch':
      await launch(args);
      return;
    case 'use':
      await useProfile(args[0]);
      return;
    case 'pick':
      await pickProfile();
      return;
    case 'refresh':
      refreshShellIntegration();
      return;
    default:
      error('Usage: claude-account-switch shell <launch|use|pick|refresh>');
      process.exit(1);
  }
}

export async function launch(args = []) {
  const profiles = listProfiles();
  if (profiles.length === 0) {
    error('No claude-account-switch profiles found. Run: npx claude-account-switch init');
    process.exit(1);
  }

  const update = await maybePromptSelfUpdate();
  if (update.shouldExit) {
    process.exit(0);
  }

  const selected = profiles.length === 1
    ? profiles[0]
    : await selectProfile(profiles);

  if (!selected) process.exit(1);

  const current = getActiveProfile();
  if (selected !== current) {
    setActiveProfile(selected);
  }

  const code = await launchClaude(selected, args);
  process.exit(code);
}

export async function useProfile(name) {
  if (!name) {
    error('Usage: cpf <profile-name>');
    process.exit(1);
  }
  if (!profileExists(name)) {
    error(`Profile "${name}" not found`);
    process.exit(1);
  }
  setActiveProfile(name);
  success(`Switched to profile: ${name}`);
}

export async function pickProfile() {
  const profiles = listProfiles();
  if (profiles.length === 0) {
    error('No profiles found. Run: npx claude-account-switch init');
    process.exit(1);
  }
  const selected = await selectProfile(profiles);
  if (!selected) process.exit(1);
  setActiveProfile(selected);
  success(`Switched to profile: ${selected}`);
}

function refreshShellIntegration() {
  const { newlyInstalled, alreadyInstalled } = installAllShells();
  const shells = [...newlyInstalled, ...alreadyInstalled];
  if (shells.length > 0) {
    success(`Shell integration refreshed (${shells.join(', ')})`);
  } else {
    info('No shell integration targets found.');
  }
}

async function selectProfile(profiles) {
  const active = getActiveProfile();
  const choices = profiles.map((name) => ({
    value: name,
    label: `${name}${name === active ? '  (active)' : ''}${isLoggedIn(name) ? '' : '  (not logged in)'}`,
  }));
  return prompt.select('Select a profile:', choices);
}

function isLoggedIn(name) {
  return existsSync(join(profileDir(name), '.claude.json'));
}

function resolveFromPath() {
  try {
    const cmd = IS_WINDOWS ? 'where' : 'which';
    const out = execFileSync(cmd, ['claude'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    return out.split(/\r?\n/).find(Boolean) ?? null;
  } catch {
    return null;
  }
}

function resolveClaudeBinary() {
  const binName = IS_WINDOWS ? 'claude.exe' : 'claude';
  const candidates = [
    resolveFromPath(),
    join(HOME, '.local', 'bin', binName),
    join(HOME, '.claude', 'local', binName),
    IS_WINDOWS ? null : '/opt/homebrew/bin/claude',
    IS_WINDOWS ? null : '/usr/local/bin/claude',
  ].filter(Boolean);

  let npmRoot = null;
  try {
    npmRoot = execFileSync('npm', ['root', '-g'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {}
  if (npmRoot) {
    candidates.push(
      join(npmRoot, '@anthropic-ai', 'claude-code', 'bin', 'claude.exe'),
      join(npmRoot, '@anthropic-ai', 'claude-code', 'bin', 'claude'),
      join(npmRoot, '@anthropic-ai', 'claude-code', 'cli.js'),
    );
  }

  return candidates.find(path => existsSync(path)) ?? null;
}

function launchClaude(profile, args) {
  const bin = resolveClaudeBinary();
  if (!bin) {
    error('claude binary not found.');
    console.error('  Reinstall (native): curl -fsSL https://claude.ai/install.sh | bash');
    return 127;
  }

  if (isLoggedIn(profile)) {
    console.log(`${color.cyan('[claude-account-switch]')} Profile: ${color.bold(profile)}`);
  } else {
    console.log(`${color.cyan('[claude-account-switch]')} Profile: ${color.bold(profile)} ${color.yellow('(not logged in - login will start)')}`);
  }

  const cmd = bin.endsWith('.js') ? process.execPath : bin;
  const spawnArgs = bin.endsWith('.js') ? [bin, ...args] : args;
  return new Promise((resolve) => {
    const child = spawn(cmd, spawnArgs, {
      stdio: 'inherit',
      shell: IS_WINDOWS,
      env: { ...process.env, CLAUDE_CONFIG_DIR: join(PROFILES_DIR, profile) },
    });
    child.on('close', code => resolve(code ?? 0));
    child.on('error', () => resolve(1));
  });
}
