import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CLI = join(__dirname, '..', 'bin', 'cli.mjs');

function makeHome(profiles = ['work']) {
  const home = mkdtempSync(join(tmpdir(), 'cas-shell-cmd-'));
  const profilesDir = join(home, '.claude-profiles');
  mkdirSync(profilesDir, { recursive: true });
  for (const name of profiles) {
    const dir = join(profilesDir, name);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, '.claude.json'), '{}');
  }
  writeFileSync(join(profilesDir, 'meta.json'), JSON.stringify({
    version: 1,
    activeProfile: profiles[0],
    shareSettings: true,
    profiles,
  }, null, 2));
  return { home, profilesDir };
}

function makeFakeClaude() {
  const binDir = mkdtempSync(join(tmpdir(), 'cas-fake-claude-'));
  const bin = join(binDir, 'claude');
  writeFileSync(bin, '#!/bin/sh\nprintf "CONFIG=%s\\n" "$CLAUDE_CONFIG_DIR"\nprintf "ARGS=%s\\n" "$*"\n');
  chmodSync(bin, 0o755);
  return binDir;
}

function runCli(args, env = {}) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [CLI, ...args], {
      env: {
        ...process.env,
        ...env,
        CLAUDE_SWITCH_DISABLE_AUTO_UPDATE: '1',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', d => (stdout += d));
    child.stderr.on('data', d => (stderr += d));
    child.on('close', code => resolve({ code, stdout, stderr }));
  });
}

describe('shell command', () => {
  it('launches Claude with the active profile config dir and forwards args', async () => {
    const { home, profilesDir } = makeHome(['work']);
    const binDir = makeFakeClaude();

    const result = await runCli(['shell', 'launch', '--model', 'sonnet'], {
      HOME: home,
      PATH: `${binDir}:${process.env.PATH}`,
    });

    assert.equal(result.code, 0, result.stderr);
    assert.match(result.stdout, /Profile: .*work/);
    assert.match(result.stdout, new RegExp(`CONFIG=${profilesDir}/work`.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    assert.match(result.stdout, /ARGS=--model sonnet/);
  });

  it('switches profiles through the shell use subcommand', async () => {
    const { home, profilesDir } = makeHome(['work', 'personal']);

    const result = await runCli(['shell', 'use', 'personal'], { HOME: home });

    assert.equal(result.code, 0, result.stderr);
    const meta = JSON.parse(readFileSync(join(profilesDir, 'meta.json'), 'utf8'));
    assert.equal(meta.activeProfile, 'personal');
  });
});
