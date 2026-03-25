---
title: Installation — claude-account-switch
description: How to install claude-account-switch. Use npx for zero-install or install globally with npm.
---

# Installation

## Prerequisites

- **Node.js 18+** — [Download](https://nodejs.org/)
- **Claude Code** — `npm i -g @anthropic-ai/claude-code`

## Recommended: Use with npx

No installation needed — run directly:

```bash
npx claude-account-switch init
```

This downloads and runs the latest version automatically.

## Global Install

If you prefer a permanent installation:

```bash
npm i -g claude-account-switch
```

Then run commands directly:

```bash
claude-account-switch init
claude-account-switch list
claude-account-switch use work
```

## Verify Installation

```bash
# With npx
npx claude-account-switch list

# With global install
claude-account-switch list
```

## Requirements

| Requirement | Version |
|-------------|---------|
| Node.js | 18+ |
| Claude Code | Latest |
| Platform | macOS, Linux, Windows (native + WSL) |

## Zero Dependencies

`claude-account-switch` has no external dependencies — it uses only Node.js built-in modules for instant `npx` startup.
