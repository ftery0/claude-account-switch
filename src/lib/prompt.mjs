import { createInterface } from 'node:readline';
import { color, hasColor } from './ui.mjs';

// ANSI helpers — only emit escape sequences when the terminal supports them
const CURSOR_UP = (n) => hasColor ? `\x1b[${n}A` : '';
const CLEAR_LINE = hasColor ? '\x1b[2K' : '';

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
    r.question(`${color.cyan('?')} ${message}${suffix}\n  ${color.dim('\u203a')} `, (answer) => {
      r.close();
      resolve(answer.trim() || defaultVal || '');
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
  const hint = defaultVal ? 'Y/n' : 'y/N';
  const r = rl();
  return new Promise((resolve) => {
    r.question(`${color.cyan('?')} ${message} ${color.dim(`(${hint})`)} `, (answer) => {
      r.close();
      const a = answer.trim().toLowerCase();
      if (a === '') resolve(defaultVal);
      else resolve(a === 'y' || a === 'yes');
    });
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
