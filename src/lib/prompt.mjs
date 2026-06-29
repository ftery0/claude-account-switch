import { createInterface } from 'node:readline';
import { color, hasColor, cursorUp, clearLine, clearDown, sym } from './ui.mjs';

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
    r.question(`${color.cyan('?')} ${message}${suffix}\n  ${color.dim(sym.arrow)} `, (answer) => {
      r.close();
      const result = answer.trim() || defaultVal || '';
      // Replace 2-line prompt with single completed line: ✓ message … answer
      if (hasColor) {
        process.stdout.write(`${cursorUp(2)}\r${clearLine}${color.green(sym.check)} ${message} ${color.dim(sym.dots)} ${color.cyan(result)}\n${clearDown}`);
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
    let selected = defaultVal;

    const render = (final = false) => {
      const prefix = final ? color.green(sym.check) : color.cyan('?');
      const sep = final ? color.dim(` ${sym.dots} `) : color.dim(` ${sym.arrow} `);
      const no  = !selected ? color.cyan('No')  : color.dim('No');
      const yes =  selected ? color.cyan('Yes') : color.dim('Yes');
      process.stdout.write(`\r${clearLine}${prefix} ${message}${sep}${no} ${color.dim('/')} ${yes}`);
    };

    render();

    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding('utf8');

    const onData = (key) => {
      if (key === '\x1b[D' || key === '\x1b[C' || key === '\t') {
        selected = !selected;
        render();
      } else if (key === 'y' || key === 'Y') {
        selected = true;
        render();
      } else if (key === 'n' || key === 'N') {
        selected = false;
        render();
      } else if (key === '\r' || key === '\n') {
        process.stdin.setRawMode(false);
        process.stdin.pause();
        process.stdin.removeListener('data', onData);
        render(true);
        process.stdout.write('\n');
        resolve(selected);
      } else if (key === '\x03') {
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
    let rendered = false;

    const render = () => {
      if (rendered) {
        process.stdout.write(cursorUp(choices.length));
      }
      choices.forEach((choice, i) => {
        const label = typeof choice === 'string' ? choice : choice.label;
        const prefix = i === selected ? color.cyan(`  ${sym.cursor} `) : '    ';
        process.stdout.write(`${clearLine}${prefix}${label}\n`);
      });
      rendered = true;
    };

    if (!process.stdin.isTTY) {
      // Non-interactive: pick first choice without rendering menu
      resolve(typeof choices[0] === 'string' ? choices[0] : choices[0].value);
      return;
    }

    process.stdout.write(`${color.cyan('?')} ${message}\n`);
    render();

    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding('utf8');

    const onData = (key) => {
      if (key === '\x1b[A') {
        selected = (selected - 1 + choices.length) % choices.length;
        render();
      } else if (key === '\x1b[B') {
        selected = (selected + 1) % choices.length;
        render();
      } else if (key === '\r' || key === '\n') {
        process.stdin.setRawMode(false);
        process.stdin.pause();
        process.stdin.removeListener('data', onData);
        const choice = choices[selected];
        const value = typeof choice === 'string' ? choice : choice.value;
        if (hasColor) {
          process.stdout.write(`${cursorUp(choices.length + 1)}\r${clearLine}${color.green(sym.check)} ${message} ${color.dim(sym.dots)} ${color.cyan(value)}\n${clearDown}`);
        }
        resolve(value);
      } else if (key === '\x03') {
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
