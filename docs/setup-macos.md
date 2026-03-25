# macOS Setup Guide

[한국어](./setup-macos.ko.md)

## Prerequisites

- **Node.js 18+** — Install via [Homebrew](https://brew.sh/) (`brew install node`) or [nodejs.org](https://nodejs.org/)
- **Claude Code** — `npm i -g @anthropic-ai/claude-code`

## Setup

### 1. Run the init wizard

```bash
npx claude-account-switch init
```

### 2. Shell integration (automatic)

The init wizard auto-detects all available shells on your system and installs integration for each one. On macOS, this typically includes:

- **zsh (~/.zshrc)** — default since Catalina
- **bash (~/.bashrc)** — if `.bashrc` exists
- **fish (~/.config/fish/config.fish)** — if fish is installed

No manual shell selection needed.

### 3. Activate

```bash
# For zsh
source ~/.zshrc

# For bash
source ~/.bashrc

# For fish
source ~/.config/fish/config.fish

# Or just open a new terminal window
```

### 4. Use

```bash
claude           # Launch Claude with the active profile
cpf <name>       # Quick switch
claude-pick      # Interactive picker
```

## How Shared Settings Work

On macOS, shared files (`settings.json`, `commands/`) are symlinked from `_shared/` into each profile. Changes to shared settings automatically apply to all profiles.

## Troubleshooting

### `command not found: claude`

Make sure Claude Code is installed and in your PATH:

```bash
npm i -g @anthropic-ai/claude-code
which claude
```

### Shell integration not working after restart

Verify the source line was added to your rc file:

```bash
# For zsh
grep "shell-integration" ~/.zshrc

# For bash
grep "shell-integration" ~/.bashrc
```

If missing, run:

```bash
npx claude-account-switch install-shell
```
