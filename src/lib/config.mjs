import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
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
    return JSON.parse(readFileSync(META_FILE, 'utf8'));
  } catch {
    return { ...DEFAULT_META };
  }
}

export function writeMeta(meta) {
  mkdirSync(dirname(META_FILE), { recursive: true });
  writeFileSync(META_FILE, JSON.stringify(meta, null, 2) + '\n');
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
