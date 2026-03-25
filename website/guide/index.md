---
title: Quick Start — claude-account-switch
description: Get started with claude-account-switch in under a minute. Create profiles, migrate existing configs, and switch between Claude Code accounts.
jsonLd:
  "@context": "https://schema.org"
  "@type": "FAQPage"
  mainEntity:
    - "@type": "Question"
      name: "How do I use multiple accounts with Claude Code?"
      acceptedAnswer:
        "@type": "Answer"
        text: "Install claude-account-switch and run 'npx claude-account-switch init'. It manages separate profiles using the CLAUDE_CONFIG_DIR environment variable, each with its own OAuth credentials."
    - "@type": "Question"
      name: "Does claude-account-switch require any dependencies?"
      acceptedAnswer:
        "@type": "Answer"
        text: "No. claude-account-switch has zero external dependencies — it uses only Node.js built-in modules for instant npx startup."
    - "@type": "Question"
      name: "What platforms does claude-account-switch support?"
      acceptedAnswer:
        "@type": "Answer"
        text: "macOS, Linux, and Windows (native + WSL). It supports zsh, bash, fish, and PowerShell shells."
    - "@type": "Question"
      name: "Can I share settings across profiles?"
      acceptedAnswer:
        "@type": "Answer"
        text: "Yes. Shared files like settings.json and custom commands are stored in a _shared directory and symlinked into each profile, so changes apply to all profiles automatically."
---

# Quick Start

Get up and running with multiple Claude Code accounts in under a minute.

## Why claude-account-switch?

Claude Code doesn't officially support multiple accounts. `claude-account-switch` uses the `CLAUDE_CONFIG_DIR` environment variable to manage separate profiles, each with its own OAuth credentials.

## Setup

```bash
npx claude-account-switch init
```

Here's what the interactive wizard looks like:

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

## After Setup

```bash
claude           # Launch Claude with the active profile
cpf work         # Quick switch to "work" profile
cpf personal     # Quick switch to "personal" profile
claude-pick      # Interactive profile selector with arrow keys
```

## Next Steps

- [Installation](/guide/installation) — all installation methods
- [Commands](/guide/commands) — full CLI reference
- [Shell Integration](/guide/shell-integration) — available shell commands
- Platform guides: [macOS](/guide/setup-macos) · [Linux](/guide/setup-linux) · [Windows](/guide/setup-windows)
