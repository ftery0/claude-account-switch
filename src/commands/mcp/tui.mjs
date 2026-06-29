import { color, success, warn, hasColor, supportsUnicode, sym, cursorUp, clearLine, clearDown } from '../../lib/ui.mjs';
import * as prompt from '../../lib/prompt.mjs';
import { listProfiles } from '../../lib/profile.mjs';
import {
  readMcpServers, writeMcpServers,
  readDisabledMcps, writeDisabledMcps,
  listAllMcps, sharedSettingsPath, profileLocalPath,
} from '../../lib/mcp.mjs';

const err = process.stderr;
const ansi = (code, s) => hasColor ? `\x1b[${code}m${s}\x1b[0m` : s;

export async function runTui() {
  if (!process.stdin.isTTY) {
    printTextList();
    return;
  }
  await renderTui();
}

// ── Non-interactive (CI / piped) ────────────────────────────────────────────

function printTextList() {
  const profiles = listProfiles();
  const { shared, profiles: pMap } = listAllMcps(profiles);

  console.log('\n  MCP Servers\n');
  console.log('  -- Shared --');
  for (const [name, cfg] of Object.entries(shared)) {
    console.log(`  ${sym.bulletOn} ${name}  ${formatTarget(cfg)}`);
  }
  for (const p of profiles) {
    const { own, disabled } = pMap[p];
    if (!Object.keys(own).length && !disabled.length) continue;
    console.log(`\n  -- ${p} --`);
    for (const name of disabled) {
      if (shared[name]) console.log(`  ${sym.bulletOff} ${name}  (disabled)`);
    }
    for (const [name, cfg] of Object.entries(own)) {
      console.log(`  ${sym.bulletOn} ${name}  ${formatTarget(cfg)}`);
    }
  }
  console.log();
}

function formatTarget(cfg) {
  const type = cfg.type ?? (cfg.command ? 'stdio' : 'http');
  return `${type}  ${cfg.url ?? cfg.command ?? ''}`;
}

// ── Interactive TUI ─────────────────────────────────────────────────────────

async function renderTui() {
  const profiles = listProfiles();
  let items = buildItems(profiles);
  let cursor = nextSelectableIndex(items, 0, 1);
  let totalLines = 0;

  function render(first = false) {
    const lines = [
      '',
      `  ${ansi('1', 'MCP Manager')}`,
      '',
      `  ${ansi('2', '↑↓ move   Space toggle   a add   d delete   q quit')}`,
      '',
    ];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type === 'header') {
        lines.push(`  ${ansi('2', `${sym.dash} ${item.label} ${sym.dash}`)}`);
        continue;
      }

      const isSelected = i === cursor;
      const cursorSym = isSelected ? ansi('36', sym.cursor) : ' ';
      const bullet = item.disabled ? ansi('90', sym.bulletOff) : ansi('32', sym.bulletOn);
      const nameStr = isSelected ? ansi('1', item.name) : item.name;
      const target = item.disabled
        ? ansi('90', '(disabled for this profile)')
        : ansi('2', formatTarget(item.cfg));
      lines.push(`  ${cursorSym} ${bullet} ${nameStr}  ${target}`);
    }
    lines.push('');

    if (!first && totalLines > 0) err.write(cursorUp(totalLines));
    for (const l of lines) err.write(`${clearLine}${l}\n`);
    totalLines = lines.length;
  }

  function refresh() {
    items = buildItems(profiles);
    cursor = clampCursor(items, cursor);
    render();
  }

  render(true);

  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.setEncoding('utf8');

  return new Promise((resolve) => {
    const onData = async (key) => {
      if (key === '\x1b[A') {
        cursor = nextSelectableIndex(items, cursor, -1);
        render();
      } else if (key === '\x1b[B') {
        cursor = nextSelectableIndex(items, cursor, 1);
        render();
      } else if (key === ' ') {
        pauseInput(onData);
        await handleToggle(items[cursor]);
        resumeInput(onData);
        refresh();
      } else if (key === 'a' || key === 'A') {
        pauseInput(onData);
        clearTui(totalLines);
        await addFlow(profiles);
        items = buildItems(profiles);
        cursor = nextSelectableIndex(items, 0, 1);
        totalLines = 0;
        resumeInput(onData);
        render(true);
      } else if (key === 'd' || key === 'D') {
        pauseInput(onData);
        await handleDelete(items[cursor]);
        resumeInput(onData);
        refresh();
      } else if (key === 'q' || key === 'Q' || key === '\x03') {
        process.stdin.setRawMode(false);
        process.stdin.pause();
        process.stdin.removeListener('data', onData);
        clearTui(totalLines);
        process.stdout.write('\n');
        resolve();
      }
    };

    process.stdin.on('data', onData);
  });
}

function pauseInput(onData) {
  process.stdin.setRawMode(false);
  process.stdin.pause();
  process.stdin.removeListener('data', onData);
}

function resumeInput(onData) {
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.on('data', onData);
}

function clearTui(totalLines) {
  if (totalLines > 0) err.write(cursorUp(totalLines) + clearDown);
}

function buildItems(profiles) {
  const { shared, profiles: pMap } = listAllMcps(profiles);
  const items = [];

  items.push({ type: 'header', label: 'Shared (all profiles)' });
  for (const [name, cfg] of Object.entries(shared)) {
    items.push({ type: 'item', scope: 'shared', profile: null, name, cfg, disabled: false });
  }

  for (const p of profiles) {
    const { own, disabled } = pMap[p];
    items.push({ type: 'header', label: p });
    for (const dName of disabled) {
      if (shared[dName]) {
        items.push({ type: 'item', scope: 'shared-disabled', profile: p, name: dName, cfg: shared[dName], disabled: true });
      }
    }
    for (const [name, cfg] of Object.entries(own)) {
      items.push({ type: 'item', scope: 'profile-own', profile: p, name, cfg, disabled: false });
    }
  }

  return items;
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

// ── Toggle / Delete / Add ───────────────────────────────────────────────────

async function handleToggle(item) {
  if (!item) return;
  console.log();

  if (item.scope === 'shared') {
    const profiles = listProfiles();
    const target = await prompt.select(
      `Which profile should "${item.name}" be disabled in?`,
      profiles.map(p => ({ label: p, value: p })),
    );
    const disabled = readDisabledMcps(target);
    if (!disabled.includes(item.name)) {
      writeDisabledMcps(target, [...disabled, item.name]);
      success(`Disabled "${item.name}" for profile ${target}`);
    }
  } else if (item.scope === 'shared-disabled') {
    const disabled = readDisabledMcps(item.profile);
    writeDisabledMcps(item.profile, disabled.filter(n => n !== item.name));
    success(`Re-enabled "${item.name}" for profile ${item.profile}`);
  } else if (item.scope === 'profile-own') {
    const ok = await prompt.confirm(`Remove "${item.name}" from profile ${item.profile}?`, false);
    if (ok) {
      const path = profileLocalPath(item.profile);
      const servers = readMcpServers(path);
      delete servers[item.name];
      writeMcpServers(path, servers);
      success(`Removed "${item.name}" from profile ${item.profile}`);
    }
  }
}

async function handleDelete(item) {
  if (!item) return;
  console.log();

  if (item.scope === 'shared') {
    const ok = await prompt.confirm(`Remove "${item.name}" from Shared?`, false);
    if (ok) {
      const path = sharedSettingsPath();
      const servers = readMcpServers(path);
      delete servers[item.name];
      writeMcpServers(path, servers);
      success(`Removed "${item.name}" from Shared`);
    }
  } else if (item.scope === 'shared-disabled') {
    warn('Use enable to re-activate or remove the server from Shared scope');
  } else if (item.scope === 'profile-own') {
    const ok = await prompt.confirm(`Remove "${item.name}" from profile ${item.profile}?`, false);
    if (ok) {
      const path = profileLocalPath(item.profile);
      const servers = readMcpServers(path);
      delete servers[item.name];
      writeMcpServers(path, servers);
      success(`Removed "${item.name}" from profile ${item.profile}`);
    }
  }
}

async function addFlow(profiles) {
  console.log(`\n  ${ansi('1', '── Add MCP ──')}\n`);

  const name = await prompt.text('MCP name');
  if (!name) { warn('Cancelled — no name entered'); return; }

  const scope = await prompt.select('Scope', [
    { label: 'Shared (all profiles)', value: '__shared__' },
    ...profiles.map(p => ({ label: `Profile-specific → ${p}`, value: p })),
  ]);

  const typeChoice = await prompt.select('MCP type', [
    { label: 'HTTP (remote URL)', value: 'http' },
    { label: 'stdio (local command)', value: 'stdio' },
  ]);

  let mcpConfig;
  if (typeChoice === 'http') {
    const url = await prompt.text('URL');
    if (!url) { warn('Cancelled — no URL entered'); return; }
    mcpConfig = { type: 'http', url };
  } else {
    const command = await prompt.text('Command');
    if (!command) { warn('Cancelled — no command entered'); return; }
    const argsStr = await prompt.text('Arguments (space-separated, or Enter to skip)', '');
    const cmdArgs = argsStr ? argsStr.split(' ').filter(Boolean) : undefined;
    mcpConfig = { command, ...(cmdArgs?.length ? { args: cmdArgs } : {}) };
  }

  const isShared = scope === '__shared__';
  const targetPath = isShared ? sharedSettingsPath() : profileLocalPath(scope);
  const servers = readMcpServers(targetPath);

  if (servers[name]) {
    const overwrite = await prompt.confirm(`"${name}" already exists. Overwrite?`, false);
    if (!overwrite) { warn('Cancelled'); return; }
  }

  servers[name] = mcpConfig;
  writeMcpServers(targetPath, servers);

  const location = isShared ? 'Shared' : `profile ${scope}`;
  success(`Added "${name}" to ${location}`);

  if (typeChoice === 'http') {
    warn('HTTP MCP requires OAuth via /mcp inside claude');
  }
  console.log();
}
