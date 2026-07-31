# Claude Switch fish integration
# Auto-generated - do not edit manually

function __claude_switch_cli
  if command -v claude-account-switch >/dev/null 2>&1
    command claude-account-switch $argv
  else
    echo (set_color red)"[claude-account-switch]"(set_color normal)" Error: claude-account-switch binary not found." >&2
    echo "  Run: npm install -g claude-account-switch" >&2
    return 127
  end
end

function claude
  __claude_switch_cli shell launch $argv
end

function cpf
  __claude_switch_cli shell use $argv
end

function claude-pick
  __claude_switch_cli shell pick
end
