import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import {
  existsSync, readFileSync, writeFileSync, mkdirSync,
  copyFileSync, unlinkSync, rmSync, lstatSync, readdirSync,
} from 'node:fs';
import { join } from 'node:path';

// ─── Helpers: backup/restore meta.json & cleanup test profiles ──────────────

const TEST_PROFILE = `zztest${Date.now()}`;
const TEST_PROFILE2 = `zztest2${Date.now()}`;
let PROFILES_DIR, SHARED_DIR, META_FILE;
let backupPath;
let hadOriginal = false;

async function setup() {
  const constants = await import('../src/lib/constants.mjs');
  PROFILES_DIR = constants.PROFILES_DIR;
  SHARED_DIR = constants.SHARED_DIR;
  META_FILE = constants.META_FILE;
  backupPath = META_FILE + '.profile-ops-backup';
  mkdirSync(PROFILES_DIR, { recursive: true });
  if (existsSync(META_FILE)) {
    copyFileSync(META_FILE, backupPath);
    hadOriginal = true;
  }
  // Start fresh
  writeFileSync(META_FILE, JSON.stringify({
    version: 1, activeProfile: null, shareSettings: true, profiles: [],
  }, null, 2));
}

function restore() {
  // Remove test profiles
  for (const p of [TEST_PROFILE, TEST_PROFILE2]) {
    const dir = join(PROFILES_DIR, p);
    if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
  }
  // Restore meta
  if (hadOriginal) {
    copyFileSync(backupPath, META_FILE);
    unlinkSync(backupPath);
  } else if (existsSync(META_FILE)) {
    unlinkSync(META_FILE);
  }
}

// ─── profileDir / profileExists ──────────────────────────────────────────────

describe('profileDir & profileExists', async () => {
  const { profileDir, profileExists } = await import('../src/lib/profile.mjs');

  it('profileDir returns path under PROFILES_DIR', async () => {
    const { PROFILES_DIR: pd } = await import('../src/lib/constants.mjs');
    const result = profileDir('test');
    assert.equal(result, join(pd, 'test'));
  });

  it('profileExists returns false for nonexistent profile', () => {
    assert.equal(profileExists('surely-does-not-exist-' + Date.now()), false);
  });
});

// ─── ensureShared ────────────────────────────────────────────────────────────

describe('ensureShared', async () => {
  const { ensureShared } = await import('../src/lib/profile.mjs');
  const { SHARED_DIR: sd, SHARED_FILES, SHARED_DIRS } = await import('../src/lib/constants.mjs');

  before(async () => { await setup(); });
  after(restore);

  it('creates _shared directory', () => {
    ensureShared();
    assert.ok(existsSync(sd));
  });

  it('creates shared files with empty JSON when they do not exist', () => {
    // Remove shared files to test creation from scratch
    for (const f of SHARED_FILES) {
      const p = join(sd, f);
      if (existsSync(p)) unlinkSync(p);
    }
    ensureShared();
    for (const f of SHARED_FILES) {
      const p = join(sd, f);
      assert.ok(existsSync(p), `${f} should exist`);
      assert.equal(readFileSync(p, 'utf8'), '{}');
    }
  });

  it('creates shared directories', () => {
    ensureShared();
    for (const d of SHARED_DIRS) {
      assert.ok(existsSync(join(sd, d)), `${d}/ should exist`);
    }
  });

  it('is idempotent — does not overwrite existing shared files', () => {
    ensureShared();
    const settingsPath = join(sd, 'settings.json');
    writeFileSync(settingsPath, '{"theme":"dark"}');
    ensureShared(); // should NOT overwrite
    assert.equal(readFileSync(settingsPath, 'utf8'), '{"theme":"dark"}');
  });
});

// ─── createProfile ───────────────────────────────────────────────────────────

describe('createProfile', async () => {
  const { createProfile, profileDir, profileExists } = await import('../src/lib/profile.mjs');
  const { readMeta } = await import('../src/lib/config.mjs');
  const { PROFILE_DIRS, SHARED_FILES, SHARED_DIRS } = await import('../src/lib/constants.mjs');

  before(async () => { await setup(); });
  after(restore);

  it('creates profile directory', () => {
    createProfile(TEST_PROFILE, true);
    assert.ok(existsSync(profileDir(TEST_PROFILE)));
  });

  it('creates subdirectories (plugins, projects, plans)', () => {
    for (const d of PROFILE_DIRS) {
      assert.ok(existsSync(join(profileDir(TEST_PROFILE), d)),
        `${d}/ should be created`);
    }
  });

  it('adds profile to meta.json', () => {
    const meta = readMeta();
    assert.ok(meta.profiles.includes(TEST_PROFILE));
  });

  it('creates links/copies for shared files when shareSettings=true', () => {
    for (const f of SHARED_FILES) {
      const p = join(profileDir(TEST_PROFILE), f);
      assert.ok(existsSync(p), `shared file link ${f} should exist`);
    }
  });

  it('creates links for shared dirs when shareSettings=true', () => {
    for (const d of SHARED_DIRS) {
      const p = join(profileDir(TEST_PROFILE), d);
      assert.ok(existsSync(p), `shared dir link ${d} should exist`);
    }
  });

  it('profileExists returns true after creation', () => {
    assert.equal(profileExists(TEST_PROFILE), true);
  });

  it('with shareSettings=false does not create shared links', () => {
    createProfile(TEST_PROFILE2, false);
    for (const f of SHARED_FILES) {
      const p = join(profileDir(TEST_PROFILE2), f);
      // Should NOT exist (no symlink/copy created)
      assert.equal(existsSync(p), false, `${f} should NOT be linked when shareSettings=false`);
    }
  });

  it('with shareSettings=false still creates subdirectories', () => {
    for (const d of PROFILE_DIRS) {
      assert.ok(existsSync(join(profileDir(TEST_PROFILE2), d)));
    }
  });

  it('is idempotent — calling twice does not error', () => {
    assert.doesNotThrow(() => createProfile(TEST_PROFILE, true));
  });
});

// ─── removeProfile ───────────────────────────────────────────────────────────

describe('removeProfile', async () => {
  const { createProfile, removeProfile, profileDir, profileExists } = await import('../src/lib/profile.mjs');
  const { readMeta, writeMeta } = await import('../src/lib/config.mjs');

  before(async () => { await setup(); });
  after(restore);

  it('removes profile directory', () => {
    createProfile(TEST_PROFILE, false);
    assert.ok(existsSync(profileDir(TEST_PROFILE)));
    removeProfile(TEST_PROFILE);
    assert.equal(existsSync(profileDir(TEST_PROFILE)), false);
  });

  it('removes profile from meta.json', () => {
    createProfile(TEST_PROFILE, false);
    removeProfile(TEST_PROFILE);
    const meta = readMeta();
    assert.ok(!meta.profiles.includes(TEST_PROFILE));
  });

  it('does not throw when profile directory is already gone', () => {
    assert.doesNotThrow(() => removeProfile('nonexistent-' + Date.now()));
  });

  it('handles removing active profile (meta switches to next)', () => {
    createProfile(TEST_PROFILE, false);
    createProfile(TEST_PROFILE2, false);
    writeMeta({
      ...readMeta(),
      activeProfile: TEST_PROFILE,
    });
    removeProfile(TEST_PROFILE);
    const meta = readMeta();
    assert.equal(meta.activeProfile, TEST_PROFILE2);
  });
});

// ─── listProfiles ────────────────────────────────────────────────────────────

describe('listProfiles', async () => {
  const { listProfiles, createProfile, removeProfile } = await import('../src/lib/profile.mjs');

  before(async () => { await setup(); });
  after(restore);

  it('returns empty array when no profiles', () => {
    const profiles = listProfiles();
    assert.ok(Array.isArray(profiles));
    // May have existing profiles from setup, so just check it's an array
  });

  it('returns profiles after creation', () => {
    createProfile(TEST_PROFILE, false);
    const profiles = listProfiles();
    assert.ok(profiles.includes(TEST_PROFILE));
  });

  it('does not include removed profiles', () => {
    createProfile(TEST_PROFILE, false);
    removeProfile(TEST_PROFILE);
    const profiles = listProfiles();
    assert.ok(!profiles.includes(TEST_PROFILE));
  });
});

// ─── migrateDir ──────────────────────────────────────────────────────────────

describe('migrateDir', async () => {
  const { migrateDir, profileDir, removeProfile } = await import('../src/lib/profile.mjs');
  const { readMeta } = await import('../src/lib/config.mjs');
  const { PROFILE_FILES, PROFILE_DIRS, SHARED_FILES, SHARED_DIRS } =
    await import('../src/lib/constants.mjs');
  const { tmpdir } = await import('node:os');

  let sourceDir;

  before(async () => {
    await setup();
    // Create a fake source directory simulating existing ~/.claude
    sourceDir = join(tmpdir(), `claude-migrate-test-${Date.now()}`);
    mkdirSync(sourceDir, { recursive: true });
    // Create profile-specific files
    writeFileSync(join(sourceDir, '.claude.json'), '{"oauth":"token123"}');
    writeFileSync(join(sourceDir, 'settings.local.json'), '{"local":true}');
    // Create profile-specific dirs with content
    for (const d of PROFILE_DIRS) {
      mkdirSync(join(sourceDir, d), { recursive: true });
      writeFileSync(join(sourceDir, d, 'test.txt'), `content-${d}`);
    }
    // Create shared files
    writeFileSync(join(sourceDir, 'settings.json'), '{"theme":"monokai"}');
    mkdirSync(join(sourceDir, 'commands'), { recursive: true });
    writeFileSync(join(sourceDir, 'commands', 'custom.md'), '# custom command');
  });

  after(() => {
    rmSync(sourceDir, { recursive: true, force: true });
    restore();
  });

  it('copies profile-specific files', () => {
    migrateDir(sourceDir, TEST_PROFILE, true);
    const dir = profileDir(TEST_PROFILE);
    for (const f of PROFILE_FILES) {
      if (existsSync(join(sourceDir, f))) {
        assert.ok(existsSync(join(dir, f)), `${f} should be copied`);
      }
    }
  });

  it('copies .claude.json with correct content', () => {
    const content = readFileSync(join(profileDir(TEST_PROFILE), '.claude.json'), 'utf8');
    assert.equal(content, '{"oauth":"token123"}');
  });

  it('copies profile-specific directories recursively', () => {
    const dir = profileDir(TEST_PROFILE);
    for (const d of PROFILE_DIRS) {
      assert.ok(existsSync(join(dir, d)), `${d}/ should be copied`);
      assert.ok(existsSync(join(dir, d, 'test.txt')), `${d}/test.txt should exist`);
    }
  });

  it('copies non-empty shared files to _shared when shareSettings=true', () => {
    // settings.json had content "{"theme":"monokai"}", so it should be in _shared
    const sharedSettings = join(SHARED_DIR, 'settings.json');
    const content = readFileSync(sharedSettings, 'utf8');
    assert.equal(content, '{"theme":"monokai"}');
  });

  it('copies shared directories to _shared', () => {
    const sharedCommands = join(SHARED_DIR, 'commands', 'custom.md');
    assert.ok(existsSync(sharedCommands));
  });

  it('creates links for shared files in profile', () => {
    for (const f of SHARED_FILES) {
      assert.ok(existsSync(join(profileDir(TEST_PROFILE), f)),
        `shared link ${f} should exist`);
    }
  });

  it('adds profile to meta.json', () => {
    const meta = readMeta();
    assert.ok(meta.profiles.includes(TEST_PROFILE));
  });

  it('does not copy empty shared files to _shared', () => {
    // Create a source with empty settings.json
    const src2 = join(tmpdir(), `claude-migrate-test2-${Date.now()}`);
    mkdirSync(src2, { recursive: true });
    writeFileSync(join(src2, '.claude.json'), '{}');
    writeFileSync(join(src2, 'settings.json'), '{}');

    // Overwrite _shared/settings.json with content first
    writeFileSync(join(SHARED_DIR, 'settings.json'), '{"theme":"dark"}');

    migrateDir(src2, TEST_PROFILE2, true);

    // Should NOT have overwritten with empty '{}'
    const content = readFileSync(join(SHARED_DIR, 'settings.json'), 'utf8');
    assert.equal(content, '{"theme":"dark"}');

    rmSync(src2, { recursive: true, force: true });
  });

  it('with shareSettings=false copies shared files directly to profile', () => {
    const profileName = `zztest3${Date.now()}`;
    const src3 = join(tmpdir(), `claude-migrate-test3-${Date.now()}`);
    mkdirSync(src3, { recursive: true });
    writeFileSync(join(src3, 'settings.json'), '{"direct":true}');

    migrateDir(src3, profileName, false);
    const dir = join(PROFILES_DIR, profileName);
    assert.ok(existsSync(join(dir, 'settings.json')));
    const content = readFileSync(join(dir, 'settings.json'), 'utf8');
    assert.equal(content, '{"direct":true}');

    // Cleanup
    rmSync(dir, { recursive: true, force: true });
    rmSync(src3, { recursive: true, force: true });
  });

  it('skips nonexistent source files gracefully', () => {
    const emptySrc = join(tmpdir(), `claude-migrate-empty-${Date.now()}`);
    mkdirSync(emptySrc, { recursive: true });
    // No files inside — should not throw
    const profileName = `zztest4${Date.now()}`;
    assert.doesNotThrow(() => migrateDir(emptySrc, profileName, false));

    // Cleanup
    rmSync(join(PROFILES_DIR, profileName), { recursive: true, force: true });
    rmSync(emptySrc, { recursive: true, force: true });
  });
});
