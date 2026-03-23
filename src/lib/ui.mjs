// ANSI color helpers — zero dependencies
export const hasColor = Boolean(process.stdout.isTTY || process.env.FORCE_COLOR)
  && !process.env.NO_COLOR
  && process.env.TERM !== 'dumb';

const ESC = '\x1b[';
const RESET = hasColor ? `${ESC}0m` : '';
const c = (code) => hasColor ? `${ESC}${code}m` : '';

export const color = {
  bold:    (s) => `${c('1')}${s}${RESET}`,
  dim:     (s) => `${c('2')}${s}${RESET}`,
  green:   (s) => `${c('32')}${s}${RESET}`,
  yellow:  (s) => `${c('33')}${s}${RESET}`,
  blue:    (s) => `${c('34')}${s}${RESET}`,
  magenta: (s) => `${c('35')}${s}${RESET}`,
  cyan:    (s) => `${c('36')}${s}${RESET}`,
  red:     (s) => `${c('31')}${s}${RESET}`,
  gray:    (s) => `${c('90')}${s}${RESET}`,
};

// On legacy Windows consoles (cmd.exe without UTF-8 codepage), Unicode box
// characters may not render.  Detect via the WT_SESSION env var (set by
// Windows Terminal) or CI/non-interactive.  Fall back to ASCII when needed.
const supportsUnicode = process.env.WT_SESSION
  || process.env.TERM_PROGRAM
  || process.platform !== 'win32';

const SYM_CHECK = supportsUnicode ? '\u2713' : 'v';
const SYM_WARN  = supportsUnicode ? '\u26A0' : '!';
const SYM_CROSS = supportsUnicode ? '\u2717' : 'x';
const SYM_INFO  = supportsUnicode ? '\u2139' : 'i';
const BOX_TL = supportsUnicode ? '\u256d' : '+';
const BOX_TR = supportsUnicode ? '\u256e' : '+';
const BOX_BL = supportsUnicode ? '\u2570' : '+';
const BOX_BR = supportsUnicode ? '\u256f' : '+';
const BOX_H  = supportsUnicode ? '\u2500' : '-';
const BOX_V  = supportsUnicode ? '\u2502' : '|';

export function box(lines) {
  const maxLen = Math.max(...lines.map(stripAnsi).map(l => l.length));
  const pad = (s) => {
    const visible = stripAnsi(s).length;
    return s + ' '.repeat(maxLen - visible);
  };
  const top    = `  ${BOX_TL}${ BOX_H.repeat(maxLen + 2) }${BOX_TR}`;
  const bottom = `  ${BOX_BL}${ BOX_H.repeat(maxLen + 2) }${BOX_BR}`;
  const body = lines.map(l => `  ${BOX_V} ${pad(l)} ${BOX_V}`).join('\n');
  return `${top}\n${body}\n${bottom}`;
}

export function success(msg) {
  process.stdout.write(`  ${color.green(SYM_CHECK)} ${msg}\n`);
}

export function warn(msg) {
  process.stdout.write(`  ${color.yellow(SYM_WARN)} ${msg}\n`);
}

export function error(msg) {
  process.stderr.write(`  ${color.red(SYM_CROSS)} ${msg}\n`);
}

export function info(msg) {
  process.stdout.write(`  ${color.blue(SYM_INFO)} ${msg}\n`);
}

function stripAnsi(s) {
  return s.replace(/\x1b\[[0-9;]*m/g, '');
}
