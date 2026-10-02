---
title: Windows Setup — claude-account-switch
description: Existing installation checks, profile setup and shell repair.
jsonLd: {"@context": "https://schema.org", "@type": "HowTo", "name": "Windows profile setup", "step": [{"@type": "HowToStep", "name": "Prerequisites", "text": "Check Node.js 18.19+ (18.x) or 20.10+, npm and your existing Claude Code installation."}, {"@type": "HowToStep", "name": "Setup", "text": "Run npx claude-account-switch@latest init to configure profiles."}, {"@type": "HowToStep", "name": "Launch", "text": "Open a new terminal and run claude."}]}
---

# Windows Setup

Use Node.js 18.19+ (18.x) or 20.10+, npm and Claude Code. Keep your existing Claude installation; if missing, follow the [official installation guide](https://code.claude.com/docs/en/setup).

```powershell
npx claude-account-switch@latest init
```

Open a new terminal and use `claude`, `cpf personal` and `claude-pick`. Multiple profiles show a picker on interactive launch. Existing setups get a summary when `init` is repeated.

## Shell repair

```powershell
npx claude-account-switch@latest install-shell
```

Shell setup connects both Windows PowerShell 5.1 and PowerShell 7 console profiles under your Windows Documents folder. It also handles redirected Documents folders, such as OneDrive. Existing profile bytes and encodings are preserved.

If an executable is missing, check that Claude and Node.js are on PATH. For a missing local runtime, run the repair command above and open a new terminal.

Check that PowerShell’s `$PROFILE` matches the installation location. If execution or organizational policy blocks loading, follow that policy’s guidance. Without file symlink permissions, files are copied; directories use junctions. Copied settings do not stay synchronized. For WSL, use the [Linux guide](/guide/setup-linux).

[Shell behavior and hooks](/guide/shell-integration) · [Migration, MCP and updates](/guide/commands)
