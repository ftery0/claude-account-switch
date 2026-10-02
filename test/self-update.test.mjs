import './helpers/home.mjs';
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync, cpSync, readdirSync, symlinkSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { PROFILES_DIR } from '../src/lib/constants.mjs';
import { installedRuntimeDirectory, shouldCheckSelfUpdate, scheduleSelfUpdate, runSelfUpdate } from '../src/lib/self-update.mjs';
import { installShellIntegration } from '../src/lib/shell.mjs';

const repository = dirname(dirname(fileURLToPath(import.meta.url)));
const pointer = join(PROFILES_DIR, '_runtime-current.json');
const stateFile = join(PROFILES_DIR, '_update-state.json');
const computePlan = async () => ({ self: { latest: '2.0.1', hasUpdate: true } });
const interactive = { env: {}, stdin: { isTTY: true }, stdout: { isTTY: true } };

function fixtureDownload(edit = () => {}) {
  return async (version, workspace) => {
    const source = join(workspace, 'package');
    mkdirSync(source);
    for (const file of ['bin', 'src', 'package.json']) cpSync(join(repository, file), join(source, file), { recursive: true });
    const manifest = join(source, 'package.json');
    const pkg = JSON.parse(readFileSync(manifest, 'utf8'));
    pkg.version = version;
    edit(pkg, source);
    writeFileSync(manifest, JSON.stringify(pkg));
    return source;
  };
}

beforeEach(() => {
  rmSync(PROFILES_DIR, { recursive: true, force: true });
  mkdirSync(PROFILES_DIR, { recursive: true });
  installShellIntegration('bash');
});

describe('automatic immutable runtime updates', () => {
  it('checks daily and backs off one hour after failure', () => {
    assert.equal(shouldCheckSelfUpdate({}, 1000), true);
    assert.equal(shouldCheckSelfUpdate({ lastCheck: new Date(5000).toISOString() }, 1000), true);
    const state = { lastCheck: new Date(1000).toISOString() };
    assert.equal(shouldCheckSelfUpdate(state, 2000), false);
    assert.equal(shouldCheckSelfUpdate(state, 1000 + 86400000), true);
    assert.equal(shouldCheckSelfUpdate({ ...state, failed: true }, 1000 + 3600000), true);
  });
  it('schedules by default without waiting for installation', () => {
    let launches = 0;
    const result = scheduleSelfUpdate({ ...interactive, spawnWorker: (node, args, options) => {
      launches++;
      assert.equal(options.detached, true);
      assert.equal(options.stdio, 'ignore');
      assert.equal(args[1], '--worker');
      return { on: () => {}, unref: () => {} };
    } });
    assert.equal(result.action, 'scheduled');
    assert.equal(launches, 1);
  });
  it('does not access files or spawn when disabled or noninteractive', () => {
    const spawnWorker = () => assert.fail('must not spawn');
    assert.equal(scheduleSelfUpdate({ ...interactive, env: { CLAUDE_SWITCH_DISABLE_AUTO_UPDATE: '1' }, spawnWorker }).reason, 'disabled');
    assert.equal(scheduleSelfUpdate({ ...interactive, stdin: { isTTY: false }, spawnWorker }).reason, 'non-tty');
    assert.equal(scheduleSelfUpdate({ ...interactive, stdout: { isTTY: false }, spawnWorker }).reason, 'non-tty');
  });
  it('activates a verified new version without changing old files, profiles or shell configuration', async () => {
    const old = installedRuntimeDirectory();
    const original = readFileSync(join(old, 'src/index.mjs'));
    const rc = join(process.env.HOME, '.bashrc');
    const rcBefore = readFileSync(rc);
    const meta = join(PROFILES_DIR, 'meta.json');
    writeFileSync(meta, 'existing profile metadata');
    const hook = join(PROFILES_DIR, 'work/pre-launch.sh');
    mkdirSync(dirname(hook));
    writeFileSync(hook, 'custom harness');
    const result = await runSelfUpdate({ computePlan, download: fixtureDownload() });
    assert.deepEqual(result, { action: 'updated', version: '2.0.1' });
    assert.notEqual(installedRuntimeDirectory(), old);
    assert.deepEqual(readFileSync(join(old, 'src/index.mjs')), original);
    assert.deepEqual(readFileSync(rc), rcBefore);
    assert.equal(readFileSync(meta, 'utf8'), 'existing profile metadata');
    assert.equal(readFileSync(hook, 'utf8'), 'custom harness');
    assert.equal(execFileSync(process.execPath, [join(old, 'bin/cli.mjs'), '--version'], { env: process.env, encoding: 'utf8' }).trim(), '2.0.1');
    assert.equal(scheduleSelfUpdate(interactive).reason, 'recent');
    assert.equal(readdirSync(PROFILES_DIR).some(name => name.startsWith('_update-stage-')), false);
  });
  it('retains old runtime on offline, interrupted downloads and malformed packages', async () => {
    const old = installedRuntimeDirectory();
    for (const download of [async () => { throw new Error('offline'); }, async (_, workspace) => {
      writeFileSync(join(workspace, 'partial'), 'interrupted download'); throw new Error('interrupted');
    }, fixtureDownload(pkg => { pkg.claudeAccountSwitch.runtimeProtocol = 99; }), fixtureDownload(pkg => { pkg.version = '0.0.0'; }), fixtureDownload((pkg, source) => {
      rmSync(join(source, 'src/index.mjs'));
    }), fixtureDownload((pkg, source) => { writeFileSync(join(source, 'bin/cli.mjs'), 'process.exit(3)'); }), fixtureDownload((pkg, source) => { writeFileSync(join(source, 'src/commands/shell.mjs'), 'invalid {'); })]) {
      const result = await runSelfUpdate({ force: true, computePlan, download });
      assert.equal(result.action, 'failed');
      assert.equal(installedRuntimeDirectory(), old);
      assert.equal(existsSync(pointer), false);
      assert.equal(readdirSync(PROFILES_DIR).some(name => name.startsWith('_update-stage-')), false);
    }
  });
  it('does not downgrade or download the installed version', async () => {
    const result = await runSelfUpdate({ computePlan: async () => ({ self: { latest: '1.2.3' } }), download: () => assert.fail('must not download') });
    assert.equal(result.reason, 'up-to-date');
    assert.equal(existsSync(pointer), false);
  });
  it('serializes simultaneous updates without blocking Claude launches', async () => {
    let finish;
    const download = (version, workspace) => new Promise(resolve => { finish = async () => resolve(await fixtureDownload()(version, workspace)); });
    const first = runSelfUpdate({ computePlan, download });
    while (!finish) await new Promise(resolve => setTimeout(resolve, 1));
    const second = await runSelfUpdate({ force: true, computePlan, download: () => assert.fail('duplicate download') });
    assert.equal(second.reason, 'busy');
    assert.equal(execFileSync(process.execPath, [join(PROFILES_DIR, '_runtime/bin/cli.mjs'), '--version'], { env: process.env, encoding: 'utf8' }).trim(), '2.0.0');
    await finish();
    assert.equal((await first).action, 'updated');
  });
  it('recovers a stale updater lock without changing live metadata', async () => {
    mkdirSync(join(PROFILES_DIR, '_update-lock'));
    writeFileSync(join(PROFILES_DIR, '_update-lock/owner.json'), JSON.stringify({ pid: 2147483647 }));
    assert.equal((await runSelfUpdate({ computePlan, download: fixtureDownload() })).action, 'updated');
  });
  it('does not follow malicious pointers or updater symlinks', async () => {
    writeFileSync(pointer, JSON.stringify({ directory: '../work' }));
    assert.throws(installedRuntimeDirectory, /Invalid runtime pointer/);
    rmSync(pointer);
    const outside = join(process.env.HOME, 'outside');
    mkdirSync(outside);
    symlinkSync(outside, join(PROFILES_DIR, '_runtime-updates'), process.platform === 'win32' ? 'junction' : 'dir');
    const result = await runSelfUpdate({ computePlan, download: fixtureDownload() });
    assert.equal(result.action, 'failed');
    assert.deepEqual(readdirSync(outside), []);
  });
  it('retains the old version if update state cannot be recorded', async () => {
    const download = async (version, workspace) => {
      const source = await fixtureDownload()(version, workspace);
      mkdirSync(stateFile);
      return source;
    };
    const result = await runSelfUpdate({ computePlan, download });
    assert.equal(result.action, 'failed');
    assert.equal(execFileSync(process.execPath, [join(PROFILES_DIR, '_runtime/bin/cli.mjs'), '--version'], { env: process.env, encoding: 'utf8' }).trim(), '2.0.0');
  });
});
