import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CLI = join(__dirname, '..', 'bin', 'cli.mjs');

// In-process mock registry: returns hardcoded latest versions
function startMockRegistry({ self, claude }) {
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      res.setHeader('content-type', 'application/json');
      if (req.url.endsWith('/claude-account-switch/latest')) {
        res.end(JSON.stringify({ version: self }));
      } else if (req.url.includes('claude-code') && req.url.endsWith('/latest')) {
        res.end(JSON.stringify({ version: claude }));
      } else {
        res.statusCode = 404;
        res.end('{}');
      }
    });
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({ server, url: `http://127.0.0.1:${port}` });
    });
  });
}

function runCli(args, env = {}) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [CLI, ...args], {
      env: { ...process.env, ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', d => (stdout += d));
    child.stderr.on('data', d => (stderr += d));
    child.on('close', code => resolve({ code, stdout, stderr }));
  });
}

describe('update --check (with mock registry)', () => {
  let server;
  let url;

  before(async () => {
    // Returns a very high version so it always reports "update available"
    ({ server, url } = await startMockRegistry({ self: '99.0.0', claude: '99.0.0' }));
  });

  after(() => { server.close(); });

  it('renders a table and exits 1 when updates are available', async () => {
    const { code, stdout } = await runCli(['update', '--check'], { CAS_TEST_REGISTRY_URL: url });
    assert.equal(code, 1, `expected exit 1 (updates available), got ${code}`);
    assert.match(stdout, /Package/);
    assert.match(stdout, /Latest/);
    assert.match(stdout, /99\.0\.0/);
  });

  it('filters to self with --self', async () => {
    const { stdout } = await runCli(['update', '--check', '--self'], { CAS_TEST_REGISTRY_URL: url });
    assert.match(stdout, /claude-account-switch/);
    assert.doesNotMatch(stdout, /@anthropic-ai\/claude-code/);
  });

  it('filters to claude-code with --claude-code', async () => {
    const { stdout } = await runCli(['update', '--check', '--claude-code'], { CAS_TEST_REGISTRY_URL: url });
    assert.match(stdout, /@anthropic-ai\/claude-code/);
    assert.doesNotMatch(stdout, /^[ \t]*claude-account-switch[ \t]/m);
  });
});

describe('update --check (no updates)', () => {
  let server;
  let url;

  before(async () => {
    // Returns a very low version so installed is always >= latest → up to date
    ({ server, url } = await startMockRegistry({ self: '0.0.1', claude: '0.0.1' }));
  });

  after(() => { server.close(); });

  it('exits 0 when everything is up to date', async () => {
    const { code, stdout } = await runCli(['update', '--check'], { CAS_TEST_REGISTRY_URL: url });
    assert.equal(code, 0, `expected exit 0, got ${code}`);
    assert.match(stdout, /up to date/);
  });
});
