import { parseArgs } from 'node:util';
import { color, success, warn, error, info } from '../lib/ui.mjs';
import { listProfiles, profileExists } from '../lib/profile.mjs';
import { getActiveProfile } from '../lib/config.mjs';
import {
  readMcpServers, writeMcpServers,
  readDisabledMcps, writeDisabledMcps,
  listAllMcps, sharedSettingsPath, profileLocalPath,
} from '../lib/mcp.mjs';
import * as prompt from '../lib/prompt.mjs';

// ── ANSI 헬퍼 ────────────────────────────────────────────────────────────────

const hasColor = Boolean(process.stderr.isTTY || process.env.FORCE_COLOR)
  && !process.env.NO_COLOR
  && process.env.TERM !== 'dumb';

const supportsUnicode = process.env.WT_SESSION
  || process.env.TERM_PROGRAM
  || process.platform !== 'win32';

const err = process.stderr;
const UP   = (n) => `\x1b[${n}A`;
const CLR  = '\x1b[2K';
const CLRD = '\x1b[0J';
const c    = (code, s) => hasColor ? `\x1b[${code}m${s}\x1b[0m` : s;

const SYM_BULLET_ON  = supportsUnicode ? '●' : '*';
const SYM_BULLET_OFF = supportsUnicode ? '○' : 'o';
const SYM_CURSOR     = supportsUnicode ? '❯' : '>';
const SYM_DASH       = supportsUnicode ? '──' : '--';

// ── 진입점 ───────────────────────────────────────────────────────────────────

export async function mcp(argv = []) {
  const sub  = argv[0];

  if (!sub || sub === 'list') {
    return runTui(argv);
  }

  const subCommands = { add, remove, disable, enable };
  const handler = subCommands[sub];
  if (!handler) {
    error(`Unknown mcp subcommand: ${sub}`);
    printMcpHelp();
    process.exit(1);
  }

  await handler(argv.slice(1));
}

function printMcpHelp() {
  console.log(`
  ${color.bold('mcp')} — MCP 서버 관리

  ${color.bold('Usage:')}
    claude-account-switch mcp [subcommand] [options]

  ${color.bold('Subcommands:')}
    (none)                  인터랙티브 TUI 실행
    list                    인터랙티브 TUI 실행
    add <name> [options]    MCP 추가
    remove <name> [options] MCP 제거
    disable <name>          공통 MCP를 특정 프로필에서 비활성화
    enable <name>           비활성화된 공통 MCP 재활성화

  ${color.bold('Add Options:')}
    --shared                모든 프로필에 공통 추가
    --profile <name>        특정 프로필에만 추가
    --type http|stdio       MCP 타입 (기본: stdio)
    --url <url>             HTTP MCP URL
    --command <cmd>         stdio MCP 명령어
    --args <arg>...         stdio MCP 인수

  ${color.bold('Remove Options:')}
    --shared                공통에서 제거
    --profile <name>        특정 프로필에서 제거

  ${color.bold('Disable/Enable Options:')}
    --profile <name>        대상 프로필 (필수)
`);
}

// ── TUI ─────────────────────────────────────────────────────────────────────

async function runTui(_args) {
  if (!process.stdin.isTTY) {
    // 비 TTY 환경: 텍스트 목록 출력
    const profiles = listProfiles();
    const { shared, profiles: pMap } = listAllMcps(profiles);
    printTextList(shared, pMap, profiles);
    return;
  }

  await renderTui();
}

function printTextList(shared, pMap, profiles) {
  console.log('\n  MCP Servers\n');
  console.log('  -- Shared --');
  for (const [name, cfg] of Object.entries(shared)) {
    const type = cfg.type ?? (cfg.command ? 'stdio' : 'http');
    const target = cfg.url ?? cfg.command ?? '';
    console.log(`  ${SYM_BULLET_ON} ${name}  ${type}  ${target}`);
  }
  for (const p of profiles) {
    const { own, disabled } = pMap[p];
    const hasOwn = Object.keys(own).length > 0;
    const hasDisabled = disabled.length > 0;
    if (!hasOwn && !hasDisabled) continue;
    console.log(`\n  -- ${p} --`);
    for (const name of disabled) {
      if (shared[name]) console.log(`  ${SYM_BULLET_OFF} ${name}  (disabled)`);
    }
    for (const [name, cfg] of Object.entries(own)) {
      const type = cfg.type ?? (cfg.command ? 'stdio' : 'http');
      const target = cfg.url ?? cfg.command ?? '';
      console.log(`  ${SYM_BULLET_ON} ${name}  ${type}  ${target}`);
    }
  }
  console.log();
}

// ── TUI 렌더러 ───────────────────────────────────────────────────────────────

async function renderTui() {
  let profiles = listProfiles();

  // items: { type: 'header'|'item', ... }
  function buildItems() {
    const { shared, profiles: pMap } = listAllMcps(profiles);
    const items = [];

    // Shared 섹션
    items.push({ type: 'header', label: 'Shared (모든 프로필)' });
    for (const [name, cfg] of Object.entries(shared)) {
      items.push({ type: 'item', scope: 'shared', profile: null, name, cfg, disabled: false });
    }

    // 프로필 섹션
    for (const p of profiles) {
      const { own, disabled } = pMap[p];
      items.push({ type: 'header', label: p });
      // 공통 MCP 중 비활성화된 항목
      for (const dName of disabled) {
        if (shared[dName]) {
          items.push({ type: 'item', scope: 'shared-disabled', profile: p, name: dName, cfg: shared[dName], disabled: true });
        }
      }
      // 프로필 전용 MCP
      for (const [name, cfg] of Object.entries(own)) {
        items.push({ type: 'item', scope: 'profile-own', profile: p, name, cfg, disabled: false });
      }
    }

    return items;
  }

  let items = buildItems();
  let cursor = nextSelectableIndex(items, 0, 1);
  let totalLines = 0; // 마지막 렌더의 줄 수

  function firstSelectableIndex() {
    return nextSelectableIndex(items, 0, 1);
  }

  function render(first = false) {
    const lines = [];
    lines.push('');
    lines.push(`  ${c('1', 'MCP Manager')}`);
    lines.push('');
    lines.push(`  ${c('2', '↑↓ 이동   Space 토글   a 추가   d 삭제   q 종료')}`);
    lines.push('');

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type === 'header') {
        lines.push(`  ${c('2', `${SYM_DASH} ${item.label} ${SYM_DASH}`)}`);
        continue;
      }

      const isSelected = i === cursor;
      const cursorSym  = isSelected ? c('36', SYM_CURSOR) : ' ';
      const bullet     = item.disabled ? c('90', SYM_BULLET_OFF) : c('32', SYM_BULLET_ON);
      const nameStr    = isSelected ? c('1', item.name) : item.name;
      const type       = item.cfg.type ?? (item.cfg.command ? 'stdio' : 'http');
      const target     = item.disabled
        ? c('90', `(disabled for this profile)`)
        : c('2', `${type}  ${item.cfg.url ?? item.cfg.command ?? ''}`);

      lines.push(`  ${cursorSym} ${bullet} ${nameStr}  ${target}`);
    }
    lines.push('');

    totalLines = lines.length;

    if (!first) {
      err.write(UP(totalLines));
    }
    for (const l of lines) {
      err.write(`${CLR}${l}\n`);
    }
  }

  // 초기 렌더
  render(true);

  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.setEncoding('utf8');

  const onData = async (key) => {
    process.stdin.removeListener('data', onData);
    process.stdin.pause();

    if (key === '\x1b[A') {
      // 위
      cursor = nextSelectableIndex(items, cursor, -1);
      render();
      resume();
    } else if (key === '\x1b[B') {
      // 아래
      cursor = nextSelectableIndex(items, cursor, 1);
      render();
      resume();
    } else if (key === ' ') {
      // 토글
      process.stdin.setRawMode(false);
      await handleToggle(items[cursor]);
      // 데이터 갱신
      items = buildItems();
      cursor = clampCursor(items, cursor);
      render();
      resume();
    } else if (key === 'a' || key === 'A') {
      // 추가
      process.stdin.setRawMode(false);
      clearTui();
      await addFlow(profiles);
      items = buildItems();
      cursor = firstSelectableIndex();
      render(true);
      resume();
    } else if (key === 'd' || key === 'D') {
      // 삭제
      process.stdin.setRawMode(false);
      await handleDelete(items[cursor]);
      items = buildItems();
      cursor = clampCursor(items, cursor);
      render();
      resume();
    } else if (key === 'q' || key === 'Q' || key === '\x03') {
      // 종료
      process.stdin.setRawMode(false);
      process.stdin.pause();
      clearTui();
      process.stdout.write('\n');
      return;
    } else {
      resume();
    }
  };

  function resume() {
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.on('data', onData);
  }

  function clearTui() {
    err.write(UP(totalLines) + CLRD);
  }

  process.stdin.on('data', onData);
}

function nextSelectableIndex(items, from, dir) {
  const len = items.length;
  let idx = from;
  for (let i = 0; i < len; i++) {
    idx = (idx + dir + len) % len;
    if (items[idx].type === 'item') return idx;
  }
  return from;
}

function clampCursor(items, cursor) {
  if (cursor < items.length && items[cursor]?.type === 'item') return cursor;
  return nextSelectableIndex(items, Math.min(cursor, items.length - 1), 1);
}

// ── 토글 처리 ────────────────────────────────────────────────────────────────

async function handleToggle(item) {
  if (!item) return;

  console.log();

  if (item.scope === 'shared') {
    // 공통 MCP → 어느 프로필에서 비활성화?
    const profiles = listProfiles();
    const profileChoice = await prompt.select(
      `"${item.name}"을 어느 프로필에서 비활성화할까요?`,
      profiles.map(p => ({ label: p, value: p })),
    );
    const disabled = readDisabledMcps(profileChoice);
    if (!disabled.includes(item.name)) {
      writeDisabledMcps(profileChoice, [...disabled, item.name]);
      success(`"${item.name}"을 ${profileChoice} 프로필에서 비활성화했습니다`);
    }
  } else if (item.scope === 'shared-disabled') {
    // 비활성화된 공통 MCP → 재활성화
    const disabled = readDisabledMcps(item.profile);
    writeDisabledMcps(item.profile, disabled.filter(n => n !== item.name));
    success(`"${item.name}"을 ${item.profile} 프로필에서 재활성화했습니다`);
  } else if (item.scope === 'profile-own') {
    // 프로필 전용 → 삭제 confirm
    const ok = await prompt.confirm(`"${item.name}"을 ${item.profile} 프로필에서 제거할까요?`, false);
    if (ok) {
      const localPath = profileLocalPath(item.profile);
      const servers = readMcpServers(localPath);
      delete servers[item.name];
      writeMcpServers(localPath, servers);
      success(`"${item.name}"을 ${item.profile} 프로필에서 제거했습니다`);
    }
  }
}

// ── 삭제 처리 ────────────────────────────────────────────────────────────────

async function handleDelete(item) {
  if (!item) return;
  console.log();

  if (item.scope === 'shared') {
    // shared + 프로필 양쪽에 같은 이름이 없으므로 shared에서 바로 제거
    const ok = await prompt.confirm(`"${item.name}"을 공통(Shared)에서 제거할까요?`, false);
    if (ok) {
      const sharedPath = sharedSettingsPath();
      const servers = readMcpServers(sharedPath);
      delete servers[item.name];
      writeMcpServers(sharedPath, servers);
      success(`"${item.name}"을 Shared에서 제거했습니다`);
    }
  } else if (item.scope === 'shared-disabled') {
    warn('"shared-disabled" MCP는 삭제가 아닌 enable로 재활성화하거나 shared에서 remove 하세요');
  } else if (item.scope === 'profile-own') {
    const ok = await prompt.confirm(`"${item.name}"을 ${item.profile} 프로필에서 제거할까요?`, false);
    if (ok) {
      const localPath = profileLocalPath(item.profile);
      const servers = readMcpServers(localPath);
      delete servers[item.name];
      writeMcpServers(localPath, servers);
      success(`"${item.name}"을 ${item.profile} 프로필에서 제거했습니다`);
    }
  }
}

// ── 추가 플로우 (인라인) ─────────────────────────────────────────────────────

async function addFlow(profiles) {
  console.log(`\n  ${c('1', '── Add MCP ──')}\n`);

  const name = await prompt.text('MCP 이름');
  if (!name) { warn('이름을 입력하지 않아 취소합니다'); return; }

  const scopeChoices = [
    { label: 'Shared (모든 프로필)', value: '__shared__' },
    ...profiles.map(p => ({ label: `Profile-specific → ${p}`, value: p })),
  ];
  const scope = await prompt.select('적용 범위', scopeChoices);

  const typeChoice = await prompt.select('MCP 타입', [
    { label: 'HTTP (remote URL)', value: 'http' },
    { label: 'stdio (local command)', value: 'stdio' },
  ]);

  let mcpConfig;
  if (typeChoice === 'http') {
    const url = await prompt.text('URL');
    if (!url) { warn('URL을 입력하지 않아 취소합니다'); return; }
    mcpConfig = { type: 'http', url };
  } else {
    const command = await prompt.text('실행 명령어');
    if (!command) { warn('명령어를 입력하지 않아 취소합니다'); return; }
    const argsStr = await prompt.text('인수 (공백 구분, 없으면 Enter)', '');
    const cmdArgs = argsStr ? argsStr.split(' ').filter(Boolean) : undefined;
    mcpConfig = { command, ...(cmdArgs?.length ? { args: cmdArgs } : {}) };
  }

  const isShared = scope === '__shared__';
  const targetPath = isShared ? sharedSettingsPath() : profileLocalPath(scope);
  const servers = readMcpServers(targetPath);

  if (servers[name]) {
    const overwrite = await prompt.confirm(`"${name}"이 이미 존재합니다. 덮어쓸까요?`, false);
    if (!overwrite) { info('취소했습니다'); return; }
  }

  servers[name] = mcpConfig;
  writeMcpServers(targetPath, servers);

  const location = isShared ? 'Shared' : `${scope} 프로필`;
  success(`"${name}"을 ${location}에 추가했습니다`);

  if (typeChoice === 'http') {
    warn('HTTP MCP는 claude 실행 후 /mcp에서 OAuth 인증이 필요합니다');
  }
  console.log();
}

// ── 서브커맨드: add ──────────────────────────────────────────────────────────

async function add(argv) {
  const { positionals, values } = parseArgs({
    args: argv,
    allowPositionals: true,
    strict: false,
    options: {
      shared:   { type: 'boolean', default: false },
      profile:  { type: 'string' },
      type:     { type: 'string', default: 'stdio' },
      url:      { type: 'string' },
      command:  { type: 'string' },
      args:     { type: 'string', multiple: true },
    },
  });

  const [name] = positionals;
  if (!name) { error('MCP 이름이 필요합니다'); process.exit(1); }

  validateScope(values);

  let mcpConfig;
  if (values.type === 'http') {
    if (!values.url) { error('--url 옵션이 필요합니다'); process.exit(1); }
    mcpConfig = { type: 'http', url: values.url };
  } else {
    if (!values.command) { error('--command 옵션이 필요합니다'); process.exit(1); }
    mcpConfig = {
      command: values.command,
      ...(values.args?.length ? { args: values.args } : {}),
    };
  }

  const isShared = values.shared;
  const targetPath = isShared ? sharedSettingsPath() : profileLocalPath(values.profile);
  const servers = readMcpServers(targetPath);

  if (servers[name]) {
    error(`"${name}"이 이미 존재합니다. 제거 후 다시 추가하세요`);
    process.exit(1);
  }

  servers[name] = mcpConfig;
  writeMcpServers(targetPath, servers);

  const location = isShared ? 'Shared' : `${values.profile} 프로필`;
  success(`"${name}"을 ${location}에 추가했습니다`);
  if (values.type === 'http') {
    warn('HTTP MCP는 claude 실행 후 /mcp에서 OAuth 인증이 필요합니다');
  }
}

// ── 서브커맨드: remove ───────────────────────────────────────────────────────

async function remove(argv) {
  const { positionals, values } = parseArgs({
    args: argv,
    allowPositionals: true,
    strict: false,
    options: {
      shared:  { type: 'boolean', default: false },
      profile: { type: 'string' },
    },
  });

  const [name] = positionals;
  if (!name) { error('MCP 이름이 필요합니다'); process.exit(1); }

  validateScope(values);

  const isShared = values.shared;
  const targetPath = isShared ? sharedSettingsPath() : profileLocalPath(values.profile);
  const servers = readMcpServers(targetPath);

  if (!servers[name]) {
    error(`"${name}"을 찾을 수 없습니다`);
    process.exit(1);
  }

  delete servers[name];
  writeMcpServers(targetPath, servers);

  const location = isShared ? 'Shared' : `${values.profile} 프로필`;
  success(`"${name}"을 ${location}에서 제거했습니다`);
}

// ── 서브커맨드: disable ──────────────────────────────────────────────────────

async function disable(argv) {
  const { positionals, values } = parseArgs({
    args: argv,
    allowPositionals: true,
    strict: false,
    options: { profile: { type: 'string' } },
  });

  const [name] = positionals;
  if (!name) { error('MCP 이름이 필요합니다'); process.exit(1); }
  if (!values.profile) { error('--profile 옵션이 필요합니다'); process.exit(1); }
  validateProfile(values.profile);

  // shared MCP인지 확인
  const sharedServers = readMcpServers(sharedSettingsPath());
  if (!sharedServers[name]) {
    error(`"${name}"은 Shared MCP가 아닙니다. profile-specific MCP는 remove를 사용하세요`);
    process.exit(1);
  }

  const disabled = readDisabledMcps(values.profile);
  if (disabled.includes(name)) {
    warn(`"${name}"은 ${values.profile}에서 이미 비활성화되어 있습니다`);
    return;
  }

  writeDisabledMcps(values.profile, [...disabled, name]);
  success(`"${name}"을 ${values.profile} 프로필에서 비활성화했습니다`);
}

// ── 서브커맨드: enable ───────────────────────────────────────────────────────

async function enable(argv) {
  const { positionals, values } = parseArgs({
    args: argv,
    allowPositionals: true,
    strict: false,
    options: { profile: { type: 'string' } },
  });

  const [name] = positionals;
  if (!name) { error('MCP 이름이 필요합니다'); process.exit(1); }
  if (!values.profile) { error('--profile 옵션이 필요합니다'); process.exit(1); }
  validateProfile(values.profile);

  const disabled = readDisabledMcps(values.profile);
  if (!disabled.includes(name)) {
    warn(`"${name}"은 ${values.profile}에서 비활성화되어 있지 않습니다`);
    return;
  }

  writeDisabledMcps(values.profile, disabled.filter(n => n !== name));
  success(`"${name}"을 ${values.profile} 프로필에서 재활성화했습니다`);
}

// ── 유효성 검사 헬퍼 ─────────────────────────────────────────────────────────

function validateScope(values) {
  if (!values.shared && !values.profile) {
    error('--shared 또는 --profile <name> 옵션이 필요합니다');
    process.exit(1);
  }
  if (values.profile) validateProfile(values.profile);
}

function validateProfile(name) {
  if (!profileExists(name)) {
    error(`프로필 "${name}"이 존재하지 않습니다`);
    process.exit(1);
  }
}
