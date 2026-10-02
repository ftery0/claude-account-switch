import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { after } from 'node:test';

const testRoot = mkdtempSync(join(tmpdir(), 'claude-switch-test-'));
const inheritedPath = process.env.PATH;
const retained = new Set([
  'PATH', 'SystemRoot', 'SYSTEMROOT', 'WINDIR', 'ComSpec', 'COMSPEC', 'PATHEXT',
  'LD_LIBRARY_PATH', 'DYLD_LIBRARY_PATH', 'NODE_TEST_CONTEXT',
]);
for (const key of Object.keys(process.env)) {
  if (!retained.has(key) || key.toUpperCase() === 'PATH') delete process.env[key];
}
const home = join(testRoot, 'home');
const temp = join(testRoot, 'tmp');
const cache = join(testRoot, 'cache');
const guard = join(testRoot, 'guard');
for (const directory of [home, temp, cache, guard]) mkdirSync(directory);
Object.assign(process.env, {
  HOME: home, USERPROFILE: home, TMPDIR: temp, TMP: temp, TEMP: temp,
  XDG_CONFIG_HOME: join(testRoot, 'config'), XDG_CACHE_HOME: cache,
  APPDATA: join(testRoot, 'appdata'), LOCALAPPDATA: join(testRoot, 'localappdata'),
  npm_config_cache: join(cache, 'npm'), npm_config_userconfig: join(testRoot, 'npmrc'),
  npm_config_globalconfig: join(testRoot, 'npmrc-global'), npm_config_offline: 'true',
  GIT_CONFIG_GLOBAL: join(testRoot, 'gitconfig'), GIT_CONFIG_NOSYSTEM: '1',
  CLAUDE_SWITCH_DISABLE_AUTO_UPDATE: '1', NO_COLOR: '1',
});
for (const name of ['npmrc', 'npmrc-global', 'gitconfig']) writeFileSync(join(testRoot, name), '');
if (process.platform === 'win32') {
  // Node cannot make a Claude request if a fixture forgets its own fake binary.
  copyFileSync(process.execPath, join(guard, 'claude.exe'));
} else {
  writeFileSync(join(guard, 'claude'), '#!/bin/sh\necho "Unexpected Claude invocation outside a fixture" >&2\nexit 97\n', { mode: 0o755 });
}
process.env.PATH = [guard, inheritedPath].filter(Boolean).join(delimiter);

after(() => rmSync(testRoot, { recursive: true, force: true }));
