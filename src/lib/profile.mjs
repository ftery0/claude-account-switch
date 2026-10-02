import {
  existsSync, mkdirSync, rmSync, symlinkSync, copyFileSync, writeFileSync,
  readFileSync, lstatSync, statSync, readlinkSync, readdirSync, realpathSync,
  mkdtempSync, renameSync, chmodSync,
} from 'node:fs';
import { join, resolve, dirname, basename, relative, isAbsolute, sep } from 'node:path';
import {
  HOME, DEFAULT_CLAUDE_DIR, IS_WINDOWS, PROFILES_DIR, SHARED_DIR,
  PROFILE_NAME_REGEX, PROFILE_NAME_MAX_LENGTH, RESERVED_NAMES,
  SHARED_FILES, SHARED_DIRS, PROFILE_FILES, PROFILE_DIRS,
} from './constants.mjs';
import { addProfileToMeta, removeProfileFromMeta, readMeta } from './config.mjs';
import { warn } from './ui.mjs';

function pathExists(path) {
  try { lstatSync(path); return true; } catch (err) {
    if (err.code === 'ENOENT' || err.code === 'ENOTDIR') return false;
    throw err;
  }
}

function createLink(target, link, isDir, copySource = resolve(dirname(link), target)) {
  if (pathExists(link)) return;
  if (IS_WINDOWS && isDir) {
    symlinkSync(resolve(dirname(link), target), link, 'junction');
    return;
  }
  try {
    symlinkSync(target, link, isDir ? 'dir' : 'file');
  } catch (err) {
    if (!IS_WINDOWS || isDir || !['EPERM', 'ENOTSUP'].includes(err.code)) throw err;
    copyFileSync(copySource, link);
    warn(`Symlink unavailable: copied shared file instead (${link}).`);
    warn('Enable Windows Developer Mode for full shared-settings sync.');
  }
}

export function validateProfileName(name) {
  if (!name) return 'Profile name cannot be empty';
  if (name.length > PROFILE_NAME_MAX_LENGTH) {
    return `Profile name must be ${PROFILE_NAME_MAX_LENGTH} characters or fewer`;
  }
  if (RESERVED_NAMES.includes(name)) return `"${name}" is a reserved name`;
  if (IS_WINDOWS && /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(name)) {
    return `"${name}" is a reserved Windows device name`;
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
  for (const file of SHARED_FILES) {
    const path = join(SHARED_DIR, file);
    if (!pathExists(path)) writeFileSync(path, '{}');
  }
  for (const dir of SHARED_DIRS) mkdirSync(join(SHARED_DIR, dir), { recursive: true });
}

export function createProfile(name, shareSettings = true) {
  const error = validateProfileName(name);
  if (error) throw new Error(error);
  readMeta();
  const dir = profileDir(name);
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  if (shareSettings) {
    ensureShared();
    for (const file of SHARED_FILES) createLink(join('..', '_shared', file), join(dir, file), false);
    for (const entry of SHARED_DIRS) createLink(join('..', '_shared', entry), join(dir, entry), true);
  }
  for (const entry of PROFILE_DIRS) mkdirSync(join(dir, entry), { recursive: true });
  addProfileToMeta(name);
}

export function removeProfile(name) {
  const dir = profileDir(name);
  if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
  removeProfileFromMeta(name);
}

export function listProfiles() {
  return readMeta().profiles;
}

export function migrationSource(sourceDir) {
  const directory = resolve(sourceDir);
  const configured = process.env.CLAUDE_CONFIG_DIR;
  const useRootConfig = directory === resolve(DEFAULT_CLAUDE_DIR)
    && (!configured || directory !== resolve(configured));
  return {
    directory,
    userConfig: useRootConfig ? join(HOME, '.claude.json') : join(directory, '.claude.json'),
  };
}

function canonicalPath(path) {
  if (pathExists(path)) return realpathSync(path);
  return join(canonicalPath(dirname(path)), basename(path));
}

function pathsOverlap(left, right) {
  const distance = relative(left, right);
  return distance === '' || (distance !== '..' && !distance.startsWith(`..${sep}`) && !isAbsolute(distance));
}

function linkTarget(path) {
  return resolve(realpathSync(dirname(path)), readlinkSync(path));
}

function copyEntry(source, destination) {
  const info = lstatSync(source);
  if (info.isSymbolicLink()) {
    const target = linkTarget(source);
    const kind = existsSync(source) && statSync(source).isDirectory() ? 'dir' : 'file';
    createLink(target, destination, kind === 'dir');
  } else if (info.isDirectory()) {
    mkdirSync(destination, { recursive: true, mode: info.mode & 0o777 });
    for (const entry of readdirSync(source)) copyEntry(join(source, entry), join(destination, entry));
  } else if (info.isFile()) {
    copyFileSync(source, destination);
  } else {
    throw new Error(`Unsupported migration entry: ${source}`);
  }
}

function identicalEntries(source, destination) {
  let from = lstatSync(source);
  let to = lstatSync(destination);
  if (from.isSymbolicLink() && to.isSymbolicLink() && linkTarget(source) === linkTarget(destination)) return true;
  if (from.isSymbolicLink()) {
    if (!existsSync(source)) return false;
    from = statSync(source);
  }
  if (to.isSymbolicLink()) {
    if (!existsSync(destination)) return false;
    to = statSync(destination);
  }
  if (from.isFile() && to.isFile()) return readFileSync(source).equals(readFileSync(destination));
  if (!from.isDirectory() || !to.isDirectory()) return false;
  const entries = readdirSync(source).sort();
  const existing = readdirSync(destination).sort();
  return entries.length === existing.length && entries.every((entry, index) =>
    entry === existing[index] && identicalEntries(join(source, entry), join(destination, entry)));
}

function emptyEntry(path) {
  const info = lstatSync(path);
  if (info.isSymbolicLink()) return false;
  if (info.isDirectory()) return readdirSync(path).length === 0;
  if (!info.isFile()) return false;
  const content = readFileSync(path, 'utf8').trim();
  return content === '' || (path.endsWith('.json') && content === '{}');
}

function validateJson(source) {
  if (!source.endsWith('.json')) return;
  let value;
  try { value = JSON.parse(readFileSync(source, 'utf8').replace(/^\uFEFF/, '')); } catch {
    throw new Error(`Invalid JSON in migration source: ${source}`);
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`Expected a JSON object in migration source: ${source}`);
  }
}

function stageEntry(source, destination) {
  if (!pathExists(source)) return;
  if (pathExists(destination)) {
    if (identicalEntries(source, destination) || emptyEntry(source)) return;
    if (!emptyEntry(destination)) throw new Error(`Migration conflict: ${destination}`);
    rmSync(destination, { recursive: true, force: true });
  }
  copyEntry(source, destination);
}

function prepareMigration(source, profileName, shareSettings, stage) {
  const target = profileDir(profileName);
  const stagedProfile = join(stage, 'profile');
  const stagedShared = join(stage, '_shared');
  for (const [current, staged] of [[target, stagedProfile], [SHARED_DIR, stagedShared]]) {
    if (current === SHARED_DIR && !shareSettings) continue;
    if (pathExists(current)) {
      if (!lstatSync(current).isDirectory()) throw new Error(`Migration target must be a directory: ${current}`);
      copyEntry(current, staged);
    } else mkdirSync(staged, { mode: 0o700 });
  }
  for (const file of PROFILE_FILES) {
    const from = file === '.claude.json' ? source.userConfig : join(source.directory, file);
    if (!pathExists(from)) continue;
    validateJson(from);
    const destination = join(stagedProfile, file);
    if (file === '.claude.json' || file === '.credentials.json') {
      if (pathExists(destination) && !emptyEntry(destination)
        && !readFileSync(from).equals(readFileSync(destination))) {
        throw new Error(`Migration conflict: ${join(target, file)}`);
      }
      if (pathExists(destination)) rmSync(destination, { force: true });
      writeFileSync(destination, readFileSync(from), { mode: 0o600 });
    } else stageEntry(from, destination);
  }
  for (const entry of PROFILE_DIRS) {
    stageEntry(join(source.directory, entry), join(stagedProfile, entry));
    if (!pathExists(join(stagedProfile, entry))) mkdirSync(join(stagedProfile, entry));
  }
  for (const entry of [...SHARED_FILES, ...SHARED_DIRS]) {
    const shared = shareSettings ? stagedShared : stagedProfile;
    const from = join(source.directory, entry);
    if (pathExists(from)) validateJson(from);
    stageEntry(from, join(shared, entry));
    if (!shareSettings) continue;
    const isDir = SHARED_DIRS.includes(entry);
    if (!pathExists(join(shared, entry))) {
      if (isDir) mkdirSync(join(shared, entry));
      else writeFileSync(join(shared, entry), '{}');
    }
    const link = join(stagedProfile, entry);
    if (pathExists(link)) {
      const original = join(target, entry);
      const linkedShared = lstatSync(link).isSymbolicLink()
        && canonicalPath(linkTarget(link)) === canonicalPath(join(SHARED_DIR, entry));
      if (!linkedShared && !identicalEntries(link, join(shared, entry)) && !emptyEntry(link)) {
        throw new Error(`Migration conflict: ${original}`);
      }
      rmSync(link, { recursive: true, force: true });
    }
    const linkPath = IS_WINDOWS ? join(SHARED_DIR, entry) : join('..', '_shared', entry);
    createLink(linkPath, link, isDir, join(shared, entry));
  }
  chmodSync(stagedProfile, 0o700);
  return shareSettings
    ? [[stagedShared, SHARED_DIR], [stagedProfile, target]]
    : [[stagedProfile, target]];
}

export function migrateDir(sourceDir, profileName, shareSettings = true) {
  const error = validateProfileName(profileName);
  if (error) throw new Error(error);
  readMeta();
  const source = migrationSource(sourceDir);
  if (!existsSync(source.directory) && !existsSync(source.userConfig)) {
    throw new Error(`Claude configuration not found: ${source.directory}`);
  }
  if (existsSync(source.directory) && !statSync(source.directory).isDirectory()) {
    throw new Error(`Migration source must be a directory: ${source.directory}`);
  }
  const from = canonicalPath(source.directory);
  for (const path of [profileDir(profileName), ...(shareSettings ? [SHARED_DIR] : [])]) {
    const to = canonicalPath(path);
    if (pathsOverlap(from, to) || pathsOverlap(to, from)) {
      throw new Error(`Migration source and target overlap: ${source.directory} and ${path}`);
    }
  }
  mkdirSync(PROFILES_DIR, { recursive: true });
  const stage = mkdtempSync(join(PROFILES_DIR, '.migration-'));
  const published = [];
  let cleanup = true;
  try {
    const entries = prepareMigration(source, profileName, shareSettings, stage);
    for (const [staged, destination] of entries) {
      const backup = join(stage, `backup-${published.length}`);
      const hadOriginal = pathExists(destination);
      if (hadOriginal) renameSync(destination, backup);
      published.push({ destination, backup, hadOriginal });
      renameSync(staged, destination);
    }
    addProfileToMeta(profileName);
  } catch (err) {
    const rollbackErrors = [];
    for (const { destination, backup, hadOriginal } of published.reverse()) {
      try {
        rmSync(destination, { recursive: true, force: true });
        if (hadOriginal) renameSync(backup, destination);
      } catch (rollbackError) {
        rollbackErrors.push(rollbackError);
      }
    }
    if (rollbackErrors.length > 0) {
      cleanup = false;
      throw new Error(`Migration rollback failed. Original backups were preserved in ${stage}. Restore them before continuing.`, { cause: err });
    }
    throw err;
  } finally {
    if (cleanup) rmSync(stage, { recursive: true, force: true });
  }
}
