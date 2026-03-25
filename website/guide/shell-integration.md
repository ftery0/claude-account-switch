---
title: Shell Integration — claude-account-switch
description: Shell commands available after installing claude-account-switch. claude, cpf, and claude-pick for instant profile switching.
---

# Shell Integration

After running `init` or `install-shell`, these commands are available in your terminal.

## Available Commands

| Command | Description |
|---------|-------------|
| `claude` | Run Claude with the active profile |
| `cpf <name>` | Quick switch to a profile |
| `claude-pick` | Interactive profile selector |

### `claude`

Launches Claude Code with the active profile's `CLAUDE_CONFIG_DIR` set.

- **Single profile**: Launches immediately
- **Multiple profiles**: Shows an interactive arrow-key picker to select a profile, then launches

```bash
claude
```

### `cpf <name>`

Instantly switch to a different profile.

```bash
cpf work        # Switch to work profile
cpf personal    # Switch to personal profile
```

### `claude-pick`

Opens an interactive arrow-key picker to select a profile. If Node.js is not available, falls back to a numbered list.

```bash
claude-pick
```

## Supported Shells

| Shell | Platform | Config File |
|-------|----------|-------------|
| zsh | macOS / Linux | `~/.zshrc` |
| bash | macOS / Linux / Git Bash | `~/.bashrc` |
| fish | macOS / Linux | `~/.config/fish/config.fish` |
| PowerShell | Windows | `$PROFILE` (PS 5.1: `~/Documents/WindowsPowerShell/`, PS 7+: `~/Documents/PowerShell/`) |

## Auto Detection

Shell integration is auto-installed during `init` for all detected shells. Additionally, every time you run any `claude-account-switch` command, it checks for newly available shells and installs integration automatically.

## Manual Installation

If you need to reinstall for a specific shell, run:

```bash
npx claude-account-switch install-shell
```

This prompts you to choose one shell. Then reload your shell:

```bash
# zsh
source ~/.zshrc

# bash
source ~/.bashrc

# fish
source ~/.config/fish/config.fish

# PowerShell
. $PROFILE
```
