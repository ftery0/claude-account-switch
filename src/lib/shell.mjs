import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { HOME, SHELL_INTEGRATION_FILE, PROFILES_DIR, META_FILE } from './constants.mjs';
import { warn } from './ui.mjs';

const SOURCE_LINE = '[ -f ~/.claude-profiles/.shell-integration.sh ] && source ~/.claude-profiles/.shell-integration.sh';

export function installShellIntegration(shell) {
  // 1. Generate the shell integration script
  generateShellScript();

  // 2. Add source line to rc file
  const rcFile = shell === 'zsh'
    ? join(HOME, '.zshrc')
    : join(HOME, '.bashrc');

  if (existsSync(rcFile)) {
    const content = readFileSync(rcFile, 'utf8');
    if (content.includes('.claude-profiles/.shell-integration.sh')) {
      // Already installed — just update the script
      return;
    }
    // Remove old claude-switch related lines if any
    const lines = content.split('\n');
    const cleaned = lines.filter(l => !l.includes('claude-profiles/.shell-integration.sh'));
    cleaned.push('', '# Claude Switch - multi-account manager', SOURCE_LINE);
    writeFileSync(rcFile, cleaned.join('\n'));
  } else {
    writeFileSync(rcFile, `\n# Claude Switch - multi-account manager\n${SOURCE_LINE}\n`);
  }
}

function generateShellScript() {
  const script = `#!/bin/sh
# Claude Switch shell integration
# Auto-generated — do not edit manually

CLAUDE_PROFILES_DIR="$HOME/.claude-profiles"
CLAUDE_META_FILE="$CLAUDE_PROFILES_DIR/meta.json"

# Get active profile from meta.json
__claude_switch_active() {
  if [ -f "$CLAUDE_META_FILE" ]; then
    # Parse JSON without jq (works in sh/bash/zsh)
    sed -n 's/.*"activeProfile"[[:space:]]*:[[:space:]]*"\\([^"]*\\)".*/\\1/p' "$CLAUDE_META_FILE"
  fi
}

# List profile directories (excluding _shared)
__claude_switch_profiles() {
  ls -d "$CLAUDE_PROFILES_DIR"/*/ 2>/dev/null | xargs -I{} basename {} | grep -v '^_'
}

# Count profiles
__claude_switch_count() {
  __claude_switch_profiles | wc -l | tr -d ' '
}

# Launch claude with a given profile
__claude_switch_launch() {
  local profile="$1"
  shift
  local config_file="$CLAUDE_PROFILES_DIR/$profile/.claude.json"
  if [ -f "$config_file" ]; then
    echo "\\033[36m[claude-switch]\\033[0m Profile: \\033[1m$profile\\033[0m"
  else
    echo "\\033[36m[claude-switch]\\033[0m Profile: \\033[1m$profile\\033[0m \\033[33m(not logged in — login will start)\\033[0m"
  fi
  CLAUDE_CONFIG_DIR="$CLAUDE_PROFILES_DIR/$profile" command claude "$@"
}

# claude command wrapper
claude() {
  local count
  count=$(__claude_switch_count)

  if [ "$count" -eq 0 ]; then
    echo "No claude-switch profiles found. Run: npx claude-switch init" >&2
    return 1
  fi

  # Single profile — skip picker, launch directly
  if [ "$count" -eq 1 ]; then
    local only_profile
    only_profile=$(__claude_switch_profiles | head -1)
    __claude_switch_launch "$only_profile" "$@"
    return
  fi

  # Multiple profiles — show picker
  local profiles current i=1
  current=$(__claude_switch_active)
  profiles=$(__claude_switch_profiles)

  echo ""
  echo "\\033[36m[claude-switch]\\033[0m Select a profile:"
  echo ""
  echo "$profiles" | while IFS= read -r p; do
    local marker=" "
    local login_status=""
    if [ "$p" = "$current" ]; then
      marker="\\033[32m>\\033[0m"
    fi
    if [ ! -f "$CLAUDE_PROFILES_DIR/$p/.claude.json" ]; then
      login_status=" \\033[33m(not logged in)\\033[0m"
    fi
    echo "  $marker \\033[1m$i)\\033[0m $p$login_status"
    i=$((i + 1))
  done
  echo ""
  printf "  Enter number (default: %s): " "$current"
  read -r choice

  local selected
  if [ -z "$choice" ]; then
    selected="$current"
  else
    selected=$(echo "$profiles" | sed -n "\${choice}p")
  fi

  if [ -z "$selected" ]; then
    echo "Invalid selection" >&2
    return 1
  fi

  # Update active profile
  if [ "$selected" != "$current" ]; then
    cpf "$selected" >/dev/null
  fi

  echo ""
  __claude_switch_launch "$selected" "$@"
}

# cpf — quick profile switch
cpf() {
  if [ -z "$1" ]; then
    echo "Usage: cpf <profile-name>" >&2
    return 1
  fi
  if [ ! -d "$CLAUDE_PROFILES_DIR/$1" ]; then
    echo "Profile \\"$1\\" not found" >&2
    return 1
  fi
  # Update meta.json activeProfile
  local tmp
  tmp=$(mktemp)
  sed "s/\\"activeProfile\\"[[:space:]]*:[[:space:]]*\\"[^"]*\\"/\\"activeProfile\\": \\"$1\\"/" "$CLAUDE_META_FILE" > "$tmp" && mv "$tmp" "$CLAUDE_META_FILE"
  echo "Switched to profile: $1"
}

# claude-pick — interactive profile selector
claude-pick() {
  local profiles profile
  profiles=$(ls -d "$CLAUDE_PROFILES_DIR"/*/ 2>/dev/null | xargs -I{} basename {} | grep -v '^_')
  if [ -z "$profiles" ]; then
    echo "No profiles found. Run: npx claude-switch init" >&2
    return 1
  fi
  echo "Select a profile:"
  local i=1
  local current
  current=$(__claude_switch_active)
  echo "$profiles" | while IFS= read -r p; do
    if [ "$p" = "$current" ]; then
      echo "  $i) $p *"
    else
      echo "  $i) $p"
    fi
    i=$((i + 1))
  done
  printf "Enter number: "
  read -r choice
  profile=$(echo "$profiles" | sed -n "\${choice}p")
  if [ -n "$profile" ]; then
    cpf "$profile"
  else
    echo "Invalid selection" >&2
  fi
}
`;

  writeFileSync(SHELL_INTEGRATION_FILE, script, { mode: 0o755 });
}
