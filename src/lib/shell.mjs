import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { HOME, PROFILES_DIR, IS_WINDOWS } from './constants.mjs';

// Unix file permissions are silently ignored on Windows
const EXEC_MODE = IS_WINDOWS ? undefined : { mode: 0o755 };

const SH_FILE   = join(PROFILES_DIR, '.shell-integration.sh');
const PS1_FILE  = join(PROFILES_DIR, '.shell-integration.ps1');
const FISH_FILE = join(PROFILES_DIR, '.shell-integration.fish');

export function installShellIntegration(shell) {
  if (shell === 'powershell') {
    generatePowerShellScript();
    installPowerShellProfile();
  } else if (shell === 'fish') {
    generateFishScript();
    installFishConfig();
  } else {
    // bash or zsh
    generateUnixScript();
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

  function track(name, isNew) {
    (isNew ? newlyInstalled : alreadyInstalled).push(name);
  }

  // Generate all scripts upfront (idempotent — keeps them up-to-date)
  generateUnixScript();
  generatePowerShellScript();
  generateFishScript();

  // PowerShell (always on Windows)
  if (IS_WINDOWS) {
    track('PowerShell', installPowerShellProfile());
  }

  const currentShell = (process.env.SHELL || '').split('/').pop();

  // bash: install if .bashrc exists or it's the current shell
  if (existsSync(join(HOME, '.bashrc')) || currentShell === 'bash') {
    track('bash', installUnixRc('bash'));
  }

  // zsh: install if .zshrc exists, current shell, or macOS default
  if (existsSync(join(HOME, '.zshrc')) || currentShell === 'zsh' || process.platform === 'darwin') {
    track('zsh', installUnixRc('zsh'));
  }

  // fish: install if fish config dir exists or it's the current shell
  if (existsSync(join(HOME, '.config', 'fish')) || currentShell === 'fish') {
    track('fish', installFishConfig());
  }

  return { newlyInstalled, alreadyInstalled };
}

// ─── Unix (bash / zsh) ───────────────────────────────────────────────────────

function installUnixRc(shell) {
  const rcFile = shell === 'zsh'
    ? join(HOME, '.zshrc')
    : join(HOME, '.bashrc');
  const sourceLine = '[ -f ~/.claude-profiles/.shell-integration.sh ] && . ~/.claude-profiles/.shell-integration.sh';
  return addSourceLine(rcFile, sourceLine, '.shell-integration.sh');
}

function generateUnixScript() {
  // Notes on portability:
  //   - Uses `#!/bin/sh` shebang but is always *sourced* into bash or zsh,
  //     so `local` and process-substitution are safe.
  //   - Profile listing uses a glob loop instead of `ls | xargs` to avoid
  //     xargs portability issues and empty-directory edge cases.
  //   - `while` loops use a here-doc (`<<`) instead of a pipe so that the
  //     loop body runs in the current shell (no subshell), keeping `local`
  //     variables and the `i` counter working correctly.
  //   - `sed` patterns use only BRE syntax, compatible with both BSD sed
  //     (macOS) and GNU sed (Linux).
  const script = `#!/bin/sh
# Claude Switch shell integration
# Auto-generated — do not edit manually

CLAUDE_PROFILES_DIR="$HOME/.claude-profiles"
CLAUDE_META_FILE="$CLAUDE_PROFILES_DIR/meta.json"

# Get active profile name from meta.json (no jq required)
__claude_switch_active() {
  if [ -f "$CLAUDE_META_FILE" ]; then
    sed -n 's/.*"activeProfile"[[:space:]]*:[[:space:]]*"\\([^\\"]*\\)".*/\\1/p' "$CLAUDE_META_FILE"
  fi
}

# List profile directories, one per line (excludes _shared and other _ prefixed dirs)
__claude_switch_profiles() {
  for _csd in "$CLAUDE_PROFILES_DIR"/*/; do
    [ -d "$_csd" ] || continue
    _csn=$(basename "$_csd")
    case "$_csn" in _*) continue ;; esac
    printf '%s\\n' "$_csn"
  done
}

# Count profiles
__claude_switch_count() {
  __claude_switch_profiles | wc -l | tr -d ' \\t'
}

# Launch claude with the given profile active
__claude_switch_launch() {
  local profile="$1"
  shift
  if [ -f "$CLAUDE_PROFILES_DIR/$profile/.claude.json" ]; then
    printf "\\033[36m[claude-account-switch]\\033[0m Profile: \\033[1m%s\\033[0m\\n" "$profile"
  else
    printf "\\033[36m[claude-account-switch]\\033[0m Profile: \\033[1m%s\\033[0m \\033[33m(not logged in — login will start)\\033[0m\\n" "$profile"
  fi
  CLAUDE_CONFIG_DIR="$CLAUDE_PROFILES_DIR/$profile" command claude "$@"
}

# claude — profile-aware launcher
claude() {
  local count
  count=$(__claude_switch_count)

  if [ "$count" -eq 0 ]; then
    printf "No claude-account-switch profiles found. Run: npx claude-account-switch init\\n" >&2
    return 1
  fi

  # Single profile — skip picker
  if [ "$count" -eq 1 ]; then
    local only
    only=$(__claude_switch_profiles | head -1)
    __claude_switch_launch "$only" "$@"
    return
  fi

  # Multiple profiles — interactive picker
  local current profiles_list i choice selected marker login_status
  current=$(__claude_switch_active)
  profiles_list=$(__claude_switch_profiles)
  i=1

  printf "\\n"
  printf "\\033[36m[claude-account-switch]\\033[0m Select a profile:\\n"
  printf "\\n"

  # Use here-doc to avoid subshell so the i counter stays in scope
  while IFS= read -r p; do
    marker=" "
    login_status=""
    [ "$p" = "$current" ] && marker="\\033[32m>\\033[0m"
    [ ! -f "$CLAUDE_PROFILES_DIR/$p/.claude.json" ] && login_status=" \\033[33m(not logged in)\\033[0m"
    printf "  %b \\033[1m%d)\\033[0m %s%b\\n" "$marker" "$i" "$p" "$login_status"
    i=$((i + 1))
  done <<_PROFILES_LIST_
$profiles_list
_PROFILES_LIST_

  printf "\\n"
  printf "  Enter number (default: %s): " "$current"
  read -r choice

  if [ -z "$choice" ]; then
    selected="$current"
  else
    selected=$(printf '%s\\n' "$profiles_list" | sed -n "\${choice}p")
  fi

  if [ -z "$selected" ]; then
    printf "Invalid selection\\n" >&2
    return 1
  fi

  [ "$selected" != "$current" ] && cpf "$selected" >/dev/null

  printf "\\n"
  __claude_switch_launch "$selected" "$@"
}

# cpf — quick profile switch
cpf() {
  if [ -z "$1" ]; then
    printf "Usage: cpf <profile-name>\\n" >&2
    return 1
  fi
  if [ ! -d "$CLAUDE_PROFILES_DIR/$1" ]; then
    printf "Profile \\"%s\\" not found\\n" "$1" >&2
    return 1
  fi
  local tmp
  tmp=$(mktemp)
  sed "s/\\"activeProfile\\"[[:space:]]*:[[:space:]]*\\"[^\\"]*\\"/\\"activeProfile\\": \\"$1\\"/" \\
    "$CLAUDE_META_FILE" > "$tmp" && mv "$tmp" "$CLAUDE_META_FILE"
  printf "Switched to profile: %s\\n" "$1"
}

# claude-pick — standalone interactive profile selector
claude-pick() {
  local profiles_list current i choice profile marker
  profiles_list=$(__claude_switch_profiles)
  if [ -z "$profiles_list" ]; then
    printf "No profiles found. Run: npx claude-account-switch init\\n" >&2
    return 1
  fi
  current=$(__claude_switch_active)
  printf "Select a profile:\\n"
  i=1
  while IFS= read -r p; do
    marker=""
    [ "$p" = "$current" ] && marker=" *"
    printf "  %d) %s%s\\n" "$i" "$p" "$marker"
    i=$((i + 1))
  done <<_PROFILES_LIST_
$profiles_list
_PROFILES_LIST_
  printf "Enter number: "
  read -r choice
  profile=$(printf '%s\\n' "$profiles_list" | sed -n "\${choice}p")
  if [ -n "$profile" ]; then
    cpf "$profile"
  else
    printf "Invalid selection\\n" >&2
  fi
}
`;

  writeFileSync(SH_FILE, script, EXEC_MODE);
}

// ─── Fish ────────────────────────────────────────────────────────────────────

function installFishConfig() {
  const configDir = join(HOME, '.config', 'fish');
  const configFile = join(configDir, 'config.fish');
  const sourceLine = 'test -f ~/.claude-profiles/.shell-integration.fish && source ~/.claude-profiles/.shell-integration.fish';
  mkdirSync(configDir, { recursive: true });
  return addSourceLine(configFile, sourceLine, '.shell-integration.fish');
}

function generateFishScript() {
  // Fish uses node (already available as a dependency of claude-account-switch)
  // for JSON read/write in cpf to avoid sed escaping complexity in fish syntax.
  const script = `# Claude Switch fish integration
# Auto-generated — do not edit manually

set -g __CLAUDE_PROFILES_DIR "$HOME/.claude-profiles"
set -g __CLAUDE_META_FILE "$__CLAUDE_PROFILES_DIR/meta.json"

function __claude_switch_active
  if test -f $__CLAUDE_META_FILE
    node -e 'try{process.stdout.write(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).activeProfile||"")}catch(e){}' "$__CLAUDE_META_FILE" 2>/dev/null
  end
end

function __claude_switch_profiles
  for d in $__CLAUDE_PROFILES_DIR/*/
    if test -d $d
      set name (basename $d)
      if not string match -q '_*' $name
        echo $name
      end
    end
  end
end

function __claude_switch_launch
  set -l profile $argv[1]
  set -e argv[1]
  if test -f "$__CLAUDE_PROFILES_DIR/$profile/.claude.json"
    echo (set_color cyan)"[claude-account-switch]"(set_color normal)" Profile: "(set_color --bold)$profile(set_color normal)
  else
    echo (set_color cyan)"[claude-account-switch]"(set_color normal)" Profile: "(set_color --bold)$profile(set_color normal)" "(set_color yellow)"(not logged in — login will start)"(set_color normal)
  end
  set -x CLAUDE_CONFIG_DIR "$__CLAUDE_PROFILES_DIR/$profile"
  command claude $argv
  set -e CLAUDE_CONFIG_DIR
end

function claude
  set -l profiles (__claude_switch_profiles)
  set -l count (count $profiles)

  if test $count -eq 0
    echo "No claude-account-switch profiles found. Run: npx claude-account-switch init" >&2
    return 1
  end

  if test $count -eq 1
    __claude_switch_launch $profiles[1] $argv
    return
  end

  set -l current (__claude_switch_active)
  echo ""
  echo (set_color cyan)"[claude-account-switch]"(set_color normal)" Select a profile:"
  echo ""

  for i in (seq 1 $count)
    set -l p $profiles[$i]
    set -l marker " "
    set -l login_status ""
    if test "$p" = "$current"
      set marker (set_color green)">"(set_color normal)
    end
    if not test -f "$__CLAUDE_PROFILES_DIR/$p/.claude.json"
      set login_status " "(set_color yellow)"(not logged in)"(set_color normal)
    end
    echo "  $marker $i) $p$login_status"
  end

  echo ""
  read -P "  Enter number (default: $current): " choice

  set -l selected ""
  if test -z "$choice"
    set selected $current
  else if string match -qr '^[0-9]+$' "$choice"
    and test $choice -ge 1
    and test $choice -le $count
    set selected $profiles[$choice]
  end

  if test -z "$selected"
    echo "Invalid selection" >&2
    return 1
  end

  if test "$selected" != "$current"
    cpf $selected >/dev/null
  end

  echo ""
  __claude_switch_launch $selected $argv
end

function cpf
  if test -z "$argv[1]"
    echo "Usage: cpf <profile-name>" >&2
    return 1
  end
  if not test -d "$__CLAUDE_PROFILES_DIR/$argv[1]"
    echo "Profile \\"$argv[1]\\" not found" >&2
    return 1
  end
  node -e 'var fs=require("fs"),f=process.argv[1],m=JSON.parse(fs.readFileSync(f,"utf8"));m.activeProfile=process.argv[2];fs.writeFileSync(f,JSON.stringify(m,null,2))' "$__CLAUDE_META_FILE" "$argv[1]" 2>/dev/null
  echo "Switched to profile: $argv[1]"
end

function claude-pick
  set -l profiles (__claude_switch_profiles)
  if test -z "$profiles"
    echo "No profiles found. Run: npx claude-account-switch init" >&2
    return 1
  end
  set -l current (__claude_switch_active)
  echo "Select a profile:"
  for i in (seq 1 (count $profiles))
    set -l p $profiles[$i]
    set -l marker ""
    if test "$p" = "$current"
      set marker " *"
    end
    echo "  $i) $p$marker"
  end
  read -P "Enter number: " choice
  if string match -qr '^[0-9]+$' "$choice"
    and test $choice -ge 1
    and test $choice -le (count $profiles)
    cpf $profiles[$choice]
  else
    echo "Invalid selection" >&2
  end
end
`;

  writeFileSync(FISH_FILE, script, EXEC_MODE);
}

// ─── PowerShell ──────────────────────────────────────────────────────────────

function installPowerShellProfile() {
  // Support both Windows PowerShell 5.1 and PowerShell 7+
  const ps5Profile = join(HOME, 'Documents', 'WindowsPowerShell', 'Microsoft.PowerShell_profile.ps1');
  const ps7Profile = join(HOME, 'Documents', 'PowerShell', 'Microsoft.PowerShell_profile.ps1');
  // Use existing PS5 profile if found; otherwise default to PS7
  const profileFile = existsSync(ps5Profile) ? ps5Profile : ps7Profile;
  const sourceLine = `. "$env:USERPROFILE\\.claude-profiles\\.shell-integration.ps1"`;
  mkdirSync(dirname(profileFile), { recursive: true });
  return addSourceLine(profileFile, sourceLine, '.shell-integration.ps1');
}

function generatePowerShellScript() {
  const script = `# Claude Switch PowerShell integration
# Auto-generated — do not edit manually

$script:__CLAUDE_PROFILES_DIR = "$env:USERPROFILE\\.claude-profiles"
$script:__CLAUDE_META_FILE    = "$script:__CLAUDE_PROFILES_DIR\\meta.json"

# Cache the real claude binary path *before* our function shadows the name.
# Get-Command with -CommandType Application bypasses functions/aliases.
$__cas_cmd = Get-Command claude -CommandType Application -ErrorAction SilentlyContinue
$script:__claude_bin = if ($__cas_cmd) { $__cas_cmd.Source } else { $null }
Remove-Variable __cas_cmd -ErrorAction SilentlyContinue

function __claude_switch_active {
  if (Test-Path $script:__CLAUDE_META_FILE) {
    try {
      (Get-Content $script:__CLAUDE_META_FILE -Raw | ConvertFrom-Json).activeProfile
    } catch { $null }
  }
}

function __claude_switch_profiles {
  if (Test-Path $script:__CLAUDE_PROFILES_DIR) {
    Get-ChildItem -Path $script:__CLAUDE_PROFILES_DIR -Directory |
      Where-Object { $_.Name -notlike '_*' } |
      Select-Object -ExpandProperty Name
  }
}

function __claude_switch_launch {
  param([string]$Profile, [string[]]$Remaining)
  $configFile = "$script:__CLAUDE_PROFILES_DIR\\$Profile\\.claude.json"
  if (Test-Path $configFile) {
    Write-Host "[claude-account-switch] Profile: $Profile" -ForegroundColor Cyan
  } else {
    Write-Host "[claude-account-switch] Profile: $Profile (not logged in — login will start)" -ForegroundColor Cyan
  }
  $env:CLAUDE_CONFIG_DIR = "$script:__CLAUDE_PROFILES_DIR\\$Profile"
  try {
    if ($script:__claude_bin) {
      & $script:__claude_bin @Remaining
    } else {
      Write-Error "claude binary not found. Please ensure Claude Code is installed and in your PATH."
    }
  } finally {
    Remove-Item Env:CLAUDE_CONFIG_DIR -ErrorAction SilentlyContinue
  }
}

function claude {
  $profiles = @(__claude_switch_profiles)
  if ($profiles.Count -eq 0) {
    Write-Error "No claude-account-switch profiles found. Run: npx claude-account-switch init"
    return
  }

  # Single profile — skip picker
  if ($profiles.Count -eq 1) {
    __claude_switch_launch -Profile $profiles[0] -Remaining $args
    return
  }

  $current = __claude_switch_active
  Write-Host ""
  Write-Host "[claude-account-switch] Select a profile:" -ForegroundColor Cyan
  Write-Host ""

  for ($i = 0; $i -lt $profiles.Count; $i++) {
    $p = $profiles[$i]
    $marker = if ($p -eq $current) { ">" } else { " " }
    $loginStatus = if (!(Test-Path "$script:__CLAUDE_PROFILES_DIR\\$p\\.claude.json")) { " (not logged in)" } else { "" }
    if ($p -eq $current) {
      Write-Host "  $marker $($i + 1)) $p$loginStatus" -ForegroundColor Green
    } else {
      Write-Host "  $marker $($i + 1)) $p$loginStatus"
    }
  }

  Write-Host ""
  $hint    = if ($current) { " (default: $current)" } else { "" }
  $choice  = Read-Host "  Enter number$hint"

  $selected = $null
  if ([string]::IsNullOrEmpty($choice)) {
    $selected = $current
  } elseif ($choice -match '^\\d+$') {
    $idx = [int]$choice - 1
    if ($idx -ge 0 -and $idx -lt $profiles.Count) {
      $selected = $profiles[$idx]
    }
  }

  if ($null -eq $selected) {
    Write-Error "Invalid selection"
    return
  }

  if ($selected -ne $current) {
    cpf $selected | Out-Null
  }

  Write-Host ""
  __claude_switch_launch -Profile $selected -Remaining $args
}

function cpf {
  param([string]$Name)
  if ([string]::IsNullOrEmpty($Name)) {
    Write-Error "Usage: cpf <profile-name>"
    return
  }
  if (!(Test-Path "$script:__CLAUDE_PROFILES_DIR\\$Name")) {
    Write-Error "Profile \`"$Name\`" not found"
    return
  }
  try {
    $meta = Get-Content $script:__CLAUDE_META_FILE -Raw | ConvertFrom-Json
    $meta.activeProfile = $Name
    $json = $meta | ConvertTo-Json -Depth 10
    [IO.File]::WriteAllText($script:__CLAUDE_META_FILE, $json)
    Write-Host "Switched to profile: $Name"
  } catch {
    Write-Error "Failed to update profile: $_"
  }
}

function claude-pick {
  $profiles = @(__claude_switch_profiles)
  if ($profiles.Count -eq 0) {
    Write-Error "No profiles found. Run: npx claude-account-switch init"
    return
  }
  $current = __claude_switch_active
  Write-Host "Select a profile:"
  for ($i = 0; $i -lt $profiles.Count; $i++) {
    $p      = $profiles[$i]
    $marker = if ($p -eq $current) { " *" } else { "" }
    Write-Host "  $($i + 1)) $p$marker"
  }
  $choice = Read-Host "Enter number"
  if ($choice -match '^\\d+$') {
    $idx = [int]$choice - 1
    if ($idx -ge 0 -and $idx -lt $profiles.Count) {
      cpf $profiles[$idx]
    } else {
      Write-Error "Invalid selection"
    }
  } else {
    Write-Error "Invalid selection"
  }
}
`;

  writeFileSync(PS1_FILE, script);
}

// ─── Shared helper ───────────────────────────────────────────────────────────

/** @returns {boolean} true if newly installed, false if already present */
function addSourceLine(rcFile, sourceLine, marker) {
  if (existsSync(rcFile)) {
    const content = readFileSync(rcFile, 'utf8');
    if (content.includes(marker)) {
      return false; // already installed
    }
    const cleaned = content.split('\n').filter(l => !l.includes(marker));
    cleaned.push('', '# Claude Switch - multi-account manager', sourceLine);
    writeFileSync(rcFile, cleaned.join('\n'));
    return true;
  } else {
    writeFileSync(rcFile, `\n# Claude Switch - multi-account manager\n${sourceLine}\n`);
    return true;
  }
}
