import { spawn, execFileSync } from 'node:child_process';
import { existsSync, lstatSync, accessSync, constants as FS } from 'node:fs';
import { join, sep } from 'node:path';
import { IS_WINDOWS } from './constants.mjs';
import { readJsonFile } from './json-fs.mjs';

// ── SemVer ──────────────────────────────────────────────────────────────────

const SEMVER_RE = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/;

export function parseSemver(v) {
  const m = String(v ?? '').match(SEMVER_RE);
  if (!m) throw new Error(`Invalid semver: ${v}`);
  return { major: +m[1], minor: +m[2], patch: +m[3], pre: m[4] ?? null };
}

export function compareSemver(a, b) {
  const A = parseSemver(a);
  const B = parseSemver(b);
  for (const k of ['major', 'minor', 'patch']) {
    if (A[k] !== B[k]) return A[k] < B[k] ? -1 : 1;
  }
  // pre-release < release
  if (A.pre === B.pre) return 0;
  if (A.pre === null) return 1;
  if (B.pre === null) return -1;
  return A.pre < B.pre ? -1 : 1;
}

// ── Local introspection ─────────────────────────────────────────────────────

let _npmRoot;
function npmRootGlobal() {
  if (_npmRoot !== undefined) return _npmRoot;
  try {
    _npmRoot = execFileSync('npm', ['root', '-g'], { encoding: 'utf8' }).trim();
  } catch {
    _npmRoot = null;
  }
  return _npmRoot;
}

let _npmPrefix;
function npmPrefixGlobal() {
  if (_npmPrefix !== undefined) return _npmPrefix;
  try {
    _npmPrefix = execFileSync('npm', ['prefix', '-g'], { encoding: 'utf8' }).trim();
  } catch {
    _npmPrefix = null;
  }
  return _npmPrefix;
}

export function getInstalledPath(pkgName) {
  const root = npmRootGlobal();
  if (!root) return null;
  const dir = join(root, pkgName);
  return existsSync(dir) ? dir : null;
}

export function getInstalledVersion(pkgName) {
  const dir = getInstalledPath(pkgName);
  if (!dir) return null;
  const pkg = readJsonFile(join(dir, 'package.json'), null);
  return pkg?.version ?? null;
}

export function isDevSymlink(pkgName) {
  const dir = getInstalledPath(pkgName);
  if (!dir) return false;
  try {
    return lstatSync(dir).isSymbolicLink();
  } catch {
    return false;
  }
}

export function getInstalledBinMap(pkgName) {
  const dir = getInstalledPath(pkgName);
  if (!dir) return null;
  const pkg = readJsonFile(join(dir, 'package.json'), null);
  if (!pkg) return null;
  if (typeof pkg.bin === 'string') return { [pkg.name]: pkg.bin };
  return pkg.bin ?? null;
}

// ── Registry ────────────────────────────────────────────────────────────────

const REGISTRY_TIMEOUT_MS = 5000;

function registryUrl() {
  return (
    process.env.CAS_TEST_REGISTRY_URL
    || process.env.NPM_CONFIG_REGISTRY
    || process.env.npm_config_registry
    || 'https://registry.npmjs.org'
  ).replace(/\/$/, '');
}

class RegistryError extends Error {
  constructor(message, code) { super(message); this.code = code; }
}

export async function fetchLatestVersion(pkgName, { signal } = {}) {
  const url = `${registryUrl()}/${encodeURIComponent(pkgName).replace('%40', '@')}/latest`;
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), REGISTRY_TIMEOUT_MS);
  if (signal) signal.addEventListener('abort', () => ctl.abort(), { once: true });

  try {
    const res = await fetch(url, { signal: ctl.signal, headers: { accept: 'application/json' } });
    if (res.status === 404) throw new RegistryError(`Package not found: ${pkgName}`, 'NOT_FOUND');
    if (!res.ok) throw new RegistryError(`Registry HTTP ${res.status}`, 'HTTP');
    const body = await res.json();
    if (!body?.version) throw new RegistryError('Registry response missing version', 'HTTP');
    return body.version;
  } catch (e) {
    if (e instanceof RegistryError) throw e;
    throw new RegistryError(`Cannot reach ${registryUrl()} (${e.code || e.name || e.message})`, 'NETWORK');
  } finally {
    clearTimeout(timer);
  }
}

// ── Package manager detection ───────────────────────────────────────────────

const PM_PATH_HINTS = [
  { needle: `${sep}.yarn${sep}global${sep}`, pm: 'yarn' },
  { needle: `${sep}yarn${sep}global${sep}`, pm: 'yarn' },
  { needle: `${sep}.bun${sep}install${sep}global${sep}`, pm: 'bun' },
  { needle: `${sep}pnpm-global${sep}`, pm: 'pnpm' },
  { needle: `${sep}pnpm${sep}global${sep}`, pm: 'pnpm' },
  { needle: `${sep}.pnpm${sep}`, pm: 'pnpm' },
];

export function classifyPathToPm(path) {
  if (!path) return null;
  for (const { needle, pm } of PM_PATH_HINTS) {
    if (path.includes(needle)) return pm;
  }
  return 'npm';
}

function pmOnPath() {
  for (const pm of ['npm', 'yarn', 'pnpm', 'bun']) {
    try {
      execFileSync(IS_WINDOWS ? 'where' : 'which', [pm], { stdio: 'ignore' });
      return pm;
    } catch {}
  }
  return 'unknown';
}

export function detectPackageManager(pkgName) {
  const path = getInstalledPath(pkgName);
  const fromPath = classifyPathToPm(path);
  if (fromPath) return fromPath;
  return pmOnPath();
}

// ── Permission / running detection ──────────────────────────────────────────

export function needsElevation() {
  if (IS_WINDOWS) return false;
  const prefix = npmPrefixGlobal();
  if (!prefix) return false;
  try {
    accessSync(prefix, FS.W_OK);
    return false;
  } catch {
    return true;
  }
}

export function detectRunningClaude() {
  try {
    if (IS_WINDOWS) {
      const out = execFileSync('tasklist', ['/FI', 'IMAGENAME eq claude.exe', '/FO', 'CSV', '/NH'], { encoding: 'utf8' });
      const pids = [...out.matchAll(/"claude\.exe","(\d+)"/g)].map(m => +m[1]);
      return { running: pids.length > 0, pids };
    }
    const out = execFileSync('ps', ['-A', '-o', 'pid=,comm='], { encoding: 'utf8' });
    const pids = out.split('\n')
      .map(l => l.trim())
      .filter(l => /(^|\/)claude(\.exe)?$/.test(l.split(/\s+/, 2)[1] ?? ''))
      .map(l => +l.split(/\s+/, 1)[0])
      .filter(Boolean);
    return { running: pids.length > 0, pids };
  } catch {
    return { running: false, pids: [] };
  }
}

// ── Install execution ───────────────────────────────────────────────────────

export function buildInstallCommand(pm, pkgName) {
  const target = `${pkgName}@latest`;
  switch (pm) {
    case 'yarn': return { cmd: 'yarn', args: ['global', 'add', target], displayCmd: `yarn global add ${target}` };
    case 'pnpm': return { cmd: 'pnpm', args: ['add', '-g', target], displayCmd: `pnpm add -g ${target}` };
    case 'bun':  return { cmd: 'bun', args: ['add', '-g', target], displayCmd: `bun add -g ${target}` };
    case 'npm':
    default:     return { cmd: 'npm', args: ['install', '-g', target], displayCmd: `npm install -g ${target}` };
  }
}

export function runInstall({ cmd, args }) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { stdio: 'inherit', shell: IS_WINDOWS });
    child.on('close', code => resolve(code ?? 0));
    child.on('error', () => resolve(1));
  });
}

// ── Aggregate ───────────────────────────────────────────────────────────────

/**
 * Build a complete picture of what an `update` invocation would do.
 * Pure aside from local fs + network. No installs.
 *
 * @param {{ checkSelf: boolean, checkClaude: boolean,
 *           getInstalled?: typeof getInstalledVersion,
 *           fetchLatest?: typeof fetchLatestVersion }} opts
 */
export async function computeUpdatePlan({
  checkSelf,
  checkClaude,
  getInstalled = getInstalledVersion,
  fetchLatest = fetchLatestVersion,
}) {
  const { CLAUDE_CODE_PKG, SELF_PKG } = await import('./constants.mjs');
  const warnings = [];
  const errors = [];

  const buildEntry = async (pkgName) => {
    const installed = getInstalled(pkgName);
    let latest = null;
    try {
      latest = await fetchLatest(pkgName);
    } catch (e) {
      errors.push(`${pkgName}: ${e.message}`);
    }
    const hasUpdate = installed && latest ? compareSemver(installed, latest) < 0 : false;
    return {
      pkg: pkgName,
      installed,
      latest,
      hasUpdate,
      pm: detectPackageManager(pkgName),
      isDev: isDevSymlink(pkgName),
      needsSudo: needsElevation(),
      path: getInstalledPath(pkgName),
      binBefore: getInstalledBinMap(pkgName),
    };
  };

  const self = checkSelf ? await buildEntry(SELF_PKG) : null;
  const claude = checkClaude ? await buildEntry(CLAUDE_CODE_PKG) : null;

  if (claude) {
    const r = detectRunningClaude();
    if (r.running) {
      if (IS_WINDOWS) {
        errors.push(`Claude Code is running (pid ${r.pids.join(', ')}) and claude.exe is locked on Windows. Close it first.`);
      } else {
        warnings.push(`Claude Code is running (pid ${r.pids.join(', ')}). Updates apply on next invocation.`);
      }
    }
  }
  if (self?.isDev) {
    warnings.push(`${self.pkg} is installed via npm link (dev symlink). Self-update is refused — use git pull instead.`);
  }
  if ((self?.hasUpdate || claude?.hasUpdate) && needsElevation()) {
    warnings.push(`Global install prefix is not writable by the current user — sudo is required.`);
  }

  return { self, claude, warnings, errors };
}
