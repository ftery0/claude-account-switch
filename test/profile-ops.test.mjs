import './helpers/home.mjs';
import { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import fs, {
  existsSync, readFileSync, writeFileSync, mkdirSync, rmSync, lstatSync,
  readdirSync, readlinkSync, symlinkSync, statSync, realpathSync,
} from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
import { join, basename } from 'node:path';
import {
  HOME, PROFILES_DIR, SHARED_DIR, PROFILE_FILES, PROFILE_DIRS, SHARED_FILES, SHARED_DIRS,
} from '../src/lib/constants.mjs';
import {
  createProfile, ensureShared, profileDir, profileExists, removeProfile,
  listProfiles, migrateDir, migrationSource,
} from '../src/lib/profile.mjs';
import { readMeta, writeMeta } from '../src/lib/config.mjs';

const source = join(HOME, 'source');

function write(path, value) {
  mkdirSync(join(path, '..'), { recursive: true });
  writeFileSync(path, value);
}

function snapshot(path) {
  if (!existsSync(path)) return null;
  const info = lstatSync(path);
  if (info.isSymbolicLink()) return { link: readlinkSync(path) };
  if (info.isFile()) return readFileSync(path, 'utf8');
  return Object.fromEntries(readdirSync(path).sort().map(entry => [entry, snapshot(join(path, entry))]));
}

beforeEach(() => {
  for (const entry of readdirSync(HOME)) rmSync(join(HOME, entry), { recursive: true, force: true });
  delete process.env.CLAUDE_CONFIG_DIR;
  mkdirSync(source);
});

describe('profile operations', () => {
  it('creates shared placeholders and preserves existing settings', () => {
    ensureShared();
    for (const file of SHARED_FILES) assert.equal(readFileSync(join(SHARED_DIR, file), 'utf8'), '{}');
    for (const entry of SHARED_DIRS) assert.ok(statSync(join(SHARED_DIR, entry)).isDirectory());
    write(join(SHARED_DIR, 'settings.json'), '{"theme":"dark"}');
    ensureShared();
    assert.equal(readFileSync(join(SHARED_DIR, 'settings.json'), 'utf8'), '{"theme":"dark"}');
  });

  it('creates linked shared settings and private account directories', () => {
    createProfile('work');
    assert.equal(profileDir('work'), join(PROFILES_DIR, 'work'));
    assert.equal(profileExists('work'), true);
    for (const entry of [...SHARED_FILES, ...SHARED_DIRS]) assert.ok(existsSync(join(profileDir('work'), entry)));
    for (const entry of PROFILE_DIRS) assert.ok(statSync(join(profileDir('work'), entry)).isDirectory());
    assert.deepEqual(listProfiles(), ['work']);
    const before = snapshot(PROFILES_DIR);
    createProfile('work');
    assert.deepEqual(snapshot(PROFILES_DIR), before);
  });

  it('creates independent profiles without shared links', () => {
    createProfile('personal', false);
    for (const entry of [...SHARED_FILES, ...SHARED_DIRS]) assert.equal(existsSync(join(profileDir('personal'), entry)), false);
    assert.equal(existsSync(SHARED_DIR), false);
    for (const entry of PROFILE_DIRS) assert.ok(existsSync(join(profileDir('personal'), entry)));
  });

  it('removes a selected profile and chooses the next active profile', () => {
    createProfile('work', false);
    createProfile('personal', false);
    writeMeta({ ...readMeta(), activeProfile: 'work' });
    removeProfile('work');
    assert.equal(profileExists('work'), false);
    assert.deepEqual(listProfiles(), ['personal']);
    assert.equal(readMeta().activeProfile, 'personal');
    assert.doesNotThrow(() => removeProfile('missing'));
  });

  it('rejects invalid profile names before creating files', () => {
    assert.throws(() => createProfile('../outside'), /lowercase/);
    assert.equal(existsSync(PROFILES_DIR), false);
  });
});

describe('migration data preservation', () => {
  it('copies user data and shares only settings and commands', () => {
    for (const file of PROFILE_FILES) write(join(source, file), file.endsWith('.json') ? '{"saved":true}' : '# user rules');
    for (const entry of PROFILE_DIRS) write(join(source, entry, 'saved.txt'), entry);
    write(join(source, 'settings.json'), '{"theme":"dark"}');
    write(join(source, 'commands', 'custom.md'), '# command');
    const original = snapshot(source);
    migrateDir(source, 'work');
    for (const file of PROFILE_FILES) assert.equal(readFileSync(join(profileDir('work'), file), 'utf8'), original[file]);
    for (const entry of PROFILE_DIRS) {
      assert.equal(readFileSync(join(profileDir('work'), entry, 'saved.txt'), 'utf8'), entry);
      assert.equal(lstatSync(join(profileDir('work'), entry)).isSymbolicLink(), false);
    }
    assert.equal(readFileSync(join(SHARED_DIR, 'settings.json'), 'utf8'), '{"theme":"dark"}');
    assert.equal(readFileSync(join(SHARED_DIR, 'commands', 'custom.md'), 'utf8'), '# command');
    assert.deepEqual(snapshot(source), original);
    assert.deepEqual(listProfiles(), ['work']);
    if (process.platform !== 'win32') {
      for (const file of ['.claude.json', '.credentials.json']) assert.equal(statSync(join(profileDir('work'), file)).mode & 0o777, 0o600);
    }
  });

  it('copies independent settings and allows missing optional data', () => {
    write(join(source, 'settings.json'), '{"direct":true}');
    migrateDir(source, 'work', false);
    assert.equal(readFileSync(join(profileDir('work'), 'settings.json'), 'utf8'), '{"direct":true}');
    assert.equal(existsSync(SHARED_DIR), false);
    assert.doesNotThrow(() => migrateDir(source, 'work', false));
  });

  it('seeds an empty history file without sharing or erasing another account history', () => {
    createProfile('work');
    createProfile('personal');
    write(join(profileDir('work'), 'history.jsonl'), '');
    write(join(profileDir('personal'), 'history.jsonl'), '{"display":"personal fixture"}\n');
    write(join(source, 'history.jsonl'), '{"display":"work fixture"}\n');
    migrateDir(source, 'work');
    assert.equal(readFileSync(join(profileDir('work'), 'history.jsonl'), 'utf8'), '{"display":"work fixture"}\n');
    assert.equal(readFileSync(join(profileDir('personal'), 'history.jsonl'), 'utf8'), '{"display":"personal fixture"}\n');
    assert.equal(existsSync(join(SHARED_DIR, 'history.jsonl')), false);
  });

  it('seeds an empty shared destination and permits identical repeated migration', () => {
    createProfile('work');
    write(join(source, '.claude.json'), '{"account":"work"}');
    write(join(source, 'settings.json'), '{"theme":"dark"}');
    write(join(source, 'commands', 'custom.md'), '# command');
    migrateDir(source, 'work');
    const before = snapshot(PROFILES_DIR);
    migrateDir(source, 'work');
    assert.deepEqual(snapshot(PROFILES_DIR), before);
  });

  it('accepts source links to identical existing shared settings and commands', { skip: process.platform === 'win32' }, () => {
    createProfile('work');
    write(join(SHARED_DIR, 'settings.json'), '{"theme":"shared"}');
    write(join(SHARED_DIR, 'commands', 'custom.md'), '# shared command');
    symlinkSync(join(SHARED_DIR, 'settings.json'), join(source, 'settings.json'));
    symlinkSync(join(SHARED_DIR, 'commands'), join(source, 'commands'));
    migrateDir(source, 'personal');
    assert.equal(readFileSync(join(profileDir('personal'), 'settings.json'), 'utf8'), '{"theme":"shared"}');
    assert.equal(readFileSync(join(profileDir('personal'), 'commands', 'custom.md'), 'utf8'), '# shared command');
  });

  it('accepts a source directory link or Windows junction to existing shared commands', () => {
    createProfile('work');
    write(join(SHARED_DIR, 'commands', 'custom.md'), '# shared command');
    symlinkSync(join(SHARED_DIR, 'commands'), join(source, 'commands'), process.platform === 'win32' ? 'junction' : 'dir');
    const original = snapshot(source);
    migrateDir(source, 'personal');
    assert.equal(readFileSync(join(profileDir('personal'), 'commands', 'custom.md'), 'utf8'), '# shared command');
    assert.deepEqual(snapshot(source), original);
  });

  it('does not replace populated shared data from another account', () => {
    createProfile('work');
    write(join(SHARED_DIR, 'settings.json'), '{"theme":"work"}');
    write(join(source, '.claude.json'), '{"account":"personal"}');
    write(join(source, 'settings.json'), '{"theme":"personal"}');
    const before = snapshot(PROFILES_DIR);
    assert.throws(() => migrateDir(source, 'personal'), /Migration conflict/);
    assert.deepEqual(snapshot(PROFILES_DIR), before);
    assert.equal(profileExists('personal'), false);
  });

  it('does not merge different populated shared command directories', () => {
    createProfile('work');
    write(join(SHARED_DIR, 'commands', 'work.md'), 'work');
    write(join(source, 'commands', 'personal.md'), 'personal');
    const before = snapshot(PROFILES_DIR);
    assert.throws(() => migrateDir(source, 'personal'), /Migration conflict/);
    assert.deepEqual(snapshot(PROFILES_DIR), before);
  });

  it('empty shared settings cannot erase existing settings', () => {
    createProfile('work');
    write(join(SHARED_DIR, 'settings.json'), '{"theme":"dark"}');
    write(join(source, 'settings.json'), '{}');
    migrateDir(source, 'personal');
    assert.equal(readFileSync(join(SHARED_DIR, 'settings.json'), 'utf8'), '{"theme":"dark"}');
  });

  it('rejects different profile credentials and preserves all previous data', () => {
    createProfile('work');
    write(join(profileDir('work'), '.claude.json'), '{"account":"original"}');
    write(join(source, '.claude.json'), '{"account":"different"}');
    const before = snapshot(PROFILES_DIR);
    assert.throws(() => migrateDir(source, 'work'), /Migration conflict/);
    assert.deepEqual(snapshot(PROFILES_DIR), before);
  });

  it('a late shared conflict leaves previously staged profile files unpublished', () => {
    createProfile('work');
    write(join(SHARED_DIR, 'commands', 'original.md'), 'original');
    write(join(source, '.claude.json'), '{"account":"work"}');
    write(join(source, 'skills', 'new', 'SKILL.md'), '# new skill');
    write(join(source, 'commands', 'different.md'), 'different');
    const before = snapshot(PROFILES_DIR);
    assert.throws(() => migrateDir(source, 'work'), /Migration conflict/);
    assert.deepEqual(snapshot(PROFILES_DIR), before);
  });

  it('invalid JSON stops migration without changing source, profile, or shared data', () => {
    createProfile('work');
    write(join(source, '.claude.json'), '{"account":"work"}');
    write(join(source, 'settings.json'), '{broken');
    const before = snapshot(PROFILES_DIR);
    const original = snapshot(source);
    assert.throws(() => migrateDir(source, 'work'), /Invalid JSON/);
    assert.deepEqual(snapshot(PROFILES_DIR), before);
    assert.deepEqual(snapshot(source), original);
  });

  it('a copy failure leaves all existing data intact', () => {
    createProfile('work');
    write(join(source, '.claude.json'), '{"account":"work"}');
    write(join(source, 'skills', 'broken', 'SKILL.md'), '# unreadable');
    const before = snapshot(PROFILES_DIR);
    const copy = fs.copyFileSync;
    mock.method(fs, 'copyFileSync', (from, to, ...args) => {
      if (from.endsWith('SKILL.md')) throw new Error('simulated copy failure');
      return copy(from, to, ...args);
    });
    syncBuiltinESMExports();
    try {
      assert.throws(() => migrateDir(source, 'work'), /simulated copy failure/);
    } finally {
      mock.restoreAll();
      syncBuiltinESMExports();
    }
    assert.deepEqual(snapshot(PROFILES_DIR), before);
    assert.equal(readFileSync(join(source, 'skills', 'broken', 'SKILL.md'), 'utf8'), '# unreadable');
  });

  it('rolls back shared publication when profile publication fails', () => {
    createProfile('work');
    write(join(source, '.claude.json'), '{"account":"work"}');
    write(join(source, 'settings.json'), '{"theme":"new"}');
    const before = snapshot(PROFILES_DIR);
    const rename = fs.renameSync;
    mock.method(fs, 'renameSync', (from, to) => {
      if (basename(from) === 'profile' && to === profileDir('work')) throw new Error('simulated publish failure');
      return rename(from, to);
    });
    syncBuiltinESMExports();
    try {
      assert.throws(() => migrateDir(source, 'work'), /simulated publish failure/);
    } finally {
      mock.restoreAll();
      syncBuiltinESMExports();
    }
    assert.deepEqual(snapshot(PROFILES_DIR), before);
  });

  it('preserves original backups if the filesystem also prevents rollback', () => {
    createProfile('work');
    write(join(profileDir('work'), 'CLAUDE.md'), '# original account instructions');
    write(join(source, '.claude.json'), '{"account":"work"}');
    write(join(source, 'settings.json'), '{"theme":"new"}');
    const originalSettings = readFileSync(join(SHARED_DIR, 'settings.json'), 'utf8');
    const rename = fs.renameSync;
    mock.method(fs, 'renameSync', (from, to) => {
      if (to === profileDir('work') && ['profile', 'backup-1'].includes(basename(from))) {
        throw new Error('simulated destination unavailable');
      }
      return rename(from, to);
    });
    syncBuiltinESMExports();
    try {
      assert.throws(() => migrateDir(source, 'work'), /Original backups were preserved/);
    } finally {
      mock.restoreAll();
      syncBuiltinESMExports();
    }
    const retained = readdirSync(PROFILES_DIR).find(entry => entry.startsWith('.migration-'));
    assert.ok(retained);
    assert.equal(readFileSync(join(PROFILES_DIR, retained, 'backup-1', 'CLAUDE.md'), 'utf8'), '# original account instructions');
    assert.equal(readFileSync(join(SHARED_DIR, 'settings.json'), 'utf8'), originalSettings);
    assert.equal(readFileSync(join(source, '.claude.json'), 'utf8'), '{"account":"work"}');
  });
});

describe('migration source boundaries', () => {
  it('reads the root user config when default directory is absent', () => {
    write(join(HOME, '.claude.json'), '{"account":"default"}');
    const defaultDir = join(HOME, '.claude');
    assert.equal(migrationSource(defaultDir).userConfig, join(HOME, '.claude.json'));
    migrateDir(defaultDir, 'work', false);
    assert.equal(readFileSync(join(profileDir('work'), '.claude.json'), 'utf8'), '{"account":"default"}');
  });

  it('uses the configured directory config even when it is ~/.claude', () => {
    const configured = join(HOME, '.claude');
    process.env.CLAUDE_CONFIG_DIR = configured;
    write(join(HOME, '.claude.json'), '{"account":"root"}');
    write(join(configured, '.claude.json'), '{"account":"configured"}');
    migrateDir(configured, 'work', false);
    assert.equal(readFileSync(join(profileDir('work'), '.claude.json'), 'utf8'), '{"account":"configured"}');
  });

  it('preserves actual targets of relative file and directory symlinks', { skip: process.platform === 'win32' }, () => {
    write(join(HOME, 'external', 'SKILL.md'), '# linked skill');
    write(join(HOME, 'global.md'), '# global rules');
    mkdirSync(join(source, 'skills'));
    symlinkSync('../../external', join(source, 'skills', 'linked'));
    symlinkSync('../global.md', join(source, 'CLAUDE.md'));
    migrateDir(source, 'work', false);
    assert.equal(readlinkSync(join(profileDir('work'), 'skills', 'linked')), realpathSync(join(HOME, 'external')));
    assert.equal(readlinkSync(join(profileDir('work'), 'CLAUDE.md')), realpathSync(join(HOME, 'global.md')));
    assert.equal(readFileSync(join(profileDir('work'), 'skills', 'linked', 'SKILL.md'), 'utf8'), '# linked skill');
  });

  it('rejects source/target overlap including real symlink or junction aliases', () => {
    createProfile('work', false);
    const before = snapshot(PROFILES_DIR);
    assert.throws(() => migrateDir(profileDir('work'), 'work', false), /overlap/);
    assert.throws(() => migrateDir(HOME, 'work', false), /overlap/);
    const nested = join(profileDir('work'), 'nested');
    mkdirSync(nested);
    assert.throws(() => migrateDir(nested, 'work', false), /overlap/);
    rmSync(nested, { recursive: true });
    symlinkSync(profileDir('work'), join(HOME, 'alias'), process.platform === 'win32' ? 'junction' : 'dir');
    assert.throws(() => migrateDir(join(HOME, 'alias'), 'work', false), /overlap/);
    assert.deepEqual(snapshot(PROFILES_DIR), before);
  });

  it('rejects nonexistent sources and files before writing profiles', () => {
    assert.throws(() => migrateDir(join(HOME, 'missing'), 'work'), /not found/);
    write(join(HOME, 'file'), '{}');
    assert.throws(() => migrateDir(join(HOME, 'file'), 'work'), /must be a directory/);
    assert.equal(existsSync(PROFILES_DIR), false);
  });
});
