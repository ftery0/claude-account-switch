import { join } from 'node:path';
import { PROFILES_DIR, SHARED_DIR } from '../../lib/constants.mjs';
import { readMeta } from '../../lib/config.mjs';
import { readJsonFile } from '../../lib/json-fs.mjs';
import { info, error } from '../../lib/ui.mjs';

export async function mcp(args = []) {
  if (args.length > 1 || (args[0] && args[0] !== 'list')) {
    error('MCP writes are no longer supported here. Use claude mcp add/remove and /mcp.');
    process.exitCode = 1;
    return;
  }
  info('Legacy MCP data is preserved. Register servers using claude mcp for the selected profile.');
  const files = [join(SHARED_DIR, 'settings.json'),
    ...readMeta().profiles.map(name => join(PROFILES_DIR, name, 'settings.local.json'))];
  for (const file of files) {
    const data = readJsonFile(file);
    const names = Object.keys(data.mcpServers ?? {});
    const disabled = Array.isArray(data.disabledMcpServers) ? data.disabledMcpServers : [];
    if (names.length || disabled.length) {
      console.log(`${file}: ${names.join(', ') || '(no servers)'}`);
      if (disabled.length) console.log(`  Legacy disabled: ${disabled.join(', ')}`);
    }
  }
  info('User servers belong in the profile .claude.json; project servers belong in .mcp.json.');
  info('See https://code.claude.com/docs/en/mcp');
}
