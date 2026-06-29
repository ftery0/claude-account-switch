// ANSI colors, terminal capability detection, and box-drawing helpers.
// Single source for any module that writes to stdout/stderr.

export const hasColor = Boolean(process.stdout.isTTY || process.env.FORCE_COLOR)
  && !process.env.NO_COLOR
  && process.env.TERM !== 'dumb';

// On legacy Windows consoles (cmd.exe without UTF-8 codepage), Unicode box
// characters may not render.  Detect via the WT_SESSION env var (set by
// Windows Terminal) or non-Windows platforms.
export const supportsUnicode = Boolean(
  process.env.WT_SESSION
  || process.env.TERM_PROGRAM
  || process.platform !== 'win32'
);

const ESC = '\x1b[';
const RESET = hasColor ? `${ESC}0m` : '';
const c = (code) => hasColor ? `${ESC}${code}m` : '';

export const color = {
  bold:    (s) => `${c('1')}${s}${RESET}`,
  dim:     (s) => `${c('2')}${s}${RESET}`,
  green:   (s) => `${c('32')}${s}${RESET}`,
  yellow:  (s) => `${c('33')}${s}${RESET}`,
  blue:    (s) => `${c('34')}${s}${RESET}`,
  cyan:    (s) => `${c('36')}${s}${RESET}`,
  red:     (s) => `${c('31')}${s}${RESET}`,
};

// Cursor / line helpers — emit only when color is supported (TTY).
export const cursorUp = (n) => hasColor ? `${ESC}${n}A` : '';
export const clearLine = hasColor ? `${ESC}2K` : '';
export const clearDown = hasColor ? `${ESC}0J` : '';

// Symbols with ASCII fallback for non-Unicode terminals.
export const sym = {
  check:     supportsUnicode ? '✓' : 'v',
  warn:      supportsUnicode ? '⚠' : '!',
  cross:     supportsUnicode ? '✗' : 'x',
  info:      supportsUnicode ? 'ℹ' : 'i',
  arrow:     supportsUnicode ? '›' : '>',
  cursor:    supportsUnicode ? '❯' : '>',
  dots:      supportsUnicode ? '…' : '...',
  bulletOn:  supportsUnicode ? '●' : '*',
  bulletOff: supportsUnicode ? '○' : 'o',
  dash:      supportsUnicode ? '──' : '--',
};

const BOX_TL = supportsUnicode ? '╭' : '+';
const BOX_TR = supportsUnicode ? '╮' : '+';
const BOX_BL = supportsUnicode ? '╰' : '+';
const BOX_BR = supportsUnicode ? '╯' : '+';
const BOX_H  = supportsUnicode ? '─' : '-';
const BOX_V  = supportsUnicode ? '│' : '|';

export function box(lines) {
  const maxLen = Math.max(...lines.map(stripAnsi).map(l => l.length));
  const pad = (s) => s + ' '.repeat(maxLen - stripAnsi(s).length);
  const top    = `  ${BOX_TL}${BOX_H.repeat(maxLen + 2)}${BOX_TR}`;
  const bottom = `  ${BOX_BL}${BOX_H.repeat(maxLen + 2)}${BOX_BR}`;
  const body = lines.map(l => `  ${BOX_V} ${pad(l)} ${BOX_V}`).join('\n');
  return `${top}\n${body}\n${bottom}`;
}

export function success(msg) {
  process.stdout.write(`  ${color.green(sym.check)} ${msg}\n`);
}

export function warn(msg) {
  process.stdout.write(`  ${color.yellow(sym.warn)} ${msg}\n`);
}

export function error(msg) {
  process.stderr.write(`  ${color.red(sym.cross)} ${msg}\n`);
}

export function info(msg) {
  process.stdout.write(`  ${color.blue(sym.info)} ${msg}\n`);
}

export function stripAnsi(s) {
  return s.replace(/\x1b\[[0-9;]*m/g, '');
}
