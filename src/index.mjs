import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { error, color } from './lib/ui.mjs';

const pkg = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'package.json'), 'utf8'));

const COMMANDS = {
  init: () => import('./commands/init.mjs').then(m => m.init()),
  add: name => import('./commands/add.mjs').then(m => m.add(name)),
  remove: name => import('./commands/remove.mjs').then(m => m.remove(name)),
  list: () => import('./commands/list.mjs').then(m => m.list()),
  use: name => import('./commands/use.mjs').then(m => m.use(name)),
  'install-shell': () => import('./commands/install-shell.mjs').then(m => m.installShell()),
  migrate: (name, args) => import('./commands/migrate.mjs').then(m => m.migrate(name, args)),
  mcp: (_, args) => import('./commands/mcp/index.mjs').then(m => m.mcp(args)),
  update: (_, args) => import('./commands/update.mjs').then(m => m.update(args)),
  shell: (_, args) => import('./commands/shell.mjs').then(m => m.shell(args)),
};

function showHelp() {
  console.log(`
  ${color.bold('claude-account-switch')} — Profile switching for Claude Code

  Usage: claude-account-switch <command> [options]

  Commands:
  init              Set up profiles; show existing setup on repeated runs
  add <name>        Create a profile
  remove <name>     Remove a profile after confirmation
  list              List profiles
  use <name>        Change the active profile
  migrate <name>    Import existing settings (--from <path>)
  install-shell     Install or repair shell integration
  update [--check]  Check this package and show the update command
  mcp [list]        Show legacy MCP entries and migration guidance

  Examples:
    npx claude-account-switch init
    npx claude-account-switch migrate work --from ~/.claude
    cpf personal
`);
}

export async function run(argv) {
  const [command, ...args] = argv;
  if (!command || ['help', '--help', '-h'].includes(command)) {
    showHelp();
    return;
  }
  if (['--version', '-v'].includes(command)) {
    console.log(pkg.version);
    return;
  }
  const handler = COMMANDS[command];
  if (!handler) {
    error(`Unknown command: ${command}`);
    showHelp();
    process.exitCode = 1;
    return;
  }
  try {
    await handler(args[0], args);
  } catch (err) {
    error(err.message);
    process.exitCode = 1;
  }
}
