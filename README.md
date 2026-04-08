# claude-account-switch

[![npm version](https://img.shields.io/npm/v/claude-account-switch)](https://www.npmjs.com/package/claude-account-switch)
[![npm downloads](https://img.shields.io/npm/dm/claude-account-switch)](https://www.npmjs.com/package/claude-account-switch)
[![license](https://img.shields.io/npm/l/claude-account-switch)](./LICENSE)

Multi-account profile manager for [Claude Code](https://docs.anthropic.com/en/docs/claude-code).

[한국어](./README.ko.md)

Claude Code doesn't officially support multiple accounts. `claude-account-switch` uses the `CLAUDE_CONFIG_DIR` environment variable to manage separate profiles, each with its own OAuth credentials.

## Quick Start

```bash
npx claude-account-switch init
```

The interactive wizard will guide you through creating profiles, migrating existing configs, and auto-installing shell integration for all detected shells.

```
  ╭──────────────────────────────────────╮
  │ Welcome to Claude Switch!            │
  │ Multi-account manager for Claude Code│
  ╰──────────────────────────────────────╯

  How many profiles do you want to set up? 2

  Profile 1 name: work
  Profile 2 name: personal

  Which profile should be active by default?
  ❯ work
    personal

  Share settings across profiles? (recommended) Yes

  Existing ~/.claude detected. Migrate to a profile?
  ❯ Yes, migrate to "work"
    Yes, migrate to "personal"
    No, skip

  ✓ Migrated ~/.claude → profile: work
  ⚠ Original ~/.claude was NOT deleted.
  ✓ Created profile: work
  ✓ Created profile: personal
  ✓ Shared settings linked
  ✓ Shell integration installed (zsh, bash)
  ✓ Active profile: work

  Next steps:
    1. Open a new terminal
    2. Run claude to authenticate your "work" profile
    3. Run cpf personal && claude to authenticate "personal"
```

**Platform guides:** [macOS](docs/setup-macos.md) · [Linux](docs/setup-linux.md) · [Windows](docs/setup-windows.md)

## Installation

```bash
# Use directly with npx (recommended)
npx claude-account-switch init

# Or install globally
npm i -g claude-account-switch
```

## Commands

| Command | Description |
|---------|-------------|
| `claude-account-switch init` | Interactive setup wizard |
| `claude-account-switch add <name>` | Create a new profile |
| `claude-account-switch remove <name>` | Remove a profile |
| `claude-account-switch list` | List all profiles |
| `claude-account-switch use <name>` | Switch active profile |
| `claude-account-switch migrate [name]` | Migrate existing `~/.claude` data into a profile |
| `claude-account-switch install-shell` | Install shell integration |
| `claude-account-switch mcp [sub]` | Manage MCP servers interactively |

## MCP Management

Manage MCP servers per-profile with `claude-account-switch mcp`.

### Interactive TUI

```bash
claude-account-switch mcp
```

Use arrow keys to navigate and `Space` to toggle. Keys: `a` add · `d` delete · `q` quit.

```
  MCP Manager

  ↑↓ 이동   Space 토글   a 추가   d 삭제   q 종료

  ── Shared (모든 프로필) ──────────────────────────────────
    ● context7     stdio   npx @upstash/context7-mcp@latest
  ❯ ● figma        http    https://mcp.figma.com/mcp

  ── work ────────────────────────────────────────────────
    ● local-db     stdio   node ~/tools/db-mcp.mjs
    ○ figma        (disabled for this profile)

  ── personal ────────────────────────────────────────────
    ○ context7     (disabled for this profile)
```

### How MCP storage works

| Scope | File | Effect |
|-------|------|--------|
| Shared (all profiles) | `_shared/settings.json` → `mcpServers{}` | Applied to every profile via symlink |
| Profile-specific | `<profile>/settings.local.json` → `mcpServers{}` | Loaded for that profile only |
| Disable a shared MCP | `<profile>/settings.local.json` → `disabledMcpServers[]` | Hides the shared MCP for that profile |

```
_shared/settings.json        ← mcpServers: { context7, figma }
work/settings.local.json     ← mcpServers: { local-db }
                                disabledMcpServers: ['figma']
```

### Subcommands

| Command | Description |
|---------|-------------|
| `mcp` | Interactive TUI |
| `mcp add <name> --shared --type http --url <url>` | Add HTTP MCP to all profiles |
| `mcp add <name> --profile <p> --command <cmd>` | Add stdio MCP to one profile |
| `mcp remove <name> --shared` | Remove shared MCP |
| `mcp remove <name> --profile <p>` | Remove profile-specific MCP |
| `mcp disable <name> --profile <p>` | Disable shared MCP for a profile |
| `mcp enable <name> --profile <p>` | Re-enable a disabled shared MCP |

### HTTP MCPs

After adding an HTTP MCP, run `claude` in the target profile and use `/mcp` to complete OAuth authentication.

## Shell Integration

Shell integration is auto-installed for all detected shells during `init`. These commands are available in your terminal:

| Command | Description |
|---------|-------------|
| `claude` | Run Claude with the active profile |
| `cpf <name>` | Quick switch to a profile |
| `claude-pick` | Interactive profile selector |

**Supported shells:**

| Shell | Platform | Config file |
|-------|----------|-------------|
| zsh | macOS / Linux | `~/.zshrc` |
| bash | macOS / Linux / Git Bash | `~/.bashrc` |
| fish | macOS / Linux | `~/.config/fish/config.fish` |
| PowerShell | Windows | `$PROFILE` |

## How It Works

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

- **Shared files** (`settings.json`, `commands/`) are stored in `_shared/` and linked into each profile
  - macOS/Linux: symlink
  - Windows: symlinks are attempted first; falls back to copy if Developer Mode is not enabled. Directories always use junctions.
- **Profile-specific files** (`.claude.json`, `settings.local.json`, `plugins/`, `projects/`, `plans/`) are kept independently
- **Temporary files** (`cache/`, `sessions/`, `history.jsonl`, etc.) are auto-created by Claude Code and not managed

## Profile Name Rules

- Lowercase letters, numbers, and hyphens only
- Must start and end with a letter or number
- Max 30 characters
- Reserved names: `_shared`, `default`

## Requirements

- Node.js 18+
- Claude Code CLI installed
- **Supported platforms:** macOS, Linux, Windows (native + WSL)

## Zero Dependencies

`claude-account-switch` has no external dependencies — it uses only Node.js built-in modules for instant `npx` startup.

## License

MIT
