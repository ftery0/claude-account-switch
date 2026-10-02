#!/usr/bin/env node

import { existsSync, readFileSync, lstatSync, realpathSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const profiles = join(homedir(), '.claude-profiles');
const installedEntry = join(profiles, '_runtime', 'bin', 'cli.mjs');
const pointer = join(profiles, '_runtime-current.json');
let entry = join(dirname(fileURLToPath(import.meta.url)), '../src/index.mjs');
if (existsSync(installedEntry) && realpathSync(fileURLToPath(import.meta.url)) === realpathSync(installedEntry) && existsSync(pointer)) {
  if (lstatSync(pointer).isSymbolicLink()) throw new Error('Runtime pointer must not be a symlink');
  const { directory } = JSON.parse(readFileSync(pointer, 'utf8'));
  if (typeof directory !== 'string' || !/^v[\w.-]+$/.test(directory)) throw new Error('Invalid runtime pointer');
  const versions = join(profiles, '_runtime-updates');
  const runtime = join(versions, directory);
  if (lstatSync(versions).isSymbolicLink() || lstatSync(runtime).isSymbolicLink()) throw new Error('Runtime must not be a symlink');
  entry = join(runtime, 'src/index.mjs');
}
const { run } = await import(pathToFileURL(entry).href);
run(process.argv.slice(2));
