import { mkdirSync } from 'node:fs';
import { PROFILES_DIR } from '../lib/constants.mjs';
import { installAllShells } from '../lib/shell.mjs';
import { success, info } from '../lib/ui.mjs';

export async function installShell() {
  mkdirSync(PROFILES_DIR, { recursive: true });
  const { newlyInstalled, alreadyInstalled } = installAllShells();
  const shells = [...newlyInstalled, ...alreadyInstalled];
  success('Local shell runtime installed.');
  if (shells.length) success(`Shell integration ready (${shells.join(', ')})`);
  info('Open a new terminal. Use claude, cpf <name>, or claude-pick.');
}
