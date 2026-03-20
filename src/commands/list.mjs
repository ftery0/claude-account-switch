import { color, info } from '../lib/ui.mjs';
import { listProfiles, profileDir } from '../lib/profile.mjs';
import { getActiveProfile } from '../lib/config.mjs';

export async function list() {
  const profiles = listProfiles();

  if (profiles.length === 0) {
    info('No profiles configured. Run claude-account-switch init to set up.');
    return;
  }

  const active = getActiveProfile();

  console.log();
  console.log(`  ${color.bold('Profiles:')}`);
  console.log();
  for (const name of profiles) {
    const isActive = name === active;
    const marker = isActive ? color.green(' * ') : '   ';
    const label = isActive ? color.bold(name) : name;
    const dir = color.dim(profileDir(name));
    console.log(`  ${marker}${label}  ${dir}`);
  }
  console.log();
  console.log(`  Active: ${color.green(active || 'none')}`);
  console.log();
}
