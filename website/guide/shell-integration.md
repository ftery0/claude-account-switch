---
title: Shell Integration — claude-account-switch
description: Local runtime, profile selection and existing launch hooks.
---

# Shell Integration

Open a new terminal after first `init` or `install-shell`.

| Command | Behavior |
| --- | --- |
| `claude [args]` | Launch Claude under the selected profile |
| `cpf <name>` | Change active profile |
| `claude-pick` | Select a profile |

With multiple profiles, interactive `claude` shows a picker with the active profile selected. Single-profile and noninteractive launches use the active profile immediately. The picker and profile notice go to stderr; Claude output passes through. Ctrl-C cancels selection.

Arguments including `--help`, `--version` and spaces, as well as exit status, pass through. `CLAUDE_CONFIG_DIR` is set only in the Claude child process.

## Installation and repair

```bash
npx claude-account-switch@latest install-shell
```

This copies the runtime into `~/.claude-profiles/_runtime` and adds a source line to shell configuration. Existing source lines are not duplicated. Read and switch commands do not edit shell files.

| Shell | Config file |
| --- | --- |
| zsh | `~/.zshrc` |
| bash | `~/.bashrc` |
| fish | `~/.config/fish/config.fish` |
| PowerShell | `~/Documents/PowerShell/Microsoft.PowerShell_profile.ps1`, or an existing WindowsPowerShell profile |

Detection uses the current shell and existing config files. Run `install-shell` again after adding a shell. Configure WSL separately inside WSL. Missing Node.js or runtime files produce a repair instruction and an error status.

## Profile launch hooks

The current shell runs the matching `pre-launch.sh`, `pre-launch.fish` or `pre-launch.ps1` in the profile directory. Hook environment changes apply to Claude without remaining in the calling shell. A failed hook stops the launch.

The existing bash/zsh `__claude_switch_launch(profile, args...)` override call point remains supported. Keep a custom override after the integration source line.

Switching profiles does not change an already running Claude session. [Update notifications](/guide/commands#update-compatibility) are optional.
