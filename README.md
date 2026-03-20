# claude-account-switch

Multi-account profile manager for [Claude Code](https://docs.anthropic.com/en/docs/claude-code).

[한국어](./README.ko.md)

Claude Code doesn't officially support multiple accounts. `claude-account-switch` uses the `CLAUDE_CONFIG_DIR` environment variable to manage separate profiles, each with its own OAuth credentials.

## Quick Start

```bash
npx claude-account-switch init
```

The interactive wizard will guide you through:
1. Creating profiles (e.g., `work`, `personal`)
2. Migrating existing `~/.claude` configs
3. Installing shell integration

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
| `claude-account-switch install-shell` | Install shell integration |

## Shell Integration

After running `init` or `install-shell`, these commands are available in your terminal:

| Command | Description |
|---------|-------------|
| `claude` | Run Claude with the active profile |
| `cpf <name>` | Quick switch to a profile |
| `claude-pick` | Interactive profile selector |

## How It Works

```
~/.claude-profiles/
├── meta.json              ← Profile metadata + active profile
├── _shared/
│   ├── settings.json      ← Shared settings (original)
│   └── commands/           ← Shared custom commands
├── work/
│   ├── .claude.json       ← Work account OAuth
│   ├── settings.json      → ../_shared/settings.json (symlink)
│   └── commands/          → ../_shared/commands/ (symlink)
└── personal/
    ├── .claude.json       ← Personal account OAuth
    ├── settings.json      → ../_shared/settings.json
    └── commands/          → ../_shared/commands/
```

- **Shared files** (`settings.json`, `commands/`) are stored in `_shared/` and symlinked into each profile
- **Profile-specific files** (`.claude.json`, `plugins/`, `projects/`) are kept independently
- **Temporary files** (`cache/`, `sessions/`, etc.) are auto-created by Claude Code and not managed

## Profile Name Rules

- Lowercase letters, numbers, and hyphens only
- Must start with a letter or number
- Reserved names: `_shared`, `default`

## Requirements

- Node.js 18+
- Claude Code CLI installed

## Zero Dependencies

`claude-account-switch` has no external dependencies — it uses only Node.js built-in modules for instant `npx` startup.

## License

MIT
