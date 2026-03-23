import {
  existsSync, mkdirSync, rmSync, symlinkSync,
  copyFileSync, cpSync, writeFileSync, readFileSync,
} from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import {
  IS_WINDOWS, PROFILES_DIR, SHARED_DIR, PROFILE_NAME_REGEX, PROFILE_NAME_MAX_LENGTH,
  RESERVED_NAMES, SHARED_FILES, SHARED_DIRS, PROFILE_FILES, PROFILE_DIRS,
} from './constants.mjs';
import { addProfileToMeta, removeProfileFromMeta, readMeta } from './config.mjs';
import { warn } from './ui.mjs';

/**
 * Creates a symbolic link from `link` pointing to `relTarget` (relative path).
 *
 * Windows behaviour:
 *   - Directories: junction point (no admin/developer mode required)
 *   - Files: tries a real symlink; if EPERM (no developer mode), copies the
 *     file instead and warns the user that changes won't auto-sync.
 *
 * Unix behaviour: plain symlink with the relative target path.
 */
function createLink(relTarget, link, isDir) {
  if (existsSync(link)) return;
  if (IS_WINDOWS) {
    const absTarget = resolve(dirname(link), relTarget);
    if (isDir) {
      // Junction points work on Windows without elevated privileges
      symlinkSync(absTarget, link, 'junction');
    } else {
      try {
        symlinkSync(absTarget, link);
      } catch (err) {
        if (err.code === 'EPERM' || err.code === 'ENOTSUP') {
          // Developer Mode is off — fall back to a plain copy
          copyFileSync(absTarget, link);
          warn(`Symlink unavailable: copied shared file instead (${link}).`);
          warn(`Enable Windows Developer Mode for full shared-settings sync.`);
        } else {
          throw err;
        }
      }
    }
  } else {
    symlinkSync(relTarget, link);
  }
}

export function validateProfileName(name) {
  if (!name) {
    return 'Profile name cannot be empty';
  }
  if (name.length > PROFILE_NAME_MAX_LENGTH) {
    return `Profile name must be ${PROFILE_NAME_MAX_LENGTH} characters or fewer`;
  }
  if (RESERVED_NAMES.includes(name)) {
    return `"${name}" is a reserved name`;
  }
  if (!PROFILE_NAME_REGEX.test(name)) {
    return 'Only lowercase letters, numbers, and hyphens allowed (must start/end with letter or number)';
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
      createLink(join('..', '_shared', f), join(dir, f), false);
    }
    for (const d of SHARED_DIRS) {
      createLink(join('..', '_shared', d), join(dir, d), true);
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
      createLink(join('..', '_shared', f), join(dir, f), false);
    }
    for (const d of SHARED_DIRS) {
      const src = join(sourceDir, d);
      const sharedDest = join(SHARED_DIR, d);
      if (existsSync(src)) {
        cpSync(src, sharedDest, { recursive: true });
      }
      createLink(join('..', '_shared', d), join(dir, d), true);
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
