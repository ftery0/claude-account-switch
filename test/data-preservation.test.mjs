import './helpers/home.mjs';
import { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import fs, {
  mkdirSync, writeFileSync, readFileSync, lstatSync, statSync, readdirSync,
  readlinkSync, realpathSync, symlinkSync, rmSync, existsSync, chmodSync,
} from 'node:fs';
import { join, basename } from 'node:path';
import { syncBuiltinESMExports } from 'node:module';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { HOME, PROFILES_DIR, SHARED_DIR, META_FILE, IS_WINDOWS } from '../src/lib/constants.mjs';
import { migrateDir, createProfile, profileDir } from '../src/lib/profile.mjs';

const source = join(HOME, 'fixture-source');
const harness = join(HOME, 'fixture-harness');
const cli = fileURLToPath(new URL('../bin/cli.mjs', import.meta.url));

function write(path, contents, mode = 0o640) {
  mkdirSync(join(path, '..'), { recursive: true });
  writeFileSync(path, contents, { mode });
  if (!IS_WINDOWS) chmodSync(path, mode);
}

function snapshot(path) {
  if (!existsSync(path)) {
    try { lstatSync(path); } catch { return null; }
  }
  const info = lstatSync(path);
  const mode = info.mode & 0o777;
  if (info.isSymbolicLink()) return { link: readlinkSync(path), mode };
  if (info.isFile()) return { data: readFileSync(path).toString('hex'), mode, modified: info.mtimeMs };
  return { mode, entries: Object.fromEntries(readdirSync(path).sort().map(entry => [entry, snapshot(join(path, entry))])) };
}

function directoryLink(target, link) {
  symlinkSync(target, link, IS_WINDOWS ? 'junction' : 'dir');
}

function fixture() {
  write(join(source, '.claude.json'), JSON.stringify({ oauthAccount: { emailAddress: 'fixture@example.invalid' }, onboarding: true }), 0o600);
  write(join(source, '.credentials.json'), JSON.stringify({ accessToken: 'fixture-only-token', refreshToken: 'fixture-only-refresh' }), 0o600);
  write(join(source, 'settings.json'), JSON.stringify({ env: { ANTHROPIC_BASE_URL: 'http://127.0.0.1:9', ANTHROPIC_AUTH_TOKEN: 'fixture-only-secret' }, hooks: { PreToolUse: [] } }));
  write(join(source, 'settings.local.json'), '{"permissions":{"allow":["Read"]}}');
  write(join(source, 'history.jsonl'), '{"display":"fixture prompt","timestamp":1,"sessionId":"fixture-session"}\n');
  write(join(source, 'projects', 'fixture-project', 'session.jsonl'), '{"type":"user","message":"fixture transcript"}\n');
  write(join(source, 'projects', 'fixture-project', 'memory', 'MEMORY.md'), '# fixture memory\n');
  write(join(source, 'plans', 'fixture.md'), '# fixture plan\n');
  write(join(source, 'pre-launch.sh'), 'export CAS_HOOK="fixture hook"\n', 0o750);
  write(join(source, 'pre-launch.fish'), 'set -gx CAS_HOOK "fixture hook"\n');
  write(join(source, 'pre-launch.ps1'), '$env:CAS_HOOK = "fixture hook"\n');
  write(join(harness, 'CLAUDE.md'), '# fixture harness instructions\n');
  write(join(harness, 'skills', 'fixture', 'SKILL.md'), '# fixture skill\n');
  write(join(harness, 'rules', 'fixture.md'), '# fixture rule\n');
  write(join(harness, 'hooks', 'fixture.sh'), '#!/bin/sh\nexit 0\n', 0o750);
  write(join(harness, 'commands', 'fixture.md'), '# fixture command\n');
  for (const entry of ['skills', 'rules', 'hooks', 'commands']) directoryLink(join(harness, entry), join(source, entry));
  if (IS_WINDOWS) write(join(source, 'CLAUDE.md'), readFileSync(join(harness, 'CLAUDE.md')));
  else symlinkSync('../fixture-harness/CLAUDE.md', join(source, 'CLAUDE.md'));
  return { source: snapshot(source), harness: snapshot(harness) };
}

async function cancelInit() {
  const url = new URL('../src/commands/init.mjs', import.meta.url).href;
  const setup = 'Object.defineProperty(process.stdin, "isTTY", { value: true }); process.stdin.setRawMode = () => {};';
  const script = `${setup} const command = await import(${JSON.stringify(url)}); await command.init();`;
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['--input-type=module', '-e', script], {
      env: { ...process.env, CLAUDE_CONFIG_DIR: source }, stdio: ['pipe', 'pipe', 'pipe'],
    });
    const replies = [
      ['How many profiles', '1\n'], ['Profile name:', 'work\n'],
      ['Share settings.json', '\r'], ['Copy an existing Claude configuration?', '\x03'],
    ];
    let index = 0;
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => { child.kill(); reject(new Error(`Cancel fixture timed out: ${stdout} ${stderr}`)); }, 5000);
    child.stdout.on('data', chunk => {
      stdout += chunk;
      if (index < replies.length && stdout.includes(replies[index][0])) {
        child.stdin.write(replies[index][1]);
        index++;
        if (index === replies.length) child.stdin.end();
      }
    });
    child.stderr.on('data', chunk => { stderr += chunk; });
    child.once('error', err => { clearTimeout(timer); reject(err); });
    child.once('close', code => { clearTimeout(timer); resolve({ code, stdout, stderr }); });
  });
}

beforeEach(() => {
  for (const path of [source, harness, PROFILES_DIR]) rmSync(path, { recursive: true, force: true });
  delete process.env.CLAUDE_CONFIG_DIR;
});

describe('synthetic Claude data preservation', () => {
  it('leaves source credentials, history, settings, links, modes, and harness files unchanged', () => {
    const original = fixture();
    migrateDir(source, 'work');
    assert.deepEqual(snapshot(source), original.source);
    assert.deepEqual(snapshot(harness), original.harness);
    assert.equal(readFileSync(join(source, 'history.jsonl'), 'utf8'), '{"display":"fixture prompt","timestamp":1,"sessionId":"fixture-session"}\n');
  });

  it('copies settings, credentials, transcripts, memory, plans, hooks, and directory links', () => {
    fixture();
    migrateDir(source, 'work');
    for (const file of ['.claude.json', '.credentials.json', 'settings.local.json', 'pre-launch.sh', 'pre-launch.fish', 'pre-launch.ps1']) {
      assert.deepEqual(readFileSync(join(profileDir('work'), file)), readFileSync(join(source, file)), file);
    }
    for (const path of ['projects/fixture-project/session.jsonl', 'projects/fixture-project/memory/MEMORY.md', 'plans/fixture.md']) {
      assert.deepEqual(readFileSync(join(profileDir('work'), path)), readFileSync(join(source, path)), path);
    }
    assert.deepEqual(readFileSync(join(SHARED_DIR, 'settings.json')), readFileSync(join(source, 'settings.json')));
    for (const entry of ['skills', 'rules', 'hooks']) {
      assert.equal(lstatSync(join(profileDir('work'), entry)).isSymbolicLink(), true, entry);
      assert.equal(realpathSync(join(profileDir('work'), entry)), realpathSync(join(harness, entry)), entry);
    }
    assert.equal(lstatSync(join(SHARED_DIR, 'commands')).isSymbolicLink(), true);
    assert.equal(realpathSync(join(profileDir('work'), 'commands')), realpathSync(join(harness, 'commands')));
    assert.deepEqual(readFileSync(join(profileDir('work'), 'CLAUDE.md')), readFileSync(join(harness, 'CLAUDE.md')));
    if (!IS_WINDOWS) {
      assert.equal(lstatSync(join(profileDir('work'), 'CLAUDE.md')).isSymbolicLink(), true);
      assert.equal(realpathSync(join(profileDir('work'), 'CLAUDE.md')), realpathSync(join(harness, 'CLAUDE.md')));
      for (const file of ['.claude.json', '.credentials.json']) assert.equal(statSync(join(profileDir('work'), file)).mode & 0o777, 0o600);
      assert.equal(statSync(profileDir('work')).mode & 0o777, 0o700);
      assert.equal(statSync(join(profileDir('work'), 'pre-launch.sh')).mode & 0o777, 0o750);
    }
    createProfile('personal');
    for (const file of ['.claude.json', '.credentials.json', 'projects/fixture-project/session.jsonl']) {
      assert.equal(existsSync(join(profileDir('personal'), file)), false, `${file} must stay in the selected account`);
    }
  });

  it('copies prompt history.jsonl into the selected account', () => {
    fixture();
    migrateDir(source, 'work', false);
    const destination = join(profileDir('work'), 'history.jsonl');
    assert.equal(existsSync(destination), true, 'history.jsonl must be copied; retaining only the source is not migration');
    assert.deepEqual(readFileSync(destination), readFileSync(join(source, 'history.jsonl')));
    assert.equal(existsSync(join(SHARED_DIR, 'history.jsonl')), false);
  });

  it('keeps CRLF, UTF-8 bytes, modes, and identical existing history intact', () => {
    fixture();
    const history = join(source, 'history.jsonl');
    const contents = Buffer.from('{"display":"fixture 한글 prompt","timestamp":2}\r\n{"display":"another fixture","timestamp":3}\r\n');
    write(history, contents, 0o640);
    const original = snapshot(history);
    migrateDir(source, 'work', false);
    assert.deepEqual(readFileSync(join(profileDir('work'), 'history.jsonl')), contents);
    if (!IS_WINDOWS) assert.equal(statSync(join(profileDir('work'), 'history.jsonl')).mode & 0o777, 0o640);
    assert.doesNotThrow(() => migrateDir(source, 'work', false));
    assert.deepEqual(readFileSync(join(profileDir('work'), 'history.jsonl')), contents);
    assert.deepEqual(snapshot(history), original);
  });

  it('rejects conflicting nonempty history without changing any existing or source data', () => {
    const original = fixture();
    createProfile('work');
    const existing = Buffer.from('{"display":"existing account history","timestamp":4}\n');
    write(join(profileDir('work'), 'history.jsonl'), existing, 0o600);
    const before = snapshot(PROFILES_DIR);
    assert.throws(() => migrateDir(source, 'work'), /Migration conflict/);
    assert.deepEqual(snapshot(PROFILES_DIR), before);
    assert.deepEqual(readFileSync(join(profileDir('work'), 'history.jsonl')), existing);
    assert.deepEqual(snapshot(source), original.source);
    assert.deepEqual(snapshot(harness), original.harness);
  });

  it('keeps linked history connected to the original file on POSIX', { skip: IS_WINDOWS }, () => {
    fixture();
    const originalHistory = join(harness, 'history.jsonl');
    write(originalHistory, readFileSync(join(source, 'history.jsonl')), 0o600);
    rmSync(join(source, 'history.jsonl'));
    symlinkSync('../fixture-harness/history.jsonl', join(source, 'history.jsonl'));
    const original = snapshot(harness);
    const sourceLink = snapshot(join(source, 'history.jsonl'));
    migrateDir(source, 'work', false);
    assert.equal(lstatSync(join(profileDir('work'), 'history.jsonl')).isSymbolicLink(), true);
    assert.equal(realpathSync(join(profileDir('work'), 'history.jsonl')), realpathSync(originalHistory));
    assert.deepEqual(readFileSync(join(profileDir('work'), 'history.jsonl')), readFileSync(originalHistory));
    assert.deepEqual(snapshot(join(source, 'history.jsonl')), sourceLink);
    assert.deepEqual(snapshot(harness), original);
  });

  it('repeated init preserves the migrated profile, source, shared files, and harness', () => {
    fixture();
    migrateDir(source, 'work');
    const before = snapshot(HOME);
    const result = spawnSync(process.execPath, [cli, 'init'], { env: process.env, encoding: 'utf8', timeout: 5000 });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /already initialized/);
    assert.deepEqual(snapshot(HOME), before);
  });

  it('cancelling init preserves synthetic credentials, history, settings, and external harness', async () => {
    const original = fixture();
    const result = await cancelInit();
    assert.equal(result.code, 0, result.stderr);
    assert.deepEqual(snapshot(source), original.source);
    assert.deepEqual(snapshot(harness), original.harness);
    assert.equal(existsSync(PROFILES_DIR), false);
  });

  it('late migration conflicts publish none of the synthetic profile data', () => {
    const original = fixture();
    createProfile('work');
    write(join(SHARED_DIR, 'settings.json'), '{"env":{"FIXTURE":"existing"}}');
    const before = snapshot(PROFILES_DIR);
    assert.throws(() => migrateDir(source, 'work'), /Migration conflict/);
    assert.deepEqual(snapshot(PROFILES_DIR), before);
    assert.deepEqual(snapshot(source), original.source);
    assert.deepEqual(snapshot(harness), original.harness);
  });

  it('a publication error restores original profile links, credentials, settings, and metadata', () => {
    const original = fixture();
    migrateDir(source, 'work');
    write(join(profileDir('work'), 'account-note.md'), '# keep this existing account file\n');
    const before = snapshot(PROFILES_DIR);
    const rename = fs.renameSync;
    mock.method(fs, 'renameSync', (from, to) => {
      if (basename(from) === 'profile' && to === profileDir('work')) throw new Error('fixture publication denied');
      return rename(from, to);
    });
    syncBuiltinESMExports();
    try {
      assert.throws(() => migrateDir(source, 'work'), /fixture publication denied/);
    } finally {
      mock.restoreAll();
      syncBuiltinESMExports();
    }
    assert.deepEqual(snapshot(PROFILES_DIR), before);
    assert.deepEqual(snapshot(source), original.source);
    assert.deepEqual(snapshot(harness), original.harness);
  });

  it('failed publication restores an empty destination history after staging new records', () => {
    const original = fixture();
    createProfile('work', false);
    write(join(profileDir('work'), 'history.jsonl'), '', 0o600);
    const before = snapshot(PROFILES_DIR);
    const rename = fs.renameSync;
    mock.method(fs, 'renameSync', (from, to) => {
      if (basename(from) === 'profile' && to === profileDir('work')) throw new Error('fixture history publication denied');
      return rename(from, to);
    });
    syncBuiltinESMExports();
    try {
      assert.throws(() => migrateDir(source, 'work', false), /fixture history publication denied/);
    } finally {
      mock.restoreAll();
      syncBuiltinESMExports();
    }
    assert.equal(readFileSync(join(profileDir('work'), 'history.jsonl')).length, 0);
    assert.deepEqual(snapshot(PROFILES_DIR), before);
    assert.deepEqual(snapshot(source), original.source);
    assert.deepEqual(snapshot(harness), original.harness);
  });

  it('rollback failure retains complete original account data in the reported backup', () => {
    const original = fixture();
    migrateDir(source, 'work');
    const profileBefore = snapshot(profileDir('work'));
    const sharedBefore = snapshot(SHARED_DIR);
    const metaBefore = snapshot(META_FILE);
    const rename = fs.renameSync;
    mock.method(fs, 'renameSync', (from, to) => {
      if (to === profileDir('work') && ['profile', 'backup-1'].includes(basename(from))) throw new Error('fixture restore denied');
      return rename(from, to);
    });
    syncBuiltinESMExports();
    let error;
    try {
      assert.throws(() => migrateDir(source, 'work'), caught => {
        error = caught;
        return /Original backups were preserved/.test(caught.message);
      });
    } finally {
      mock.restoreAll();
      syncBuiltinESMExports();
    }
    const retained = readdirSync(PROFILES_DIR).find(entry => entry.startsWith('.migration-'));
    assert.ok(retained);
    assert.ok(error.message.includes(join(PROFILES_DIR, retained)));
    assert.deepEqual(snapshot(join(PROFILES_DIR, retained, 'backup-1')), profileBefore);
    assert.deepEqual(snapshot(SHARED_DIR), sharedBefore);
    assert.deepEqual(snapshot(META_FILE), metaBefore);
    assert.deepEqual(snapshot(source), original.source);
    assert.deepEqual(snapshot(harness), original.harness);
  });

  it('Windows file-link fallback copies the newly seeded shared settings', { skip: !IS_WINDOWS }, () => {
    const original = fixture();
    createProfile('work');
    const symlink = fs.symlinkSync;
    mock.method(fs, 'symlinkSync', (target, link, type) => {
      if (type === 'file') throw Object.assign(new Error('fixture file-link denied'), { code: 'EPERM' });
      return symlink(target, link, type);
    });
    syncBuiltinESMExports();
    try {
      migrateDir(source, 'work');
    } finally {
      mock.restoreAll();
      syncBuiltinESMExports();
    }
    assert.equal(lstatSync(join(profileDir('work'), 'settings.json')).isSymbolicLink(), false);
    assert.deepEqual(readFileSync(join(profileDir('work'), 'settings.json')), readFileSync(join(source, 'settings.json')));
    assert.deepEqual(snapshot(source), original.source);
    assert.deepEqual(snapshot(harness), original.harness);
  });
});
