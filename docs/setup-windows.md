# Windows Setup Guide

[한국어](./setup-windows.ko.md)

## Prerequisites

- **Node.js 18+** — [Download](https://nodejs.org/)
- **Claude Code** — `npm i -g @anthropic-ai/claude-code`

## Setup

### 1. Run the init wizard

Open **PowerShell** and run:

```powershell
npx claude-account-switch init
```

### 2. Choose PowerShell integration

When prompted, select **PowerShell (recommended for Windows)**.

This adds a single line to your PowerShell profile (`$PROFILE`):

```powershell
. "$env:USERPROFILE\.claude-profiles\.shell-integration.ps1"
```

### 3. Activate

```powershell
# Reload your profile
. $PROFILE

# Or just open a new PowerShell window
```

### 4. Use

```powershell
claude           # Launch Claude with the active profile
cpf <name>       # Quick switch
claude-pick      # Interactive picker
```

## Optional: Enable Developer Mode

By default, shared settings (`settings.json`) are **copied** into each profile on Windows. To use real symlinks instead (so changes auto-sync across profiles):

1. Open **Settings → For developers**
2. Enable **Developer Mode**

Without Developer Mode, the tool works fine — you'll just see a one-time notice that files were copied instead of linked.

## Alternative: Git Bash / WSL

If you prefer a Unix shell on Windows, you can choose **bash** or **zsh** during the init wizard instead of PowerShell.

### Git Bash

```bash
npx claude-account-switch init
# Select: bash (~/.bashrc)
source ~/.bashrc
```

### WSL (Windows Subsystem for Linux)

WSL behaves as a full Linux environment. See the [Linux Setup Guide](./setup-linux.md).

## Troubleshooting

### `running scripts is disabled on this system`

PowerShell's execution policy may block the profile script. Fix:

```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```

### `claude: The term 'claude' is not recognized`

Make sure Claude Code is installed globally and in your PATH:

```powershell
npm i -g @anthropic-ai/claude-code
claude --version
```

### Profile script not loading

Verify your profile path and that the integration line exists:

```powershell
echo $PROFILE
Get-Content $PROFILE | Select-String "shell-integration"
```
