import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import {
  readFileSync, writeFileSync, existsSync, copyFileSync,
  unlinkSync, mkdirSync,
} from 'node:fs';
import { dirname } from 'node:path';

// ─── Single setup / teardown for entire file ─────────────────────────────────
// All tests share one backup of meta.json to avoid file-locking races on Windows.

let META_FILE;
let backupPath;
let hadOriginal = false;

before(async () => {
  const { META_FILE: mf } = await import('../src/lib/constants.mjs');
  META_FILE = mf;
  backupPath = META_FILE + '.config-test-backup';
  mkdirSync(dirname(META_FILE), { recursive: true });
  if (existsSync(META_FILE)) {
    copyFileSync(META_FILE, backupPath);
    hadOriginal = true;
  }
});

after(() => {
  if (hadOriginal && existsSync(backupPath)) {
    copyFileSync(backupPath, META_FILE);
    unlinkSync(backupPath);
  } else if (!hadOriginal && existsSync(META_FILE)) {
    unlinkSync(META_FILE);
  }
});

// ─── readMeta ────────────────────────────────────────────────────────────────

describe('readMeta', async () => {
  const { readMeta } = await import('../src/lib/config.mjs');

  it('returns default structure', () => {
    const meta = readMeta();
    assert.ok(Array.isArray(meta.profiles));
    assert.ok('activeProfile' in meta);
    assert.ok('version' in meta);
    assert.ok('shareSettings' in meta);
  });

  it('returns defaults when meta.json is missing', () => {
    if (existsSync(META_FILE)) unlinkSync(META_FILE);
    const meta = readMeta();
    assert.deepEqual(meta.profiles, []);
    assert.equal(meta.activeProfile, null);
    assert.equal(meta.version, 1);
    assert.equal(meta.shareSettings, true);
  });

  it('returns defaults when meta.json is corrupt', () => {
    writeFileSync(META_FILE, 'this is not json {{{');
    const meta = readMeta();
    assert.deepEqual(meta.profiles, []);
    assert.equal(meta.activeProfile, null);
  });

  it('returns defaults when meta.json is empty', () => {
    writeFileSync(META_FILE, '');
    const meta = readMeta();
    assert.deepEqual(meta.profiles, []);
  });

  it('handles BOM-prefixed JSON (PowerShell 5.1 UTF-8)', () => {
    const content = { version: 1, activeProfile: 'work', shareSettings: true, profiles: ['work'] };
    writeFileSync(META_FILE, '\uFEFF' + JSON.stringify(content));
    const meta = readMeta();
    assert.equal(meta.activeProfile, 'work');
    assert.deepEqual(meta.profiles, ['work']);
  });

  it('handles JSON with Windows line endings (\\r\\n)', () => {
    const json = '{\r\n  "version": 1,\r\n  "activeProfile": "test",\r\n  "shareSettings": true,\r\n  "profiles": ["test"]\r\n}';
    writeFileSync(META_FILE, json);
    const meta = readMeta();
    assert.equal(meta.activeProfile, 'test');
  });

  it('preserves extra fields in meta.json', () => {
    const content = { version: 1, activeProfile: 'a', shareSettings: true, profiles: ['a'], customField: 42 };
    writeFileSync(META_FILE, JSON.stringify(content));
    const meta = readMeta();
    assert.equal(meta.customField, 42);
  });
});

// ─── writeMeta ───────────────────────────────────────────────────────────────

describe('writeMeta', async () => {
  const { readMeta, writeMeta } = await import('../src/lib/config.mjs');

  it('creates valid JSON file', () => {
    const data = { version: 1, activeProfile: 'work', shareSettings: true, profiles: ['work'] };
    writeMeta(data);
    const raw = readFileSync(META_FILE, 'utf8');
    assert.doesNotThrow(() => JSON.parse(raw));
  });

  it('roundtrip: writeMeta then readMeta returns same data', () => {
    const data = { version: 1, activeProfile: 'dev', shareSettings: false, profiles: ['dev', 'prod'] };
    writeMeta(data);
    const result = readMeta();
    assert.equal(result.activeProfile, 'dev');
    assert.equal(result.shareSettings, false);
    assert.deepEqual(result.profiles, ['dev', 'prod']);
  });

  it('uses pretty-printed JSON (2-space indent)', () => {
    writeMeta({ version: 1, activeProfile: null, shareSettings: true, profiles: [] });
    const raw = readFileSync(META_FILE, 'utf8');
    assert.ok(raw.includes('  "version"'));
  });

  it('ends with a trailing newline', () => {
    writeMeta({ version: 1, activeProfile: null, shareSettings: true, profiles: [] });
    const raw = readFileSync(META_FILE, 'utf8');
    assert.ok(raw.endsWith('\n'));
  });

  it('creates parent directory if missing', () => {
    writeMeta({ version: 1, activeProfile: null, shareSettings: true, profiles: [] });
    assert.ok(existsSync(META_FILE));
  });
});

// ─── addProfileToMeta ────────────────────────────────────────────────────────

describe('addProfileToMeta', async () => {
  const { readMeta, writeMeta, addProfileToMeta } = await import('../src/lib/config.mjs');

  it('adds a new profile to the list', () => {
    writeMeta({ version: 1, activeProfile: null, shareSettings: true, profiles: [] });
    addProfileToMeta('alpha');
    const meta = readMeta();
    assert.ok(meta.profiles.includes('alpha'));
  });

  it('is idempotent — does not duplicate', () => {
    writeMeta({ version: 1, activeProfile: null, shareSettings: true, profiles: [] });
    addProfileToMeta('alpha');
    addProfileToMeta('alpha');
    const meta = readMeta();
    assert.equal(meta.profiles.filter(p => p === 'alpha').length, 1);
  });

  it('adds multiple different profiles', () => {
    writeMeta({ version: 1, activeProfile: null, shareSettings: true, profiles: [] });
    addProfileToMeta('beta');
    addProfileToMeta('gamma');
    const meta = readMeta();
    assert.ok(meta.profiles.includes('beta'));
    assert.ok(meta.profiles.includes('gamma'));
  });
});

// ─── removeProfileFromMeta ───────────────────────────────────────────────────

describe('removeProfileFromMeta', async () => {
  const { readMeta, writeMeta, removeProfileFromMeta } = await import('../src/lib/config.mjs');

  it('removes profile from list', () => {
    writeMeta({ version: 1, activeProfile: 'a', shareSettings: true, profiles: ['a', 'b', 'c'] });
    removeProfileFromMeta('b');
    const meta = readMeta();
    assert.ok(!meta.profiles.includes('b'));
    assert.deepEqual(meta.profiles, ['a', 'c']);
  });

  it('switches active profile when removing the active one', () => {
    writeMeta({ version: 1, activeProfile: 'a', shareSettings: true, profiles: ['a', 'b'] });
    removeProfileFromMeta('a');
    const meta = readMeta();
    assert.equal(meta.activeProfile, 'b');
  });

  it('sets activeProfile to null when removing last profile', () => {
    writeMeta({ version: 1, activeProfile: 'only', shareSettings: true, profiles: ['only'] });
    removeProfileFromMeta('only');
    const meta = readMeta();
    assert.equal(meta.activeProfile, null);
    assert.deepEqual(meta.profiles, []);
  });

  it('does not change activeProfile when removing non-active', () => {
    writeMeta({ version: 1, activeProfile: 'a', shareSettings: true, profiles: ['a', 'b'] });
    removeProfileFromMeta('b');
    const meta = readMeta();
    assert.equal(meta.activeProfile, 'a');
  });

  it('no-ops for profile that does not exist', () => {
    writeMeta({ version: 1, activeProfile: 'a', shareSettings: true, profiles: ['a'] });
    removeProfileFromMeta('nonexistent');
    const meta = readMeta();
    assert.deepEqual(meta.profiles, ['a']);
  });
});

// ─── setActiveProfile / getActiveProfile ─────────────────────────────────────

describe('setActiveProfile & getActiveProfile', async () => {
  const { writeMeta, setActiveProfile, getActiveProfile } = await import('../src/lib/config.mjs');

  it('sets and gets the active profile', () => {
    writeMeta({ version: 1, activeProfile: 'a', shareSettings: true, profiles: ['a', 'b', 'c'] });
    setActiveProfile('b');
    assert.equal(getActiveProfile(), 'b');
  });

  it('throws for nonexistent profile', () => {
    writeMeta({ version: 1, activeProfile: 'a', shareSettings: true, profiles: ['a'] });
    assert.throws(() => setActiveProfile('nonexistent'), /does not exist/);
  });

  it('can switch back and forth', () => {
    writeMeta({ version: 1, activeProfile: 'a', shareSettings: true, profiles: ['a', 'b'] });
    setActiveProfile('b');
    assert.equal(getActiveProfile(), 'b');
    setActiveProfile('a');
    assert.equal(getActiveProfile(), 'a');
  });

  it('returns null when no active profile', () => {
    writeMeta({ version: 1, activeProfile: null, shareSettings: true, profiles: [] });
    assert.equal(getActiveProfile(), null);
  });
});
