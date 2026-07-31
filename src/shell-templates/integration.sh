#!/bin/sh
# Claude Switch shell integration
# Auto-generated — do not edit manually

__claude_switch_cli() {
  if command -v claude-account-switch >/dev/null 2>&1; then
    claude-account-switch "$@"
  else
    printf "\033[31m[claude-account-switch]\033[0m Error: claude-account-switch binary not found.\n" >&2
    printf "  Run: npm install -g claude-account-switch\n" >&2
    return 127
  fi
}

# claude — profile-aware launcher
claude() {
  __claude_switch_cli shell launch "$@"
}

# cpf — quick profile switch
cpf() {
  __claude_switch_cli shell use "$@"
}

# claude-pick — standalone interactive profile selector
claude-pick() {
  __claude_switch_cli shell pick
}
