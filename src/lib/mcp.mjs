import { join } from 'node:path';
import { PROFILES_DIR, SHARED_DIR } from './constants.mjs';
import { readJsonFile, writeJsonFile } from './json-fs.mjs';

// ── Path helpers ────────────────────────────────────────────────────────────

export function sharedSettingsPath() {
  return join(SHARED_DIR, 'settings.json');
}

export function profileLocalPath(profileName) {
  return join(PROFILES_DIR, profileName, 'settings.local.json');
}

// ── MCP servers read/write ──────────────────────────────────────────────────

export function readMcpServers(filePath) {
  return readJsonFile(filePath).mcpServers ?? {};
}

export function writeMcpServers(filePath, mcpServers) {
  const data = readJsonFile(filePath);
  data.mcpServers = mcpServers;
  writeJsonFile(filePath, data);
}

// ── Disabled list read/write ────────────────────────────────────────────────

export function readDisabledMcps(profileName) {
  return readJsonFile(profileLocalPath(profileName)).disabledMcpServers ?? [];
}

export function writeDisabledMcps(profileName, list) {
  const filePath = profileLocalPath(profileName);
  const data = readJsonFile(filePath);
  if (list.length === 0) {
    delete data.disabledMcpServers;
  } else {
    data.disabledMcpServers = list;
  }
  writeJsonFile(filePath, data);
}

// ── Aggregate ───────────────────────────────────────────────────────────────

/**
 * Aggregate MCP servers across shared scope and every profile.
 * @param {string[]} profiles - profile names
 * @returns {{ shared: object, profiles: object }}
 *   shared: { name → mcpConfig }
 *   profiles: { profileName → { own: { name → mcpConfig }, disabled: string[] } }
 */
export function listAllMcps(profiles) {
  const shared = readMcpServers(sharedSettingsPath());
  const profileMap = {};
  for (const p of profiles) {
    profileMap[p] = {
      own: readMcpServers(profileLocalPath(p)),
      disabled: readDisabledMcps(p),
    };
  }
  return { shared, profiles: profileMap };
}
