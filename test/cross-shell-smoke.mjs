import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { accessSync, constants, copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, delimiter, dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repository = join(dirname(fileURLToPath(import.meta.url)), '..');
const windows = process.platform === 'win32';
const psQuote = value => "'" + value.replace(/'/g, "''") + "'";
const unixQuote = value => "'" + value.replace(/'/g, "'\\''") + "'";
let compiledFake;

function executable(file) {
  try { accessSync(file, windows ? constants.F_OK : constants.X_OK); return true; } catch { return false; }
}

export function findShell(kind) {
  const system = process.env.SystemRoot || process.env.SYSTEMROOT || 'C:\\Windows';
  const known = windows ? {
    powershell: [join(system, 'System32/WindowsPowerShell/v1.0/powershell.exe')],
    pwsh: ['C:\\Program Files\\PowerShell\\7\\pwsh.exe'],
    cmd: [join(system, 'System32/cmd.exe')],
  } : {
    bash: ['/bin/bash', '/usr/bin/bash'], zsh: ['/bin/zsh', '/usr/bin/zsh'],
    fish: ['/usr/bin/fish', '/usr/local/bin/fish', '/opt/homebrew/bin/fish'],
    pwsh: ['/usr/bin/pwsh', '/opt/microsoft/powershell/7/pwsh', '/opt/cas-pwsh/pwsh'],
  };
  const names = windows ? [`${kind}.exe`] : [kind];
  const candidates = [...(known[kind] || [])];
  for (const path of (process.env.PATH || '').split(delimiter)) {
    if (path) for (const name of names) candidates.push(join(path, name));
  }
  return candidates.find(executable);
}

export function compileFakeClaude(target, env) {
  if (!windows) throw new Error('Native C# fake compilation requires Windows');
  const compiler = findShell('powershell');
  if (!compiler) throw new Error('Windows PowerShell is required to compile the Framework test fixture');
  const source = join(repository, 'test/fixtures/fake-claude.cs');
  const command = 'Add-Type -TypeDefinition (Get-Content -Raw -LiteralPath $env:CAS_FAKE_SOURCE) -OutputAssembly $env:CAS_FAKE_TARGET -OutputType ConsoleApplication -ErrorAction Stop';
  const result = spawnSync(compiler, ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', command], {
    env: { ...env, CAS_FAKE_SOURCE: source, CAS_FAKE_TARGET: target },
    stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8', timeout: 120000,
  });
  assert.equal(result.status, 0, result.stderr || String(result.error));
  assert.ok(existsSync(target), 'C# compiler did not create the fake executable');
}

export function createShellFixture(profiles = ['work'], shell = findShell(windows ? 'powershell' : 'bash')) {
  const workspace = realpathSync.native(mkdtempSync(join(tmpdir(), 'cas-shell-fixture-')));
  try {
    const home = join(workspace, 'home with spaces');
    const temp = join(workspace, 'tmp');
    const cache = join(workspace, 'cache');
    const binDir = join(workspace, 'bin');
    for (const path of [home, temp, cache, binDir]) mkdirSync(path);
    const profilesDir = join(home, '.claude-profiles');
    mkdirSync(profilesDir);
    for (const name of profiles) mkdirSync(join(profilesDir, name));
    writeFileSync(join(profilesDir, 'meta.json'), JSON.stringify({ version: 1, activeProfile: profiles[0] || null, shareSettings: true, profiles }));
    const system = process.env.SystemRoot || process.env.SYSTEMROOT || 'C:\\Windows';
    const paths = windows ? [join(system, 'System32'), join(system, 'System32/WindowsPowerShell/v1.0')] : ['/usr/bin', '/bin'];
    const env = {
      HOME: home, USERPROFILE: home, TMPDIR: temp, TMP: temp, TEMP: temp,
      XDG_CONFIG_HOME: join(workspace, 'config'), XDG_CACHE_HOME: cache,
      APPDATA: join(workspace, 'appdata'), LOCALAPPDATA: join(workspace, 'localappdata'),
      PATH: [binDir, ...(shell ? [dirname(shell)] : []), ...paths].join(delimiter), SHELL: shell || '',
      TERM: 'dumb', NO_COLOR: '1', CLAUDE_SWITCH_DISABLE_AUTO_UPDATE: '1',
      npm_config_cache: join(cache, 'npm'), npm_config_userconfig: join(workspace, 'npmrc'),
      npm_config_globalconfig: join(workspace, 'npmrc-global'), npm_config_offline: 'true',
      GIT_CONFIG_GLOBAL: join(workspace, 'gitconfig'), GIT_CONFIG_NOSYSTEM: '1',
    };
    for (const name of ['SystemRoot', 'SYSTEMROOT', 'WINDIR', 'ComSpec', 'COMSPEC', 'PATHEXT', 'LD_LIBRARY_PATH', 'DYLD_LIBRARY_PATH']) {
      if (process.env[name]) env[name] = process.env[name];
    }
    for (const name of ['npmrc', 'npmrc-global', 'gitconfig']) writeFileSync(join(workspace, name), '');
    const node = join(binDir, windows ? 'node.exe' : 'node');
    if (windows) copyFileSync(process.execPath, node);
    else symlinkSync(process.execPath, node);
    const bin = join(binDir, windows ? 'claude.exe' : 'claude');
    if (windows) {
      if (!compiledFake || !existsSync(compiledFake)) {
        compiledFake = join(temp, 'compiled-fake.exe');
        compileFakeClaude(compiledFake, env);
      }
      copyFileSync(compiledFake, bin);
    } else {
      const fake = join(workspace, 'fake-claude.cjs');
      writeFileSync(fake, `console.log(JSON.stringify({fake:true,args:process.argv.slice(2),config:process.env.CLAUDE_CONFIG_DIR,hook:process.env.CAS_HOOK??null}));const delay=Number(process.env.CAS_FAKE_SLEEP_MS||0);if(delay)setTimeout(()=>process.exit(Number(process.env.CAS_FAKE_EXIT||0)),delay);else process.exit(Number(process.env.CAS_FAKE_EXIT||0));\n`);
      writeFileSync(bin, `#!/bin/sh\nexec node ${unixQuote(fake)} "$@"\n`, { mode: 0o755 });
    }
    return { workspace, home, temp, cache, profilesDir, binDir, bin, node, env, shell };
  } catch (error) {
    rmSync(workspace, { recursive: true, force: true });
    throw error;
  }
}

export function shellKind(shell) {
  return basename(shell).replace(/\.exe$/i, '').toLowerCase();
}

export function quoteArgument(value, kind) {
  if (['pwsh', 'powershell'].includes(kind)) return psQuote(value);
  if (kind === 'cmd') return '"' + value.replace(/(\\*)"/g, '$1$1\\"').replace(/(\\+)$/g, '$1$1') + '"';
  if (kind === 'fish') return "'" + value.replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";
  return unixQuote(value);
}

export function shellArguments(shell, script) {
  const kind = shellKind(shell);
  if (['pwsh', 'powershell'].includes(kind)) {
    return ['-NoLogo', '-NoProfile', '-NonInteractive', '-OutputFormat', 'Text',
      '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')];
  }
  if (kind === 'cmd') return ['/d', '/s', '/c', script];
  if (kind === 'fish') return ['--no-config', '-c', script];
  if (kind === 'zsh') return ['-f', '-c', script];
  return ['--noprofile', '--norc', '-c', script];
}

export function sourceIntegration(fixture, shell = fixture.shell) {
  const kind = shellKind(shell);
  const extension = ['pwsh', 'powershell'].includes(kind) ? 'ps1' : kind === 'fish' ? 'fish' : 'sh';
  const template = join(fixture.profilesDir, `.shell-integration.${extension}`);
  return ['pwsh', 'powershell'].includes(kind) ? `. ${psQuote(template)}; ` : `source ${unixQuote(template)}; `;
}

export function installFixture(fixture, repo = repository, kind = shellKind(fixture.shell)) {
  const installKind = ['pwsh', 'powershell', 'cmd'].includes(kind) ? 'powershell' : kind;
  const code = `import {homedir} from 'node:os';if(homedir()!==${JSON.stringify(fixture.home)})throw new Error('unsafe HOME');const {installShellIntegration}=await import(${JSON.stringify(pathToFileURL(join(repo, 'src/lib/shell.mjs')).href)});installShellIntegration(${JSON.stringify(installKind)});`;
  const result = spawnSync(fixture.node, ['--input-type=module', '-e', code], { env: fixture.env, encoding: 'utf8', timeout: 15000 });
  assert.equal(result.status, 0, result.stderr || String(result.error));
}

export function runCrossShellSmoke({ repo = repository, shell, psMode = 'Default', ttyCancel = false }) {
  const kind = shellKind(shell);
  assert.ok(['bash', 'zsh', 'fish', 'pwsh', 'powershell', 'cmd'].includes(kind), `Unknown shell: ${kind}`);
  assert.ok(['Default', 'Standard', 'Legacy', 'Windows'].includes(psMode), `Unknown argument mode: ${psMode}`);
  if (dirname(shell) === '.') shell = findShell(kind);
  assert.ok(shell && executable(shell), `Shell executable not found: ${kind}`);
  let fixture;
  const powerShell = ['pwsh', 'powershell'].includes(kind);
  const cmd = kind === 'cmd';
  const checks = [];
  let lastResult;
  try {
    fixture = createShellFixture(['work', 'personal'], shell);
    installFixture(fixture, resolve(repo), kind);
    if (kind === 'powershell') {
      const template = join(fixture.profilesDir, '.shell-integration.ps1');
      const trace = readFileSync(template, 'utf8')
        .replace('function __claude_switch_cli {', "function __claude_switch_cli {\n  [Console]::Error.WriteLine('CAS_PS5_CLI')")
        .replace("$hadTransport = Test-Path Env:CLAUDE_SWITCH_ARGV", "[Console]::Error.WriteLine('CAS_PS5_COMMAND_READY')\n  $hadTransport = Test-Path Env:CLAUDE_SWITCH_ARGV")
        .replace("$env:CLAUDE_SWITCH_ARGV = [Convert]::ToBase64String", "[Console]::Error.WriteLine('CAS_PS5_PAYLOAD_READY')\n    $env:CLAUDE_SWITCH_ARGV = [Convert]::ToBase64String")
        .replace('& $node.Source --input-type=module', "[Console]::Error.WriteLine('CAS_PS5_NODE_START')\n    & $node.Source --input-type=module")
        .replace('$exitCode = $LASTEXITCODE', "[Console]::Error.WriteLine('CAS_PS5_NODE_END')\n    $exitCode = $LASTEXITCODE");
      writeFileSync(template, trace);
    }
    const nativeMode = powerShell && psMode !== 'Default' ? `$PSNativeCommandArgumentPassing=${psQuote(psMode)}; ` : '';
    const source = cmd ? '' : nativeMode + sourceIntegration(fixture, shell);
    const quote = value => quoteArgument(value, kind);
    const runtime = join(fixture.profilesDir, '_runtime/bin/cli.mjs');
    const launch = values => cmd ? `node ${quote(runtime)} shell launch ${values.map(quote).join(' ')}` : `claude ${values.map(quote).join(' ')}`;
    const ending = powerShell ? '; exit $LASTEXITCODE' : cmd ? '' : kind === 'fish' ? '; exit $status' : '; exit $?';
    const run = (script, extra = {}) => {
      const result = spawnSync(shell, shellArguments(shell, script), { cwd: fixture.workspace, env: { ...fixture.env, ...extra }, stdio: ['ignore', 'pipe', 'pipe'], windowsVerbatimArguments: cmd, encoding: 'utf8', timeout: kind === 'powershell' ? 60000 : 15000 });
      lastResult = { status: result.status, signal: result.signal, stdout: result.stdout, stderr: result.stderr, error: result.error?.message };
      return result;
    };
    const fakeOutput = result => {
      assert.equal(result.status, 0, result.stderr || String(result.error));
      const lines = result.stdout.split(/\r?\n/).filter(line => line.startsWith('{'));
      assert.equal(lines.length, 1, result.stdout);
      const parsed = JSON.parse(lines[0]);
      assert.equal(parsed.fake, true);
      return parsed;
    };
    if (ttyCancel) {
      assert.ok(process.stdin.isTTY && !cmd, 'TTY cancellation requires a supported interactive terminal');
      const original = readFileSync(runtime);
      try {
        writeFileSync(runtime, 'if(!process.stdin.isTTY)process.exitCode=91;\n');
        const inherited = spawnSync(shell, shellArguments(shell, source + '__claude_switch_cli' + ending), { env: fixture.env, stdio: 'inherit' });
        assert.equal(inherited.status, 0);
        checks.push('tty-stdin-inherited');
      } finally { writeFileSync(runtime, original); }
      const before = readFileSync(join(fixture.profilesDir, 'meta.json'), 'utf8');
      const cancelled = spawnSync(shell, shellArguments(shell, source + launch(['--help']) + ending), { env: { ...fixture.env, TERM: 'xterm' }, stdio: 'inherit' });
      assert.equal(cancelled.status, 130);
      assert.equal(readFileSync(join(fixture.profilesDir, 'meta.json'), 'utf8'), before);
      checks.push('tty-cancel/status130/metadata-unchanged');
    } else {
      const forwarded = ['--help', '--version', 'a b', '', '$literal', 'quote"value', '한글', 'slash\\"quote', 'trailing\\', "single'quote"];
      if (!cmd) forwarded.push('line\nbreak');
      const traceStart = kind === 'powershell' ? "[Console]::Error.WriteLine('CAS_PS5_START'); " : '';
      const traceLoaded = kind === 'powershell' ? "[Console]::Error.WriteLine('CAS_PS5_LOADED'); " : '';
      const output = fakeOutput(run(traceStart + source + traceLoaded + launch(forwarded) + ending));
      assert.deepEqual(output.args, forwarded);
      assert.equal(output.config, join(fixture.profilesDir, 'work'));
      checks.push('argument-preservation/config-dir');
      const switchCommand = cmd ? `node ${quote(runtime)} shell use personal & ` : 'cpf personal; ';
      const switched = fakeOutput(run(source + switchCommand + launch(['--help']) + ending));
      assert.equal(switched.config, join(fixture.profilesDir, 'personal'));
      assert.equal(JSON.parse(readFileSync(join(fixture.profilesDir, 'meta.json'), 'utf8')).activeProfile, 'personal');
      checks.push('profile-switch');
      if (!cmd) {
        const extension = powerShell ? 'ps1' : kind === 'fish' ? 'fish' : 'sh';
        const hook = join(fixture.profilesDir, 'personal', `pre-launch.${extension}`);
        writeFileSync(hook, powerShell ? "$env:CAS_HOOK='profile value'\n" : kind === 'fish' ? "set -gx CAS_HOOK 'profile value'\n" : "CAS_HOOK='profile value'\n");
        const parent = powerShell ? '; Write-Output ("PARENT=" + $env:CAS_HOOK)' : kind === 'fish' ? '; printf "PARENT=%s\\n" "$CAS_HOOK"' : '; printf "PARENT=%s\\n" "${CAS_HOOK-unset}"';
        const hooked = run(source + launch(['--version']) + parent);
        assert.equal(fakeOutput(hooked).hook, 'profile value');
        assert.ok(hooked.stdout.split(/\r?\n/).includes(powerShell || kind === 'fish' ? 'PARENT=' : 'PARENT=unset'), hooked.stdout);
        checks.push('hook-environment-isolation');
        let failureHook = 'return 17\n';
        if (powerShell) failureHook = "throw 'fixture hook failure'\n";
        else if (kind === 'fish') failureHook = 'function __cas_hook_failure\n  return 17\nend\n__cas_hook_failure\n';
        writeFileSync(hook, failureHook);
        const failed = run(source + launch(['--help']) + ending);
        assert.equal(failed.status, powerShell ? 1 : 17, failed.stderr);
        assert.equal(failed.stdout.trim(), '');
        checks.push('hook-failure-stops-launch');
        rmSync(hook);
        const overridden = powerShell ? 'function __claude_switch_launch { $args | ConvertTo-Json -Compress }; ' : kind === 'fish' ? 'function __claude_switch_launch; printf "%s\\n" $argv; end; ' : '__claude_switch_launch() { printf "%s\\n" "$@"; }; ';
        const custom = run(source + overridden + 'claude ' + quote('a b'));
        assert.equal(custom.status, 0, custom.stderr);
        assert.equal(custom.stdout.trim(), powerShell ? '["personal","a b"]' : 'personal\na b');
        if (powerShell) {
          const customArgs = run(source + overridden + launch(forwarded));
          assert.equal(customArgs.status, 0, customArgs.stderr);
          assert.deepEqual(JSON.parse(customArgs.stdout), ['personal', ...forwarded]);
        }
        checks.push('launch-override');
      }
      const nonzero = run(source + launch(['--version']) + ending, { CAS_FAKE_EXIT: '42' });
      assert.equal(nonzero.status, 42, nonzero.stderr);
      checks.push('native-exit-code');
      if (powerShell) {
        const legacyEncoding = run(source + '[Console]::OutputEncoding=[Text.Encoding]::GetEncoding(28591); $captured=@(' + launch(['한글']) + '); $encoding=[Console]::OutputEncoding.CodePage; [Console]::OutputEncoding=[Text.Encoding]::UTF8; $captured | Write-Output; Write-Output ("ENCODING=" + $encoding)');
        assert.deepEqual(fakeOutput(legacyEncoding).args, ['한글']);
        assert.ok(legacyEncoding.stdout.includes('ENCODING=28591'), legacyEncoding.stdout);
        checks.push('unicode-output/encoding-restoration');
        const cancelled = run(source + launch(['--version']) + ending, { CAS_FAKE_EXIT: '130' });
        assert.equal(cancelled.status, 130, cancelled.stderr);
        checks.push('native-exit130');
        const hook = join(fixture.profilesDir, 'personal/pre-launch.ps1');
        writeFileSync(hook, "$env:CAS_HOOK=(Get-Location).Path + '|' + $env:CLAUDE_CONFIG_DIR\n");
        const inheritedConfig = join(fixture.workspace, 'existing config');
        const hooked = run(source + launch([]) + '; Write-Output ("PARENT=" + $env:CLAUDE_CONFIG_DIR); Write-Output ("CWD=" + (Get-Location).Path)', { CLAUDE_CONFIG_DIR: inheritedConfig });
        assert.equal(fakeOutput(hooked).hook, `${fixture.workspace}|${inheritedConfig}`);
        assert.equal(fakeOutput(hooked).config, join(fixture.profilesDir, 'personal'));
        assert.ok(hooked.stdout.includes(`PARENT=${inheritedConfig}`), hooked.stdout);
        assert.ok(hooked.stdout.includes(`CWD=${fixture.workspace}`), hooked.stdout);
        const stopped = run(source + "$ErrorActionPreference='Stop'; $PSNativeCommandUseErrorActionPreference=$true; " + launch([]) + ending, { CAS_FAKE_EXIT: '42' });
        assert.equal(stopped.status, 42, stopped.stderr);
        writeFileSync(hook, "& $env:CAS_FAKE_EXIT_HOOK\n");
        const failed = run(source + '$PSNativeCommandUseErrorActionPreference=$true; ' + launch([]) + ending, { CAS_FAKE_EXIT_HOOK: fixture.bin, CAS_FAKE_EXIT: '17' });
        assert.equal(failed.status, 17, failed.stderr);
        assert.equal(failed.stdout.split(/\r?\n/).filter(line => line.startsWith('{')).length, 1);
        assert.equal(JSON.parse(failed.stdout.trim()).config ?? null, null);
        rmSync(hook);
        checks.push('hook-timing/cwd/native-failure');
        const original = readFileSync(runtime);
        try {
          writeFileSync(runtime, "console.log(JSON.stringify({args:process.argv.slice(2),transport:process.env.CLAUDE_SWITCH_ARGV??null}));\n");
          for (const previous of [undefined, "existing 한글 'value' \\\"\nend"]) {
            const extra = previous === undefined ? {} : { CLAUDE_SWITCH_ARGV: previous };
            const probe = run(source + '__claude_switch_cli ' + forwarded.map(quote).join(' ') + '; Write-Output ("PARENT=" + $env:CLAUDE_SWITCH_ARGV)', extra);
            assert.equal(probe.status, 0, probe.stderr);
            const [line, ...parent] = probe.stdout.trimEnd().split(/\r?\n/);
            const output = JSON.parse(line);
            assert.deepEqual(output.args, forwarded);
            assert.equal(output.transport, previous ?? null);
            assert.equal(parent.join('\n'), `PARENT=${previous ?? ''}`);
          }
        } finally { writeFileSync(runtime, original); }
        checks.push('transport-restoration');
        if (!windows) {
          const fallback = fakeOutput(run(source + launch(['--help']) + ending, { USERPROFILE: '' }));
          assert.equal(fallback.config, join(fixture.profilesDir, 'personal'));
          checks.push('unix-HOME-fallback');
        }
        rmSync(join(fixture.profilesDir, '_runtime'), { recursive: true });
        const missing = run(source + "$ErrorActionPreference='Stop'; claude" + ending);
        assert.equal(missing.status, 127, missing.stderr);
        assert.match(missing.stderr, /install-shell/);
        assert.equal(missing.stdout, '');
        checks.push('missing-runtime127');
      }
    }
    return { ok: true, platform: process.platform, node: process.version, shell, kind, psMode: powerShell ? psMode : undefined, checks, cmdApplicability: cmd ? 'Direct runtime CLI; CMD has no integration functions or profile hooks' : undefined };
  } catch (error) {
    return { ok: false, platform: process.platform, node: process.version, shell, kind, psMode: powerShell ? psMode : undefined, checks, error: error.message, lastResult };
  } finally {
    if (fixture) rmSync(fixture.workspace, { recursive: true, force: true });
  }
}

const shellOption = process.argv.slice(2).find(value => value.startsWith('--shell='));
if (shellOption) {
  const options = Object.fromEntries(process.argv.slice(2).map(value => {
    const [name, ...parts] = value.replace(/^--/, '').split('=');
    return [name, parts.join('=')];
  }));
  const result = runCrossShellSmoke({ repo: options.repo || repository, shell: options.shell, psMode: options['ps-mode'] || 'Default', ttyCancel: 'tty-cancel' in options });
  (result.ok ? console.log : console.error)(JSON.stringify(result));
  if (!result.ok) process.exitCode = 1;
}
