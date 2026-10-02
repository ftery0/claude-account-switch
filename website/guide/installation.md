---
title: Installation — claude-account-switch
description: Node.js, Claude Code and the local shell runtime.
---

# Installation

Node.js 18.19+ (18.x) or 20.10+ and npm are required. Keep your existing Claude Code installation. If Claude Code is missing, follow its [official installation guide](https://code.claude.com/docs/en/setup).

```bash
npx claude-account-switch@latest init
```

First setup stores profiles and a local runtime in `~/.claude-profiles/`, then connects detected shells. The runtime survives npx cache removal.

## Repair or upgrade an existing setup

```bash
npx claude-account-switch@latest install-shell
```

Open a new terminal afterward. Repeating `init` preserves the current setup. `list`, `use` and help do not edit shell configuration either.

A global CLI is optional: `npm install -g claude-account-switch@latest`. After upgrading it, run `claude-account-switch install-shell` to refresh the local runtime.

## Verify

```bash
npx claude-account-switch@latest list
```

Daily `claude`, `cpf` and `claude-pick` commands still require Node.js. See [platform setup](/guide/setup-macos).
