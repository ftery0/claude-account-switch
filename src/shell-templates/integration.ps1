# Claude Switch PowerShell integration

function __claude_switch_cli {
  $profileHome = $env:USERPROFILE
  if (!$profileHome) { $profileHome = $env:HOME }
  $runtime = Join-Path $profileHome '.claude-profiles/_runtime/bin/cli.mjs'
  $node = Get-Command node -CommandType Application -ErrorAction SilentlyContinue
  if (!(Test-Path $runtime) -or !$node) {
    $global:LASTEXITCODE = 127
    Write-Error 'Shell runtime unavailable. Run: npx claude-account-switch@latest install-shell' -ErrorAction Continue
    return
  }
  $hadTransport = Test-Path Env:CLAUDE_SWITCH_ARGV
  $previousTransport = $env:CLAUDE_SWITCH_ARGV
  $previousEncoding = [Console]::OutputEncoding
  $exitCode = 1
  try {
    $payload = ConvertTo-Json -Compress -Depth 3 -InputObject @{
      runtime = $runtime
      args = @($args)
      previous = $previousTransport
    }
    $env:CLAUDE_SWITCH_ARGV = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($payload))
    $bootstrap = @'
const payload = JSON.parse(Buffer.from(process.env.CLAUDE_SWITCH_ARGV, 'base64').toString('utf8'));
if (payload.previous === null) delete process.env.CLAUDE_SWITCH_ARGV;
else process.env.CLAUDE_SWITCH_ARGV = payload.previous;
process.argv = [process.execPath, payload.runtime, ...payload.args];
await import((await import('node:url')).pathToFileURL(payload.runtime).href);
'@
    $ErrorActionPreference = 'Continue'
    $PSNativeCommandUseErrorActionPreference = $false
    [Console]::OutputEncoding = [Text.Encoding]::UTF8
    & $node.Source --input-type=module --eval $bootstrap
    $exitCode = $LASTEXITCODE
  } finally {
    [Console]::OutputEncoding = $previousEncoding
    if ($hadTransport) { $env:CLAUDE_SWITCH_ARGV = $previousTransport }
    else { Remove-Item Env:CLAUDE_SWITCH_ARGV -ErrorAction SilentlyContinue }
    $global:LASTEXITCODE = $exitCode
  }
}

function __claude_switch_launch {
  $profile = $args[0]
  $forwarded = @($args | Select-Object -Skip 1)
  $profileHome = $env:USERPROFILE
  if (!$profileHome) { $profileHome = $env:HOME }
  $hook = Join-Path $profileHome ".claude-profiles/$profile/pre-launch.ps1"
  $saved = @{}
  Get-ChildItem Env: | ForEach-Object { $saved[$_.Name] = $_.Value }
  try {
    if (Test-Path $hook) {
      $ErrorActionPreference = 'Stop'
      $global:LASTEXITCODE = 0
      . $hook
      if (!$? -or $LASTEXITCODE -ne 0) { return }
    }
    __claude_switch_cli shell launch --profile $profile '--' @forwarded
  } catch {
    if (!$LASTEXITCODE) { $global:LASTEXITCODE = 1 }
    Write-Error $_ -ErrorAction Continue
  } finally {
    Get-ChildItem Env: | ForEach-Object {
      if (!$saved.ContainsKey($_.Name)) { Remove-Item "Env:$($_.Name)" }
    }
    foreach ($name in $saved.Keys) { Set-Item "Env:$name" $saved[$name] }
  }
}

function claude {
  $selected = __claude_switch_cli shell pick --print
  if ($LASTEXITCODE -ne 0 -or !$selected) { return }
  __claude_switch_launch $selected @args
}

function cpf { __claude_switch_cli shell use @args }
function claude-pick { __claude_switch_cli shell pick }
