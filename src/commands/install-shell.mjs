import { success, info } from '../lib/ui.mjs';
import { color } from '../lib/ui.mjs';
import { installShellIntegration } from '../lib/shell.mjs';
import { IS_WINDOWS } from '../lib/constants.mjs';
import * as prompt from '../lib/prompt.mjs';

const SHELL_CHOICES_WINDOWS = [
  { label: 'PowerShell  (~\\Documents\\PowerShell\\profile.ps1)  [recommended]', value: 'powershell' },
  { label: 'bash        (~/.bashrc)   [Git Bash / WSL]', value: 'bash' },
  { label: 'zsh         (~/.zshrc)    [WSL]', value: 'zsh' },
  { label: 'fish        (~/.config/fish/config.fish)', value: 'fish' },
];

const SHELL_CHOICES_UNIX = [
  { label: 'zsh   (~/.zshrc)', value: 'zsh' },
  { label: 'bash  (~/.bashrc)', value: 'bash' },
  { label: 'fish  (~/.config/fish/config.fish)', value: 'fish' },
];

export async function installShell() {
  const shell = await prompt.select(
    'Which shell do you use?',
    IS_WINDOWS ? SHELL_CHOICES_WINDOWS : SHELL_CHOICES_UNIX,
  );

  installShellIntegration(shell);
  success('Shell integration installed');

  console.log();
  info(`Run ${color.cyan(activateCmd(shell))} or open a new terminal to activate`);
  console.log();
  console.log(`  Available commands:`);
  console.log(`    ${color.cyan('claude')}       - Run Claude with the active profile`);
  console.log(`    ${color.cyan('claude-pick')} - Interactive profile selector`);
  console.log(`    ${color.cyan('cpf <name>')}  - Quick switch to a profile`);
  console.log();
}

function activateCmd(shell) {
  switch (shell) {
    case 'powershell': return '. $PROFILE';
    case 'fish':       return 'source ~/.config/fish/config.fish';
    case 'zsh':        return 'source ~/.zshrc';
    default:           return 'source ~/.bashrc';
  }
}
