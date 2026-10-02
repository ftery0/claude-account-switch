import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { existsSync, readFileSync, writeFileSync, mkdirSync, mkdtempSync, cpSync, renameSync, rmSync, lstatSync, readdirSync, realpathSync, statSync } from 'node:fs';
import { dirname, join, delimiter, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';
import { PROFILES_DIR, SELF_PKG } from './constants.mjs';
import { computeUpdatePlan, compareSemver, parseSemver } from './updater.mjs';

const execute = promisify(execFile);
const stateFile = join(PROFILES_DIR, '_update-state.json');
const pointerFile = join(PROFILES_DIR, '_runtime-current.json');
const versionsDir = join(PROFILES_DIR, '_runtime-updates');
const lockDir = join(PROFILES_DIR, '_update-lock');
const interval = 24 * 60 * 60 * 1000;

function readState() {
  if (!existsSync(stateFile)) return {};
  if (lstatSync(stateFile).isSymbolicLink()) throw new Error('Update state must not be a symlink');
  try {
    const state = JSON.parse(readFileSync(stateFile, 'utf8'));
    return state && typeof state === 'object' ? state : {};
  } catch (error) {
    if (error instanceof SyntaxError) return {};
    throw error;
  }
}

function atomicJson(file, value) {
  if (existsSync(file) && lstatSync(file).isSymbolicLink()) throw new Error('Update file must not be a symlink');
  const temporary = file + '.' + randomUUID();
  try {
    writeFileSync(temporary, JSON.stringify(value) + '\n', { flag: 'wx', mode: 0o600 });
    renameSync(temporary, file);
  } finally {
    rmSync(temporary, { force: true });
  }
}

export function installedRuntimeDirectory() {
  const base = join(PROFILES_DIR, '_runtime');
  if (!existsSync(base)) return null;
  if (lstatSync(base).isSymbolicLink()) throw new Error('Runtime must not be a symlink');
  if (!existsSync(pointerFile)) return base;
  if (lstatSync(pointerFile).isSymbolicLink()) throw new Error('Runtime pointer must not be a symlink');
  const { directory } = JSON.parse(readFileSync(pointerFile, 'utf8'));
  if (typeof directory !== 'string' || !/^v[\w.-]+$/.test(directory)) throw new Error('Invalid runtime pointer');
  const runtime = join(versionsDir, directory);
  if (lstatSync(versionsDir).isSymbolicLink() || lstatSync(runtime).isSymbolicLink()) throw new Error('Runtime must not be a symlink');
  return runtime;
}

export function shouldCheckSelfUpdate(state, now = Date.now()) {
  const last = Date.parse(state.lastCheck ?? '');
  const retry = state.failed ? 60 * 60 * 1000 : interval;
  return !Number.isFinite(last) || now < last || now - last >= retry;
}

function acquireLock() {
  try {
    mkdirSync(lockDir);
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
    if (lstatSync(lockDir).isSymbolicLink()) throw new Error('Update lock must not be a symlink');
    let owner;
    try { owner = JSON.parse(readFileSync(join(lockDir, 'owner.json'), 'utf8')); } catch {
      if (readdirSync(lockDir).length !== 0 || Date.now() - statSync(lockDir).mtimeMs < 300000) return null;
    }
    if (owner) {
      if (!Number.isInteger(owner.pid) || owner.pid < 1) return null;
      try { process.kill(owner.pid, 0); return null; } catch (probe) {
        if (probe.code !== 'ESRCH') return null;
      }
    }
    const stale = lockDir + '-stale-' + randomUUID();
    try { renameSync(lockDir, stale); } catch { return null; }
    rmSync(stale, { recursive: true, force: true });
    return acquireLock();
  }
  writeFileSync(join(lockDir, 'owner.json'), JSON.stringify({ pid: process.pid }), { flag: 'wx', mode: 0o600 });
  return () => rmSync(lockDir, { recursive: true, force: true });
}

function npmCli(env) {
  const candidates = [
    join(dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js'),
    join(dirname(process.execPath), '../lib/node_modules/npm/bin/npm-cli.js'),
  ];
  for (const directory of (env.PATH || '').split(delimiter).filter(Boolean)) {
    candidates.push(join(directory, 'node_modules/npm/bin/npm-cli.js'));
    for (const name of ['npm', 'npm.cmd']) {
      try {
        const file = realpathSync(join(directory, name));
        if (file.endsWith('npm-cli.js')) candidates.push(file);
      } catch {}
    }
  }
  return candidates.find(file => existsSync(file) && lstatSync(file).isFile()) ?? null;
}

function assertRegularTree(directory) {
  for (const name of readdirSync(directory)) {
    const file = join(directory, name);
    const stat = lstatSync(file);
    if (stat.isDirectory()) assertRegularTree(file);
    else if (!stat.isFile()) throw new Error(`Unsupported package entry: ${name}`);
  }
}

async function downloadPackage(version, workspace, env) {
  const npm = npmCli(env);
  if (!npm) throw new Error('npm executable unavailable');
  const home = join(workspace, 'home');
  mkdirSync(home);
  const config = join(workspace, 'npmrc');
  writeFileSync(config, '');
  const globalConfig = join(workspace, 'npmrc-global');
  writeFileSync(globalConfig, '');
  const isolatedEnv = {};
  for (const key of ['PATH', 'SystemRoot', 'SYSTEMROOT', 'WINDIR', 'ComSpec', 'COMSPEC', 'PATHEXT', 'TMPDIR', 'TMP', 'TEMP', 'HTTPS_PROXY', 'HTTP_PROXY', 'NO_PROXY', 'https_proxy', 'http_proxy', 'no_proxy', 'NODE_EXTRA_CA_CERTS']) {
    if (env[key]) isolatedEnv[key] = env[key];
  }
  Object.assign(isolatedEnv, {
    HOME: home, USERPROFILE: home, APPDATA: home, LOCALAPPDATA: home,
    npm_config_userconfig: config, npm_config_globalconfig: globalConfig,
    npm_config_cache: join(workspace, 'cache'), npm_config_engine_strict: 'true',
  });
  await execute(process.execPath, [npm, 'install', `${SELF_PKG}@${version}`,
    '--prefix', workspace, '--ignore-scripts', '--no-audit', '--no-fund', '--no-save', '--package-lock=false', '--omit=dev',
    '--fetch-retries=0', '--fetch-timeout=30000', '--registry', env.CAS_TEST_REGISTRY_URL || 'https://registry.npmjs.org'], {
    cwd: workspace, env: isolatedEnv, timeout: 120000, maxBuffer: 1024 * 1024, windowsHide: true,
  });
  return join(workspace, 'node_modules', SELF_PKG);
}

async function activatePackage(source, version) {
  assertRegularTree(source);
  const pkg = JSON.parse(readFileSync(join(source, 'package.json'), 'utf8'));
  if (pkg.name !== SELF_PKG || pkg.version !== version || pkg.claudeAccountSwitch?.runtimeProtocol !== 1) {
    throw new Error('Incompatible runtime package');
  }
  if (Object.keys(pkg.dependencies || {}).length || Object.keys(pkg.optionalDependencies || {}).length) {
    throw new Error('Runtime package must be self-contained');
  }
  for (const file of ['bin/cli.mjs', 'src/index.mjs', 'src/commands/shell.mjs', 'src/lib/self-update.mjs']) {
    if (!existsSync(join(source, file))) throw new Error(`Missing runtime file: ${file}`);
  }
  const validationHome = join(dirname(source), 'validation-home');
  mkdirSync(validationHome);
  const validation = await execute(process.execPath, [join(source, 'bin/cli.mjs'), '--version'], {
    cwd: validationHome, env: { HOME: validationHome, USERPROFILE: validationHome, CLAUDE_SWITCH_DISABLE_AUTO_UPDATE: '1', NO_COLOR: '1' },
    timeout: 10000, windowsHide: true,
  });
  if (validation.stdout.trim() !== version) throw new Error('Runtime version verification failed');
  await execute(process.execPath, ['--input-type=module', '-e', `await import(${JSON.stringify(pathToFileURL(join(source, 'src/commands/shell.mjs')).href)})`], {
    cwd: validationHome, env: { HOME: validationHome, USERPROFILE: validationHome, CLAUDE_SWITCH_DISABLE_AUTO_UPDATE: '1', NO_COLOR: '1' },
    timeout: 10000, windowsHide: true,
  });
  if (existsSync(versionsDir) && lstatSync(versionsDir).isSymbolicLink()) throw new Error('Runtime updates must not be a symlink');
  mkdirSync(versionsDir, { recursive: true });
  const directory = `v${version.replace(/\+/g, '-')}-${randomUUID()}`;
  const destination = join(versionsDir, directory);
  mkdirSync(destination);
  let activated = false;
  try {
    for (const file of ['package.json', 'bin', 'src']) cpSync(join(source, file), join(destination, file), { recursive: true });
    atomicJson(pointerFile, { directory, version });
    activated = true;
  } finally {
    if (!activated) rmSync(destination, { recursive: true, force: true });
  }
}

export async function runSelfUpdate({ force = false, env = process.env, now = Date.now(), computePlan = computeUpdatePlan, download = downloadPackage } = {}) {
  const runtime = installedRuntimeDirectory();
  if (!runtime) return { action: 'skipped', reason: 'not-installed' };
  const release = acquireLock();
  if (!release) return { action: 'skipped', reason: 'busy' };
  let workspace;
  try {
    const state = readState();
    if (!force && !shouldCheckSelfUpdate(state, now)) return { action: 'skipped', reason: 'recent' };
    const installed = JSON.parse(readFileSync(join(installedRuntimeDirectory(), 'package.json'), 'utf8')).version;
    const { self } = await computePlan();
    parseSemver(self.latest);
    if (compareSemver(installed, self.latest) >= 0) {
      atomicJson(stateFile, { lastCheck: new Date(now).toISOString(), failed: false });
      return { action: 'skipped', reason: 'up-to-date' };
    }
    workspace = mkdtempSync(join(PROFILES_DIR, '_update-stage-'));
    const source = await download(self.latest, workspace, env);
    atomicJson(stateFile, { lastCheck: new Date(now).toISOString(), failed: false, version: self.latest });
    await activatePackage(source, self.latest);
    return { action: 'updated', version: self.latest };
  } catch (error) {
    try { atomicJson(stateFile, { lastCheck: new Date(now).toISOString(), failed: true }); } catch {}
    const npmError = error.stderr?.match(/npm (?:ERR!|error) code (\S+)/i)?.[1];
    let message = error.message;
    if (npmError) message = `npm ${npmError}`;
    else if (error.killed) message = 'Update timed out';
    return { action: 'failed', error: message };
  } finally {
    try { if (workspace) rmSync(workspace, { recursive: true, force: true }); } finally { release(); }
  }
}

export function scheduleSelfUpdate({ env = process.env, stdin = process.stdin, stdout = process.stderr, spawnWorker = spawn } = {}) {
  if (env.CLAUDE_SWITCH_DISABLE_AUTO_UPDATE === '1') return { action: 'skipped', reason: 'disabled' };
  if (!stdin.isTTY || !stdout.isTTY) return { action: 'skipped', reason: 'non-tty' };
  try {
    if (!installedRuntimeDirectory()) return { action: 'skipped', reason: 'not-installed' };
    if (!shouldCheckSelfUpdate(readState())) return { action: 'skipped', reason: 'recent' };
    const child = spawnWorker(process.execPath, [fileURLToPath(import.meta.url), '--worker'], {
      cwd: PROFILES_DIR, env, detached: true, stdio: 'ignore', windowsHide: true,
    });
    child.on('error', () => {});
    child.unref();
    return { action: 'scheduled' };
  } catch {
    return { action: 'skipped', reason: 'unavailable' };
  }
}

if (process.argv[2] === '--worker' && process.argv[1]
  && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runSelfUpdate().catch(() => {});
}
