import './helpers/home.mjs';
import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';

describe('color helpers', async () => {
  const { color, hasColor } = await import('../src/lib/ui.mjs');

  it('hasColor is a boolean', () => {
    assert.equal(typeof hasColor, 'boolean');
  });

  it('color functions return the input text (may include ANSI)', () => {
    for (const fn of Object.values(color)) {
      const result = fn('hello');
      assert.ok(result.includes('hello'));
    }
  });

  it('all color keys are present', () => {
    const expected = ['bold', 'dim', 'green', 'yellow', 'blue', 'cyan', 'red'];
    for (const key of expected) {
      assert.equal(typeof color[key], 'function', `color.${key} should be a function`);
    }
  });

  it('nested color calls do not corrupt output', () => {
    const result = color.bold(color.cyan('nested'));
    assert.ok(result.includes('nested'));
  });

  it('handles empty string', () => {
    assert.equal(typeof color.bold(''), 'string');
  });

  it('handles special characters in input', () => {
    const result = color.red('hello "world" <>&');
    assert.ok(result.includes('hello "world" <>&'));
  });
});

describe('box', async () => {
  const { box } = await import('../src/lib/ui.mjs');

  it('returns a string', () => {
    assert.equal(typeof box(['hello']), 'string');
  });

  it('wraps content in box characters', () => {
    const result = box(['hello']);
    const lines = result.split('\n');
    assert.equal(lines.length, 3); // top + content + bottom
  });

  it('handles multiple lines', () => {
    const result = box(['line 1', 'line 2', 'line 3']);
    const lines = result.split('\n');
    assert.equal(lines.length, 5); // top + 3 content + bottom
  });

  it('pads shorter lines to match longest', () => {
    const result = box(['short', 'much longer line']);
    // Both content lines should have same visual width
    const lines = result.split('\n');
    assert.equal(lines[1].length, lines[2].length);
  });

  it('handles content with ANSI codes (width calculation strips ANSI)', () => {
    const result = box(['\x1b[1mhello\x1b[0m', 'world']);
    // Should not crash and should produce valid box
    const lines = result.split('\n');
    assert.equal(lines.length, 4); // top + 2 content + bottom
  });

  it('handles empty string content', () => {
    assert.doesNotThrow(() => box(['']));
  });

  it('single character content', () => {
    const result = box(['x']);
    assert.ok(result.includes('x'));
  });
});

describe('stripAnsi (via box)', async () => {
  const { box } = await import('../src/lib/ui.mjs');

  it('box correctly measures width of ANSI-colored text', () => {
    // If stripAnsi is broken, the box would have wrong padding
    const plain = box(['hello']);
    const colored = box(['\x1b[31mhello\x1b[0m']);
    // Both should have same top border length (same visual width)
    const plainTop = plain.split('\n')[0];
    const coloredTop = colored.split('\n')[0];
    assert.equal(plainTop.length, coloredTop.length);
  });
});

function captureOutput(stream, fn) {
  const write = mock.method(stream, 'write', () => true);
  try {
    fn();
    return write.mock.calls.map(call => call.arguments[0]).join('');
  } finally {
    write.mock.restore();
  }
}

describe('output functions', async () => {
  const { success, warn, error, info } = await import('../src/lib/ui.mjs');

  it('success writes its message to stdout', () => {
    const output = captureOutput(process.stdout, () => success('test message'));
    assert.ok(output.endsWith(' test message\n'));
  });

  it('warn writes its message to stdout', () => {
    const output = captureOutput(process.stdout, () => warn('test warning'));
    assert.ok(output.endsWith(' test warning\n'));
  });

  it('error writes its message to stderr', () => {
    const output = captureOutput(process.stderr, () => error('test error'));
    assert.ok(output.endsWith(' test error\n'));
  });

  it('info writes its message to stdout', () => {
    const output = captureOutput(process.stdout, () => info('test info'));
    assert.ok(output.endsWith(' test info\n'));
  });

  it('handles empty messages on both streams', () => {
    for (const [fn, stream] of [[success, process.stdout], [warn, process.stdout], [error, process.stderr], [info, process.stdout]]) {
      assert.ok(captureOutput(stream, () => fn('')).endsWith(' \n'));
    }
  });

  it('preserves special characters in its output', () => {
    const message = 'path: C:\\Users\\test & "quotes"';
    assert.ok(captureOutput(process.stdout, () => success(message)).endsWith(message + '\n'));
  });
});
