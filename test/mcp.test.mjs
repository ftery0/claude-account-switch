import './helpers/home.mjs';
import { it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, readFileSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const profiles = join(homedir(), '.claude-profiles');
const shared = join(profiles, '_shared/settings.json');
mkdirSync(join(profiles, '_shared'), { recursive: true });
writeFileSync(join(profiles, 'meta.json'), JSON.stringify({ version: 1, activeProfile: 'work', shareSettings: true, profiles: ['work'] }));
const original = JSON.stringify({ mcpServers: { legacy: { env: { TOKEN: 'must-stay-private' }, url: 'https://secret.example' } } });
writeFileSync(shared, original);
const cli = fileURLToPath(new URL('../bin/cli.mjs', import.meta.url));

it('shows names and paths without printing credentials or changing legacy data', () => {
  const before = readdirSync(profiles);
  const result = spawnSync(process.execPath, [cli, 'mcp', 'list'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /legacy/);
  assert.doesNotMatch(result.stdout, /must-stay-private|secret.example/);
  assert.equal(readFileSync(shared, 'utf8'), original);
  assert.deepEqual(readdirSync(profiles), before);
});
it('rejects former writes without modifying data', () => {
  for (const command of ['add', 'remove', 'disable', 'enable']) {
    const result = spawnSync(process.execPath, [cli, 'mcp', command, 'legacy'], { encoding: 'utf8' });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /no longer supported/);
    assert.equal(readFileSync(shared, 'utf8'), original);
  }
});
