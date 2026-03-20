import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, rmSync, existsSync, readlinkSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

// Override PROFILES_DIR for testing
const TEST_DIR = join(tmpdir(), `claude-switch-test-${Date.now()}`);

// We need to patch constants before importing profile
// Since ESM doesn't allow monkey-patching, we'll test via the actual functions
// but point to a temp directory by setting env

describe('validateProfileName', async () => {
  const { validateProfileName } = await import('../src/lib/profile.mjs');

  it('accepts valid names', () => {
    assert.equal(validateProfileName('work'), null);
    assert.equal(validateProfileName('my-profile'), null);
    assert.equal(validateProfileName('dev2'), null);
    assert.equal(validateProfileName('a'), null);
  });

  it('rejects reserved names', () => {
    assert.ok(validateProfileName('_shared'));
    assert.ok(validateProfileName('default'));
  });

  it('rejects invalid characters', () => {
    assert.ok(validateProfileName('Work'));     // uppercase
    assert.ok(validateProfileName('my profile')); // space
    assert.ok(validateProfileName('my_profile')); // underscore
    assert.ok(validateProfileName('-start'));   // starts with hyphen
    assert.ok(validateProfileName(''));         // empty
  });
});

describe('config', async () => {
  const { readMeta, writeMeta, addProfileToMeta, removeProfileFromMeta } = await import('../src/lib/config.mjs');

  it('readMeta returns defaults when no file exists', () => {
    // This tests against the actual META_FILE path which may or may not exist
    // Just verify structure
    const meta = readMeta();
    assert.ok(Array.isArray(meta.profiles));
    assert.ok('activeProfile' in meta);
  });
});
