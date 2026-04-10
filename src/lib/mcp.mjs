import { readFileSync, writeFileSync, renameSync, unlinkSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { PROFILES_DIR, SHARED_DIR } from './constants.mjs';

// ── 파일 읽기/쓰기 (config.mjs의 atomic write 패턴 재사용) ──────────────────

export function readSettingsFile(filePath) {
  if (!existsSync(filePath)) return {};
  try {
    const raw = readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export function writeSettingsFile(filePath, data) {
  mkdirSync(dirname(filePath), { recursive: true });
  const content = JSON.stringify(data, null, 2) + '\n';
  const tmp = join(dirname(filePath), `.settings.${process.pid}.tmp`);
  writeFileSync(tmp, content);
  try {
    renameSync(tmp, filePath);
  } catch {
    writeFileSync(filePath, content);
    try { unlinkSync(tmp); } catch {}
  }
}

// ── 경로 헬퍼 ────────────────────────────────────────────────────────────────

export function sharedSettingsPath() {
  return join(SHARED_DIR, 'settings.json');
}

export function profileLocalPath(profileName) {
  return join(PROFILES_DIR, profileName, 'settings.local.json');
}

// ── MCP 서버 읽기/쓰기 ───────────────────────────────────────────────────────

export function readMcpServers(filePath) {
  const data = readSettingsFile(filePath);
  return data.mcpServers ?? {};
}

export function writeMcpServers(filePath, mcpServers) {
  const data = readSettingsFile(filePath);
  data.mcpServers = mcpServers;
  writeSettingsFile(filePath, data);
}

// ── 비활성화 목록 읽기/쓰기 ─────────────────────────────────────────────────

export function readDisabledMcps(profileName) {
  const data = readSettingsFile(profileLocalPath(profileName));
  return data.disabledMcpServers ?? [];
}

export function writeDisabledMcps(profileName, list) {
  const filePath = profileLocalPath(profileName);
  const data = readSettingsFile(filePath);
  if (list.length === 0) {
    delete data.disabledMcpServers;
  } else {
    data.disabledMcpServers = list;
  }
  writeSettingsFile(filePath, data);
}

// ── 전체 MCP 집계 ────────────────────────────────────────────────────────────

/**
 * 모든 프로필의 MCP 목록을 집계합니다.
 * @param {string[]} profiles - 프로필 이름 배열
 * @returns {{ shared: object, profiles: object }}
 *   shared: { name → mcpConfig }
 *   profiles: { profileName → { own: { name → mcpConfig }, disabled: string[] } }
 */
export function listAllMcps(profiles) {
  const sharedPath = sharedSettingsPath();
  const shared = readMcpServers(sharedPath);

  const profileMap = {};
  for (const p of profiles) {
    const localPath = profileLocalPath(p);
    const own = readMcpServers(localPath);
    const disabled = readDisabledMcps(p);
    profileMap[p] = { own, disabled };
  }

  return { shared, profiles: profileMap };
}
