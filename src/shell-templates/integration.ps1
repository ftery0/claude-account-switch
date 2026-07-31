# Claude Switch PowerShell integration
# Auto-generated - do not edit manually

function __claude_switch_cli {
  $cmd = Get-Command claude-account-switch -CommandType Application -ErrorAction SilentlyContinue
  if ($cmd) {
    & $cmd.Source @args
  } else {
    Write-Error "claude-account-switch binary not found. Run: npm install -g claude-account-switch"
    return 127
  }
}

function claude {
  __claude_switch_cli shell launch @args
}

function cpf {
  __claude_switch_cli shell use @args
}

function claude-pick {
  __claude_switch_cli shell pick
}
