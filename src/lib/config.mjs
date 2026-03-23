import { readFileSync, writeFileSync, renameSync, unlinkSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { META_FILE, PROFILES_DIR } from './constants.mjs';

const DEFAULT_META = {
  version: 1,
  activeProfile: null,
  shareSettings: true,
  profiles: [],
};

export function readMeta() {
  if (!existsSync(META_FILE)) return { ...DEFAULT_META };
  try {
    // Strip BOM (U+FEFF) that PowerShell 5.1 -Encoding UTF8 may prepend
    const raw = readFileSync(META_FILE, 'utf8').replace(/^\uFEFF/, '');
    return JSON.parse(raw);
  } catch {
    return { ...DEFAULT_META };
  }
}

export function writeMeta(meta) {
  mkdirSync(dirname(META_FILE), { recursive: true });
  const content = JSON.stringify(meta, null, 2) + '\n';
  // Atomic write: write to a temp file then rename to avoid partial-write
  // corruption when two processes update meta.json concurrently.
  const tmp = join(dirname(META_FILE), `.meta.${process.pid}.tmp`);
  writeFileSync(tmp, content);
  try {
    renameSync(tmp, META_FILE);
  } catch {
    // Windows: rename may fail (EPERM) when the target is briefly locked by
    // antivirus or the filesystem indexer.  Fall back to a direct overwrite.
    writeFileSync(META_FILE, content);
    try { unlinkSync(tmp); } catch {}
  }
}

export function getActiveProfile() {
  const meta = readMeta();
  return meta.activeProfile;
}

export function setActiveProfile(name) {
  const meta = readMeta();
  if (!meta.profiles.includes(name)) {
    throw new Error(`Profile "${name}" does not exist`);
  }
  meta.activeProfile = name;
  writeMeta(meta);
}

export function addProfileToMeta(name) {
  const meta = readMeta();
  if (!meta.profiles.includes(name)) {
    meta.profiles.push(name);
  }
  writeMeta(meta);
}

export function removeProfileFromMeta(name) {
  const meta = readMeta();
  meta.profiles = meta.profiles.filter(p => p !== name);
  if (meta.activeProfile === name) {
    meta.activeProfile = meta.profiles[0] || null;
  }
  writeMeta(meta);
}
