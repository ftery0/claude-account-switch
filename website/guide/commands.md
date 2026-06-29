---
title: CLI Commands — claude-account-switch
description: Complete reference for all claude-account-switch CLI commands. Init, add, remove, list, use, migrate, install-shell, mcp, and update.
---

# CLI Commands

All commands can be run with `npx claude-account-switch <command>` or, if installed globally, `claude-account-switch <command>`.

## `init`

Interactive setup wizard that guides you through the complete setup process.

```bash
npx claude-account-switch init
```

This will:
1. Create profiles (defaults to `work` and `personal`, or `main` for single profile)
2. Migrate existing `~/.claude` config (if present)
3. Auto-detect and install shell integration for all available shells

## `add <name>`

Create a new profile.

```bash
npx claude-account-switch add work
npx claude-account-switch add personal
```

## `remove <name>`

Remove an existing profile and its data.

```bash
npx claude-account-switch remove old-account
```

## `list`

List all profiles and show which one is active.

```bash
npx claude-account-switch list
```

Output example:
```
  Profiles:

      personal  ~/.claude-profiles/personal
   *  work      ~/.claude-profiles/work

  Active: work
```

## `use <name>`

Switch the active profile.

```bash
npx claude-account-switch use personal
```

## `migrate [name]`

Migrate existing `~/.claude` data into a profile. If no name is given, the wizard will prompt you to select a source directory and target profile.

```bash
npx claude-account-switch migrate work
```

The wizard detects common source directories (`~/.claude`, `~/.claude-work`, `~/.claude-personal`) or lets you enter a custom path. After migration:

- `.claude.json`, `settings.local.json` — auth & local settings
- `plugins/`, `projects/`, `plans/` — profile data
- `settings.json`, `commands/` — copied to `_shared` and symlinked (if shared settings enabled)

::: warning
The original source directory is NOT deleted. Remove it manually after verifying everything works.
:::

## `install-shell`

Manually install shell integration for a specific shell. You will be prompted to choose one shell.

```bash
npx claude-account-switch install-shell
```

::: tip
This is usually not needed — `init` auto-installs for all detected shells. Use `install-shell` only if you need to reinstall for a specific shell.
:::

## `mcp [subcommand]`

Manage MCP servers per-profile. Running `mcp` with no subcommand launches an interactive TUI.

```bash
npx claude-account-switch mcp                                          # interactive TUI
npx claude-account-switch mcp add ctx --shared --command "npx -y ctx7" # add shared stdio MCP
npx claude-account-switch mcp add figma --shared --type http --url https://mcp.figma.com/mcp
npx claude-account-switch mcp remove figma --profile work              # remove from one profile
npx claude-account-switch mcp disable figma --profile work             # hide a shared MCP
npx claude-account-switch mcp enable figma --profile work              # re-enable
```

| Subcommand | Description |
|------------|-------------|
| `mcp` / `mcp list` | Interactive TUI |
| `mcp add <name> --shared --type http --url <url>` | Add a shared HTTP MCP |
| `mcp add <name> --profile <p> --command <cmd>` | Add a stdio MCP to one profile |
| `mcp remove <name> --shared` | Remove a shared MCP |
| `mcp remove <name> --profile <p>` | Remove a profile-specific MCP |
| `mcp disable <name> --profile <p>` | Hide a shared MCP for a profile |
| `mcp enable <name> --profile <p>` | Re-enable a disabled shared MCP |

::: tip
HTTP MCPs require OAuth — run `claude` in the target profile after adding, then use `/mcp` to authenticate.
:::

## `update [options]`

Update Claude Code (and surface self-updates) without breaking the shell integration. The self-update is intentionally print-only — it shows the exact `npm install -g claude-account-switch@latest` command instead of overwriting itself mid-process.

```bash
npx claude-account-switch update            # check both, install Claude Code after confirm
npx claude-account-switch update --check    # dry-run; exit 1 if updates are available
npx claude-account-switch update --self     # show the self-update command only
npx claude-account-switch update --claude-code --yes  # non-interactive (CI)
```

| Flag | Behavior |
|------|----------|
| (none) | Check both packages, install Claude Code after confirmation |
| `--check` / `-n` | Dry-run; never installs. Exit `0` if up to date, `1` if updates are available, `2` on registry error |
| `--self` | Print the self-update command only |
| `--claude-code` | Update Claude Code only |
| `--yes` / `-y` | Skip the install confirm (does not bypass dev-symlink / sudo / running-claude blocks) |

Behavior highlights:

- Detects the package manager (`npm` / `yarn` / `pnpm` / `bun`) from the install path
- Refuses self-update when `claude-account-switch` is a `npm link` symlink (dev install)
- Pre-flights `sudo` requirements and prints the exact command to re-run
- Blocks Claude Code install on Windows while `claude.exe` is running (avoids EBUSY)
- Refreshes shell-integration templates after a successful install — the next terminal picks up the new binary
- Warns if Claude Code's `bin` entry changes between versions (signals that templates may need attention)

::: tip
Use `--check` in CI to fail the job when an update is available — exit `1` is intended for this.
:::

## Profile Name Rules

- Lowercase letters, numbers, and hyphens only
- Must start and end with a letter or number
- Maximum 30 characters
- Reserved names: `_shared`, `default`
