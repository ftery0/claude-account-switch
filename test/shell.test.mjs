import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, copyFileSync, unlinkSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

describe('shell script generation', async () => {
  const { PROFILES_DIR } = await import('../src/lib/constants.mjs');
  const { installShellIntegration } = await import('../src/lib/shell.mjs');

  const SH_FILE   = join(PROFILES_DIR, '.shell-integration.sh');
  const PS1_FILE  = join(PROFILES_DIR, '.shell-integration.ps1');
  const FISH_FILE = join(PROFILES_DIR, '.shell-integration.fish');

  const HOME = homedir();
  const rcFiles = [
    join(HOME, '.bashrc'),
    join(HOME, '.zshrc'),
    join(HOME, '.config', 'fish', 'config.fish'),
    join(HOME, 'Documents', 'PowerShell', 'Microsoft.PowerShell_profile.ps1'),
    join(HOME, 'Documents', 'WindowsPowerShell', 'Microsoft.PowerShell_profile.ps1'),
  ];
  const rcBackups = new Map();

  before(() => {
    mkdirSync(PROFILES_DIR, { recursive: true });
    for (const rc of rcFiles) {
      if (existsSync(rc)) {
        const bk = rc + '.shell-test-backup';
        copyFileSync(rc, bk);
        rcBackups.set(rc, bk);
      }
    }
  });

  after(() => {
    for (const [rc, bk] of rcBackups) {
      copyFileSync(bk, rc);
      unlinkSync(bk);
    }
    for (const rc of rcFiles) {
      if (!rcBackups.has(rc) && existsSync(rc)) {
        unlinkSync(rc);
      }
    }
  });

  describe('Unix (bash/zsh) script', () => {
    before(() => {
      installShellIntegration('bash');
    });

    it('creates .shell-integration.sh', () => {
      assert.ok(existsSync(SH_FILE));
    });

    it('has shebang line', () => {
      const content = readFileSync(SH_FILE, 'utf8');
      assert.ok(content.startsWith('#!/bin/sh'));
    });

    it('defines thin command shims', () => {
      const content = readFileSync(SH_FILE, 'utf8');
      assert.ok(content.includes('__claude_switch_cli()'));
      assert.ok(content.includes('claude()'));
      assert.ok(content.includes('cpf()'));
      assert.ok(content.includes('claude-pick()'));
    });

    it('delegates runtime behavior to the installed CLI', () => {
      const content = readFileSync(SH_FILE, 'utf8');
      assert.ok(content.includes('claude-account-switch "$@"'));
      assert.ok(content.includes('__claude_switch_cli shell launch "$@"'));
      assert.ok(content.includes('__claude_switch_cli shell use "$@"'));
      assert.ok(content.includes('__claude_switch_cli shell pick'));
    });

    it('does not cache or launch Claude directly', () => {
      const content = readFileSync(SH_FILE, 'utf8');
      assert.ok(!content.includes('__CLAUDE_SWITCH_REAL_BIN'));
      assert.ok(!content.includes('CLAUDE_CONFIG_DIR='));
      assert.ok(!content.includes('@anthropic-ai/claude-code'));
    });
  });

  describe('PowerShell script', () => {
    before(() => {
      installShellIntegration('powershell');
    });

    it('creates .shell-integration.ps1', () => {
      assert.ok(existsSync(PS1_FILE));
    });

    it('delegates runtime behavior to the installed CLI', () => {
      const content = readFileSync(PS1_FILE, 'utf8');
      assert.ok(content.includes('Get-Command claude-account-switch'));
      assert.ok(content.includes('__claude_switch_cli shell launch @args'));
      assert.ok(content.includes('__claude_switch_cli shell use @args'));
      assert.ok(content.includes('__claude_switch_cli shell pick'));
    });

    it('does not launch Claude directly', () => {
      const content = readFileSync(PS1_FILE, 'utf8');
      assert.ok(!content.includes('$env:CLAUDE_CONFIG_DIR'));
      assert.ok(!content.includes('Get-Command claude -CommandType Application'));
    });
  });

  describe('Fish script', () => {
    before(() => {
      installShellIntegration('fish');
    });

    it('creates .shell-integration.fish', () => {
      assert.ok(existsSync(FISH_FILE));
    });

    it('uses fish syntax and delegates to the installed CLI', () => {
      const content = readFileSync(FISH_FILE, 'utf8');
      assert.ok(content.includes('function claude'));
      assert.ok(content.includes('function cpf'));
      assert.ok(content.includes('function claude-pick'));
      assert.ok(content.includes('__claude_switch_cli shell launch $argv'));
      assert.ok(content.includes('__claude_switch_cli shell use $argv'));
      assert.ok(content.includes('__claude_switch_cli shell pick'));
    });

    it('does not launch Claude directly', () => {
      const content = readFileSync(FISH_FILE, 'utf8');
      assert.ok(!content.includes('__CLAUDE_SWITCH_REAL_BIN'));
      assert.ok(!content.includes('CLAUDE_CONFIG_DIR'));
      assert.ok(!content.includes('@anthropic-ai/claude-code'));
    });
  });

  describe('installShellIntegration routing', () => {
    it('appends source line to an existing rc file with a trailing newline', () => {
      const bashRc = join(HOME, '.bashrc');
      writeFileSync(bashRc, 'export PATH="$HOME/bin:$PATH"');

      installShellIntegration('bash');

      const content = readFileSync(bashRc, 'utf8');
      assert.ok(content.endsWith('\n'));
      assert.ok(content.includes('# Claude Switch - multi-account manager\n'));
      assert.ok(content.includes('[ -f ~/.claude-profiles/.shell-integration.sh ]'));
    });

    it('generates .sh for bash', () => {
      installShellIntegration('bash');
      assert.ok(existsSync(SH_FILE));
    });

    it('generates .sh for zsh', () => {
      installShellIntegration('zsh');
      assert.ok(existsSync(SH_FILE));
    });

    it('generates .ps1 for powershell', () => {
      installShellIntegration('powershell');
      assert.ok(existsSync(PS1_FILE));
    });

    it('generates .fish for fish', () => {
      installShellIntegration('fish');
      assert.ok(existsSync(FISH_FILE));
    });
  });
});
