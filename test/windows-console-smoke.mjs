import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createShellFixture, findShell } from './cross-shell-smoke.mjs';

export function checkWindowsConsole() {
  assert.equal(process.platform, 'win32', 'This check needs a native Windows console API');
  const fixture = createShellFixture();
  try {
    const source = join(dirname(fileURLToPath(import.meta.url)), 'fixtures/windows-console.cs');
    const host = join(fixture.temp, 'console-smoke.exe');
    const compile = 'Add-Type -TypeDefinition (Get-Content -Raw -LiteralPath $env:CAS_CONSOLE_SOURCE) -OutputAssembly $env:CAS_CONSOLE_HOST -OutputType ConsoleApplication -ErrorAction Stop';
    const compilation = spawnSync(findShell('powershell'), ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', compile], {
      env: { ...fixture.env, CAS_CONSOLE_SOURCE: source, CAS_CONSOLE_HOST: host },
      encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 120000,
    });
    assert.equal(compilation.status, 0, compilation.stderr || String(compilation.error));
    const cli = fileURLToPath(new URL('../bin/cli.mjs', import.meta.url));
    const install = spawnSync(process.execPath, [cli, 'install-shell'], { env: fixture.env, encoding: 'utf8', timeout: 30000 });
    assert.equal(install.status, 0, install.stderr);
    const marker = join(fixture.temp, 'fake-started.jsonl');
    const log = join(fixture.temp, 'console-output.txt');
    const rc = join(fixture.home, 'Documents/WindowsPowerShell/Microsoft.PowerShell_profile.ps1');
    const before = readFileSync(rc);
    const runtime = join(fixture.profilesDir, '_runtime/bin/cli.mjs');
    const probe = join(fixture.temp, 'tty-probe.mjs');
    writeFileSync(probe, `if(!process.stdin.isTTY||!process.stdout.isTTY)throw new Error('Console TTY unavailable');\nprocess.argv=[process.execPath,${JSON.stringify(runtime)},'shell','launch'];\nawait import(${JSON.stringify(pathToFileURL(runtime).href)});\n`);
    const result = spawnSync(host, [], {
      env: { ...fixture.env, CAS_CONSOLE_COMMAND: `"${process.execPath}" "${probe}"`,
        CAS_CONSOLE_LOG: log, CAS_FAKE_MARKER: marker, CAS_FAKE_SLEEP_MS: '120000', CAS_FAKE_QUIET: '1' },
      encoding: 'utf8', timeout: 100000, stdio: ['ignore', 'pipe', 'pipe'],
    });
    assert.equal(result.status, 0, result.stderr || String(result.error));
    const consoleResult = JSON.parse(result.stdout.trim());
    assert.equal(consoleResult.sentCtrlC, true);
    assert.equal(consoleResult.exitCode, 130, readFileSync(log, 'utf8'));
    const child = JSON.parse(readFileSync(marker, 'utf8').trim());
    assert.equal(child.config, join(fixture.profilesDir, 'work'));
    assert.equal(child.stdinTty, true);
    assert.ok(Number.isInteger(child.pid));
    assert.throws(() => process.kill(child.pid, 0), error => error.code === 'ESRCH', 'Claude fixture must not remain running');
    assert.deepEqual(readFileSync(rc), before);
    return { ok: true, platform: process.platform, checks: ['native-ConPTY', 'stdin-and-stdout-TTY', 'Ctrl-C130', 'child-exited', 'profile-preserved'] };
  } finally {
    rmSync(fixture.workspace, { recursive: true, force: true });
  }
}

if (process.argv.includes('--run')) console.log(JSON.stringify(checkWindowsConsole()));
