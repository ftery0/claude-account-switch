#!/bin/sh
# Claude Switch shell integration
# Auto-generated — do not edit manually

CLAUDE_PROFILES_DIR="$HOME/.claude-profiles"
CLAUDE_META_FILE="$CLAUDE_PROFILES_DIR/meta.json"

# Resolve real claude binary path BEFORE our function shadows the name.
# command -v bypasses functions/aliases and finds the actual executable.
__CLAUDE_SWITCH_REAL_BIN="$(command -v claude 2>/dev/null)"

# Get active profile name from meta.json (no jq required)
__claude_switch_active() {
  if [ -f "$CLAUDE_META_FILE" ]; then
    sed -n 's/.*"activeProfile"[[:space:]]*:[[:space:]]*"\([^\"]*\)".*/\1/p' "$CLAUDE_META_FILE"
  fi
}

# List profile directories, one per line (excludes _shared and other _ prefixed dirs)
__claude_switch_profiles() {
  for _csd in "$CLAUDE_PROFILES_DIR"/*/; do
    [ -d "$_csd" ] || continue
    _csn=$(basename "$_csd")
    case "$_csn" in _*) continue ;; esac
    printf '%s\n' "$_csn"
  done
}

# Count profiles
__claude_switch_count() {
  __claude_switch_profiles | wc -l | tr -d ' \t'
}

# Launch claude with the given profile active
__claude_switch_launch() {
  local profile="$1"
  shift
  if [ -f "$CLAUDE_PROFILES_DIR/$profile/.claude.json" ]; then
    printf "\033[36m[claude-account-switch]\033[0m Profile: \033[1m%s\033[0m\n" "$profile"
  else
    printf "\033[36m[claude-account-switch]\033[0m Profile: \033[1m%s\033[0m \033[33m(not logged in — login will start)\033[0m\n" "$profile"
  fi
  # Use cached binary; fallback to npm global root; error if not found.
  # Modern Claude Code ships as a native binary (bin/claude.exe); the
  # legacy cli.js form is kept last for older installs.
  local _bin="$__CLAUDE_SWITCH_REAL_BIN"
  if [ -z "$_bin" ] || [ ! -x "$_bin" ]; then
    local _npm_root _c
    _npm_root="$(npm root -g 2>/dev/null)"
    if [ -n "$_npm_root" ]; then
      for _c in \
        "$_npm_root/@anthropic-ai/claude-code/bin/claude.exe" \
        "$_npm_root/@anthropic-ai/claude-code/bin/claude" \
        "$_npm_root/@anthropic-ai/claude-code/cli.js"
      do
        if [ -x "$_c" ] || [ -f "$_c" ]; then _bin="$_c"; break; fi
      done
    fi
  fi
  if [ -z "$_bin" ]; then
    printf "\033[31m[claude-account-switch]\033[0m Error: claude binary not found.\n" >&2
    printf "  Run: npm install -g @anthropic-ai/claude-code\n" >&2
    return 127
  fi
  # If resolved to a .js script, invoke it through node
  case "$_bin" in
    *.js) CLAUDE_CONFIG_DIR="$CLAUDE_PROFILES_DIR/$profile" node "$_bin" "$@" ;;
    *)    CLAUDE_CONFIG_DIR="$CLAUDE_PROFILES_DIR/$profile" "$_bin" "$@" ;;
  esac
}

# claude — profile-aware launcher
claude() {
  local count
  count=$(__claude_switch_count)

  if [ "$count" -eq 0 ]; then
    printf "No claude-account-switch profiles found. Run: npx claude-account-switch init\n" >&2
    return 1
  fi

  # Single profile — skip picker
  if [ "$count" -eq 1 ]; then
    local only
    only=$(__claude_switch_profiles | head -1)
    __claude_switch_launch "$only" "$@"
    return
  fi

  # Multiple profiles — arrow-key picker (via node) or number fallback
  local current selected
  current=$(__claude_switch_active)

  if [ -f "$CLAUDE_PROFILES_DIR/.picker.mjs" ] && command -v node >/dev/null 2>&1; then
    selected=$(node "$CLAUDE_PROFILES_DIR/.picker.mjs" </dev/tty)
    [ -z "$selected" ] && return 1
  else
    local profiles_list i choice marker login_status
    profiles_list=$(__claude_switch_profiles)
    i=1
    printf "\n"
    printf "\033[36m[claude-account-switch]\033[0m Select a profile:\n"
    printf "\n"
    while IFS= read -r p; do
      marker=" "
      login_status=""
      [ "$p" = "$current" ] && marker="\033[32m>\033[0m"
      [ ! -f "$CLAUDE_PROFILES_DIR/$p/.claude.json" ] && login_status=" \033[33m(not logged in)\033[0m"
      printf "  %b \033[1m%d)\033[0m %s%b\n" "$marker" "$i" "$p" "$login_status"
      i=$((i + 1))
    done <<_PROFILES_LIST_
$profiles_list
_PROFILES_LIST_
    printf "\n"
    printf "  Enter number (default: %s): " "$current"
    read -r choice
    if [ -z "$choice" ]; then
      selected="$current"
    else
      selected=$(printf '%s\n' "$profiles_list" | sed -n "${choice}p")
    fi
    if [ -z "$selected" ]; then
      printf "Invalid selection\n" >&2
      return 1
    fi
  fi

  [ "$selected" != "$current" ] && cpf "$selected" >/dev/null
  printf "\n"
  __claude_switch_launch "$selected" "$@"
}

# cpf — quick profile switch
cpf() {
  if [ -z "$1" ]; then
    printf "Usage: cpf <profile-name>\n" >&2
    return 1
  fi
  if [ ! -d "$CLAUDE_PROFILES_DIR/$1" ]; then
    printf "Profile \"%s\" not found\n" "$1" >&2
    return 1
  fi
  local tmp
  tmp=$(mktemp)
  sed "s/\"activeProfile\"[[:space:]]*:[[:space:]]*\"[^\"]*\"/\"activeProfile\": \"$1\"/" \
    "$CLAUDE_META_FILE" > "$tmp" && mv "$tmp" "$CLAUDE_META_FILE"
  printf "Switched to profile: %s\n" "$1"
}

# claude-pick — standalone interactive profile selector
claude-pick() {
  if [ -f "$CLAUDE_PROFILES_DIR/.picker.mjs" ] && command -v node >/dev/null 2>&1; then
    local selected
    selected=$(node "$CLAUDE_PROFILES_DIR/.picker.mjs" </dev/tty)
    [ -z "$selected" ] && return 1
    cpf "$selected"
  else
    local profiles_list current i choice profile marker
    profiles_list=$(__claude_switch_profiles)
    if [ -z "$profiles_list" ]; then
      printf "No profiles found. Run: npx claude-account-switch init\n" >&2
      return 1
    fi
    current=$(__claude_switch_active)
    printf "Select a profile:\n"
    i=1
    while IFS= read -r p; do
      marker=""
      [ "$p" = "$current" ] && marker=" *"
      printf "  %d) %s%s\n" "$i" "$p" "$marker"
      i=$((i + 1))
    done <<_PROFILES_LIST_
$profiles_list
_PROFILES_LIST_
    printf "Enter number: "
    read -r choice
    profile=$(printf '%s\n' "$profiles_list" | sed -n "${choice}p")
    if [ -n "$profile" ]; then
      cpf "$profile"
    else
      printf "Invalid selection\n" >&2
    fi
  fi
}
