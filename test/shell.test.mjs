import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, copyFileSync, unlinkSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

describe('shell script generation', async () => {
  const { PROFILES_DIR } = await import('../src/lib/constants.mjs');
  const { installShellIntegration } = await import('../src/lib/shell.mjs');

  const SH_FILE   = join(PROFILES_DIR, '.shell-integration.sh');
  const PS1_FILE  = join(PROFILES_DIR, '.shell-integration.ps1');
  const FISH_FILE = join(PROFILES_DIR, '.shell-integration.fish');

  // Save/restore rc files that installShellIntegration modifies
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
    // Backup rc files
    for (const rc of rcFiles) {
      if (existsSync(rc)) {
        const bk = rc + '.shell-test-backup';
        copyFileSync(rc, bk);
        rcBackups.set(rc, bk);
      }
    }
  });

  after(() => {
    // Restore rc files
    for (const [rc, bk] of rcBackups) {
      copyFileSync(bk, rc);
      unlinkSync(bk);
    }
    // Remove rc files that were created by the test (didn't exist before)
    for (const rc of rcFiles) {
      if (!rcBackups.has(rc) && existsSync(rc)) {
        unlinkSync(rc);
      }
    }
  });

  // ─── Unix shell script content ───────────────────────────────────────────

  describe('Unix (bash/zsh) script', () => {
    before(() => {
      installShellIntegration('bash');
    });

    after(() => {});  // cleanup handled by parent after

    it('creates .shell-integration.sh', () => {
      assert.ok(existsSync(SH_FILE));
    });

    it('has shebang line', () => {
      const content = readFileSync(SH_FILE, 'utf8');
      assert.ok(content.startsWith('#!/bin/sh'));
    });

    it('defines __claude_switch_active function', () => {
      const content = readFileSync(SH_FILE, 'utf8');
      assert.ok(content.includes('__claude_switch_active()'));
    });

    it('defines __claude_switch_profiles function', () => {
      const content = readFileSync(SH_FILE, 'utf8');
      assert.ok(content.includes('__claude_switch_profiles()'));
    });

    it('defines claude function', () => {
      const content = readFileSync(SH_FILE, 'utf8');
      assert.ok(content.includes('claude()'));
    });

    it('defines cpf function', () => {
      const content = readFileSync(SH_FILE, 'utf8');
      assert.ok(content.includes('cpf()'));
    });

    it('defines claude-pick function', () => {
      const content = readFileSync(SH_FILE, 'utf8');
      assert.ok(content.includes('claude-pick()'));
    });

    it('uses CLAUDE_CONFIG_DIR env var to launch claude', () => {
      const content = readFileSync(SH_FILE, 'utf8');
      assert.ok(content.includes('CLAUDE_CONFIG_DIR='));
    });

    it('uses "command claude" to avoid function recursion', () => {
      const content = readFileSync(SH_FILE, 'utf8');
      assert.ok(content.includes('command claude'));
    });

    it('does NOT use xargs (portability)', () => {
      const content = readFileSync(SH_FILE, 'utf8');
      assert.ok(!content.includes('xargs'));
    });

    it('uses glob loop for profile listing instead of ls|xargs', () => {
      const content = readFileSync(SH_FILE, 'utf8');
      assert.ok(content.includes('for _csd in "$CLAUDE_PROFILES_DIR"/*/'));
    });

    it('uses here-doc for while loop (avoids subshell)', () => {
      const content = readFileSync(SH_FILE, 'utf8');
      assert.ok(content.includes('<<_PROFILES_LIST_'));
    });

    it('sed patterns have properly escaped quotes inside double-quoted strings', () => {
      const content = readFileSync(SH_FILE, 'utf8');
      // Check that [^"]*  inside sed double-quoted commands uses escaped quote [^\"]
      // The pattern should NOT have unescaped " inside [^...]
      const sedLines = content.split('\n').filter(l => l.includes('sed '));
      for (const line of sedLines) {
        // If the line has a character class [^...], the " inside should be escaped
        if (line.includes('[^')) {
          // Ensure it's [^\"] not [^"]
          assert.ok(!line.match(/\[(?:\^)?[^\]]*(?<!\\)"[^\]]*\]/),
            `Unescaped quote in sed character class: ${line.trim()}`);
        }
      }
    });

    it('uses $HOME for paths (not hardcoded ~)', () => {
      const content = readFileSync(SH_FILE, 'utf8');
      assert.ok(content.includes('CLAUDE_PROFILES_DIR="$HOME/.claude-profiles"'));
    });

    it('uses mktemp for atomic file updates in cpf', () => {
      const content = readFileSync(SH_FILE, 'utf8');
      assert.ok(content.includes('mktemp'));
    });
  });

  // ─── PowerShell script content ───────────────────────────────────────────

  describe('PowerShell script', () => {
    before(() => {
      installShellIntegration('powershell');
    });

    it('creates .shell-integration.ps1', () => {
      assert.ok(existsSync(PS1_FILE));
    });

    it('caches claude binary path before defining function', () => {
      const content = readFileSync(PS1_FILE, 'utf8');
      // Must find the binary BEFORE the function claude { } is defined
      const cacheIdx = content.indexOf('Get-Command claude -CommandType Application');
      const funcIdx = content.indexOf('function claude {');
      assert.ok(cacheIdx > -1, 'should cache claude binary');
      assert.ok(funcIdx > -1, 'should define claude function');
      assert.ok(cacheIdx < funcIdx, 'cache must come before function definition');
    });

    it('uses $script:__claude_bin to call real binary', () => {
      const content = readFileSync(PS1_FILE, 'utf8');
      assert.ok(content.includes('$script:__claude_bin'));
      assert.ok(content.includes('& $script:__claude_bin'));
    });

    it('uses ConvertFrom-Json for reading meta', () => {
      const content = readFileSync(PS1_FILE, 'utf8');
      assert.ok(content.includes('ConvertFrom-Json'));
    });

    it('writes meta without BOM (uses [IO.File]::WriteAllText)', () => {
      const content = readFileSync(PS1_FILE, 'utf8');
      assert.ok(content.includes('[IO.File]::WriteAllText'));
      // Should NOT use Set-Content -Encoding UTF8 (adds BOM in PS5.1)
      assert.ok(!content.includes('Set-Content') || !content.includes('-Encoding UTF8'),
        'Should not use Set-Content -Encoding UTF8 (BOM issue in PS5.1)');
    });

    it('cleans up CLAUDE_CONFIG_DIR with try/finally', () => {
      const content = readFileSync(PS1_FILE, 'utf8');
      assert.ok(content.includes('try {'));
      assert.ok(content.includes('finally {'));
      assert.ok(content.includes('Remove-Item Env:CLAUDE_CONFIG_DIR'));
    });

    it('defines cpf function with param', () => {
      const content = readFileSync(PS1_FILE, 'utf8');
      assert.ok(content.includes('function cpf'));
    });

    it('defines claude-pick function', () => {
      const content = readFileSync(PS1_FILE, 'utf8');
      assert.ok(content.includes('function claude-pick'));
    });

    it('uses $env:USERPROFILE for home path (Windows)', () => {
      const content = readFileSync(PS1_FILE, 'utf8');
      assert.ok(content.includes('$env:USERPROFILE'));
    });

    it('handles single-profile shortcut (no picker)', () => {
      const content = readFileSync(PS1_FILE, 'utf8');
      assert.ok(content.includes('$profiles.Count -eq 1'));
    });
  });

  // ─── Fish script content ─────────────────────────────────────────────────

  describe('Fish script', () => {
    before(() => {
      installShellIntegration('fish');
    });

    it('creates .shell-integration.fish', () => {
      assert.ok(existsSync(FISH_FILE));
    });

    it('uses fish syntax (function/end instead of {/})', () => {
      const content = readFileSync(FISH_FILE, 'utf8');
      assert.ok(content.includes('function claude'));
      assert.ok(content.includes('end'));
    });

    it('uses set_color for terminal colors', () => {
      const content = readFileSync(FISH_FILE, 'utf8');
      assert.ok(content.includes('set_color'));
    });

    it('uses node with process.argv for safe path passing', () => {
      const content = readFileSync(FISH_FILE, 'utf8');
      assert.ok(content.includes('process.argv[1]'));
      assert.ok(content.includes('process.argv[2]'));
    });

    it('does not interpolate paths into JS strings (injection safe)', () => {
      const content = readFileSync(FISH_FILE, 'utf8');
      // The cpf function should NOT use '$__CLAUDE_META_FILE' inside JS code
      // It should use process.argv instead
      const cpfSection = content.split('function cpf')[1]?.split('end')[0] || '';
      const nodeLines = cpfSection.split('\n').filter(l => l.includes('node -e'));
      for (const line of nodeLines) {
        // Inside the JS code (single-quoted), there should be no $__CLAUDE
        const jsCode = line.match(/'([^']*)'/)?.[1] || '';
        assert.ok(!jsCode.includes('$__CLAUDE'),
          'Should not interpolate fish vars into JS code');
      }
    });

    it('uses "command claude" to avoid function recursion', () => {
      const content = readFileSync(FISH_FILE, 'utf8');
      assert.ok(content.includes('command claude'));
    });

    it('sets and unsets CLAUDE_CONFIG_DIR', () => {
      const content = readFileSync(FISH_FILE, 'utf8');
      assert.ok(content.includes('set -x CLAUDE_CONFIG_DIR'));
      assert.ok(content.includes('set -e CLAUDE_CONFIG_DIR'));
    });
  });

  // ─── Script routing ──────────────────────────────────────────────────────

  describe('installShellIntegration routing', () => {
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
