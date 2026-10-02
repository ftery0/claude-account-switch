import { readFileSync, writeFileSync, renameSync, unlinkSync, mkdirSync } from 'node:fs';
import { dirname, join, basename } from 'node:path';

export function readJsonFile(filePath, fallback = {}) {
  let raw;
  try {
    raw = readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
  } catch (err) {
    if (err.code === 'ENOENT') return structuredClone(fallback);
    throw err;
  }
  try {
    return JSON.parse(raw);
  } catch (err) {
    throw new Error(`Invalid JSON in ${filePath}: ${err.message}`);
  }
}

export function writeJsonFile(filePath, data) {
  mkdirSync(dirname(filePath), { recursive: true });
  const content = JSON.stringify(data, null, 2) + '\n';
  const tmp = join(dirname(filePath), `.${basename(filePath)}.${process.pid}.tmp`);
  writeFileSync(tmp, content);
  try {
    renameSync(tmp, filePath);
  } catch (err) {
    try { unlinkSync(tmp); } catch {}
    throw err;
  }
}
