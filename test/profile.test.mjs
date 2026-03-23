import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// ─── validateProfileName ─────────────────────────────────────────────────────

describe('validateProfileName', async () => {
  const { validateProfileName } = await import('../src/lib/profile.mjs');

  // ── Valid names ──

  it('accepts single lowercase letter', () => {
    assert.equal(validateProfileName('a'), null);
    assert.equal(validateProfileName('z'), null);
  });

  it('accepts single digit', () => {
    assert.equal(validateProfileName('0'), null);
    assert.equal(validateProfileName('9'), null);
  });

  it('accepts common profile names', () => {
    assert.equal(validateProfileName('work'), null);
    assert.equal(validateProfileName('personal'), null);
    assert.equal(validateProfileName('staging'), null);
    assert.equal(validateProfileName('dev2'), null);
  });

  it('accepts names with hyphens in the middle', () => {
    assert.equal(validateProfileName('my-profile'), null);
    assert.equal(validateProfileName('work-prod'), null);
    assert.equal(validateProfileName('a-b-c'), null);
    assert.equal(validateProfileName('a1-b2-c3'), null);
  });

  it('accepts maximum length name (30 chars)', () => {
    assert.equal(validateProfileName('a'.repeat(30)), null);
    assert.equal(validateProfileName('a' + 'b'.repeat(28) + 'c'), null);
  });

  it('accepts two-character names', () => {
    assert.equal(validateProfileName('ab'), null);
    assert.equal(validateProfileName('a1'), null);
    assert.equal(validateProfileName('1a'), null);
  });

  // ── Invalid: empty / length ──

  it('rejects empty string', () => {
    assert.ok(validateProfileName(''));
    assert.match(validateProfileName(''), /empty/i);
  });

  it('rejects undefined/null (falsy)', () => {
    assert.ok(validateProfileName(undefined));
    assert.ok(validateProfileName(null));
    assert.ok(validateProfileName(''));
  });

  it('rejects names exceeding max length', () => {
    assert.ok(validateProfileName('a'.repeat(31)));
    assert.ok(validateProfileName('a'.repeat(100)));
    assert.match(validateProfileName('a'.repeat(31)), /30/);
  });

  // ── Invalid: reserved names ──

  it('rejects _shared', () => {
    const err = validateProfileName('_shared');
    assert.ok(err);
    assert.match(err, /reserved/i);
  });

  it('rejects default', () => {
    const err = validateProfileName('default');
    assert.ok(err);
    assert.match(err, /reserved/i);
  });

  // ── Invalid: character rules ──

  it('rejects uppercase letters', () => {
    assert.ok(validateProfileName('Work'));
    assert.ok(validateProfileName('WORK'));
    assert.ok(validateProfileName('wOrK'));
  });

  it('rejects spaces', () => {
    assert.ok(validateProfileName('my profile'));
    assert.ok(validateProfileName(' work'));
    assert.ok(validateProfileName('work '));
  });

  it('rejects underscores', () => {
    assert.ok(validateProfileName('my_profile'));
    assert.ok(validateProfileName('_test'));
  });

  it('rejects names starting with hyphen', () => {
    assert.ok(validateProfileName('-start'));
    assert.ok(validateProfileName('-'));
    assert.ok(validateProfileName('--double'));
  });

  it('rejects names ending with hyphen', () => {
    assert.ok(validateProfileName('work-'));
    assert.ok(validateProfileName('my-profile-'));
  });

  it('rejects special characters', () => {
    assert.ok(validateProfileName('work!'));
    assert.ok(validateProfileName('work@home'));
    assert.ok(validateProfileName('profile.v2'));
    assert.ok(validateProfileName('user/admin'));
    assert.ok(validateProfileName('a+b'));
    assert.ok(validateProfileName('a=b'));
    assert.ok(validateProfileName('a&b'));
  });

  it('rejects unicode characters', () => {
    assert.ok(validateProfileName('프로필'));
    assert.ok(validateProfileName('café'));
    assert.ok(validateProfileName('naïve'));
  });

  it('rejects whitespace-only input', () => {
    assert.ok(validateProfileName('   '));
    assert.ok(validateProfileName('\t'));
    assert.ok(validateProfileName('\n'));
  });

  it('rejects dots', () => {
    assert.ok(validateProfileName('.'));
    assert.ok(validateProfileName('..'));
    assert.ok(validateProfileName('.hidden'));
  });

  // ── Edge: single hyphen ──

  it('rejects single hyphen (starts and ends with it)', () => {
    assert.ok(validateProfileName('-'));
  });

  // ── Double hyphens (valid per regex) ──

  it('accepts double hyphens in the middle', () => {
    assert.equal(validateProfileName('a--b'), null);
    assert.equal(validateProfileName('work--staging'), null);
  });
});
