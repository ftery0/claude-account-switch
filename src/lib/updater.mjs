import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SELF_PKG } from './constants.mjs';

export function parseSemver(value) {
  if (typeof value !== 'string') throw new Error(`Invalid version: ${value}`);
  const match = /^(\d+)\.(\d+)\.(\d+)(?:-([\w.-]+))?(?:\+[\w.-]+)?$/.exec(value);
  if (!match) throw new Error(`Invalid version: ${value}`);
  return { major: Number(match[1]), minor: Number(match[2]), patch: Number(match[3]), pre: match[4] ?? null };
}

export function compareSemver(a, b) {
  const left = parseSemver(a);
  const right = parseSemver(b);
  for (const key of ['major', 'minor', 'patch']) {
    if (left[key] !== right[key]) return left[key] > right[key] ? 1 : -1;
  }
  if (left.pre === right.pre) return 0;
  if (!left.pre) return 1;
  if (!right.pre) return -1;
  const leftParts = left.pre.split('.');
  const rightParts = right.pre.split('.');
  for (let i = 0; i < Math.max(leftParts.length, rightParts.length); i++) {
    if (leftParts[i] === rightParts[i]) continue;
    if (leftParts[i] === undefined) return -1;
    if (rightParts[i] === undefined) return 1;
    const leftNumeric = /^\d+$/.test(leftParts[i]);
    const rightNumeric = /^\d+$/.test(rightParts[i]);
    if (leftNumeric && rightNumeric) return Number(leftParts[i]) > Number(rightParts[i]) ? 1 : -1;
    if (leftNumeric !== rightNumeric) return leftNumeric ? -1 : 1;
    return leftParts[i] > rightParts[i] ? 1 : -1;
  }
  return 0;
}

export async function fetchLatestVersion(pkg = SELF_PKG) {
  const registry = process.env.CAS_TEST_REGISTRY_URL || 'https://registry.npmjs.org';
  let response;
  try {
    response = await fetch(`${registry}/${pkg.replace('/', '%2f')}/latest`, { signal: AbortSignal.timeout(5000) });
  } catch (err) {
    throw new Error(`Could not reach the package registry: ${err.message}`, { cause: err });
  }
  if (!response.ok) throw new Error(`Registry returned HTTP ${response.status}`);
  const data = await response.json();
  parseSemver(data.version);
  return data.version;
}

export async function computeUpdatePlan({ fetchVersion = fetchLatestVersion } = {}) {
  const pkg = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../../package.json'), 'utf8'));
  const latest = await fetchVersion(SELF_PKG);
  return { self: { pkg: SELF_PKG, installed: pkg.version, latest, hasUpdate: compareSemver(pkg.version, latest) < 0 } };
}
