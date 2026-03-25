# Linux Setup Guide

[한국어](./setup-linux.ko.md)

## Prerequisites

- **Node.js 18+** — Install via your package manager or [nvm](https://github.com/nvm-sh/nvm)
  ```bash
  # Using nvm (recommended)
  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
  nvm install --lts

  # Ubuntu / Debian
  sudo apt install nodejs npm

  # Fedora
  sudo dnf install nodejs
  ```
- **Claude Code** — `npm i -g @anthropic-ai/claude-code`

## Setup

### 1. Run the init wizard

```bash
npx claude-account-switch init
```

### 2. Shell integration (automatic)

The init wizard auto-detects all available shells on your system and installs integration for each one. On Linux, this typically includes:

- **bash (~/.bashrc)** — default on most distros
- **zsh (~/.zshrc)** — if `.zshrc` exists
- **fish (~/.config/fish/config.fish)** — if fish is installed

No manual shell selection needed.

### 3. Activate

```bash
# For bash
source ~/.bashrc

# For zsh
source ~/.zshrc

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

On Linux, shared files (`settings.json`, `commands/`) are symlinked from `_shared/` into each profile. Changes to shared settings automatically apply to all profiles.

## WSL (Windows Subsystem for Linux)

If you're running Linux via WSL, this guide applies as-is. WSL is treated as a standard Linux environment.

## Troubleshooting

### `command not found: claude`

Make sure Claude Code is installed and in your PATH:

```bash
npm i -g @anthropic-ai/claude-code
which claude
```

### Permission errors with global npm install

Use nvm to manage Node.js (avoids `sudo` for global packages), or fix npm permissions:

```bash
mkdir -p ~/.npm-global
npm config set prefix '~/.npm-global'
echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.bashrc
source ~/.bashrc
```

### Shell integration not working after restart

Verify the source line was added:

```bash
grep "shell-integration" ~/.bashrc   # or ~/.zshrc
```

If missing, run:

```bash
npx claude-account-switch install-shell
```
