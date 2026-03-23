import { describe, it } from 'node:test';
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
    const expected = ['bold', 'dim', 'green', 'yellow', 'blue', 'magenta', 'cyan', 'red', 'gray'];
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
  const { box, color } = await import('../src/lib/ui.mjs');

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
    const result = box([color.bold('hello'), 'world']);
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
  const { box, color } = await import('../src/lib/ui.mjs');

  it('box correctly measures width of ANSI-colored text', () => {
    // If stripAnsi is broken, the box would have wrong padding
    const plain = box(['hello']);
    const colored = box([color.red('hello')]);
    // Both should have same top border length (same visual width)
    const plainTop = plain.split('\n')[0];
    const coloredTop = colored.split('\n')[0];
    assert.equal(plainTop.length, coloredTop.length);
  });
});

describe('output functions', async () => {
  const { success, warn, error, info } = await import('../src/lib/ui.mjs');

  // These write to stdout/stderr directly.
  // We verify they don't throw.

  it('success does not throw', () => {
    assert.doesNotThrow(() => success('test message'));
  });

  it('warn does not throw', () => {
    assert.doesNotThrow(() => warn('test warning'));
  });

  it('error does not throw', () => {
    assert.doesNotThrow(() => error('test error'));
  });

  it('info does not throw', () => {
    assert.doesNotThrow(() => info('test info'));
  });

  it('handles empty message', () => {
    assert.doesNotThrow(() => success(''));
    assert.doesNotThrow(() => warn(''));
    assert.doesNotThrow(() => error(''));
    assert.doesNotThrow(() => info(''));
  });

  it('handles message with special chars', () => {
    assert.doesNotThrow(() => success('path: C:\\Users\\test & "quotes"'));
  });
});
