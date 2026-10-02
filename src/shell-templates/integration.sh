#!/bin/sh
# Claude Switch shell integration

__claude_switch_cli() {
  local runtime="$HOME/.claude-profiles/_runtime/bin/cli.mjs"
  if [ ! -f "$runtime" ] || ! command -v node >/dev/null 2>&1; then
    printf 'Shell runtime unavailable. Run: npx claude-account-switch@latest install-shell\n' >&2
    return 127
  fi
  command node "$runtime" "$@"
}

__claude_switch_launch() (
  local profile="$1"
  shift
  local hook="$HOME/.claude-profiles/$profile/pre-launch.sh"
  if [ -f "$hook" ]; then
    set -a
    . "$hook" || return $?
    set +a
  fi
  __claude_switch_cli shell launch --profile "$profile" -- "$@"
)

claude() {
  local selected
  selected=$(__claude_switch_cli shell pick --print) || return $?
  [ -n "$selected" ] || return 1
  __claude_switch_launch "$selected" "$@"
}

cpf() {
  __claude_switch_cli shell use "$@"
}

claude-pick() {
  __claude_switch_cli shell pick
}
