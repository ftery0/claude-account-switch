import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('Claude Code data detection', async () => {
  const {
    describeClaudeSource,
    detectClaudeSources,
    hasExistingClaudeSetup,
    rootStateFileForSource,
  } = await import('../src/lib/claude-data.mjs');

  it('detects modern credentials under ~/.claude', () => {
    const home = mkdtempSync(join(tmpdir(), 'cas-claude-data-'));
    const source = join(home, '.claude');
    mkdirSync(source, { recursive: true });
    writeFileSync(join(source, '.credentials.json'), '{}');

    const result = describeClaudeSource(source, { home });

    assert.equal(result.hasData, true);
    assert.equal(result.hasCredentials, true);
    assert.ok(result.markers.includes('.credentials.json'));
  });

  it('detects root ~/.claude.json as existing Claude setup', () => {
    const home = mkdtempSync(join(tmpdir(), 'cas-claude-root-state-'));
    writeFileSync(join(home, '.claude.json'), '{}');

    assert.equal(hasExistingClaudeSetup({ home }), true);
    assert.equal(detectClaudeSources({ home })[0].rootStateFile, join(home, '.claude.json'));
  });

  it('maps default ~/.claude to sibling ~/.claude.json', () => {
    const home = mkdtempSync(join(tmpdir(), 'cas-root-state-map-'));
    assert.equal(rootStateFileForSource(join(home, '.claude'), home), join(home, '.claude.json'));
  });

  it('does not report empty placeholder directories as Claude setup', () => {
    const home = mkdtempSync(join(tmpdir(), 'cas-empty-claude-'));
    mkdirSync(join(home, '.claude'), { recursive: true });

    assert.equal(existsSync(join(home, '.claude')), true);
    assert.equal(hasExistingClaudeSetup({ home }), false);
  });
});
