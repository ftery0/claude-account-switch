import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  markSelfUpdateChecked,
  maybePromptSelfUpdate,
  shouldCheckSelfUpdate,
} from '../src/lib/self-update.mjs';

describe('self update prompt', () => {
  it('checks when there is no previous check timestamp', () => {
    assert.equal(shouldCheckSelfUpdate({}, 1000), true);
  });

  it('skips checks inside the 24 hour window', () => {
    const meta = { lastSelfUpdateCheck: new Date(1000).toISOString() };
    assert.equal(shouldCheckSelfUpdate(meta, 1000 + 60_000), false);
  });

  it('marks the last check timestamp without dropping existing meta fields', () => {
    const marked = markSelfUpdateChecked({ profiles: ['work'] }, 2000);
    assert.deepEqual(marked.profiles, ['work']);
    assert.equal(marked.lastSelfUpdateCheck, new Date(2000).toISOString());
  });

  it('does not prompt in non-TTY sessions', async () => {
    let planned = false;
    const result = await maybePromptSelfUpdate({
      stdin: { isTTY: false },
      stdout: { isTTY: true },
      computePlan: async () => { planned = true; },
    });
    assert.deepEqual(result, { action: 'skipped', reason: 'non-tty' });
    assert.equal(planned, false);
  });

  it('prompts, installs, and refreshes shell integration when accepted', async () => {
    const writes = [];
    const installs = [];
    let refreshed = false;

    const result = await maybePromptSelfUpdate({
      stdin: { isTTY: true },
      stdout: { isTTY: true },
      now: 3000,
      readMetaFn: () => ({ profiles: ['work'] }),
      writeMetaFn: meta => writes.push(meta),
      computePlan: async () => ({
        self: {
          installed: '1.2.3',
          latest: '1.2.4',
          hasUpdate: true,
          isDev: false,
          pm: 'npm',
          needsSudo: false,
        },
        warnings: [],
        errors: [],
      }),
      confirmFn: async () => true,
      runInstallFn: async (cmd) => {
        installs.push(cmd);
        return 0;
      },
      runShellRefreshFn: async () => {
        refreshed = true;
        return 0;
      },
    });

    assert.equal(result.action, 'updated');
    assert.equal(result.shouldExit, true);
    assert.equal(writes[0].lastSelfUpdateCheck, new Date(3000).toISOString());
    assert.deepEqual(installs[0], {
      cmd: 'npm',
      args: ['install', '-g', 'claude-account-switch@latest'],
    });
    assert.equal(refreshed, true);
  });

  it('does not install when the user declines', async () => {
    let installed = false;
    const result = await maybePromptSelfUpdate({
      stdin: { isTTY: true },
      stdout: { isTTY: true },
      readMetaFn: () => ({}),
      writeMetaFn: () => {},
      computePlan: async () => ({
        self: {
          installed: '1.2.3',
          latest: '1.2.4',
          hasUpdate: true,
          isDev: false,
          pm: 'npm',
          needsSudo: false,
        },
        warnings: [],
        errors: [],
      }),
      confirmFn: async () => false,
      runInstallFn: async () => {
        installed = true;
        return 0;
      },
    });

    assert.deepEqual(result, { action: 'skipped', reason: 'declined' });
    assert.equal(installed, false);
  });
});
