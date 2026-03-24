import { createInterface } from 'node:readline';
import { color, hasColor } from './ui.mjs';

// ANSI helpers — only emit escape sequences when the terminal supports them
const CURSOR_UP = (n) => hasColor ? `\x1b[${n}A` : '';
const CLEAR_LINE = hasColor ? '\x1b[2K' : '';
const CLEAR_DOWN = hasColor ? '\x1b[0J' : '';

// Unicode detection (matches ui.mjs logic)
const supportsUnicode = process.env.WT_SESSION
  || process.env.TERM_PROGRAM
  || process.platform !== 'win32';
const SYM_CHECK = supportsUnicode ? '\u2713' : 'v';
const SYM_ARROW = supportsUnicode ? '\u203a' : '>';
const SYM_DOTS  = supportsUnicode ? '\u2026' : '...';

/**
 * Zero-dependency interactive prompts using raw stdin.
 */

function rl() {
  return createInterface({ input: process.stdin, output: process.stdout });
}

export async function text(message, defaultVal) {
  const suffix = defaultVal !== undefined ? color.dim(` (${defaultVal})`) : '';
  const r = rl();
  return new Promise((resolve) => {
    r.question(`${color.cyan('?')} ${message}${suffix}\n  ${color.dim(SYM_ARROW)} `, (answer) => {
      r.close();
      const result = answer.trim() || defaultVal || '';
      // Replace 2-line prompt with single completed line: ✓ message … answer
      if (hasColor) {
        process.stdout.write(`${CURSOR_UP(2)}\r${CLEAR_LINE}${color.green(SYM_CHECK)} ${message} ${color.dim(SYM_DOTS)} ${color.cyan(result)}\n${CLEAR_DOWN}`);
      }
      resolve(result);
    });
  });
}

export async function number(message, defaultVal) {
  const val = await text(message, defaultVal?.toString());
  const n = parseInt(val, 10);
  if (isNaN(n) || n < 1) return defaultVal ?? 1;
  return n;
}

export async function confirm(message, defaultVal = true) {
  if (!process.stdin.isTTY) {
    return defaultVal;
  }

  return new Promise((resolve) => {
    let selected = defaultVal; // true = Yes, false = No

    const render = (final = false) => {
      const prefix = final ? color.green(SYM_CHECK) : color.cyan('?');
      const sep = final ? color.dim(` ${SYM_DOTS} `) : color.dim(` ${SYM_ARROW} `);
      const no  = !selected ? color.cyan('No')  : color.dim('No');
      const yes =  selected ? color.cyan('Yes') : color.dim('Yes');
      process.stdout.write(`\r${CLEAR_LINE}${prefix} ${message}${sep}${no} ${color.dim('/')} ${yes}`);
    };

    render();

    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding('utf8');

    const onData = (key) => {
      if (key === '\x1b[D' || key === '\x1b[C' || key === '\t') { // left, right, tab
        selected = !selected;
        render();
      } else if (key === 'y' || key === 'Y') {
        selected = true;
        render();
      } else if (key === 'n' || key === 'N') {
        selected = false;
        render();
      } else if (key === '\r' || key === '\n') { // enter
        process.stdin.setRawMode(false);
        process.stdin.pause();
        process.stdin.removeListener('data', onData);
        render(true);
        process.stdout.write('\n');
        resolve(selected);
      } else if (key === '\x03') { // ctrl-c
        process.stdin.setRawMode(false);
        process.stdin.pause();
        process.stdin.removeListener('data', onData);
        process.stdout.write('\n');
        process.exit(0);
      }
    };

    process.stdin.on('data', onData);
  });
}

export async function select(message, choices) {
  return new Promise((resolve) => {
    let selected = 0;

    const render = () => {
      // Move cursor up to overwrite previous render (except first time)
      if (rendered) {
        process.stdout.write(CURSOR_UP(choices.length));
      }
      choices.forEach((c, i) => {
        const label = typeof c === 'string' ? c : c.label;
        const prefix = i === selected ? color.cyan('  \u276f ') : '    ';
        process.stdout.write(`${CLEAR_LINE}${prefix}${label}\n`);
      });
      rendered = true;
    };

    if (!process.stdin.isTTY) {
      // Non-interactive: pick first choice without rendering menu
      resolve(typeof choices[0] === 'string' ? choices[0] : choices[0].value);
      return;
    }

    let rendered = false;
    process.stdout.write(`${color.cyan('?')} ${message}\n`);
    render();

    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding('utf8');

    const onData = (key) => {
      if (key === '\x1b[A') { // up
        selected = (selected - 1 + choices.length) % choices.length;
        render();
      } else if (key === '\x1b[B') { // down
        selected = (selected + 1) % choices.length;
        render();
      } else if (key === '\r' || key === '\n') { // enter
        process.stdin.setRawMode(false);
        process.stdin.pause();
        process.stdin.removeListener('data', onData);
        const choice = choices[selected];
        const value = typeof choice === 'string' ? choice : choice.value;
        const answer = typeof choice === 'string' ? choice : choice.value;
        // Collapse question + choices into single completed line: ✓ message … answer
        if (hasColor) {
          process.stdout.write(`${CURSOR_UP(choices.length + 1)}\r${CLEAR_LINE}${color.green(SYM_CHECK)} ${message} ${color.dim(SYM_DOTS)} ${color.cyan(answer)}\n${CLEAR_DOWN}`);
        }
        resolve(value);
      } else if (key === '\x03') { // ctrl-c
        process.stdin.setRawMode(false);
        process.stdin.pause();
        process.stdin.removeListener('data', onData);
        process.stdout.write('\n');
        process.exit(0);
      }
    };

    process.stdin.on('data', onData);
  });
}
