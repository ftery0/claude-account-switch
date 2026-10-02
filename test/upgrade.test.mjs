import './helpers/home.mjs';
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, cpSync, readdirSync, statSync, existsSync, rmSync } from 'node:fs';
import { execFileSync, spawn } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { PROFILES_DIR } from '../src/lib/constants.mjs';
import { runSelfUpdate, installedRuntimeDirectory, scheduleSelfUpdate } from '../src/lib/self-update.mjs';

const repository = dirname(dirname(fileURLToPath(import.meta.url)));
const workspace = mkdtempSync(join(process.env.TMPDIR, 'upgrade-'));
const legacyDirectory = join(workspace, 'legacy');
let server;
let registry;
let tarball;
let manifest;
let corrupt = false;
let requests = [];

async function verifiedRelease() {
  const registryResponse = await fetch('https://registry.npmjs.org/claude-account-switch/1.2.3', { signal: AbortSignal.timeout(30000) });
  assert.equal(registryResponse.status, 200);
  const release = await registryResponse.json();
  const url = new URL(release.dist.tarball);
  assert.equal(url.origin, 'https://registry.npmjs.org');
  const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
  assert.equal(response.status, 200);
  const data = Buffer.from(await response.arrayBuffer());
  assert.equal('sha512-' + createHash('sha512').update(data).digest('base64'), release.dist.integrity);
  const archive = join(workspace, 'legacy.tgz');
  writeFileSync(archive, data);
  mkdirSync(legacyDirectory);
  execFileSync('tar', ['-xzf', archive, '-C', legacyDirectory], { stdio: 'pipe', timeout: 30000 });
  assert.equal(JSON.parse(readFileSync(join(legacyDirectory, 'package/package.json'), 'utf8')).version, '1.2.3');
}

function packCandidate(version = '2.0.1', engines = undefined) {
  const source = join(workspace, 'candidate');
  rmSync(source, { recursive: true, force: true });
  const packageDirectory = join(source, 'package');
  mkdirSync(packageDirectory, { recursive: true });
  for (const file of ['package.json', 'src', 'bin']) cpSync(join(repository, file), join(packageDirectory, file), { recursive: true });
  manifest = JSON.parse(readFileSync(join(packageDirectory, 'package.json'), 'utf8'));
  manifest.version = version;
  delete manifest.devDependencies;
  if (engines) manifest.engines = engines;
  manifest.scripts = Object.fromEntries(['preinstall', 'install', 'postinstall', 'prepare'].map(name => [name, 'node install-trap.cjs']));
  writeFileSync(join(packageDirectory, 'install-trap.cjs'), `require('http').get(${JSON.stringify(registry + '/lifecycle-trap')});\n`);
  writeFileSync(join(packageDirectory, 'package.json'), JSON.stringify(manifest));
  const archive = join(workspace, 'candidate.tgz');
  execFileSync('tar', ['-czf', archive, '-C', source, 'package'], { stdio: 'pipe', timeout: 30000 });
  tarball = readFileSync(archive);
}

function snapshot(directory) {
  const entries = {};
  function visit(path, relative) {
    for (const name of readdirSync(path)) {
      const file = join(path, name);
      const key = relative ? relative + '/' + name : name;
      const stat = statSync(file);
      if (stat.isDirectory()) visit(file, key);
      else entries[key] = { sha: createHash('sha256').update(readFileSync(file)).digest('hex'), mode: stat.mode, mtime: stat.mtimeMs };
    }
  }
  visit(directory, '');
  return entries;
}

function cli(entry, args) {
  return execFileSync(process.execPath, [entry, ...args], { env: process.env, encoding: 'utf8', timeout: process.platform === 'win32' ? 30000 : 10000 });
}

before(async () => {
  await verifiedRelease();
  mkdirSync(PROFILES_DIR);
  const profile = join(PROFILES_DIR, 'work');
  mkdirSync(profile);
  for (const [name, contents] of Object.entries({ '.credentials.json': '{"token":"fixture-only"}', 'history.jsonl': '{"display":"old conversation"}\n', 'pre-launch.sh': '#!/bin/sh\nexport CUSTOM_HARNESS=1\n', 'settings.local.json': '{"hooks":{"Stop":[]}}', 'CLAUDE.md': 'custom harness rules\n' })) {
    writeFileSync(join(profile, name), contents);
  }
  mkdirSync(join(profile, 'projects'));
  writeFileSync(join(profile, 'projects/session.jsonl'), 'existing session\n');
  writeFileSync(join(PROFILES_DIR, 'meta.json'), JSON.stringify({ version: 1, profiles: ['work'], activeProfile: 'work', shareSettings: true }));
  writeFileSync(join(process.env.HOME, '.bashrc'), '# existing shell setup\n');
  cli(join(legacyDirectory, 'package/bin/cli.mjs'), ['install-shell']);
  const profilesBefore = snapshot(profile);
  const metaBefore = readFileSync(join(PROFILES_DIR, 'meta.json'));
  const rcBefore = readFileSync(join(process.env.HOME, '.bashrc'));
  cli(join(repository, 'bin/cli.mjs'), ['install-shell']);
  assert.deepEqual(snapshot(profile), profilesBefore);
  assert.deepEqual(readFileSync(join(PROFILES_DIR, 'meta.json')), metaBefore);
  assert.deepEqual(readFileSync(join(process.env.HOME, '.bashrc')), rcBefore);
  server = createServer((request, response) => {
    requests.push(request.url);
    if (request.url === '/candidate.tgz') {
      response.setHeader('Content-Type', 'application/octet-stream');
      response.end(corrupt ? Buffer.from('damaged package') : tarball);
      return;
    }
    response.setHeader('Content-Type', 'application/json');
    const version = { ...manifest, dist: { tarball: registry + '/candidate.tgz', integrity: 'sha512-' + createHash('sha512').update(tarball).digest('base64') } };
    response.end(JSON.stringify(request.url.endsWith('/latest') ? version : { name: manifest.name, 'dist-tags': { latest: manifest.version }, versions: { [manifest.version]: version } }));
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  registry = `http://127.0.0.1:${server.address().port}`;
  packCandidate();
});
after(() => server?.close());

describe('published 1.2.3 upgrade and real npm downloads', () => {
  it('upgrades the actual release in place and applies a downloaded package without lifecycle scripts', async () => {
    const profileBefore = snapshot(join(PROFILES_DIR, 'work'));
    const oldRuntime = installedRuntimeDirectory();
    const oldBytes = snapshot(oldRuntime);
    const result = await runSelfUpdate({ force: true, env: { ...process.env, CAS_TEST_REGISTRY_URL: registry }, computePlan: async () => ({ self: { latest: manifest.version } }) });
    assert.deepEqual(result, { action: 'updated', version: '2.0.1' });
    assert.equal(cli(join(PROFILES_DIR, '_runtime/bin/cli.mjs'), ['--version']).trim(), '2.0.1');
    assert.deepEqual(snapshot(oldRuntime), oldBytes);
    assert.deepEqual(snapshot(join(PROFILES_DIR, 'work')), profileBefore);
    assert.ok(requests.includes('/candidate.tgz'));
    assert.equal(requests.includes('/lifecycle-trap'), false);
  });
  it('verifies npm package integrity and retains the active version after a corrupt download', async () => {
    packCandidate('2.0.2');
    corrupt = true;
    const old = installedRuntimeDirectory();
    const before = snapshot(old);
    const result = await runSelfUpdate({ force: true, env: { ...process.env, CAS_TEST_REGISTRY_URL: registry }, computePlan: async () => ({ self: { latest: manifest.version } }) });
    assert.equal(result.action, 'failed');
    assert.match(result.error, corrupt ? /EINTEGRITY/ : /EBADENGINE/);
    assert.equal(installedRuntimeDirectory(), old);
    assert.deepEqual(snapshot(old), before);
    assert.equal(cli(join(PROFILES_DIR, '_runtime/bin/cli.mjs'), ['--version']).trim(), '2.0.1');
    corrupt = false;
  });
  it('rejects packages that require an unsupported Node version', async () => {
    packCandidate('2.0.3', { node: '>=999.0.0' });
    const old = installedRuntimeDirectory();
    const result = await runSelfUpdate({ force: true, env: { ...process.env, CAS_TEST_REGISTRY_URL: registry }, computePlan: async () => ({ self: { latest: manifest.version } }) });
    assert.equal(result.action, 'failed');
    assert.match(result.error, corrupt ? /EINTEGRITY/ : /EBADENGINE/);
    assert.equal(installedRuntimeDirectory(), old);
  });
  it('manual update and check report the installed runtime and do not rerun init', async () => {
    packCandidate('2.0.4');
    const env = { ...process.env, CAS_TEST_REGISTRY_URL: registry };
    const run = args => new Promise((resolve, reject) => {
      const child = spawn(process.execPath, [join(repository, 'bin/cli.mjs'), ...args], { env, stdio: ['ignore', 'pipe', 'pipe'] });
      let output = '';
      child.stdout.on('data', bytes => output += bytes);
      child.stderr.on('data', bytes => output += bytes);
      child.once('error', reject);
      child.once('exit', code => resolve({ code, output }));
    });
    const check = await run(['update', '--check']);
    assert.equal(check.code, 1, check.output);
    assert.match(check.output, /2\.0\.1/);
    assert.equal(cli(join(PROFILES_DIR, '_runtime/bin/cli.mjs'), ['--version']).trim(), '2.0.1');
    const update = await run(['update']);
    assert.equal(update.code, 0, update.output);
    assert.match(update.output, /Updated to 2\.0\.4/);
    assert.equal(cli(join(PROFILES_DIR, '_runtime/bin/cli.mjs'), ['--version']).trim(), '2.0.4');
    assert.equal(existsSync(join(PROFILES_DIR, 'work/.credentials.json')), true);
  });
  it('automatically downloads in a detached worker and switches the next launch', async () => {
    packCandidate('2.0.5');
    rmSync(join(PROFILES_DIR, '_update-state.json'));
    const result = scheduleSelfUpdate({ env: { ...process.env, CLAUDE_SWITCH_DISABLE_AUTO_UPDATE: '0', CAS_TEST_REGISTRY_URL: registry }, stdin: { isTTY: true }, stdout: { isTTY: true } });
    assert.equal(result.action, 'scheduled');
    const deadline = Date.now() + 30000;
    let installed = '';
    while (Date.now() < deadline) {
      installed = JSON.parse(readFileSync(join(installedRuntimeDirectory(), 'package.json'), 'utf8')).version;
      if (installed === '2.0.5') break;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert.equal(installed, '2.0.5');
    assert.equal(cli(join(PROFILES_DIR, '_runtime/bin/cli.mjs'), ['--version']).trim(), '2.0.5');
    assert.equal(requests.includes('/lifecycle-trap'), false);
  });
  it('keeps an already running process able to load its original modules after activation', async () => {
    const old = installedRuntimeDirectory();
    const original = snapshot(old);
    const program = `process.send('ready');process.once('message',async()=>{const{run}=await import(${JSON.stringify(pathToFileURL(join(old, 'src/index.mjs')).href)});await run(['--version']);process.disconnect()});`;
    const child = spawn(process.execPath, ['-e', program], { env: process.env, stdio: ['ignore', 'pipe', 'pipe', 'ipc'] });
    let output = '';
    let errors = '';
    child.stdout.on('data', bytes => output += bytes);
    child.stderr.on('data', bytes => errors += bytes);
    const finished = new Promise((resolve, reject) => { child.once('error', reject); child.once('close', resolve); });
    try {
      await new Promise((resolve, reject) => { child.once('message', resolve); child.once('error', reject); });
      packCandidate('2.0.6');
      assert.equal((await runSelfUpdate({ force: true, env: { ...process.env, CAS_TEST_REGISTRY_URL: registry }, computePlan: async () => ({ self: { latest: manifest.version } }) })).action, 'updated');
      assert.deepEqual(snapshot(old), original);
      child.send('load-old-module');
      assert.equal(await finished, 0, errors);
      assert.equal(output.trim(), '2.0.5');
      assert.equal(cli(join(PROFILES_DIR, '_runtime/bin/cli.mjs'), ['--version']).trim(), '2.0.6');
    } finally { if (child.exitCode === null) child.kill(); }
  });
});
