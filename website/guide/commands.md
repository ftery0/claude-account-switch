---
title: CLI Commands — claude-account-switch
description: Complete reference for all claude-account-switch CLI commands. Init, add, remove, list, use, migrate, and install-shell.
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

## Profile Name Rules

- Lowercase letters, numbers, and hyphens only
- Must start and end with a letter or number
- Maximum 30 characters
- Reserved names: `_shared`, `default`
