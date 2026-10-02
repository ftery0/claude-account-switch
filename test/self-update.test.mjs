import './helpers/home.mjs';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { markSelfUpdateChecked, maybePromptSelfUpdate, shouldCheckSelfUpdate } from '../src/lib/self-update.mjs';

describe('optional update notification', () => {
  it('checks only after the daily interval and preserves metadata', () => {
    assert.equal(shouldCheckSelfUpdate({}, 1000), true);
    const meta = markSelfUpdateChecked({ profiles: ['work'] }, 1000);
    assert.deepEqual(meta.profiles, ['work']);
    assert.equal(shouldCheckSelfUpdate(meta, 2000), false);
    assert.equal(shouldCheckSelfUpdate(meta, 1000 + 24 * 60 * 60 * 1000), true);
  });
  it('does not access the registry or metadata by default', async () => {
    const result = await maybePromptSelfUpdate({ env: {}, readMetaFn: () => assert.fail('must not read') });
    assert.deepEqual(result, { action: 'skipped', reason: 'disabled' });
  });
  it('skips opted-in notifications in noninteractive sessions', async () => {
    const result = await maybePromptSelfUpdate({ env: { CLAUDE_SWITCH_CHECK_UPDATES: '1' },
      stdin: { isTTY: false }, stdout: { isTTY: true }, computePlan: () => assert.fail('must not check') });
    assert.deepEqual(result, { action: 'skipped', reason: 'non-tty' });
  });
  it('only notifies and records a successful check', async () => {
    const output = [];
    const writes = [];
    const result = await maybePromptSelfUpdate({ env: { CLAUDE_SWITCH_CHECK_UPDATES: '1' },
      stdin: { isTTY: true }, stdout: { isTTY: true, write: text => output.push(text) }, now: 3000,
      readMetaFn: () => ({ profiles: ['work'] }), writeMetaFn: meta => writes.push(meta),
      computePlan: async () => ({ self: { latest: '99.0.0', hasUpdate: true } }),
    });
    assert.deepEqual(result, { action: 'notified' });
    assert.equal(writes[0].lastSelfUpdateCheck, new Date(3000).toISOString());
    assert.match(output.join(''), /npx claude-account-switch@latest install-shell/);
  });
  it('failed checks do not block launching or postpone retry', async () => {
    const result = await maybePromptSelfUpdate({ env: { CLAUDE_SWITCH_CHECK_UPDATES: '1' },
      stdin: { isTTY: true }, stdout: { isTTY: true }, readMetaFn: () => ({}),
      writeMetaFn: () => assert.fail('must not mark failure'), computePlan: async () => { throw new Error('offline'); },
    });
    assert.deepEqual(result, { action: 'skipped', reason: 'check-failed' });
  });
});
