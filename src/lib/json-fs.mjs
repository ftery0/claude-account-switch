import { readFileSync, writeFileSync, renameSync, unlinkSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join, basename } from 'node:path';

/**
 * Read JSON from disk with BOM stripping (PowerShell 5.1 UTF-8 emits BOM).
 * Returns `fallback` (deep-cloned via spread) when the file is missing,
 * empty, or contains invalid JSON.
 */
export function readJsonFile(filePath, fallback = {}) {
  if (!existsSync(filePath)) return clone(fallback);
  try {
    const raw = readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
    return JSON.parse(raw);
  } catch {
    return clone(fallback);
  }
}

/**
 * Atomic JSON write: write to a temp file then rename to avoid partial-write
 * corruption from concurrent writers. Falls back to direct overwrite on
 * Windows when rename fails (EPERM during AV / indexer locks).
 */
export function writeJsonFile(filePath, data) {
  mkdirSync(dirname(filePath), { recursive: true });
  const content = JSON.stringify(data, null, 2) + '\n';
  const tmp = join(dirname(filePath), `.${basename(filePath)}.${process.pid}.tmp`);
  writeFileSync(tmp, content);
  try {
    renameSync(tmp, filePath);
  } catch {
    writeFileSync(filePath, content);
    try { unlinkSync(tmp); } catch {}
  }
}

function clone(value) {
  return value && typeof value === 'object' ? { ...value } : value;
}
