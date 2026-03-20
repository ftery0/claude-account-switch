import { success, error, info, warn } from '../lib/ui.mjs';
import { color } from '../lib/ui.mjs';
import { installShellIntegration } from '../lib/shell.mjs';
import * as prompt from '../lib/prompt.mjs';

export async function installShell() {
  const shell = await prompt.select(
    'Which shell do you use?',
    [
      { label: 'zsh (~/.zshrc)', value: 'zsh' },
      { label: 'bash (~/.bashrc)', value: 'bash' },
    ],
  );

  installShellIntegration(shell);
  success('Shell integration installed');

  const rcFile = shell === 'zsh' ? '~/.zshrc' : '~/.bashrc';
  console.log();
  info(`Run ${color.cyan(`source ${rcFile}`)} or open a new terminal to activate`);
  console.log();
  console.log(`  Available commands:`);
  console.log(`    ${color.cyan('claude')}       - Run Claude with the active profile`);
  console.log(`    ${color.cyan('claude-pick')} - Interactive profile selector`);
  console.log(`    ${color.cyan('cpf <name>')}  - Quick switch to a profile`);
  console.log();
}
