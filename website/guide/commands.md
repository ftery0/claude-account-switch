---
title: Commands and Migration — claude-account-switch
description: Profile management, safe import and version 2 compatibility.
---

# Commands and Migration

Prefix these commands with `npx claude-account-switch@latest`, or use `claude-account-switch` with a global installation.

| Command | Behavior |
| --- | --- |
| `init` | First setup wizard; read-only summary if profiles already exist |
| `add <name>` | Create a profile |
| `remove <name>` | Delete a profile after confirmation |
| `list` | Show profiles and active selection |
| `use <name>` | Change active profile |
| `migrate [name] --from <path>` | Copy configuration; select a target if omitted |
| `install-shell` | Install, repair or refresh detected shells and the local runtime |
| `update [--check]` | Check this package and show an upgrade command |
| `mcp [list]` | Read legacy MCP server names and file paths |

Names use lowercase letters, digits and hyphens, up to 30 characters, and start/end with a letter or digit. `_shared` and `default` are reserved.

## Import an existing configuration

Create the target profile first, then run:

```bash
npx claude-account-switch@latest migrate work --from ~/.claude
```

The default source combines `~/.claude` with the separate `~/.claude.json`. A configured `CLAUDE_CONFIG_DIR` is also detected with its own `.claude.json`. Use `--from` for a custom directory.

Import preserves settings, commands, projects, plugins, plans, skills, agents, rules, hooks and `CLAUDE.md`. Symlinks retain their original targets. File credentials are copied with restricted permissions into only the chosen profile. macOS Keychain is not migrated; Claude checks authentication. A `.claude.json` file does not establish login status.

The source is retained. Equal or nested source/target paths are rejected. Different existing target or shared data stops import with a conflict path. Invalid JSON is never treated as empty configuration.

## MCP compatibility

Version 2 removes the separate MCP editor. `mcp` and `mcp list` only show legacy server names and file paths, without URLs, tokens or environment values. Former `add/remove/enable/disable` calls fail without modifying files.

Register the servers you need with the official CLI under the selected profile. Old entries are not automatically converted or deleted.

```bash
cpf work
claude mcp add --transport http example --scope user https://example.com/mcp
claude mcp list
```

Do not assume legacy `mcpServers` in shared settings applies across accounts. User/local scope uses Claude's user configuration; project scope uses `.mcp.json`. See the [official MCP guide](https://code.claude.com/docs/en/mcp).

## Update compatibility

`update` and `update --self` check only this package and print an upgrade command. `--yes` does not install anything. `--check` exits 0 when current, 1 for a newer version, or 2 if the check fails.

Legacy `--claude-code` prints [official update guidance](https://code.claude.com/docs/en/setup#update-manually). It does not check Claude's version, so `--claude-code --check` exits 2. Update Claude using `claude update` or your installation's package manager.

Launch-time package update notifications default to off. Set `CLAUDE_SWITCH_CHECK_UPDATES=1` to check once daily during interactive launches. Nothing is installed automatically. `CLAUDE_SWITCH_DISABLE_AUTO_UPDATE=1` remains a compatibility override.
