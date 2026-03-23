import { homedir } from 'node:os';
import { join } from 'node:path';

export const HOME = homedir();
export const IS_WINDOWS = process.platform === 'win32';
export const PROFILES_DIR = join(HOME, '.claude-profiles');
export const SHARED_DIR = join(PROFILES_DIR, '_shared');
export const META_FILE = join(PROFILES_DIR, 'meta.json');

export const DEFAULT_CLAUDE_DIR = join(HOME, '.claude');

export const PROFILE_NAME_REGEX = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;
export const PROFILE_NAME_MAX_LENGTH = 30;
export const RESERVED_NAMES = ['_shared', 'default'];

// Files/dirs that are shared across profiles (symlinked)
export const SHARED_FILES = ['settings.json'];
export const SHARED_DIRS = ['commands'];

// Files/dirs that are profile-specific (copied independently)
export const PROFILE_FILES = ['.claude.json', 'settings.local.json'];
export const PROFILE_DIRS = ['plugins', 'projects', 'plans'];

// Files/dirs that are temporary (not managed)
export const TEMP_PATTERNS = ['cache', 'sessions', 'history.jsonl', 'session-env', 'shell-snapshots', 'paste-cache', 'file-history', 'backups', 'mcp-needs-auth-cache.json'];
