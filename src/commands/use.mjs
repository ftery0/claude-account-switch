import { success, error, info } from '../lib/ui.mjs';
import { profileExists } from '../lib/profile.mjs';
import { setActiveProfile, getActiveProfile } from '../lib/config.mjs';

export async function use(name) {
  if (!name) {
    error('Usage: claude-account-switch use <name>');
    process.exit(1);
  }

  if (!profileExists(name)) {
    error(`Profile "${name}" does not exist`);
    process.exit(1);
  }

  const current = getActiveProfile();
  if (current === name) {
    info(`"${name}" is already the active profile`);
    return;
  }

  setActiveProfile(name);
  success(`Switched to profile: ${name}`);
}
