import { color, error } from '../../lib/ui.mjs';
import { runTui } from './tui.mjs';
import { add, remove, disable, enable } from './cli.mjs';

const SUBCOMMANDS = { add, remove, disable, enable };

export async function mcp(argv = []) {
  const sub = argv[0];

  if (!sub || sub === 'list') {
    return runTui();
  }

  const handler = SUBCOMMANDS[sub];
  if (!handler) {
    error(`Unknown mcp subcommand: ${sub}`);
    printMcpHelp();
    process.exit(1);
  }

  await handler(argv.slice(1));
}

function printMcpHelp() {
  console.log(`
  ${color.bold('mcp')} — Manage MCP servers

  ${color.bold('Usage:')}
    claude-account-switch mcp [subcommand] [options]

  ${color.bold('Subcommands:')}
    (none)                  Launch interactive TUI
    list                    Launch interactive TUI
    add <name> [options]    Add an MCP server
    remove <name> [options] Remove an MCP server
    disable <name>          Disable a shared MCP for a specific profile
    enable <name>           Re-enable a previously disabled shared MCP

  ${color.bold('Add Options:')}
    --shared                Add to all profiles (shared)
    --profile <name>        Add to a specific profile only
    --type http|stdio       MCP type (default: stdio)
    --url <url>             HTTP MCP URL
    --command <cmd>         stdio MCP command
    --args <arg>...         stdio MCP arguments

  ${color.bold('Remove Options:')}
    --shared                Remove from shared scope
    --profile <name>        Remove from a specific profile

  ${color.bold('Disable/Enable Options:')}
    --profile <name>        Target profile (required)
`);
}
