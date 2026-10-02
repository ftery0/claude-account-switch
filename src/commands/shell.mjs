import { spawn, execFileSync } from 'node:child_process';
import { accessSync, constants, statSync } from 'node:fs';
import { constants as osConstants } from 'node:os';
import { join, delimiter } from 'node:path';
import { getActiveProfile, setActiveProfile } from '../lib/config.mjs';
import { HOME, IS_WINDOWS } from '../lib/constants.mjs';
import { installAllShells } from '../lib/shell.mjs';
import { listProfiles, profileDir, profileExists } from '../lib/profile.mjs';
import { success } from '../lib/ui.mjs';
import * as prompt from '../lib/prompt.mjs';
import { scheduleSelfUpdate } from '../lib/self-update.mjs';

export async function shell(argv = []) {
  const [subcommand, ...args] = argv;
  switch (subcommand) {
    case 'launch': {
      let profile;
      let forwarded = args;
      if (args[0] === '--profile') {
        if (!args[1] || args[2] !== '--') throw new Error('Expected shell launch --profile <name> -- <args>');
        profile = args[1];
        forwarded = args.slice(3);
      }
      await launch(forwarded, profile);
      return;
    }
    case 'use':
      if (args.length !== 1) throw new Error('Usage: cpf <profile-name>');
      useProfile(args[0]);
      return;
    case 'pick':
      if (args.length && (args.length !== 1 || args[0] !== '--print')) throw new Error('Usage: shell pick [--print]');
      await pickProfile(args[0] === '--print');
      return;
    case 'refresh':
      if (args.length) throw new Error('Usage: shell refresh');
      installAllShells();
      success('Shell integration refreshed.');
      return;
    default:
      throw new Error('Usage: shell <launch|use|pick|refresh>');
  }
}

async function launch(args, selected) {
  const profile = selected ?? await selectProfile();
  if (!profile) {
    process.exitCode = 130;
    return;
  }
  if (!listProfiles().includes(profile) || !profileExists(profile)) throw new Error(`Profile "${profile}" not found`);
  const bin = resolveClaudeBinary();
  if (!bin) {
    console.error('Claude Code executable not found. See https://code.claude.com/docs/en/setup');
    process.exitCode = 127;
    return;
  }
  scheduleSelfUpdate();
  if (getActiveProfile() !== profile) setActiveProfile(profile);
  process.stderr.write(`[claude-account-switch] Profile: ${profile}\n`);
  const cmd = bin.endsWith('.js') ? process.execPath : bin;
  const childArgs = bin.endsWith('.js') ? [bin, ...args] : args;
  const result = await new Promise(resolve => {
    const child = spawn(cmd, childArgs, {
      stdio: 'inherit', shell: false,
      env: { ...process.env, CLAUDE_CONFIG_DIR: profileDir(profile) },
    });
    let interrupted;
    const onInt = () => { interrupted = 'SIGINT'; child.kill('SIGINT'); };
    const onTerm = () => { interrupted = 'SIGTERM'; child.kill('SIGTERM'); };
    process.on('SIGINT', onInt);
    process.on('SIGTERM', onTerm);
    const cleanup = () => {
      process.removeListener('SIGINT', onInt);
      process.removeListener('SIGTERM', onTerm);
    };
    child.once('error', err => {
      cleanup();
      console.error(`Could not start Claude Code: ${err.message}`);
      resolve(1);
    });
    child.once('close', (code, signal) => {
      cleanup();
      resolve(interrupted ? 128 + osConstants.signals[interrupted] : code ?? (128 + (osConstants.signals[signal] ?? 1)));
    });
  });
  process.exitCode = result;
}

function useProfile(name) {
  if (!listProfiles().includes(name) || !profileExists(name)) throw new Error(`Profile "${name}" not found`);
  if (getActiveProfile() !== name) setActiveProfile(name);
  success(`Switched to profile: ${name}`);
}

async function pickProfile(printOnly) {
  const profile = await selectProfile();
  if (!profile) {
    process.exitCode = 130;
    return;
  }
  if (getActiveProfile() !== profile) setActiveProfile(profile);
  if (printOnly) process.stdout.write(profile + '\n');
  else success(`Switched to profile: ${profile}`);
}

async function selectProfile() {
  const profiles = listProfiles();
  if (!profiles.length) throw new Error('No profiles found. Run: npx claude-account-switch init');
  const active = getActiveProfile();
  const selected = !process.stdin.isTTY || profiles.length === 1
    ? (active ?? profiles[0])
    : await prompt.select('Select a profile:', profiles, { output: process.stderr, initial: profiles.indexOf(active) });
  if (selected && !profileExists(selected)) throw new Error(`Profile "${selected}" not found`);
  return selected;
}

function executable(file) {
  try {
    accessSync(file, IS_WINDOWS ? constants.F_OK : constants.X_OK);
    return statSync(file).isFile();
  } catch {
    return false;
  }
}

function resolveClaudeBinary() {
  const names = IS_WINDOWS ? ['claude.exe'] : ['claude'];
  for (const directory of (process.env.PATH ?? '').split(delimiter).filter(Boolean)) {
    for (const name of names) {
      const file = join(directory, name);
      if (executable(file)) return file;
    }
  }
  const binName = IS_WINDOWS ? 'claude.exe' : 'claude';
  const native = [join(HOME, '.local/bin', binName), join(HOME, '.claude/local', binName)];
  if (!IS_WINDOWS) native.push('/opt/homebrew/bin/claude', '/usr/local/bin/claude');
  const found = native.find(executable);
  if (found) return found;
  try {
    const npmRoot = execFileSync(IS_WINDOWS ? 'npm.cmd' : 'npm', ['root', '-g'], {
      encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 3000, shell: IS_WINDOWS,
    }).trim();
    const candidates = IS_WINDOWS ? ['bin/claude.exe', 'cli.js'] : ['bin/claude', 'cli.js'];
    return candidates
      .map(file => join(npmRoot, '@anthropic-ai/claude-code', file))
      .find(file => executable(file) || (file.endsWith('.js') && executable(process.execPath) && exists(file))) ?? null;
  } catch {
    return null;
  }
}

function exists(file) {
  try { accessSync(file); return statSync(file).isFile(); } catch { return false; }
}
