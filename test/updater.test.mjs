import './helpers/home.mjs';
import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { parseSemver, compareSemver, fetchLatestVersion, computeUpdatePlan } from '../src/lib/updater.mjs';

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });

describe('package versions', () => {
  it('parses stable, prerelease, and build metadata', () => {
    assert.deepEqual(parseSemver('1.2.3'), { major: 1, minor: 2, patch: 3, pre: null });
    assert.equal(parseSemver('1.2.3-rc.2+build.5').pre, 'rc.2');
    for (const value of [null, '', 'invalid', '1.2']) assert.throws(() => parseSemver(value));
  });
  it('compares release and numeric prerelease components correctly', () => {
    for (const [a, b, expected] of [
      ['1.0.0', '1.0.0', 0], ['1.0.0', '2.0.0', -1], ['2.0.0', '1.0.0', 1],
      ['1.0.0', '1.1.0', -1], ['1.0.1', '1.0.0', 1], ['1.0.0-rc.1', '1.0.0', -1],
      ['1.0.0-rc.9', '1.0.0-rc.10', -1], ['1.0.0-alpha', '1.0.0-beta', -1],
      ['1.0.0-alpha', '1.0.0-alpha.1', -1], ['1.0.0-1', '1.0.0-alpha', -1],
    ]) assert.equal(compareSemver(a, b), expected);
  });
  it('reads the registry version', async () => {
    globalThis.fetch = async () => ({ ok: true, json: async () => ({ version: '99.0.0' }) });
    assert.equal(await fetchLatestVersion(), '99.0.0');
  });
  it('rejects unavailable, malformed, and unreachable registry responses', async () => {
    globalThis.fetch = async () => ({ ok: false, status: 404 });
    await assert.rejects(fetchLatestVersion(), /HTTP 404/);
    globalThis.fetch = async () => ({ ok: true, json: async () => ({ version: 'invalid' }) });
    await assert.rejects(fetchLatestVersion(), /Invalid version/);
    globalThis.fetch = async () => { throw new Error('offline'); };
    await assert.rejects(fetchLatestVersion(), /Could not reach/);
  });
  it('only checks this package and detects newer or older registry versions', async () => {
    const seen = [];
    const updated = await computeUpdatePlan({ fetchVersion: async pkg => { seen.push(pkg); return '99.0.0'; } });
    assert.equal(updated.self.hasUpdate, true);
    assert.deepEqual(seen, ['claude-account-switch']);
    assert.equal(updated.claude, undefined);
    const current = await computeUpdatePlan({ fetchVersion: async () => '0.0.1' });
    assert.equal(current.self.hasUpdate, false);
  });
});
