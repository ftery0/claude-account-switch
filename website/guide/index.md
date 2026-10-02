---
title: Quick Start — claude-account-switch
description: Profile setup and safe migration using your existing Claude installation.
jsonLd: {"@context": "https://schema.org", "@type": "FAQPage", "mainEntity": [{"@type": "Question", "name": "Should I run init if Claude is already installed?", "acceptedAnswer": {"@type": "Answer", "text": "Run it for first profile setup. Existing profiles are summarized without changes."}}, {"@type": "Question", "name": "Does it work after the npx cache is deleted?", "acceptedAnswer": {"@type": "Answer", "text": "The installed local runtime remains usable. Node.js and Claude Code are still required."}}, {"@type": "Question", "name": "Does migration copy the login?", "acceptedAnswer": {"@type": "Answer", "text": "File credentials are copied only into the selected profile. macOS Keychain is not copied; Claude checks authentication."}}]}
---

# Quick Start

This tool adds profile selection and configuration import to Claude Code's [separate configuration directories](https://code.claude.com/docs/en/iam#log-in-with-multiple-accounts).

With Node.js 18.19+ (18.x) or 20.10+ and Claude Code available, run:

```bash
npx claude-account-switch@latest init
```

1. Choose profile names and the active profile.
2. Choose whether to share `settings.json` and `commands/`.
3. Copy one detected existing configuration into one profile, or skip.
4. Open a new terminal and run `claude`. Claude handles login if needed.

```bash
cpf personal
claude
claude-pick
```

Already initialized? `init` only shows the current setup. Run `npx claude-account-switch@latest install-shell` to repair or refresh shell integration.

## FAQ

### Should I run init if Claude is already installed?

Run it for first profile setup. Existing profiles are summarized without changes.


### Does it work after the npx cache is deleted?

The installed local runtime remains usable. Node.js and Claude Code are still required.


### Does migration copy the login?

File credentials are copied only into the selected profile. macOS Keychain is not copied; Claude checks authentication.

[Installation](/guide/installation) · [Commands and migration](/guide/commands) · [Shell integration](/guide/shell-integration)
