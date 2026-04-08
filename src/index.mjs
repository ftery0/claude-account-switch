import { parseArgs } from 'node:util';
import { error, color, success } from './lib/ui.mjs';
import { installAllShells } from './lib/shell.mjs';

const COMMANDS = {
  init:            () => import('./commands/init.mjs').then(m => m.init()),
  add:             (name) => import('./commands/add.mjs').then(m => m.add(name)),
  remove:          (name) => import('./commands/remove.mjs').then(m => m.remove(name)),
  list:            () => import('./commands/list.mjs').then(m => m.list()),
  use:             (name) => import('./commands/use.mjs').then(m => m.use(name)),
  'install-shell': () => import('./commands/install-shell.mjs').then(m => m.installShell()),
  migrate:         (name) => import('./commands/migrate.mjs').then(m => m.migrate(name)),
  mcp:             (_, args) => import('./commands/mcp.mjs').then(m => m.mcp(args)),
};

function showHelp() {
  console.log(`
  ${color.bold('claude-account-switch')} — Multi-account manager for Claude Code

  ${color.bold('Usage:')}
    claude-account-switch <command> [options]

  ${color.bold('Commands:')}
    init              Interactive setup wizard
    add <name>        Create a new profile
    remove <name>     Remove a profile
    list              List all profiles
    use <name>        Switch active profile
    migrate [name]    Migrate existing ~/.claude data into a profile
    install-shell     Install shell integration
    mcp [sub]         Manage MCP servers interactively

  ${color.bold('Examples:')}
    npx claude-account-switch init
    npx claude-account-switch add staging
    npx claude-account-switch use work
    npx claude-account-switch migrate work
`);
}

export async function run(argv) {
  const { positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    strict: false,
  });

  const [command, ...args] = positionals;

  if (argv.includes('--version') || argv.includes('-v')) {
    const { readFileSync } = await import('node:fs');
    const { fileURLToPath } = await import('node:url');
    const { dirname, join } = await import('node:path');
    const __dirname = dirname(fileURLToPath(import.meta.url));
    const pkg = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf8'));
    console.log(pkg.version);
    return;
  }

  if (!command || command === 'help' || argv.includes('--help') || argv.includes('-h')) {
    showHelp();
    return;
  }

  const handler = COMMANDS[command];
  if (!handler) {
    error(`Unknown command: ${command}`);
    showHelp();
    process.exit(1);
  }

  // mcp 커맨드는 서브커맨드 플래그가 있으므로 raw argv (command 이후) 전달
  const rawSubArgs = argv.slice(argv.indexOf(command) + 1);

  try {
    await handler(args[0], command === 'mcp' ? rawSubArgs : args);
  } catch (err) {
    error(err.message);
    process.exit(1);
  }

  // Auto-detect new shells and install integration silently
  const { newlyInstalled } = installAllShells();
  if (newlyInstalled.length > 0) {
    console.log();
    success(`New shell detected — integration installed (${newlyInstalled.join(', ')})`);
    success('Open a new terminal to activate');
  }
}
