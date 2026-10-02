# claude-account-switch

[![npm version](https://img.shields.io/npm/v/claude-account-switch)](https://www.npmjs.com/package/claude-account-switch)
[![license](https://img.shields.io/npm/l/claude-account-switch)](./LICENSE)

Profile switching for [Claude Code](https://code.claude.com/docs/en/iam#log-in-with-multiple-accounts) using `CLAUDE_CONFIG_DIR`. No runtime dependencies.

[한국어](./README.ko.md) · [Full guide](https://ftery0.github.io/claude-account-switch/guide/)

## Start

Use Node.js 18.19+ (18.x) or 20.10+ and your existing Claude Code installation. If Claude Code is missing, follow its [official installation guide](https://code.claude.com/docs/en/setup).

```bash
npx claude-account-switch@latest init
```

Choose profile names, optionally copy one existing configuration, then open a new terminal:

```bash
claude
cpf personal
claude-pick
```

With multiple profiles, `claude` shows a picker in interactive terminals. In scripts it uses the active profile. Claude arguments, including `--help` and `--version`, pass through.

## Existing users

Repeated `init` shows your current setup without changing it. To repair or upgrade shell integration:

```bash
npx claude-account-switch@latest install-shell
```

The shell uses a local runtime in `~/.claude-profiles/_runtime`, so global installation and the temporary npx cache are not needed for daily use. Node.js and Claude Code must remain available.

## Commands

| Command | Purpose |
| --- | --- |
| `init` | First setup or existing setup summary |
| `add <name>` / `remove <name>` | Manage profiles |
| `list` / `use <name>` | View or switch profiles |
| `migrate <name> --from <path>` | Copy existing configuration safely |
| `install-shell` | Install, repair or refresh the local runtime |
| `update --check` | Check this package's published version |
| `mcp list` | Read legacy MCP names and migration guidance |

Migration preserves the source and stops on conflicting data. Skills, agents, rules, hooks and `CLAUDE.md` stay with the selected profile. macOS Keychain credentials are not copied; Claude may require login in the new profile. See [migration and compatibility](https://ftery0.github.io/claude-account-switch/guide/commands).

Version 2 removes the separate MCP editor and Claude installer. Use official `claude mcp` and Claude's [update mechanism](https://code.claude.com/docs/en/setup#update-manually). Existing legacy MCP files remain unchanged. Update notifications are off by default.

Platform guides: [macOS](docs/setup-macos.md) · [Linux](docs/setup-linux.md) · [Windows](docs/setup-windows.md)

[MIT](./LICENSE)
