// ANSI color helpers — zero dependencies
const ESC = '\x1b[';
const RESET = `${ESC}0m`;

export const color = {
  bold:    (s) => `${ESC}1m${s}${RESET}`,
  dim:     (s) => `${ESC}2m${s}${RESET}`,
  green:   (s) => `${ESC}32m${s}${RESET}`,
  yellow:  (s) => `${ESC}33m${s}${RESET}`,
  blue:    (s) => `${ESC}34m${s}${RESET}`,
  magenta: (s) => `${ESC}35m${s}${RESET}`,
  cyan:    (s) => `${ESC}36m${s}${RESET}`,
  red:     (s) => `${ESC}31m${s}${RESET}`,
  gray:    (s) => `${ESC}90m${s}${RESET}`,
};

export function box(lines) {
  const maxLen = Math.max(...lines.map(stripAnsi).map(l => l.length));
  const pad = (s) => {
    const visible = stripAnsi(s).length;
    return s + ' '.repeat(maxLen - visible);
  };
  const top    = `  \u256d${ '\u2500'.repeat(maxLen + 2) }\u256e`;
  const bottom = `  \u2570${ '\u2500'.repeat(maxLen + 2) }\u256f`;
  const body = lines.map(l => `  \u2502 ${pad(l)} \u2502`).join('\n');
  return `${top}\n${body}\n${bottom}`;
}

export function success(msg) {
  process.stdout.write(`  ${color.green('\u2713')} ${msg}\n`);
}

export function warn(msg) {
  process.stdout.write(`  ${color.yellow('\u26A0')} ${msg}\n`);
}

export function error(msg) {
  process.stderr.write(`  ${color.red('\u2717')} ${msg}\n`);
}

export function info(msg) {
  process.stdout.write(`  ${color.blue('\u2139')} ${msg}\n`);
}

function stripAnsi(s) {
  return s.replace(/\x1b\[[0-9;]*m/g, '');
}
