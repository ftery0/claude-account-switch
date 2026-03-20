import { error, success, warn } from '../lib/ui.mjs';
import { confirm } from '../lib/prompt.mjs';
import { removeProfile, profileExists } from '../lib/profile.mjs';
import { getActiveProfile } from '../lib/config.mjs';

export async function remove(name) {
  if (!name) {
    error('Usage: claude-switch remove <name>');
    process.exit(1);
  }

  if (!profileExists(name)) {
    error(`Profile "${name}" does not exist`);
    process.exit(1);
  }

  const active = getActiveProfile();
  if (name === active) {
    warn(`"${name}" is the currently active profile`);
  }

  const yes = await confirm(`Delete profile "${name}"? This cannot be undone`, false);
  if (!yes) {
    console.log('  Cancelled.');
    return;
  }

  removeProfile(name);
  success(`Removed profile: ${name}`);

  if (name === active) {
    const { getActiveProfile: getNew } = await import('../lib/config.mjs');
    const newActive = getNew();
    if (newActive) {
      success(`Active profile switched to: ${newActive}`);
    } else {
      warn('No profiles remaining. Run claude-switch init to set up again.');
    }
  }
}
