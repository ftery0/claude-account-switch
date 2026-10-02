import './helpers/home.mjs';
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const CLI = fileURLToPath(new URL('../bin/cli.mjs', import.meta.url));
const fakeBin = join(homedir(), '.local', 'bin', process.platform === 'win32' ? 'claude.exe' : 'claude');
let server;
let registry;
let latest = '99.0.0';
let statusCode = 200;
let requests = [];

before(async () => {
  mkdirSync(join(homedir(), '.local', 'bin'), { recursive: true });
  writeFileSync(fakeBin, 'preserve this executable');
  server = createServer((req, res) => {
    requests.push(req.url);
    res.statusCode = statusCode;
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ version: latest }));
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  registry = `http://127.0.0.1:${server.address().port}`;
});
after(() => server?.close());

function runCli(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [CLI, ...args], {
      env: { ...process.env, CAS_TEST_REGISTRY_URL: registry }, stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', data => { stdout += data; });
    child.stderr.on('data', data => { stderr += data; });
    child.once('error', reject);
    child.once('close', code => resolve({ code, stdout, stderr }));
  });
}

describe('explicit package updates', () => {
  it('exits 1 for a newer package without installing or changing shells', async () => {
    const result = await runCli(['update', '--check']);
    assert.equal(result.code, 1, result.stderr);
    assert.match(result.stdout, /99\.0\.0/);
    assert.equal(readFileSync(fakeBin, 'utf8'), 'preserve this executable');
    assert.equal(existsSync(join(homedir(), '.claude-profiles')), false);
    assert.deepEqual(requests, ['/claude-account-switch/latest']);
  });
  it('preserves --self and never queries Claude versions', async () => {
    requests = [];
    const result = await runCli(['update', '--self', '--yes']);
    assert.equal(result.code, 0, result.stderr);
    assert.match(result.stdout, /no installation was run/);
    assert.deepEqual(requests, ['/claude-account-switch/latest']);
    assert.equal(readFileSync(fakeBin, 'utf8'), 'preserve this executable');
  });
  it('reports Claude version status as unchecked and gives official guidance', async () => {
    requests = [];
    const result = await runCli(['update', '--claude-code', '--check']);
    assert.equal(result.code, 2, result.stderr);
    assert.match(result.stdout, /claude update/);
    assert.match(result.stdout, /not checked/);
    assert.deepEqual(requests, []);
  });
  it('exits 0 when the package is current', async () => {
    latest = '0.0.1';
    const result = await runCli(['update', '--check']);
    assert.equal(result.code, 0, result.stderr);
    assert.match(result.stdout, /up to date/);
  });
  it('exits 2 for registry failure without changing the installation', async () => {
    statusCode = 503;
    const result = await runCli(['update', '--check']);
    assert.equal(result.code, 2);
    assert.match(result.stderr, /503/);
    assert.equal(readFileSync(fakeBin, 'utf8'), 'preserve this executable');
    assert.equal(existsSync(join(homedir(), '.claude-profiles')), false);
  });
});
