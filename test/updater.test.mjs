import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync, rmSync, lstatSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const mod = await import('../src/lib/updater.mjs');
const {
  parseSemver, compareSemver, buildInstallCommand, classifyPathToPm,
  fetchLatestVersion, computeUpdatePlan,
} = mod;

// ── parseSemver / compareSemver ─────────────────────────────────────────────

describe('parseSemver', () => {
  it('parses 1.2.3', () => {
    assert.deepEqual(parseSemver('1.2.3'), { major: 1, minor: 2, patch: 3, pre: null });
  });

  it('parses pre-release', () => {
    assert.deepEqual(parseSemver('1.0.0-rc.1'), { major: 1, minor: 0, patch: 0, pre: 'rc.1' });
  });

  it('ignores build metadata', () => {
    assert.equal(parseSemver('2.0.0+build.5').patch, 0);
  });

  it('throws on invalid input', () => {
    assert.throws(() => parseSemver('not-a-version'));
    assert.throws(() => parseSemver(''));
    assert.throws(() => parseSemver(null));
  });
});

describe('compareSemver', () => {
  it('returns 0 for equal', () => {
    assert.equal(compareSemver('1.0.0', '1.0.0'), 0);
  });

  it('compares major.minor.patch', () => {
    assert.equal(compareSemver('1.0.0', '2.0.0'), -1);
    assert.equal(compareSemver('2.0.0', '1.0.0'), 1);
    assert.equal(compareSemver('1.0.0', '1.1.0'), -1);
    assert.equal(compareSemver('1.0.1', '1.0.0'), 1);
  });

  it('pre-release is less than release', () => {
    assert.equal(compareSemver('1.0.0-rc.1', '1.0.0'), -1);
    assert.equal(compareSemver('1.0.0', '1.0.0-rc.1'), 1);
  });

  it('compares pre-release tags lexically', () => {
    assert.equal(compareSemver('1.0.0-alpha', '1.0.0-beta'), -1);
  });
});

// ── buildInstallCommand ─────────────────────────────────────────────────────

describe('buildInstallCommand', () => {
  it('builds npm command', () => {
    const r = buildInstallCommand('npm', 'pkg-a');
    assert.equal(r.cmd, 'npm');
    assert.deepEqual(r.args, ['install', '-g', 'pkg-a@latest']);
    assert.equal(r.displayCmd, 'npm install -g pkg-a@latest');
  });

  it('builds yarn command', () => {
    const r = buildInstallCommand('yarn', 'pkg-a');
    assert.deepEqual(r.args, ['global', 'add', 'pkg-a@latest']);
  });

  it('builds pnpm command', () => {
    const r = buildInstallCommand('pnpm', 'pkg-a');
    assert.deepEqual(r.args, ['add', '-g', 'pkg-a@latest']);
  });

  it('builds bun command', () => {
    const r = buildInstallCommand('bun', 'pkg-a');
    assert.deepEqual(r.args, ['add', '-g', 'pkg-a@latest']);
  });

  it('falls back to npm for unknown pm', () => {
    const r = buildInstallCommand('unknown-pm', 'pkg-a');
    assert.equal(r.cmd, 'npm');
  });
});

// ── classifyPathToPm ────────────────────────────────────────────────────────

describe('classifyPathToPm', () => {
  it('returns null for empty path', () => {
    assert.equal(classifyPathToPm(null), null);
    assert.equal(classifyPathToPm(''), null);
  });

  it('detects yarn', () => {
    assert.equal(classifyPathToPm('/Users/x/.yarn/global/node_modules/foo'), 'yarn');
  });

  it('detects pnpm', () => {
    assert.equal(classifyPathToPm('/Users/x/.pnpm/foo'), 'pnpm');
    assert.equal(classifyPathToPm('/Users/x/pnpm-global/5/node_modules/foo'), 'pnpm');
  });

  it('detects bun', () => {
    assert.equal(classifyPathToPm('/Users/x/.bun/install/global/node_modules/foo'), 'bun');
  });

  it('defaults to npm', () => {
    assert.equal(classifyPathToPm('/Users/x/.nvm/versions/node/v20/lib/node_modules/foo'), 'npm');
    assert.equal(classifyPathToPm('/usr/local/lib/node_modules/foo'), 'npm');
  });
});

// ── fetchLatestVersion (with stubbed fetch) ─────────────────────────────────

describe('fetchLatestVersion', () => {
  let originalFetch;
  before(() => { originalFetch = globalThis.fetch; });
  after(() => { globalThis.fetch = originalFetch; });

  it('returns version from registry response', async () => {
    globalThis.fetch = async () => ({
      ok: true, status: 200,
      json: async () => ({ version: '1.2.3' }),
    });
    const v = await fetchLatestVersion('@scope/pkg');
    assert.equal(v, '1.2.3');
  });

  it('throws NOT_FOUND on 404', async () => {
    globalThis.fetch = async () => ({ ok: false, status: 404 });
    await assert.rejects(() => fetchLatestVersion('missing'), e => e.code === 'NOT_FOUND');
  });

  it('throws HTTP on 5xx', async () => {
    globalThis.fetch = async () => ({ ok: false, status: 500 });
    await assert.rejects(() => fetchLatestVersion('x'), e => e.code === 'HTTP');
  });

  it('throws NETWORK on fetch rejection', async () => {
    globalThis.fetch = async () => { throw new Error('ENOTFOUND'); };
    await assert.rejects(() => fetchLatestVersion('x'), e => e.code === 'NETWORK');
  });

  it('throws HTTP when body has no version', async () => {
    globalThis.fetch = async () => ({ ok: true, status: 200, json: async () => ({}) });
    await assert.rejects(() => fetchLatestVersion('x'), e => e.code === 'HTTP');
  });
});

// ── computeUpdatePlan (DI scenarios) ────────────────────────────────────────

describe('computeUpdatePlan', () => {
  it('reports both packages up to date', async () => {
    const plan = await computeUpdatePlan({
      checkSelf: true,
      checkClaude: true,
      getInstalled: () => '1.0.0',
      fetchLatest: async () => '1.0.0',
    });
    assert.equal(plan.self.hasUpdate, false);
    assert.equal(plan.claude.hasUpdate, false);
    assert.deepEqual(plan.errors, []);
  });

  it('flags hasUpdate when installed < latest', async () => {
    const plan = await computeUpdatePlan({
      checkSelf: false,
      checkClaude: true,
      getInstalled: () => '1.0.0',
      fetchLatest: async () => '2.0.0',
    });
    assert.equal(plan.claude.hasUpdate, true);
  });

  it('collects registry errors without throwing', async () => {
    const plan = await computeUpdatePlan({
      checkSelf: false,
      checkClaude: true,
      getInstalled: () => '1.0.0',
      fetchLatest: async () => { const e = new Error('Network down'); e.code = 'NETWORK'; throw e; },
    });
    assert.equal(plan.claude.hasUpdate, false);
    assert.ok(plan.errors.length > 0);
  });

  it('null installed + valid latest is not flagged as hasUpdate', async () => {
    const plan = await computeUpdatePlan({
      checkSelf: false,
      checkClaude: true,
      getInstalled: () => null,
      fetchLatest: async () => '1.0.0',
    });
    assert.equal(plan.claude.hasUpdate, false);
    assert.equal(plan.claude.installed, null);
    assert.equal(plan.claude.latest, '1.0.0');
  });

  it('omits sections when check flags are false', async () => {
    const plan = await computeUpdatePlan({
      checkSelf: true,
      checkClaude: false,
      getInstalled: () => '1.0.0',
      fetchLatest: async () => '1.0.0',
    });
    assert.equal(plan.claude, null);
    assert.ok(plan.self);
  });
});

// ── isDevSymlink via tmpdir (no monkey-patching the npm root call) ──────────
// This is intentionally light — full integration is covered by manual smoke.

describe('isDevSymlink (tmpdir sanity)', () => {
  let tmp;
  before(() => { tmp = mkdtempSync(join(tmpdir(), 'cas-updater-')); });
  after(() => { rmSync(tmp, { recursive: true, force: true }); });

  it('lstatSync correctly distinguishes symlink vs directory', () => {
    const real = join(tmp, 'real');
    const link = join(tmp, 'link');
    mkdirSync(real);
    symlinkSync(real, link);
    writeFileSync(join(real, 'package.json'), JSON.stringify({ name: 'x', version: '1.0.0' }));

    assert.equal(lstatSync(real).isSymbolicLink(), false);
    assert.equal(lstatSync(link).isSymbolicLink(), true);
  });
});
