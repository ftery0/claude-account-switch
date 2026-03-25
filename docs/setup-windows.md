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

### 2. Shell integration (automatic)

The init wizard auto-detects available shells and installs integration for each one. On Windows, this typically includes:

- **PowerShell (`$PROFILE`)** — auto-installed on Windows
- **bash (~/.bashrc)** — if Git Bash or WSL is detected
- **zsh (~/.zshrc)** — if WSL with zsh is detected

No manual shell selection needed.

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

On Windows, the tool attempts to create symlinks for shared settings (`settings.json`). If symlink creation fails (Developer Mode not enabled), it falls back to copying the file with a one-time notice.

To enable symlinks:

1. Open **Settings > For developers**
2. Enable **Developer Mode**

Without Developer Mode, the tool works fine — shared directories (`commands/`) always use junctions (no special permissions needed), and shared files are copied instead of linked.

## Alternative: Git Bash / WSL

Shell integration is auto-installed for all detected shells. If Git Bash or WSL is available, it will be set up automatically during `init`.

### Git Bash

```bash
npx claude-account-switch init
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
