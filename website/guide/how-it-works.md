---
title: How It Works — claude-account-switch
description: Architecture and design of claude-account-switch. Profile directory structure, shared settings via symlinks, and CLAUDE_CONFIG_DIR.
---

# How It Works

`claude-account-switch` manages separate Claude Code profiles by leveraging the `CLAUDE_CONFIG_DIR` environment variable.

## Directory Structure

```
~/.claude-profiles/
├── meta.json                  ← Profile metadata + active profile
├── .shell-integration.sh      ← bash/zsh integration script
├── .shell-integration.fish    ← fish integration script
├── .shell-integration.ps1     ← PowerShell integration script
├── .picker.mjs                ← Arrow-key picker script
├── _shared/
│   ├── settings.json          ← Shared settings (original)
│   └── commands/               ← Shared custom commands
├── work/
│   ├── .claude.json           ← Work account OAuth
│   ├── settings.local.json    ← Local settings (profile-specific)
│   ├── settings.json          → ../_shared/settings.json (symlink)
│   ├── commands/              → ../_shared/commands/ (symlink)
│   ├── plugins/               ← Installed plugins
│   ├── projects/              ← Project-specific settings
│   └── plans/                 ← Saved plans
└── personal/
    ├── .claude.json           ← Personal account OAuth
    ├── settings.local.json
    ├── settings.json          → ../_shared/settings.json
    ├── commands/              → ../_shared/commands/
    ├── plugins/
    ├── projects/
    └── plans/
```

## Shared Settings

Shared files (`settings.json`, `commands/`) are stored once in `_shared/` and linked into each profile:

- **macOS/Linux**: Symbolic links
- **Windows**: Symlinks are attempted first. If symlink creation fails (Developer Mode not enabled), files are copied with a one-time notice. Directories always use junctions (no special permissions needed).

Changes to shared settings automatically apply to all profiles.

## Profile-Specific Files

Each profile independently manages:

- **`.claude.json`** — OAuth credentials
- **`settings.local.json`** — Local settings
- **`plugins/`** — Installed plugins
- **`projects/`** — Project-specific settings
- **`plans/`** — Saved plans

## Temporary Files

Files like `cache/`, `sessions/`, `history.jsonl`, `session-env/`, `shell-snapshots/`, `paste-cache/`, `file-history/`, `backups/` are auto-created by Claude Code and not managed by `claude-account-switch`.

## Auto Shell Detection

Every time you run any `claude-account-switch` command, it checks for newly available shells and installs integration automatically. If you install a new shell (e.g. fish), the next CLI run will detect it and set up integration.

## Profile Switching

When you run `cpf <name>` or `claude-pick`, the tool:

1. Updates `meta.json` to record the new active profile
2. Sets `CLAUDE_CONFIG_DIR` to point to the selected profile directory
3. Claude Code then reads its config from that directory
