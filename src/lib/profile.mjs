import {
  existsSync, mkdirSync, rmSync, symlinkSync,
  copyFileSync, cpSync, writeFileSync, readFileSync,
} from 'node:fs';
import { join } from 'node:path';
import {
  PROFILES_DIR, SHARED_DIR, PROFILE_NAME_REGEX, RESERVED_NAMES,
  SHARED_FILES, SHARED_DIRS, PROFILE_FILES, PROFILE_DIRS,
} from './constants.mjs';
import { addProfileToMeta, removeProfileFromMeta, readMeta } from './config.mjs';

export function validateProfileName(name) {
  if (RESERVED_NAMES.includes(name)) {
    return `"${name}" is a reserved name`;
  }
  if (!PROFILE_NAME_REGEX.test(name)) {
    return 'Only lowercase letters, numbers, and hyphens allowed (must start with letter or number)';
  }
  return null;
}

export function profileDir(name) {
  return join(PROFILES_DIR, name);
}

export function profileExists(name) {
  return existsSync(profileDir(name));
}

export function ensureShared() {
  mkdirSync(SHARED_DIR, { recursive: true });
  for (const f of SHARED_FILES) {
    const path = join(SHARED_DIR, f);
    if (!existsSync(path)) {
      writeFileSync(path, '{}');
    }
  }
  for (const d of SHARED_DIRS) {
    mkdirSync(join(SHARED_DIR, d), { recursive: true });
  }
}

export function createProfile(name, shareSettings = true) {
  const dir = profileDir(name);
  mkdirSync(dir, { recursive: true });

  if (shareSettings) {
    ensureShared();
    for (const f of SHARED_FILES) {
      const target = join('..', '_shared', f);
      const link = join(dir, f);
      if (!existsSync(link)) {
        symlinkSync(target, link);
      }
    }
    for (const d of SHARED_DIRS) {
      const target = join('..', '_shared', d);
      const link = join(dir, d);
      if (!existsSync(link)) {
        symlinkSync(target, link);
      }
    }
  }

  for (const d of PROFILE_DIRS) {
    mkdirSync(join(dir, d), { recursive: true });
  }

  addProfileToMeta(name);
}

export function removeProfile(name) {
  const dir = profileDir(name);
  if (existsSync(dir)) {
    rmSync(dir, { recursive: true, force: true });
  }
  removeProfileFromMeta(name);
}

export function listProfiles() {
  const meta = readMeta();
  return meta.profiles;
}

/**
 * Migrate an existing Claude config directory into a profile.
 */
export function migrateDir(sourceDir, profileName, shareSettings = true) {
  const dir = profileDir(profileName);
  mkdirSync(dir, { recursive: true });

  if (shareSettings) {
    ensureShared();
  }

  // Copy profile-specific files
  for (const f of PROFILE_FILES) {
    const src = join(sourceDir, f);
    if (existsSync(src)) {
      copyFileSync(src, join(dir, f));
    }
  }

  // Copy profile-specific dirs
  for (const d of PROFILE_DIRS) {
    const src = join(sourceDir, d);
    if (existsSync(src)) {
      cpSync(src, join(dir, d), { recursive: true });
    }
  }

  if (shareSettings) {
    // Copy shared files from source to _shared if they have content
    for (const f of SHARED_FILES) {
      const src = join(sourceDir, f);
      const sharedDest = join(SHARED_DIR, f);
      if (existsSync(src)) {
        const content = readFileSync(src, 'utf8');
        if (content.trim() !== '{}' && content.trim() !== '') {
          writeFileSync(sharedDest, content);
        }
      }
      const link = join(dir, f);
      if (!existsSync(link)) {
        symlinkSync(join('..', '_shared', f), link);
      }
    }
    for (const d of SHARED_DIRS) {
      const src = join(sourceDir, d);
      const sharedDest = join(SHARED_DIR, d);
      if (existsSync(src)) {
        cpSync(src, sharedDest, { recursive: true });
      }
      const link = join(dir, d);
      if (!existsSync(link)) {
        symlinkSync(join('..', '_shared', d), link);
      }
    }
  } else {
    for (const f of SHARED_FILES) {
      const src = join(sourceDir, f);
      if (existsSync(src)) {
        copyFileSync(src, join(dir, f));
      }
    }
    for (const d of SHARED_DIRS) {
      const src = join(sourceDir, d);
      if (existsSync(src)) {
        cpSync(src, join(dir, d), { recursive: true });
      }
    }
  }

  addProfileToMeta(profileName);
}
