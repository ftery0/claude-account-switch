---
title: macOS Setup — claude-account-switch
description: Existing installation checks, profile setup and shell repair.
jsonLd: {"@context": "https://schema.org", "@type": "HowTo", "name": "macOS profile setup", "step": [{"@type": "HowToStep", "name": "Prerequisites", "text": "Check Node.js 18.19+ (18.x) or 20.10+, npm and your existing Claude Code installation."}, {"@type": "HowToStep", "name": "Setup", "text": "Run npx claude-account-switch@latest init to configure profiles."}, {"@type": "HowToStep", "name": "Launch", "text": "Open a new terminal and run claude."}]}
---

# macOS Setup

Use Node.js 18.19+ (18.x) or 20.10+, npm and Claude Code. Keep your existing Claude installation; if missing, follow the [official installation guide](https://code.claude.com/docs/en/setup).

```bash
npx claude-account-switch@latest init
```

Open a new terminal and use `claude`, `cpf personal` and `claude-pick`. Multiple profiles show a picker on interactive launch. Existing setups get a summary when `init` is repeated.

## Shell repair

```bash
npx claude-account-switch@latest install-shell
```

Configuration locations: `~/.zshrc` (zsh), `~/.bashrc` (bash), `~/.config/fish/config.fish` (fish).

If an executable is missing, check that Claude and Node.js are on PATH. For a missing local runtime, run the repair command above and open a new terminal.

macOS Keychain login is not imported. Complete any login requested on first profile launch.

[Shell behavior and hooks](/guide/shell-integration) · [Migration, MCP and updates](/guide/commands)
