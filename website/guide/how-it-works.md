---
title: How It Works — claude-account-switch
description: Shared scope, profile files and authentication responsibilities.
---

# How It Works

Shell commands invoke the local runtime, which passes the selected profile path to Claude as `CLAUDE_CONFIG_DIR`.

```text
~/.claude-profiles/
├── meta.json                 Active profile and sharing choice
├── _runtime/                 bin, src, package.json
├── .shell-integration.sh     Shell connection
├── _shared/
│   ├── settings.json
│   └── commands/
└── work/
    ├── .claude.json          User configuration and state
    ├── .credentials.json     Only where file credentials exist
    ├── settings.local.json
    ├── settings.json         Links to _shared when enabled
    ├── commands/             Links to _shared when enabled
    ├── CLAUDE.md
    ├── skills/
    ├── agents/
    ├── rules/
    ├── hooks/
    ├── plugins/
    ├── projects/
    └── plans/
```

## Sharing scope

Only `settings.json` and legacy `commands/` are shared. Skills, agents, rules, hooks and `CLAUDE.md` are imported into the chosen profile, not automatically distributed to other accounts. This tool does not install skills.

macOS/Linux use symlinks; Windows directories use junctions. If Windows cannot create a file symlink, the file is copied with a notice. Subsequent file changes are not automatically synchronized in that case.

## Authentication

`.claude.json` stores user configuration and state; it is not proof of an OAuth login. macOS Keychain credentials are not moved automatically. Existing file credentials go into only the selected profile. Claude determines login status on launch.

The [official authentication guide](https://code.claude.com/docs/en/iam#log-in-with-multiple-accounts) uses separate directories for claude.ai logins and API keys. Keyless Claude Console sign-ins are not separated by configuration directories alone. Inherited authentication environment variables also continue to apply.

## Preservation and runtime

Default import combines `~/.claude` and `~/.claude.json`. Existing symlinks retain their original targets; sources are not edited. Conflicts and invalid JSON stop the operation with a reason.

`meta.json` records active selection. Shell installation and refresh happen during explicit first setup, `install-shell` or `shell refresh`. Daily use then needs neither the npx cache nor a global switch command.

Claude-created caches, sessions and temporary history are not imported wholesale. They remain in the source.
