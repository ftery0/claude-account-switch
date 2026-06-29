# Claude Switch PowerShell integration
# Auto-generated — do not edit manually

$script:__CLAUDE_PROFILES_DIR = "$env:USERPROFILE\.claude-profiles"
$script:__CLAUDE_META_FILE    = "$script:__CLAUDE_PROFILES_DIR\meta.json"

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
  $configFile = "$script:__CLAUDE_PROFILES_DIR\$Profile\.claude.json"
  if (Test-Path $configFile) {
    Write-Host "[claude-account-switch] Profile: $Profile" -ForegroundColor Cyan
  } else {
    Write-Host "[claude-account-switch] Profile: $Profile (not logged in — login will start)" -ForegroundColor Cyan
  }
  $env:CLAUDE_CONFIG_DIR = "$script:__CLAUDE_PROFILES_DIR\$Profile"
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
    $loginStatus = if (!(Test-Path "$script:__CLAUDE_PROFILES_DIR\$p\.claude.json")) { " (not logged in)" } else { "" }
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
  } elseif ($choice -match '^\d+$') {
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
  if (!(Test-Path "$script:__CLAUDE_PROFILES_DIR\$Name")) {
    Write-Error "Profile `"$Name`" not found"
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
  if ($choice -match '^\d+$') {
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
