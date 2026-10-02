import { readFileSync, writeFileSync, appendFileSync, existsSync, mkdirSync, mkdtempSync, cpSync, copyFileSync, renameSync, rmSync, lstatSync, unlinkSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname, resolve, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { HOME, PROFILES_DIR, IS_WINDOWS } from './constants.mjs';

// Unix file permissions are silently ignored on Windows
const EXEC_MODE = IS_WINDOWS ? undefined : { mode: 0o755 };

const SH_FILE     = join(PROFILES_DIR, '.shell-integration.sh');
const PS1_FILE    = join(PROFILES_DIR, '.shell-integration.ps1');
const FISH_FILE   = join(PROFILES_DIR, '.shell-integration.fish');

const HERE = dirname(fileURLToPath(import.meta.url));
const TEMPLATES_DIR = join(HERE, '..', 'shell-templates');
const PACKAGE_DIR = join(HERE, '..', '..');
const RUNTIME_DIR = join(PROFILES_DIR, '_runtime');

export function installShellIntegration(shell) {
  if (!['bash', 'zsh', 'fish', 'powershell'].includes(shell)) throw new Error(`Unknown shell: ${shell}`);
  installRuntime();
  mkdirSync(PROFILES_DIR, { recursive: true });
  if (shell === 'powershell') {
    writeTemplate('integration.ps1', PS1_FILE);
    installPowerShellProfile();
  } else if (shell === 'fish') {
    writeTemplate('integration.fish', FISH_FILE);
    installFishConfig();
  } else {
    writeTemplate('integration.sh', SH_FILE);
    installUnixRc(shell);
  }
}

export function installAllShells() {
  if (!existsSync(PROFILES_DIR)) return { newlyInstalled: [], alreadyInstalled: [] };

  installRuntime();
  const newlyInstalled = [];
  const alreadyInstalled = [];
  const track = (name, isNew) => (isNew ? newlyInstalled : alreadyInstalled).push(name);

  // Generate all scripts upfront (idempotent — keeps them up-to-date)
  writeTemplate('integration.sh', SH_FILE);
  writeTemplate('integration.ps1', PS1_FILE);
  writeTemplate('integration.fish', FISH_FILE);

  const currentShell = (process.env.SHELL || '').split('/').pop();
  const nativePowerShell = join(process.env.XDG_CONFIG_HOME || join(HOME, '.config'), 'powershell');
  const legacyPowerShell = ['WindowsPowerShell', 'PowerShell'].some(edition =>
    existsSync(join(HOME, 'Documents', edition, 'Microsoft.PowerShell_profile.ps1')));
  if (IS_WINDOWS || currentShell === 'pwsh' || existsSync(nativePowerShell) || legacyPowerShell) {
    track('PowerShell', installPowerShellProfile());
  }

  if (existsSync(join(HOME, '.bashrc')) || currentShell === 'bash') {
    track('bash', installUnixRc('bash'));
  }
  if (existsSync(join(HOME, '.zshrc')) || currentShell === 'zsh' || process.platform === 'darwin') {
    track('zsh', installUnixRc('zsh'));
  }
  if (existsSync(join(HOME, '.config', 'fish')) || currentShell === 'fish') {
    track('fish', installFishConfig());
  }

  return { newlyInstalled, alreadyInstalled };
}


function installRuntime() {
  mkdirSync(PROFILES_DIR, { recursive: true });
  if (existsSync(RUNTIME_DIR) && lstatSync(RUNTIME_DIR).isSymbolicLink()) {
    throw new Error(`Runtime must be a directory: ${RUNTIME_DIR}`);
  }
  const stage = mkdtempSync(join(PROFILES_DIR, '_runtime-stage-'));
  const backup = stage + '-previous';
  let moved = false;
  try {
    copyFileSync(join(PACKAGE_DIR, 'package.json'), join(stage, 'package.json'));
    cpSync(join(PACKAGE_DIR, 'bin'), join(stage, 'bin'), { recursive: true });
    cpSync(join(PACKAGE_DIR, 'src'), join(stage, 'src'), { recursive: true });
    JSON.parse(readFileSync(join(stage, 'package.json'), 'utf8'));
    for (const relative of ['bin/cli.mjs', 'src/index.mjs', 'src/commands/shell.mjs']) {
      if (!existsSync(join(stage, relative))) throw new Error(`Missing runtime file: ${relative}`);
    }
    if (existsSync(RUNTIME_DIR)) {
      renameSync(RUNTIME_DIR, backup);
      moved = true;
    }
    try {
      renameSync(stage, RUNTIME_DIR);
    } catch (err) {
      if (moved) renameSync(backup, RUNTIME_DIR);
      throw err;
    }
    const pointer = join(PROFILES_DIR, '_runtime-current.json');
    if (existsSync(pointer)) unlinkSync(pointer);
    if (moved) rmSync(backup, { recursive: true, force: true });
  } finally {
    rmSync(stage, { recursive: true, force: true });
  }
}

function writeTemplate(templateName, targetFile) {
  const content = readFileSync(join(TEMPLATES_DIR, templateName), 'utf8').replace(/\r\n/g, '\n');
  writeFileSync(targetFile, content, EXEC_MODE);
}


function installUnixRc(shell) {
  const rcFile = shell === 'zsh' ? join(HOME, '.zshrc') : join(HOME, '.bashrc');
  const sourceLine = '[ -f ~/.claude-profiles/.shell-integration.sh ] && . ~/.claude-profiles/.shell-integration.sh';
  return addSourceLine(rcFile, sourceLine, '.shell-integration.sh');
}

function installFishConfig() {
  const configDir = join(HOME, '.config', 'fish');
  const configFile = join(configDir, 'config.fish');
  const sourceLine = 'test -f ~/.claude-profiles/.shell-integration.fish && source ~/.claude-profiles/.shell-integration.fish';
  mkdirSync(configDir, { recursive: true });
  return addSourceLine(configFile, sourceLine, '.shell-integration.fish');
}

function installPowerShellProfile() {
  const documents = IS_WINDOWS ? windowsDocuments() : join(HOME, 'Documents');
  const legacy = ['WindowsPowerShell', 'PowerShell'].map(edition =>
    join(documents, edition, 'Microsoft.PowerShell_profile.ps1'));
  const native = join(process.env.XDG_CONFIG_HOME || join(HOME, '.config'), 'powershell', 'Microsoft.PowerShell_profile.ps1');
  const profiles = IS_WINDOWS ? legacy : [native, ...legacy.filter(existsSync)];
  const sourceLine = IS_WINDOWS
    ? `. "$env:USERPROFILE\\.claude-profiles\\.shell-integration.ps1"`
    : `. "$HOME/.claude-profiles/.shell-integration.ps1"`;
  let installed = false;
  for (const profile of profiles) {
    mkdirSync(dirname(profile), { recursive: true });
    const changed = addSourceLine(profile, sourceLine, '.shell-integration.ps1');
    installed = changed || installed;
  }
  return installed;
}

function windowsDocuments() {
  const fallback = join(HOME, 'Documents');
  const system = process.env.SystemRoot || process.env.SYSTEMROOT;
  const powershell = system ? join(system, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe') : 'powershell.exe';
  const command = `[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding
@{
  userProfile = [Environment]::GetFolderPath("UserProfile")
  documents = [Environment]::GetFolderPath("MyDocuments", "DoNotVerify")
} | ConvertTo-Json -Compress`;
  try {
    const output = execFileSync(powershell, ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', command], {
      encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 5000,
    });
    const { userProfile, documents } = JSON.parse(output.trim().replace(/^\uFEFF/, ''));
    // Known folders belong to the Windows SID, even when HOME is overridden for a fixture.
    if (typeof userProfile === 'string' && isAbsolute(userProfile)
      && resolve(userProfile).toLowerCase() === resolve(HOME).toLowerCase()
      && typeof documents === 'string' && isAbsolute(documents)) return documents;
  } catch {}
  return fallback;
}

/** @returns {boolean} true if newly installed, false if already present */
function addSourceLine(rcFile, sourceLine, marker) {
  const content = existsSync(rcFile) ? readFileSync(rcFile) : Buffer.alloc(0);
  let width = 1;
  let bigEndian = false;
  if (content.subarray(0, 4).equals(Buffer.from([0xff, 0xfe, 0, 0]))) width = 4;
  else if (content.subarray(0, 4).equals(Buffer.from([0, 0, 0xfe, 0xff]))) {
    width = 4;
    bigEndian = true;
  } else if (content.subarray(0, 2).equals(Buffer.from([0xff, 0xfe]))) width = 2;
  else if (content.subarray(0, 2).equals(Buffer.from([0xfe, 0xff]))) {
    width = 2;
    bigEndian = true;
  }
  if (content.length % width !== 0) throw new Error(`Incomplete UTF-${width * 8} encoding in shell profile: ${rcFile}`);
  const encode = text => {
    if (width === 1) return Buffer.from(text, 'utf8');
    if (width === 2) {
      const bytes = Buffer.from(text, 'utf16le');
      return bigEndian ? bytes.swap16() : bytes;
    }
    const bytes = Buffer.alloc(text.length * 4);
    for (let index = 0; index < text.length; index++) bytes.writeUInt32LE(text.charCodeAt(index), index * 4);
    return bigEndian ? bytes.swap32() : bytes;
  };
  if (content.includes(encode(marker))) return false;
  const newline = content.includes(encode('\r\n')) ? '\r\n' : '\n';
  const lf = encode('\n');
  const separator = content.length > 0 && !content.subarray(-lf.length).equals(lf) ? newline : '';
  appendFileSync(rcFile, encode(`${separator}${newline}# Claude Switch - multi-account manager${newline}${sourceLine}${newline}`));
  return true;
}
