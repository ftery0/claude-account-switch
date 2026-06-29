import { parseArgs } from 'node:util';
import { success, warn, error } from '../../lib/ui.mjs';
import { profileExists } from '../../lib/profile.mjs';
import {
  readMcpServers, writeMcpServers,
  readDisabledMcps, writeDisabledMcps,
  sharedSettingsPath, profileLocalPath,
} from '../../lib/mcp.mjs';

// ── add ─────────────────────────────────────────────────────────────────────

export async function add(argv) {
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
  if (!name) { error('MCP name is required'); process.exit(1); }

  validateScope(values);

  let mcpConfig;
  if (values.type === 'http') {
    if (!values.url) { error('--url is required for HTTP MCP'); process.exit(1); }
    mcpConfig = { type: 'http', url: values.url };
  } else {
    if (!values.command) { error('--command is required for stdio MCP'); process.exit(1); }
    mcpConfig = {
      command: values.command,
      ...(values.args?.length ? { args: values.args } : {}),
    };
  }

  const isShared = values.shared;
  const targetPath = isShared ? sharedSettingsPath() : profileLocalPath(values.profile);
  const servers = readMcpServers(targetPath);

  if (servers[name]) {
    error(`"${name}" already exists. Remove it first to re-add`);
    process.exit(1);
  }

  servers[name] = mcpConfig;
  writeMcpServers(targetPath, servers);

  const location = isShared ? 'Shared' : `profile ${values.profile}`;
  success(`Added "${name}" to ${location}`);
  if (values.type === 'http') {
    warn('HTTP MCP requires OAuth via /mcp inside claude');
  }
}

// ── remove ──────────────────────────────────────────────────────────────────

export async function remove(argv) {
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
  if (!name) { error('MCP name is required'); process.exit(1); }

  validateScope(values);

  const isShared = values.shared;
  const targetPath = isShared ? sharedSettingsPath() : profileLocalPath(values.profile);
  const servers = readMcpServers(targetPath);

  if (!servers[name]) {
    error(`"${name}" not found`);
    process.exit(1);
  }

  delete servers[name];
  writeMcpServers(targetPath, servers);

  const location = isShared ? 'Shared' : `profile ${values.profile}`;
  success(`Removed "${name}" from ${location}`);
}

// ── disable ─────────────────────────────────────────────────────────────────

export async function disable(argv) {
  const { positionals, values } = parseArgs({
    args: argv,
    allowPositionals: true,
    strict: false,
    options: { profile: { type: 'string' } },
  });

  const [name] = positionals;
  if (!name) { error('MCP name is required'); process.exit(1); }
  if (!values.profile) { error('--profile is required'); process.exit(1); }
  validateProfile(values.profile);

  const shared = readMcpServers(sharedSettingsPath());
  if (!shared[name]) {
    error(`"${name}" is not a Shared MCP. Use remove for profile-specific MCPs`);
    process.exit(1);
  }

  const disabled = readDisabledMcps(values.profile);
  if (disabled.includes(name)) {
    warn(`"${name}" is already disabled in ${values.profile}`);
    return;
  }

  writeDisabledMcps(values.profile, [...disabled, name]);
  success(`Disabled "${name}" for profile ${values.profile}`);
}

// ── enable ──────────────────────────────────────────────────────────────────

export async function enable(argv) {
  const { positionals, values } = parseArgs({
    args: argv,
    allowPositionals: true,
    strict: false,
    options: { profile: { type: 'string' } },
  });

  const [name] = positionals;
  if (!name) { error('MCP name is required'); process.exit(1); }
  if (!values.profile) { error('--profile is required'); process.exit(1); }
  validateProfile(values.profile);

  const disabled = readDisabledMcps(values.profile);
  if (!disabled.includes(name)) {
    warn(`"${name}" is not disabled in ${values.profile}`);
    return;
  }

  writeDisabledMcps(values.profile, disabled.filter(n => n !== name));
  success(`Re-enabled "${name}" for profile ${values.profile}`);
}

// ── validators ──────────────────────────────────────────────────────────────

function validateScope(values) {
  if (!values.shared && !values.profile) {
    error('Either --shared or --profile <name> is required');
    process.exit(1);
  }
  if (values.profile) validateProfile(values.profile);
}

function validateProfile(name) {
  if (!profileExists(name)) {
    error(`Profile "${name}" does not exist`);
    process.exit(1);
  }
}
