# Claude Switch fish integration

function __claude_switch_cli
  set -l runtime "$HOME/.claude-profiles/_runtime/bin/cli.mjs"
  if not test -f "$runtime"; or not command -q node
    echo 'Shell runtime unavailable. Run: npx claude-account-switch@latest install-shell' >&2
    return 127
  end
  command node "$runtime" $argv
end

function __claude_switch_launch
  set -l profile $argv[1]
  set -e argv[1]
  set -l hook "$HOME/.claude-profiles/$profile/pre-launch.fish"
  command fish -c '
    function __claude_switch_exec
      set -l hook $argv[1]
      set -e argv[1]
      if test -f "$hook"
        source "$hook"; or return $status
      end
      exec $argv
    end
    __claude_switch_exec $argv
  ' "$hook" node "$HOME/.claude-profiles/_runtime/bin/cli.mjs" shell launch --profile "$profile" -- $argv
end

function claude
  set -l selected (__claude_switch_cli shell pick --print)
  or return $status
  test -n "$selected"; or return 1
  __claude_switch_launch "$selected" $argv
end

function cpf
  __claude_switch_cli shell use $argv
end

function claude-pick
  __claude_switch_cli shell pick
end
