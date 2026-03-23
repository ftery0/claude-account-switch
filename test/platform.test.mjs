import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { homedir } from 'node:os';

// ─── Constants ───────────────────────────────────────────────────────────────

describe('constants', async () => {
  const c = await import('../src/lib/constants.mjs');

  it('IS_WINDOWS matches process.platform', () => {
    assert.equal(c.IS_WINDOWS, process.platform === 'win32');
  });

  it('HOME matches os.homedir()', () => {
    assert.equal(c.HOME, homedir());
  });

  it('PROFILES_DIR is under HOME', () => {
    assert.ok(c.PROFILES_DIR.startsWith(c.HOME));
    assert.ok(c.PROFILES_DIR.includes('.claude-profiles'));
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

  it('PROFILE_FILES includes .claude.json (auth file)', () => {
    assert.ok(c.PROFILE_FILES.includes('.claude.json'));
  });

  it('SHARED_FILES includes settings.json', () => {
    assert.ok(c.SHARED_FILES.includes('settings.json'));
  });
});

// ─── PROFILE_NAME_REGEX edge cases ───────────────────────────────────────────

describe('PROFILE_NAME_REGEX', async () => {
  const { PROFILE_NAME_REGEX } = await import('../src/lib/constants.mjs');

  // Valid patterns
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

  // Invalid patterns
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

// ─── Cross-platform path handling ────────────────────────────────────────────

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
    assert.ok(c.DEFAULT_CLAUDE_DIR.startsWith(c.HOME));
  });
});

// ─── CLI entry point ─────────────────────────────────────────────────────────

describe('CLI entry point', async () => {
  const { execSync } = await import('node:child_process');
  const { join: pathJoin } = await import('node:path');

  const cli = pathJoin(process.cwd(), 'bin', 'cli.mjs');

  it('--version prints version string', () => {
    const output = execSync(`node "${cli}" --version`, { encoding: 'utf8' }).trim();
    assert.match(output, /^\d+\.\d+\.\d+$/);
  });

  it('-v prints version string', () => {
    const output = execSync(`node "${cli}" -v`, { encoding: 'utf8' }).trim();
    assert.match(output, /^\d+\.\d+\.\d+$/);
  });

  it('--help shows usage info', () => {
    const output = execSync(`node "${cli}" --help`, { encoding: 'utf8' });
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
      execSync(`node "${cli}" nonexistent-command`, { encoding: 'utf8', stdio: 'pipe' });
    }, (err) => {
      assert.equal(err.status, 1);
      return true;
    });
  });

  it('no command shows help', () => {
    const output = execSync(`node "${cli}"`, { encoding: 'utf8' });
    assert.ok(output.includes('Usage:'));
  });

  it('add without name exits with code 1', () => {
    assert.throws(() => {
      execSync(`node "${cli}" add`, { encoding: 'utf8', stdio: 'pipe' });
    }, (err) => {
      assert.equal(err.status, 1);
      return true;
    });
  });

  it('use without name exits with code 1', () => {
    assert.throws(() => {
      execSync(`node "${cli}" use`, { encoding: 'utf8', stdio: 'pipe' });
    }, (err) => {
      assert.equal(err.status, 1);
      return true;
    });
  });

  it('remove without name exits with code 1', () => {
    assert.throws(() => {
      execSync(`node "${cli}" remove`, { encoding: 'utf8', stdio: 'pipe' });
    }, (err) => {
      assert.equal(err.status, 1);
      return true;
    });
  });

  it('add with invalid name exits with code 1', () => {
    assert.throws(() => {
      execSync(`node "${cli}" add "INVALID NAME"`, { encoding: 'utf8', stdio: 'pipe' });
    }, (err) => {
      assert.equal(err.status, 1);
      return true;
    });
  });

  it('use with nonexistent profile exits with code 1', () => {
    assert.throws(() => {
      execSync(`node "${cli}" use "nonexistent${Date.now()}"`, { encoding: 'utf8', stdio: 'pipe' });
    }, (err) => {
      assert.equal(err.status, 1);
      return true;
    });
  });
});

// ─── select() non-TTY behaviour ──────────────────────────────────────────────

describe('select() in non-TTY (piped)', async () => {
  const { execSync } = await import('node:child_process');

  it('returns first choice when stdin is not a TTY', () => {
    const script = `
      import { select } from './src/lib/prompt.mjs';
      const val = await select('pick', [
        { label: 'A', value: 'alpha' },
        { label: 'B', value: 'beta' },
      ]);
      process.stdout.write('RESULT:' + val);
    `;
    const output = execSync(
      `node --input-type=module -e "${script.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`,
      { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] },
    );
    assert.ok(output.includes('RESULT:alpha'));
  });

  it('does not output ANSI escape sequences in non-TTY', () => {
    const script = `
      import { select } from './src/lib/prompt.mjs';
      await select('pick', [{ label: 'A', value: 'a' }]);
    `;
    const output = execSync(
      `node --input-type=module -e "${script.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`,
      { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] },
    );
    // Should not contain cursor movement or line clear sequences
    assert.ok(!output.includes('\x1b['), 'should not contain ANSI escape sequences');
  });
});
