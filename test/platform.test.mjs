import './helpers/home.mjs';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';

const cli = fileURLToPath(new URL('../bin/cli.mjs', import.meta.url));
const promptModule = new URL('../src/lib/prompt.mjs', import.meta.url).href;
const profileModule = new URL('../src/lib/profile.mjs', import.meta.url).href;

function runNode(args) {
  return execFileSync(process.execPath, args, {
    encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'],
  });
}

describe('constants', async () => {
  const c = await import('../src/lib/constants.mjs');

  it('IS_WINDOWS matches process.platform', () => {
    assert.equal(c.IS_WINDOWS, process.platform === 'win32');
  });

  it('HOME matches os.homedir()', () => {
    assert.equal(c.HOME, homedir());
  });

  it('PROFILES_DIR is under HOME', () => {
    assert.equal(c.PROFILES_DIR, join(c.HOME, '.claude-profiles'));
  });

  it('SHARED_DIR is under PROFILES_DIR', () => {
    assert.equal(c.SHARED_DIR, join(c.PROFILES_DIR, '_shared'));
  });

  it('META_FILE is under PROFILES_DIR', () => {
    assert.equal(c.META_FILE, join(c.PROFILES_DIR, 'meta.json'));
  });

  it('PROFILE_NAME_MAX_LENGTH is a positive number', () => {
    assert.equal(typeof c.PROFILE_NAME_MAX_LENGTH, 'number');
    assert.ok(c.PROFILE_NAME_MAX_LENGTH > 0);
  });

  it('RESERVED_NAMES is an array containing _shared and default', () => {
    assert.ok(Array.isArray(c.RESERVED_NAMES));
    assert.ok(c.RESERVED_NAMES.includes('_shared'));
    assert.ok(c.RESERVED_NAMES.includes('default'));
  });

  it('file/dir arrays are non-empty', () => {
    assert.ok(c.SHARED_FILES.length > 0);
    assert.ok(c.SHARED_DIRS.length > 0);
    assert.ok(c.PROFILE_FILES.length > 0);
    assert.ok(c.PROFILE_DIRS.length > 0);
  });

  it('PROFILE_FILES includes .claude.json (user configuration)', () => {
    assert.ok(c.PROFILE_FILES.includes('.claude.json'));
  });

  it('history.jsonl belongs to a single profile', () => {
    assert.ok(c.PROFILE_FILES.includes('history.jsonl'));
    assert.equal(c.SHARED_FILES.includes('history.jsonl'), false);
  });

  it('SHARED_FILES includes settings.json', () => {
    assert.ok(c.SHARED_FILES.includes('settings.json'));
  });
});

describe('PROFILE_NAME_REGEX', async () => {
  const { PROFILE_NAME_REGEX } = await import('../src/lib/constants.mjs');

  const valid = [
    'a', 'z', '0', '9', 'ab', 'a1', '1a', '10',
    'work', 'my-profile', 'a-b-c', 'a--b',
    'abcdefghijklmnopqrstuvwxyz1234',
  ];
  for (const name of valid) {
    it(`matches valid name: "${name}"`, () => {
      assert.ok(PROFILE_NAME_REGEX.test(name));
    });
  }

  const invalid = [
    '', '-', '-a', 'a-', '-a-', '--', 'A', 'Work',
    'my profile', 'my_profile', '.hidden', '..', 'a.b',
    'a/b', 'a\\b', 'a@b', 'a!b', '_shared',
  ];
  for (const name of invalid) {
    it(`rejects invalid name: "${name}"`, () => {
      assert.equal(PROFILE_NAME_REGEX.test(name), false);
    });
  }
});

describe('cross-platform paths', async () => {
  const c = await import('../src/lib/constants.mjs');

  it('PROFILES_DIR uses path.join (OS-appropriate separators)', () => {
    if (c.IS_WINDOWS) {
      assert.ok(c.PROFILES_DIR.includes('\\'));
    } else {
      assert.ok(c.PROFILES_DIR.includes('/'));
    }
  });

  it('DEFAULT_CLAUDE_DIR is under HOME', () => {
    assert.equal(c.DEFAULT_CLAUDE_DIR, join(c.HOME, '.claude'));
  });
});

describe('Windows profile names (mocked process.platform off Windows)', () => {
  it('rejects Windows device names before creating a profile', () => {
    const names = ['con', 'prn', 'aux', 'nul'];
    for (let index = 1; index <= 9; index++) names.push(`com${index}`, `lpt${index}`);
    const script = `
      if (process.platform !== 'win32') Object.defineProperty(process, 'platform', { value: 'win32' });
      const { validateProfileName } = await import(${JSON.stringify(profileModule)});
      console.log(JSON.stringify(${JSON.stringify(names)}.map(name => [name, validateProfileName(name)])));
    `;
    const results = JSON.parse(runNode(['--input-type=module', '-e', script]));
    const accepted = results.filter(([, error]) => error === null).map(([name]) => name);
    assert.deepEqual(accepted, [], `Windows device names were accepted: ${accepted.join(', ')}`);
  });

  it('still accepts ordinary names containing device-name prefixes', () => {
    const names = ['con-work', 'auxiliary', 'nul-user', 'com0', 'com10', 'com1-work', 'lpt0', 'lpt10'];
    const script = `
      if (process.platform !== 'win32') Object.defineProperty(process, 'platform', { value: 'win32' });
      const { validateProfileName } = await import(${JSON.stringify(profileModule)});
      console.log(JSON.stringify(${JSON.stringify(names)}.map(name => validateProfileName(name))));
    `;
    assert.deepEqual(JSON.parse(runNode(['--input-type=module', '-e', script])), names.map(() => null));
  });

  it('preserves valid device-name labels on non-Windows platforms', () => {
    const names = ['con', 'prn', 'aux', 'nul', 'com1', 'com9', 'lpt1', 'lpt9'];
    const script = `
      if (process.platform === 'win32') Object.defineProperty(process, 'platform', { value: 'linux' });
      const { validateProfileName } = await import(${JSON.stringify(profileModule)});
      console.log(JSON.stringify(${JSON.stringify(names)}.map(name => validateProfileName(name))));
    `;
    assert.deepEqual(JSON.parse(runNode(['--input-type=module', '-e', script])), names.map(() => null));
  });

  it('rejects new device-name profiles before writing while preserving existing metadata', () => {
    const configModule = new URL('../src/lib/config.mjs', import.meta.url).href;
    const constantsModule = new URL('../src/lib/constants.mjs', import.meta.url).href;
    const script = `
      import assert from 'node:assert/strict';
      import { mkdtempSync, rmSync, existsSync } from 'node:fs';
      import { tmpdir } from 'node:os';
      import { join } from 'node:path';
      const home = mkdtempSync(join(tmpdir(), 'profile-name-fixture-'));
      process.env.HOME = home;
      process.env.USERPROFILE = home;
      if (process.platform !== 'win32') Object.defineProperty(process, 'platform', { value: 'win32' });
      const { createProfile } = await import(${JSON.stringify(profileModule)});
      const { PROFILES_DIR } = await import(${JSON.stringify(constantsModule)});
      const { readMeta, writeMeta } = await import(${JSON.stringify(configModule)});
      try {
        assert.throws(() => createProfile('con'), /reserved Windows device/);
        assert.equal(existsSync(PROFILES_DIR), false);
        const existing = { version: 1, activeProfile: 'con', shareSettings: true, profiles: ['con'] };
        writeMeta(existing);
        assert.deepEqual(readMeta(), existing);
        console.log('preserved');
      } finally {
        rmSync(home, { recursive: true, force: true });
      }
    `;
    assert.equal(runNode(['--input-type=module', '-e', script]).trim(), 'preserved');
  });
});

describe('CLI entry point', () => {
  it('--version prints version string', () => {
    const output = runNode([cli, '--version']).trim();
    assert.match(output, /^\d+\.\d+\.\d+$/);
  });

  it('-v prints version string', () => {
    const output = runNode([cli, '-v']).trim();
    assert.match(output, /^\d+\.\d+\.\d+$/);
  });

  it('--help shows usage info', () => {
    const output = runNode([cli, '--help']);
    assert.ok(output.includes('claude-account-switch'));
    assert.ok(output.includes('Commands:'));
    assert.ok(output.includes('init'));
    assert.ok(output.includes('add'));
    assert.ok(output.includes('remove'));
    assert.ok(output.includes('list'));
    assert.ok(output.includes('use'));
    assert.ok(output.includes('migrate'));
    assert.ok(output.includes('install-shell'));
  });

  it('unknown command exits with code 1', () => {
    assert.throws(() => {
      runNode([cli, 'nonexistent-command']);
    }, (err) => {
      assert.equal(err.status, 1);
      return true;
    });
  });

  it('no command shows help', () => {
    const output = runNode([cli]);
    assert.ok(output.includes('Usage:'));
  });

  it('add without name exits with code 1', () => {
    assert.throws(() => {
      runNode([cli, 'add']);
    }, (err) => {
      assert.equal(err.status, 1);
      return true;
    });
  });

  it('use without name exits with code 1', () => {
    assert.throws(() => {
      runNode([cli, 'use']);
    }, (err) => {
      assert.equal(err.status, 1);
      return true;
    });
  });

  it('remove without name exits with code 1', () => {
    assert.throws(() => {
      runNode([cli, 'remove']);
    }, (err) => {
      assert.equal(err.status, 1);
      return true;
    });
  });

  it('add with invalid name exits with code 1', () => {
    assert.throws(() => {
      runNode([cli, 'add', 'INVALID NAME']);
    }, (err) => {
      assert.equal(err.status, 1);
      return true;
    });
  });

  it('use with nonexistent profile exits with code 1', () => {
    assert.throws(() => {
      runNode([cli, 'use', `nonexistent${Date.now()}`]);
    }, (err) => {
      assert.equal(err.status, 1);
      return true;
    });
  });
});

describe('select() in non-TTY (piped)', () => {
  it('returns first choice when stdin is not a TTY', () => {
    const script = `
      import { select } from ${JSON.stringify(promptModule)};
      const val = await select('pick', [
        { label: 'A', value: 'alpha' },
        { label: 'B', value: 'beta' },
      ]);
      process.stdout.write('RESULT:' + val);
    `;
    const output = runNode(['--input-type=module', '-e', script]);
    assert.ok(output.includes('RESULT:alpha'));
  });

  it('does not output ANSI escape sequences in non-TTY', () => {
    const script = `
      import { select } from ${JSON.stringify(promptModule)};
      await select('pick', [{ label: 'A', value: 'a' }]);
    `;
    const output = runNode(['--input-type=module', '-e', script]);
    assert.ok(!output.includes('\x1b['), 'should not contain ANSI escape sequences');
  });
});
