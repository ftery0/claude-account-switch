import { META_FILE, PROFILE_NAME_REGEX, PROFILE_NAME_MAX_LENGTH, RESERVED_NAMES } from './constants.mjs';
import { readJsonFile, writeJsonFile } from './json-fs.mjs';

const DEFAULT_META = {
  version: 1,
  activeProfile: null,
  shareSettings: true,
  profiles: [],
};

export function readMeta() {
  const meta = readJsonFile(META_FILE, DEFAULT_META);
  if (!meta || !Array.isArray(meta.profiles)
    || meta.profiles.some(name => typeof name !== 'string'
      || !PROFILE_NAME_REGEX.test(name) || name.length > PROFILE_NAME_MAX_LENGTH
      || RESERVED_NAMES.includes(name))
    || new Set(meta.profiles).size !== meta.profiles.length
    || (meta.activeProfile !== null && !meta.profiles.includes(meta.activeProfile))
    || typeof meta.shareSettings !== 'boolean') {
    throw new Error(`Invalid profile metadata in ${META_FILE}. Restore it before continuing.`);
  }
  return meta;
}

export function writeMeta(meta) {
  writeJsonFile(META_FILE, meta);
}

export function getActiveProfile() {
  return readMeta().activeProfile;
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
