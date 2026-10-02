import './helpers/home.mjs';
import { after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, statSync, cpSync, rmSync } from 'node:fs';
import { dirname, join, win32 } from 'node:path';
import { runInNewContext } from 'node:vm';
import { fileURLToPath } from 'node:url';
import { createShellFixture, findShell, shellArguments, sourceIntegration } from './cross-shell-smoke.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const CLI = join(root, 'bin/cli.mjs');
const windows = process.platform === 'win32';
const defaultShell = findShell(windows ? 'powershell' : 'bash');
const fixtures = [];
after(() => fixtures.forEach(fixture => rmSync(fixture.workspace, { recursive: true, force: true })));

function makeHome(profiles = ['work']) {
  const fixture = createShellFixture(profiles, defaultShell);
  fixtures.push(fixture);
  return fixture;
}

function makeNpmFallback(fixture) {
  const npmRoot = join(fixture.cache, 'npm-root');
  const packageDir = join(npmRoot, '@anthropic-ai', 'claude-code');
  mkdirSync(packageDir, { recursive: true });
  writeFileSync(join(packageDir, 'cli.js'), `console.log(JSON.stringify({fake:true,args:process.argv.slice(2),config:process.env.CLAUDE_CONFIG_DIR}));process.exit(Number(process.env.CAS_FAKE_EXIT||0));\n`);
  const npmScript = join(fixture.workspace, 'fake-npm.cjs');
  writeFileSync(npmScript, `if(process.argv[2]==='root'&&process.argv[3]==='-g')console.log(process.env.CAS_FAKE_NPM_ROOT);else process.exit(91);\n`);
  writeFileSync(join(fixture.binDir, 'npm.cmd'), '@echo off\r\n"%CAS_FAKE_NODE%" "%CAS_FAKE_NPM_JS%" %*\r\n');
  Object.assign(fixture.env, { CAS_FAKE_NODE: fixture.node, CAS_FAKE_NPM_JS: npmScript, CAS_FAKE_NPM_ROOT: npmRoot });
  rmSync(fixture.bin);
}

function start(command, args, env) {
  const child = spawn(command, args, { env, stdio: ['ignore', 'pipe', 'pipe'] });
  const result = new Promise((resolve, reject) => {
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', data => { stdout += data; });
    child.stderr.on('data', data => { stderr += data; });
    child.once('error', reject);
    child.once('close', (code, signal) => resolve({ code, signal, stdout, stderr }));
  });
  return { child, result };
}

function runCli(args, fixture, cli = CLI) {
  return start(process.execPath, [cli, ...args], fixture.env).result;
}

function runShell(script, fixture, command = defaultShell) {
  assert.ok(command, 'A shell is required for this test');
  return start(command, shellArguments(command, script), fixture.env).result;
}

function nativeOutput(result) {
  assert.equal(result.code, 0, result.stderr);
  const output = JSON.parse(result.stdout.trim());
  assert.equal(output.fake, true);
  return output;
}

describe('shell command and local runtime', () => {
  it('forwards help, version, spaces, empty args and status to Claude', async () => {
    const fixture = makeHome();
    const args = ['--help', '--version', '--model', 'a b', '', '$literal', 'quote"value', '한글'];
    const output = nativeOutput(await runCli(['shell', 'launch', ...args], fixture));
    assert.deepEqual(output.args, args);
    assert.equal(output.config, join(fixture.profilesDir, 'work'));
    fixture.env.CAS_FAKE_EXIT = '42';
    assert.equal((await runCli(['shell', 'launch'], fixture)).code, 42);
  });

  it('uses the active profile in noninteractive selection', async () => {
    const fixture = makeHome(['work', 'personal']);
    assert.equal((await runCli(['shell', 'use', 'personal'], fixture)).code, 0);
    const picked = await runCli(['shell', 'pick', '--print'], fixture);
    assert.equal(picked.stdout, 'personal\n');
    assert.equal(picked.stderr, '');
    assert.equal(nativeOutput(await runCli(['shell', 'launch'], fixture)).config, join(fixture.profilesDir, 'personal'));
  });

  it('uses the Windows npm JS fallback with preserved arguments and status', async t => {
    if (!windows) return t.skip('Windows npm.cmd fallback requires native Windows');
    const fixture = makeHome();
    makeNpmFallback(fixture);
    const args = ['--help', 'a b', '', 'quote"value', '한글'];
    const output = nativeOutput(await runCli(['shell', 'launch', ...args], fixture));
    assert.deepEqual(output.args, args);
    assert.equal(output.config, join(fixture.profilesDir, 'work'));
    fixture.env.CAS_FAKE_EXIT = '42';
    assert.equal((await runCli(['shell', 'launch'], fixture)).code, 42);
  });

  it('does not select a Windows PATH POSIX shim before the npm JS fallback', async t => {
    if (!windows) return t.skip('Windows extensionless shim selection requires native Windows');
    const fixture = makeHome();
    makeNpmFallback(fixture);
    writeFileSync(join(fixture.binDir, 'claude'), '#!/bin/sh\nexit 97\n');
    const args = ['--version', 'a b', '', 'quote"value', '한글'];
    const output = nativeOutput(await runCli(['shell', 'launch', ...args], fixture));
    assert.deepEqual(output.args, args);
    assert.equal(output.config, join(fixture.profilesDir, 'work'));
  });

  it('read commands and profile switching leave shell files untouched', async () => {
    const fixture = makeHome(['work', 'personal']);
    assert.equal((await runCli(['install-shell'], fixture)).code, 0);
    const rc = windows ? 'Documents/PowerShell/Microsoft.PowerShell_profile.ps1' : '.bashrc';
    const extension = windows ? 'ps1' : 'sh';
    const paths = [rc, `.claude-profiles/.shell-integration.${extension}`, '.claude-profiles/_runtime/bin/cli.mjs'];
    const original = paths.map(path => [readFileSync(join(fixture.home, path)), statSync(join(fixture.home, path)).mtimeMs]);
    for (const args of [['list'], ['use', 'personal'], ['init'], ['--help'], ['--version']]) {
      assert.equal((await runCli(args, fixture)).code, 0);
    }
    paths.forEach((path, index) => {
      assert.deepEqual(readFileSync(join(fixture.home, path)), original[index][0]);
      assert.equal(statSync(join(fixture.home, path)).mtimeMs, original[index][1]);
    });
  });

  it('keeps working after its temporary installation source is removed', async t => {
    if (!defaultShell) return t.skip('The platform shell is not installed');
    const fixture = makeHome();
    const cache = join(fixture.cache, 'temporary-npx-package');
    mkdirSync(cache);
    for (const path of ['package.json', 'bin', 'src']) cpSync(join(root, path), join(cache, path), { recursive: true });
    const installed = await runCli(['install-shell'], fixture, join(cache, 'bin/cli.mjs'));
    assert.equal(installed.code, 0, installed.stderr);
    rmSync(cache, { recursive: true });
    const output = nativeOutput(await runShell(sourceIntegration(fixture) + 'claude --help "a b"', fixture));
    assert.deepEqual(output.args, ['--help', 'a b']);
    assert.equal(output.config, join(fixture.profilesDir, 'work'));
    const runtime = join(fixture.profilesDir, '_runtime/bin/cli.mjs');
    assert.equal((await runCli(['shell', 'refresh'], fixture, runtime)).code, 0);
    assert.equal(nativeOutput(await runShell(sourceIntegration(fixture) + 'claude --version', fixture)).args[0], '--version');
  });

  it('runs profile hooks without leaking environment into the parent shell', async t => {
    if (!defaultShell) return t.skip('The platform shell is not installed');
    const fixture = makeHome();
    writeFileSync(join(fixture.profilesDir, windows ? 'work/pre-launch.ps1' : 'work/pre-launch.sh'), windows ? "$env:CAS_HOOK='profile value'\n" : 'CAS_HOOK="profile value"\n');
    assert.equal((await runCli(['install-shell'], fixture)).code, 0);
    const parent = windows ? '; Write-Output ("PARENT=" + $env:CAS_HOOK)' : '; printf "PARENT=%s\\n" "${CAS_HOOK-unset}"';
    const result = await runShell(sourceIntegration(fixture) + 'claude' + parent, fixture);
    assert.equal(result.code, 0, result.stderr);
    const [line, parentValue] = result.stdout.trim().split(/\r?\n/);
    assert.equal(JSON.parse(line).hook, 'profile value');
    assert.equal(parentValue, windows ? 'PARENT=' : 'PARENT=unset');
  });

  it('preserves the launch override call point and hook failures', async t => {
    if (!defaultShell) return t.skip('The platform shell is not installed');
    const fixture = makeHome();
    assert.equal((await runCli(['install-shell'], fixture)).code, 0);
    const override = windows ? 'function __claude_switch_launch { $args | ConvertTo-Json -Compress }; ' : '__claude_switch_launch() { printf "%s\\n" "$@"; }; ';
    const custom = await runShell(sourceIntegration(fixture) + override + 'claude "a b"', fixture);
    assert.equal(custom.stdout.trim(), windows ? '["work","a b"]' : 'work\na b');
    writeFileSync(join(fixture.profilesDir, windows ? 'work/pre-launch.ps1' : 'work/pre-launch.sh'), windows ? "throw 'fixture hook failure'\n" : 'return 17\n');
    const ending = windows ? '; exit $LASTEXITCODE' : '';
    const failed = await runShell(sourceIntegration(fixture) + 'claude' + ending, fixture);
    assert.equal(failed.code, windows ? 1 : 17);
    assert.equal(failed.stdout, '');
  });

  it('supports zsh without loading the actual user rc', async t => {
    const zsh = windows ? undefined : findShell('zsh');
    if (!zsh) return t.skip('Native zsh is not available on this platform');
    const fixture = makeHome();
    assert.equal((await runCli(['install-shell'], fixture)).code, 0);
    const result = await runShell(sourceIntegration(fixture, zsh) + 'cpf work; claude --help', fixture, zsh);
    assert.equal(result.code, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout.trim().split('\n').at(-1)).args, ['--help']);
  });

  it('returns an actionable error if the installed runtime is missing', async t => {
    if (!defaultShell) return t.skip('The platform shell is not installed');
    const fixture = makeHome();
    assert.equal((await runCli(['install-shell'], fixture)).code, 0);
    rmSync(join(fixture.profilesDir, '_runtime'), { recursive: true });
    const result = await runShell(sourceIntegration(fixture) + 'claude' + (windows ? '; exit $LASTEXITCODE' : ''), fixture);
    assert.equal(result.code, 127);
    assert.match(result.stderr, /install-shell/);
    assert.equal(result.stdout, '');
  });

  it('forwards termination to Claude and returns its signal status', async t => {
    if (windows) return t.skip('POSIX SIGTERM/143 semantics do not apply to native Windows processes');
    const fixture = makeHome();
    fixture.env.CAS_FAKE_SLEEP_MS = '100000';
    const { child, result } = start(process.execPath, [CLI, 'shell', 'launch'], fixture.env);
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => { child.kill(); reject(new Error('Claude did not start')); }, 5000);
      child.stdout.once('data', () => { clearTimeout(timeout); resolve(); });
    });
    child.kill('SIGTERM');
    const ended = await result;
    assert.equal(ended.code, 143, ended.stderr);
  });
});

describe('Windows resolver logic in win32 VM (not native execution)', () => {
  const directory = 'C:\\fake-bin';
  const npmRoot = 'C:\\fake-npm';
  const native = win32.join(directory, 'claude.exe');
  const shim = win32.join(directory, 'claude');
  const packageDir = win32.join(npmRoot, '@anthropic-ai/claude-code');
  const npmJs = win32.join(packageDir, 'cli.js');
  const source = readFileSync(join(root, 'src/commands/shell.mjs'), 'utf8');
  const resolver = source.slice(source.indexOf('function executable(file)'));
  const cases = [
    ['ignores a PATH POSIX shim without fallback', { [shim]: true }, null],
    ['ignores a PATH POSIX shim before npm JS', { [shim]: true, [npmJs]: true }, npmJs],
    ['ignores the global npm POSIX bin before npm JS', { [win32.join(packageDir, 'bin/claude')]: true, [npmJs]: true }, npmJs],
    ['ignores a claude.exe directory before npm JS', { [native]: false, [npmJs]: true }, npmJs],
    ['ignores a cli.js directory even when Node exists', { [npmJs]: false, 'C:\\fake-node.exe': true }, null],
    ['prefers a PATH native executable over npm JS', { [native]: true, [npmJs]: true }, native],
    ['returns null when no executable exists', {}, null],
  ];
  for (const [name, files, expected] of cases) {
    it(name, () => {
      const access = file => { if (!(file in files)) throw new Error('Fixture path not found'); };
      const context = {
        join: win32.join, delimiter: ';', IS_WINDOWS: true, HOME: 'C:\\fake-home',
        constants: { F_OK: 0 }, accessSync: access,
        statSync: file => { access(file); return { isFile: () => files[file] }; },
        process: { env: { PATH: directory }, execPath: 'C:\\fake-node.exe' },
        execFileSync: (command, args, options) => {
          assert.equal(command, 'npm.cmd');
          assert.deepEqual(Array.from(args), ['root', '-g']);
          assert.equal(options.shell, true);
          return npmRoot;
        },
      };
      assert.equal(runInNewContext(resolver + '\nresolveClaudeBinary();', context), expected);
    });
  }
});
