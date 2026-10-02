import './helpers/home.mjs';
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import {
  readdirSync, rmSync, mkdirSync, writeFileSync, readFileSync,
  existsSync, lstatSync, readlinkSync, statSync, copyFileSync,
} from 'node:fs';
import { join, delimiter } from 'node:path';
import { fileURLToPath } from 'node:url';
import { HOME, META_FILE, PROFILES_DIR, SHARED_DIR } from '../src/lib/constants.mjs';
import { createProfile, profileDir } from '../src/lib/profile.mjs';
import { readMeta, writeMeta } from '../src/lib/config.mjs';
import { existingClaudeSources } from '../src/commands/init.mjs';
import { compileFakeClaude } from './cross-shell-smoke.mjs';

const cli = fileURLToPath(new URL('../bin/cli.mjs', import.meta.url));
const childShell = process.platform === 'win32' ? 'powershell' : '/bin/zsh';
const commandTimeout = process.platform === 'win32' ? 15000 : 5000;

function write(path, content) {
  mkdirSync(join(path, '..'), { recursive: true });
  writeFileSync(path, content);
}

function snapshot(path) {
  if (!existsSync(path)) return null;
  const info = lstatSync(path);
  if (info.isSymbolicLink()) return { link: readlinkSync(path) };
  if (info.isFile()) return { content: readFileSync(path, 'utf8'), modified: info.mtimeMs };
  return Object.fromEntries(readdirSync(path).sort().map(entry => [entry, snapshot(join(path, entry))]));
}

function run(args, env = {}) {
  return spawnSync(process.execPath, [cli, ...args], {
    env: { ...process.env, SHELL: childShell, ...env },
    encoding: 'utf8', timeout: commandTimeout,
  });
}

function wizard(name = 'work', env = {}) {
  return interactive([cli, 'init'], [['How many profiles', '1\n'], ['Profile name:', name + '\n']], env);
}

function interactive(argv, replies, env = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, argv, {
      env: { ...process.env, SHELL: childShell, ...env },
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let index = 0;
    let stdout = '';
    let stderr = '';
    const timeout = setTimeout(() => {
      child.kill();
      reject(new Error(`Init did not finish: ${stdout} ${stderr}`));
    }, commandTimeout);
    child.stdout.on('data', data => {
      stdout += data.toString();
      if (index < replies.length && stdout.includes(replies[index][0])) {
        child.stdin.write(replies[index][1]);
        index++;
        if (index === replies.length) child.stdin.end();
      }
    });
    child.stderr.on('data', data => { stderr += data.toString(); });
    child.on('error', error => { clearTimeout(timeout); reject(error); });
    child.on('close', status => { clearTimeout(timeout); resolve({ status, stdout, stderr }); });
  });
}

function ttyCommand(module, call) {
  const url = new URL(`../src/commands/${module}.mjs`, import.meta.url).href;
  const setup = 'Object.defineProperty(process.stdin, "isTTY", { value: true }); process.stdin.setRawMode = () => {};';
  return ['--input-type=module', '-e', `${setup} const command = await import(${JSON.stringify(url)}); await command.${call};`];
}

async function installerGuards() {
  const directory = join(HOME, 'fake-bin');
  const marker = join(HOME, 'install-called');
  const probeMarker = join(HOME, 'guard-probe');
  mkdirSync(directory);
  const commands = ['claude', 'curl', 'npm', 'npx', 'wget', 'winget', 'choco', 'scoop', 'powershell', 'pwsh'];
  if (process.platform === 'win32') {
    const executable = join(directory, 'claude.exe');
    await compileFakeClaude(executable, process.env);
    for (const name of commands) {
      if (name !== 'claude') copyFileSync(executable, join(directory, `${name}.exe`));
      writeFileSync(join(directory, `${name}.cmd`), `@echo off\r\n"%~dp0${name}.exe" %*\r\nexit /b %errorlevel%\r\n`);
    }
  } else {
    for (const name of [...commands, 'sh', 'bash']) {
      writeFileSync(join(directory, name), '#!/bin/sh\nprintf "invoked\\n" >> "$CAS_FAKE_MARKER"\nexit 9\n', { mode: 0o755 });
    }
  }
  const env = {
    PATH: `${directory}${delimiter}${process.env.PATH}`, CAS_FAKE_MARKER: marker,
    CAS_FAKE_QUIET: '1', CAS_FAKE_EXIT: '9',
  };
  const probe = spawnSync(join(directory, process.platform === 'win32' ? 'claude.exe' : 'claude'), [], {
    env: { ...process.env, ...env, CAS_FAKE_MARKER: probeMarker }, encoding: 'utf8',
  });
  assert.equal(probe.status, 9, probe.stderr);
  assert.ok(existsSync(probeMarker), 'installer guards must execute and record invocations');
  rmSync(probeMarker);
  return env;
}

beforeEach(() => {
  for (const entry of readdirSync(HOME)) rmSync(join(HOME, entry), { recursive: true, force: true });
  delete process.env.CLAUDE_CONFIG_DIR;
});

describe('init existing Claude installation', () => {
  it('finds the default root config without requiring ~/.claude', () => {
    write(join(HOME, '.claude.json'), '{"account":"work"}');
    assert.deepEqual(existingClaudeSources(), [join(HOME, '.claude')]);
  });

  it('prioritizes and deduplicates the configured directory', () => {
    const configured = join(HOME, 'configured');
    process.env.CLAUDE_CONFIG_DIR = configured;
    mkdirSync(configured);
    mkdirSync(join(HOME, '.claude'));
    assert.deepEqual(existingClaudeSources(), [configured, join(HOME, '.claude')]);
    process.env.CLAUDE_CONFIG_DIR = join(HOME, '.claude');
    assert.deepEqual(existingClaudeSources(), [join(HOME, '.claude')]);
  });

  it('repeated init only reports state and leaves metadata, settings, and shell untouched', () => {
    createProfile('work');
    writeMeta({ ...readMeta(), activeProfile: 'work' });
    write(join(SHARED_DIR, 'settings.json'), '{"env":{"MODEL":"local"}}');
    write(join(HOME, '.zshrc'), '# custom shell configuration\n');
    const before = snapshot(HOME);
    const result = run(['init']);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /already initialized/);
    assert.match(result.stdout, /Active: work/);
    assert.doesNotMatch(result.stdout, /Reinitialize|How many profiles/);
    assert.deepEqual(snapshot(HOME), before);
  });

  it('imports default root config on first init and does not run an installer or Claude', async () => {
    write(join(HOME, '.claude.json'), '{"account":"work"}');
    const result = await wizard('work', await installerGuards());
    assert.equal(result.status, 0, result.stderr + result.stdout);
    assert.equal(readFileSync(join(profileDir('work'), '.claude.json'), 'utf8'), '{"account":"work"}');
    assert.equal(readFileSync(join(HOME, '.claude.json'), 'utf8'), '{"account":"work"}');
    assert.equal(existsSync(join(HOME, 'install-called')), false);
    assert.equal(readMeta().activeProfile, 'work');
    assert.doesNotMatch(result.stdout, /successfully logged in|authenticated|login will start/i);
  });

  it('first init imports the configured directory and its user config', async () => {
    const configured = join(HOME, 'configured');
    write(join(configured, '.claude.json'), '{"account":"configured"}');
    write(join(configured, 'skills', 'local', 'SKILL.md'), '# local skill');
    write(join(HOME, '.claude.json'), '{"account":"root"}');
    const result = await wizard('work', { CLAUDE_CONFIG_DIR: configured });
    assert.equal(result.status, 0, result.stderr + result.stdout);
    assert.equal(readFileSync(join(profileDir('work'), '.claude.json'), 'utf8'), '{"account":"configured"}');
    assert.equal(readFileSync(join(profileDir('work'), 'skills', 'local', 'SKILL.md'), 'utf8'), '# local skill');
    assert.equal(readFileSync(join(HOME, '.claude.json'), 'utf8'), '{"account":"root"}');
  });

  it('corrupt metadata stops init without altering existing data or shell', () => {
    write(META_FILE, '{broken');
    write(join(HOME, '.zshrc'), '# preserve\n');
    const before = snapshot(HOME);
    const result = run(['init']);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /JSON|metadata/);
    assert.deepEqual(snapshot(HOME), before);
  });

  it('cancelling the active profile selection leaves the home untouched', async () => {
    const before = snapshot(HOME);
    const result = await interactive(ttyCommand('init', 'init()'), [
      ['How many profiles', '2\n'],
      ['Profile 1 name:', 'work\n'],
      ['Profile 2 name:', 'personal\n'],
      ['Which profile should be active', '\x03'],
    ]);
    assert.equal(result.status, 0, result.stderr + result.stdout);
    assert.deepEqual(snapshot(HOME), before);
  });

  it('cancelling the source selection does not initialize or copy data', async () => {
    write(join(HOME, '.claude.json'), '{"account":"root"}');
    const before = snapshot(HOME);
    const result = await interactive(ttyCommand('init', 'init()'), [
      ['How many profiles', '1\n'],
      ['Profile name:', 'work\n'],
      ['Share settings.json', '\r'],
      ['Copy an existing Claude configuration?', '\x03'],
    ]);
    assert.equal(result.status, 0, result.stderr + result.stdout);
    assert.deepEqual(snapshot(HOME), before);
  });
});

describe('migrate --from CLI', () => {
  it('honors an explicit source path with spaces and preserves source data', () => {
    createProfile('work', false);
    writeMeta({ ...readMeta(), shareSettings: false });
    const source = join(HOME, 'import account');
    write(join(source, '.claude.json'), '{"account":"imported"}');
    write(join(source, '.credentials.json'), '{"session":"file-credential"}');
    write(join(source, 'CLAUDE.md'), '# custom rules');
    const before = snapshot(source);
    const result = run(['migrate', 'work', '--from', source]);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(readFileSync(join(profileDir('work'), '.claude.json'), 'utf8'), '{"account":"imported"}');
    assert.equal(readFileSync(join(profileDir('work'), 'CLAUDE.md'), 'utf8'), '# custom rules');
    assert.deepEqual(snapshot(source), before);
    assert.equal(existsSync(join(HOME, '.zshrc')), false);
    if (process.platform !== 'win32') assert.equal(statSync(join(profileDir('work'), '.credentials.json')).mode & 0o777, 0o600);
  });

  it('accepts --from before the profile positional argument', () => {
    createProfile('work', false);
    const source = join(HOME, 'source');
    write(join(source, '.claude.json'), '{"account":"imported"}');
    const result = run(['migrate', '--from', source, 'work']);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(readFileSync(join(profileDir('work'), '.claude.json'), 'utf8'), '{"account":"imported"}');
  });

  it('supports a root-only default source and rejects incomplete --from arguments', () => {
    createProfile('work', false);
    write(join(HOME, '.claude.json'), '{"account":"root"}');
    const result = run(['migrate', 'work', '--from', join(HOME, '.claude')]);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(readFileSync(join(profileDir('work'), '.claude.json'), 'utf8'), '{"account":"root"}');
    const before = snapshot(PROFILES_DIR);
    const missing = run(['migrate', 'work', '--from']);
    assert.equal(missing.status, 1);
    assert.deepEqual(snapshot(PROFILES_DIR), before);
  });

  it('rejects conflicting credentials without writing any staged data or shell files', () => {
    createProfile('work');
    write(join(profileDir('work'), '.claude.json'), '{"account":"original"}');
    const source = join(HOME, 'source');
    write(join(source, '.claude.json'), '{"account":"different"}');
    const before = snapshot(HOME);
    const result = run(['migrate', 'work', '--from', source]);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Migration conflict/);
    assert.deepEqual(snapshot(HOME), before);
  });

  it('cancelling the migration source selection preserves the current setup', async () => {
    createProfile('work', false);
    const before = snapshot(HOME);
    const result = await interactive(ttyCommand('migrate', 'migrate("work")'), [
      ['Which configuration do you want to copy?', '\x03'],
    ]);
    assert.equal(result.status, 0, result.stderr + result.stdout);
    assert.deepEqual(snapshot(HOME), before);
  });
});
