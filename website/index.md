---
layout: home
title: claude-account-switch — Multi-account Profile Manager for Claude Code
description: Manage multiple Claude Code accounts with ease. Switch between work and personal profiles instantly using CLAUDE_CONFIG_DIR.
jsonLd:
  "@context": "https://schema.org"
  "@type": "SoftwareApplication"
  name: "claude-account-switch"
  applicationCategory: "DeveloperApplication"
  operatingSystem: "macOS, Linux, Windows"
  offers:
    "@type": "Offer"
    price: "0"
    priceCurrency: "USD"
  description: "Multi-account profile manager for Claude Code. Switch between work and personal accounts instantly."
  url: "https://ftery0.github.io/claude-account-switch/"
  downloadUrl: "https://www.npmjs.com/package/claude-account-switch"
  softwareVersion: "1.2.0"
  author:
    "@type": "Person"
    name: "haejun"
  license: "https://opensource.org/licenses/MIT"

hero:
  name: claude-account-switch
  text: Multi-account Profile Manager for Claude Code
  tagline: Switch between work and personal Claude Code accounts instantly. Zero dependencies.
  actions:
    - theme: brand
      text: Get Started
      link: /guide/
    - theme: alt
      text: View on GitHub
      link: https://github.com/ftery0/claude-account-switch

features:
  - title: One-Command Setup
    details: Run npx claude-account-switch init and the interactive wizard handles everything.
  - title: Instant Profile Switching
    details: Use cpf <name> to switch profiles in milliseconds. No restart needed.
  - title: Zero Dependencies
    details: Uses only Node.js built-in modules for instant npx startup. No bloat.
  - title: Cross-Platform
    details: Works on macOS, Linux, and Windows (native + WSL). Supports zsh, bash, fish, and PowerShell.
  - title: Shared Settings
    details: Settings and custom commands are shared across all profiles via symlinks.
  - title: Interactive Picker
    details: Use claude-pick to select profiles with arrow-key navigation.
---
