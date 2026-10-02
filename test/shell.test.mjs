import './helpers/home.mjs';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, mkdirSync, mkdtempSync, writeFileSync, symlinkSync, renameSync, unlinkSync, chmodSync, statSync, cpSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { homedir } from 'node:os';
import { installShellIntegration } from '../src/lib/shell.mjs';
import { PROFILES_DIR } from '../src/lib/constants.mjs';

const home = homedir();
const shellModule = new URL('../src/lib/shell.mjs', import.meta.url).href;

function powerShellProfile(fixtureHome, edition) {
  return join(fixtureHome, 'Documents', edition, 'Microsoft.PowerShell_profile.ps1');
}

function installPowerShellFixture(fixtureHome, options = {}) {
  const folders = options.folders || { userProfile: join(fixtureHome, 'system-user'), documents: join(fixtureHome, 'system-documents') };
  const output = options.output ?? JSON.stringify(folders);
  const platform = options.platform || 'win32';
  const script = `
    Object.defineProperty(process, 'platform', { value: ${JSON.stringify(platform)} });
    const { default: childProcess } = await import('node:child_process');
    const { syncBuiltinESMExports } = await import('node:module');
    const queries = [];
    childProcess.execFileSync = (command, args, settings) => {
      queries.push({ command, args, stdio: settings.stdio });
      if (${Boolean(options.queryError)}) throw new Error('fixture query failure');
      return ${JSON.stringify(output)};
    };
    syncBuiltinESMExports();
    const integration = await import(${JSON.stringify(shellModule)});
    const installed = integration.${options.all ? 'installAllShells()' : "installShellIntegration('powershell')"};
    console.log(JSON.stringify({ queries, installed }));
  `;
  const result = execFileSync(process.execPath, ['--input-type=module', '-e', script], {
    encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, HOME: fixtureHome, USERPROFILE: fixtureHome, XDG_CONFIG_HOME: join(fixtureHome, '.config'), ...options.env },
  });
  return JSON.parse(result);
}

function assertProfileAppend(fixtureHome, original, decode) {
  const profile = powerShellProfile(fixtureHome, 'WindowsPowerShell');
  mkdirSync(dirname(profile), { recursive: true });
  writeFileSync(profile, original);
  if (process.platform !== 'win32') chmodSync(profile, 0o640);
  const mode = statSync(profile).mode;
  installPowerShellFixture(fixtureHome);
  const installed = readFileSync(profile);
  assert.deepEqual(installed.subarray(0, original.length), original);
  const appended = decode(installed.subarray(original.length));
  assert.match(appended, /\.shell-integration.ps1/);
  if (process.platform !== 'win32') assert.equal(statSync(profile).mode, mode);
  const modified = statSync(profile).mtimeMs;
  installPowerShellFixture(fixtureHome);
  assert.deepEqual(readFileSync(profile), installed);
  assert.equal(statSync(profile).mtimeMs, modified);
  return appended;
}

describe('shell installation', () => {
  it('installs executable LF templates from a CRLF source checkout', () => {
    const source = join(home, 'crlf-package');
    const root = fileURLToPath(new URL('..', import.meta.url));
    mkdirSync(source, { recursive: true });
    for (const entry of ['bin', 'src', 'package.json']) cpSync(join(root, entry), join(source, entry), { recursive: true });
    for (const extension of ['sh', 'fish', 'ps1']) {
      const template = join(source, 'src', 'shell-templates', `integration.${extension}`);
      writeFileSync(template, readFileSync(template, 'utf8').replace(/\r?\n/g, '\r\n'));
    }
    const fixtureHome = join(home, 'crlf-home');
    mkdirSync(fixtureHome);
    const moduleUrl = pathToFileURL(join(source, 'src/lib/shell.mjs')).href;
    execFileSync(process.execPath, ['--input-type=module', '-e',
      `const {installShellIntegration}=await import(${JSON.stringify(moduleUrl)});for(const shell of ['bash','fish','powershell'])installShellIntegration(shell);`], {
      env: { ...process.env, HOME: fixtureHome, USERPROFILE: fixtureHome, XDG_CONFIG_HOME: join(fixtureHome, '.config') },
      stdio: ['ignore', 'pipe', 'pipe'], timeout: 20000,
    });
    for (const extension of ['sh', 'fish', 'ps1']) {
      const installed = readFileSync(join(fixtureHome, '.claude-profiles', `.shell-integration.${extension}`), 'utf8');
      assert.ok(installed.includes('\n'));
      assert.ok(!installed.includes('\r'), extension);
    }
  });

  it('creates a complete local runtime for all supported shell templates', () => {
    for (const shell of ['bash', 'zsh', 'fish', 'powershell']) installShellIntegration(shell);
    for (const file of ['bin/cli.mjs', 'src/index.mjs', 'src/commands/shell.mjs', 'package.json']) {
      assert.ok(existsSync(join(PROFILES_DIR, '_runtime', ...file.split('/'))), file);
    }
    for (const extension of ['sh', 'fish', 'ps1']) {
      const content = readFileSync(join(PROFILES_DIR, `.shell-integration.${extension}`), 'utf8');
      assert.match(content, /_runtime/);
      assert.match(content, /shell pick --print/);
      assert.match(content, /__claude_switch_launch/);
      assert.match(content, /pre-launch\./);
      assert.doesNotMatch(content, /Get-Command claude-account-switch|claude-account-switch "\$@"/);
      assert.doesNotMatch(content, /@anthropic-ai\/claude-code/);
    }
  });

  it('preserves existing rc bytes and adds only one source line', () => {
    const rc = join(home, '.bashrc');
    const original = 'export MY_SETTING="keep"\n# user custom function\ncustom() { :; }';
    writeFileSync(rc, original);
    installShellIntegration('bash');
    const first = readFileSync(rc, 'utf8');
    assert.ok(first.startsWith(original + '\n'));
    assert.ok(first.endsWith('\n'));
    assert.match(first, /\[ -f ~\/\.claude-profiles\/\.shell-integration.sh \]/);
    installShellIntegration('bash');
    assert.equal(readFileSync(rc, 'utf8'), first);
  });

  it('preserves an existing launch override after the source line', () => {
    const rc = join(home, '.zshrc');
    const original = '. ~/.claude-profiles/.shell-integration.sh\n__claude_switch_launch() { echo custom; }\n';
    writeFileSync(rc, original);
    installShellIntegration('zsh');
    assert.equal(readFileSync(rc, 'utf8'), original);
  });

  it('appends to raw Unix rc bytes without changing permissions or rewriting content', () => {
    const rc = join(home, '.bashrc');
    const original = Buffer.concat([Buffer.from('# keep '), Buffer.from([0x81, 0xff]), Buffer.from('\r\ncustom() { :; }')]);
    writeFileSync(rc, original);
    if (process.platform !== 'win32') chmodSync(rc, 0o600);
    const mode = statSync(rc).mode;
    installShellIntegration('bash');
    const installed = readFileSync(rc);
    assert.deepEqual(installed.subarray(0, original.length), original);
    assert.match(installed.subarray(original.length).toString('ascii'), /\.shell-integration.sh/);
    if (process.platform !== 'win32') assert.equal(statSync(rc).mode, mode);
    const modified = statSync(rc).mtimeMs;
    installShellIntegration('bash');
    assert.deepEqual(readFileSync(rc), installed);
    assert.equal(statSync(rc).mtimeMs, modified);
  });

  it('routes fish and PowerShell to their existing config locations', () => {
    const fishConfig = join(home, '.config', 'fish', 'config.fish');
    const ps5 = powerShellProfile(home, 'WindowsPowerShell');
    mkdirSync(join(home, 'Documents', 'WindowsPowerShell'), { recursive: true });
    writeFileSync(ps5, '# user configuration\n');
    installShellIntegration('fish');
    installShellIntegration('powershell');
    assert.match(readFileSync(fishConfig, 'utf8'), /source ~\/\.claude-profiles\/\.shell-integration.fish/);
    assert.match(readFileSync(ps5, 'utf8'), /user configuration/);
    assert.match(readFileSync(ps5, 'utf8'), /\.shell-integration.ps1/);
  });

  it('rejects unknown shells before changing config', () => {
    const rc = readFileSync(join(home, '.bashrc'), 'utf8');
    assert.throws(() => installShellIntegration('unknown'), /Unknown shell/);
    assert.equal(readFileSync(join(home, '.bashrc'), 'utf8'), rc);
  });

  it('refuses to replace a runtime symlink', () => {
    const runtime = join(PROFILES_DIR, '_runtime');
    const saved = runtime + '-saved';
    renameSync(runtime, saved);
    symlinkSync(saved, runtime, process.platform === 'win32' ? 'junction' : 'dir');
    try {
      assert.throws(() => installShellIntegration('bash'), /Runtime must be a directory/);
      assert.ok(existsSync(join(saved, 'bin/cli.mjs')));
    } finally {
      unlinkSync(runtime);
      renameSync(saved, runtime);
    }
  });
});

describe('PowerShell profile compatibility (mocked process.platform off Windows)', () => {
  it('preserves UTF-16LE BOM and Korean configuration bytes', () => {
    const fixtureHome = mkdtempSync(join(home, 'powershell-utf16-'));
    const profile = powerShellProfile(fixtureHome, 'WindowsPowerShell');
    mkdirSync(join(fixtureHome, 'Documents', 'WindowsPowerShell'), { recursive: true });
    const original = Buffer.concat([
      Buffer.from([0xff, 0xfe]),
      Buffer.from("# 사용자 설정\r\n$Greeting = '안녕하세요'\r\n", 'utf16le'),
    ]);
    writeFileSync(profile, original);
    installPowerShellFixture(fixtureHome);
    const installed = readFileSync(profile);
    assert.deepEqual(installed.subarray(0, original.length), original);
    assert.match(installed.subarray(2).toString('utf16le'), /\.shell-integration.ps1/);
    installPowerShellFixture(fixtureHome);
    assert.deepEqual(readFileSync(profile), installed);
  });

  it('creates the Windows PowerShell 5.1 profile on a fresh Windows home', () => {
    const fixtureHome = mkdtempSync(join(home, 'powershell-fresh-'));
    installPowerShellFixture(fixtureHome);
    const profile = powerShellProfile(fixtureHome, 'WindowsPowerShell');
    assert.ok(existsSync(profile), `Windows PowerShell 5.1 cannot load ${profile}`);
    assert.match(readFileSync(profile, 'utf8'), /\.shell-integration.ps1/);
    assert.match(readFileSync(powerShellProfile(fixtureHome, 'PowerShell'), 'utf8'), /\.shell-integration.ps1/);
  });

  it('integrates both existing Windows PowerShell 5.1 and PowerShell 7 profiles', () => {
    const fixtureHome = mkdtempSync(join(home, 'powershell-both-'));
    const profiles = ['WindowsPowerShell', 'PowerShell'].map(edition => powerShellProfile(fixtureHome, edition));
    for (const [index, profile] of profiles.entries()) {
      mkdirSync(dirname(profile), { recursive: true });
      writeFileSync(profile, `# 사용자 설정 ${index}\n`);
    }
    installPowerShellFixture(fixtureHome);
    const installed = profiles.map(profile => readFileSync(profile, 'utf8'));
    for (const [index, content] of installed.entries()) {
      assert.ok(content.startsWith(`# 사용자 설정 ${index}\n`));
      assert.match(content, /\.shell-integration.ps1/, profiles[index]);
    }
    installPowerShellFixture(fixtureHome);
    assert.deepEqual(profiles.map(profile => readFileSync(profile, 'utf8')), installed);
  });

  const formats = [
    {
      name: 'UTF-8 BOM',
      original: ending => Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(`# 사용자 설정${ending}`)]),
      decode: bytes => bytes.toString('utf8'),
    },
    {
      name: 'UTF-16BE BOM',
      original: ending => Buffer.concat([Buffer.from([0xfe, 0xff]), Buffer.from(`# 사용자 설정${ending}`, 'utf16le').swap16()]),
      decode: bytes => Buffer.from(bytes).swap16().toString('utf16le'),
    },
    {
      name: 'ANSI raw bytes',
      original: ending => Buffer.concat([Buffer.from([0x23, 0x20, 0xb0, 0xa1, 0xff]), Buffer.from(ending)]),
      decode: bytes => bytes.toString('ascii'),
    },
  ];
  for (const format of formats) {
    for (const ending of ['', '\n', '\r\n']) {
      it(`preserves ${format.name}, permissions and ${JSON.stringify(ending)} ending on repeated install`, () => {
        const fixtureHome = mkdtempSync(join(home, 'powershell-bytes-'));
        const appended = assertProfileAppend(fixtureHome, format.original(ending), format.decode);
        if (ending === '\r\n') assert.equal(appended.replace(/\r\n/g, '').includes('\n'), false);
        else assert.equal(appended.includes('\r'), false);
      });
    }
  }

  for (const bigEndian of [false, true]) {
    it(`preserves UTF-32${bigEndian ? 'BE' : 'LE'} BOM without mixing encodings`, () => {
      const fixtureHome = mkdtempSync(join(home, 'powershell-utf32-'));
      const text = '\uFEFF# 사용자 설정\r\n';
      const original = Buffer.alloc(text.length * 4);
      for (let index = 0; index < text.length; index++) original.writeUInt32LE(text.charCodeAt(index), index * 4);
      if (bigEndian) original.swap32();
      const decode = bytes => {
        const littleEndian = bigEndian ? Buffer.from(bytes).swap32() : bytes;
        let decoded = '';
        for (let index = 0; index < bytes.length; index += 4) decoded += String.fromCodePoint(littleEndian.readUInt32LE(index));
        return decoded;
      };
      assertProfileAppend(fixtureHome, original, decode);
    });
  }

  it('refuses incomplete UTF-16 without changing original bytes', () => {
    const fixtureHome = mkdtempSync(join(home, 'powershell-incomplete-'));
    const profile = powerShellProfile(fixtureHome, 'WindowsPowerShell');
    mkdirSync(dirname(profile), { recursive: true });
    const original = Buffer.from([0xff, 0xfe, 0x23]);
    writeFileSync(profile, original);
    assert.throws(() => installPowerShellFixture(fixtureHome), /Incomplete UTF-16 encoding/);
    assert.deepEqual(readFileSync(profile), original);
  });

  it('uses redirected Documents only for the matching Windows user profile', () => {
    const fixtureHome = mkdtempSync(join(home, 'powershell-redirected-'));
    const documents = join(fixtureHome, 'OneDrive', 'Documents');
    const result = installPowerShellFixture(fixtureHome, { folders: { userProfile: fixtureHome, documents } });
    for (const edition of ['WindowsPowerShell', 'PowerShell']) {
      assert.match(readFileSync(join(documents, edition, 'Microsoft.PowerShell_profile.ps1'), 'utf8'), /\.shell-integration.ps1/);
    }
    assert.equal(existsSync(join(fixtureHome, 'Documents')), false);
    assert.equal(result.queries.length, 1);
    assert.ok(result.queries[0].args.includes('-NoProfile'));
    assert.match(result.queries[0].args.at(-1), /GetFolderPath/);
    assert.deepEqual(result.queries[0].stdio, ['ignore', 'pipe', 'ignore']);
  });

  it('never writes SID Documents when HOME belongs to a different fixture', () => {
    const fixtureHome = mkdtempSync(join(home, 'powershell-isolated-'));
    const osHome = mkdtempSync(join(home, 'windows-sid-fixture-'));
    const documents = join(osHome, 'OneDrive', 'Documents');
    mkdirSync(documents, { recursive: true });
    const sentinel = join(documents, 'user-file.txt');
    writeFileSync(sentinel, 'keep original user data');
    installPowerShellFixture(fixtureHome, { folders: { userProfile: osHome, documents } });
    assert.equal(readFileSync(sentinel, 'utf8'), 'keep original user data');
    assert.equal(existsSync(join(documents, 'WindowsPowerShell')), false);
    assert.equal(existsSync(join(documents, 'PowerShell')), false);
    assert.ok(existsSync(powerShellProfile(fixtureHome, 'WindowsPowerShell')));
    assert.ok(existsSync(powerShellProfile(fixtureHome, 'PowerShell')));
  });

  for (const [name, options] of [
    ['failed', { queryError: true }],
    ['malformed', { output: 'not JSON' }],
    ['missing', { output: '{"userProfile":null,"documents":null}' }],
  ]) {
    it(`falls back inside HOME after a ${name} known-folder query`, () => {
      const fixtureHome = mkdtempSync(join(home, 'powershell-fallback-'));
      installPowerShellFixture(fixtureHome, options);
      assert.ok(existsSync(powerShellProfile(fixtureHome, 'WindowsPowerShell')));
      assert.ok(existsSync(powerShellProfile(fixtureHome, 'PowerShell')));
    });
  }

  it('installs the Unix native profile and preserves both existing legacy profiles', () => {
    const fixtureHome = mkdtempSync(join(home, 'powershell-unix-'));
    for (const edition of ['WindowsPowerShell', 'PowerShell']) {
      const profile = powerShellProfile(fixtureHome, edition);
      mkdirSync(dirname(profile), { recursive: true });
      writeFileSync(profile, '# existing legacy configuration\n');
    }
    installPowerShellFixture(fixtureHome, { platform: 'linux' });
    const native = join(fixtureHome, '.config', 'powershell', 'Microsoft.PowerShell_profile.ps1');
    assert.match(readFileSync(native, 'utf8'), /\$HOME\/\.claude-profiles/);
    for (const edition of ['WindowsPowerShell', 'PowerShell']) {
      const content = readFileSync(powerShellProfile(fixtureHome, edition), 'utf8');
      assert.ok(content.startsWith('# existing legacy configuration\n'));
      assert.match(content, /\.shell-integration.ps1/);
    }
  });

  it('detects pwsh on Unix and respects its configured XDG directory', () => {
    const fixtureHome = mkdtempSync(join(home, 'powershell-xdg-'));
    mkdirSync(join(fixtureHome, '.claude-profiles'));
    const config = join(fixtureHome, 'custom-config');
    const result = installPowerShellFixture(fixtureHome, {
      platform: 'linux', all: true, env: { SHELL: '/usr/bin/pwsh', XDG_CONFIG_HOME: config },
    });
    assert.ok(result.installed.newlyInstalled.includes('PowerShell'));
    assert.ok(existsSync(join(config, 'powershell', 'Microsoft.PowerShell_profile.ps1')));
    assert.equal(existsSync(join(fixtureHome, 'Documents')), false);
  });
});
