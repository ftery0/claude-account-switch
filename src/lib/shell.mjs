import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { HOME, PROFILES_DIR, IS_WINDOWS } from './constants.mjs';

// Unix file permissions are silently ignored on Windows
const EXEC_MODE = IS_WINDOWS ? undefined : { mode: 0o755 };

const SH_FILE     = join(PROFILES_DIR, '.shell-integration.sh');
const PS1_FILE    = join(PROFILES_DIR, '.shell-integration.ps1');
const FISH_FILE   = join(PROFILES_DIR, '.shell-integration.fish');
const PICKER_FILE = join(PROFILES_DIR, '.picker.mjs');

const HERE = dirname(fileURLToPath(import.meta.url));
const TEMPLATES_DIR = join(HERE, '..', 'shell-templates');
const PICKER_SRC = join(HERE, 'picker-script.mjs');

export function installShellIntegration(shell) {
  if (shell === 'powershell') {
    writeTemplate('integration.ps1', PS1_FILE);
    installPowerShellProfile();
  } else if (shell === 'fish') {
    writePickerAndTemplate('integration.fish', FISH_FILE);
    installFishConfig();
  } else {
    writePickerAndTemplate('integration.sh', SH_FILE);
    installUnixRc(shell);
  }
}

/**
 * Auto-detect and install shell integration for ALL available shells.
 * Returns { newlyInstalled: string[], alreadyInstalled: string[] }.
 */
export function installAllShells() {
  if (!existsSync(PROFILES_DIR)) return { newlyInstalled: [], alreadyInstalled: [] };

  const newlyInstalled = [];
  const alreadyInstalled = [];
  const track = (name, isNew) => (isNew ? newlyInstalled : alreadyInstalled).push(name);

  // Generate all scripts upfront (idempotent — keeps them up-to-date)
  writePickerAndTemplate('integration.sh', SH_FILE);
  writeTemplate('integration.ps1', PS1_FILE);
  writePickerAndTemplate('integration.fish', FISH_FILE);

  if (IS_WINDOWS) {
    track('PowerShell', installPowerShellProfile());
  }

  const currentShell = (process.env.SHELL || '').split('/').pop();

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

// ── Template & picker writers ───────────────────────────────────────────────

function writeTemplate(templateName, targetFile) {
  const content = readFileSync(join(TEMPLATES_DIR, templateName), 'utf8');
  writeFileSync(targetFile, content, EXEC_MODE);
}

function writePickerAndTemplate(templateName, targetFile) {
  if (!existsSync(PROFILES_DIR)) return;
  const picker = readFileSync(PICKER_SRC, 'utf8');
  writeFileSync(PICKER_FILE, picker, EXEC_MODE);
  writeTemplate(templateName, targetFile);
}

// ── Per-shell RC installers ─────────────────────────────────────────────────

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
  // Support both Windows PowerShell 5.1 and PowerShell 7+
  const ps5Profile = join(HOME, 'Documents', 'WindowsPowerShell', 'Microsoft.PowerShell_profile.ps1');
  const ps7Profile = join(HOME, 'Documents', 'PowerShell', 'Microsoft.PowerShell_profile.ps1');
  const profileFile = existsSync(ps5Profile) ? ps5Profile : ps7Profile;
  const sourceLine = `. "$env:USERPROFILE\\.claude-profiles\\.shell-integration.ps1"`;
  mkdirSync(dirname(profileFile), { recursive: true });
  return addSourceLine(profileFile, sourceLine, '.shell-integration.ps1');
}

/** @returns {boolean} true if newly installed, false if already present */
function addSourceLine(rcFile, sourceLine, marker) {
  if (existsSync(rcFile)) {
    const content = readFileSync(rcFile, 'utf8');
    if (content.includes(marker)) return false;
    const cleaned = content.split('\n').filter(l => !l.includes(marker));
    cleaned.push('', '# Claude Switch - multi-account manager', sourceLine);
    writeFileSync(rcFile, cleaned.join('\n'));
  } else {
    writeFileSync(rcFile, `\n# Claude Switch - multi-account manager\n${sourceLine}\n`);
  }
  return true;
}
