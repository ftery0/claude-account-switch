import { color, success, error } from '../lib/ui.mjs';
import { createProfile, validateProfileName, profileExists } from '../lib/profile.mjs';
import { readMeta } from '../lib/config.mjs';

export async function add(name) {
  if (!name) {
    error('Usage: claude-switch add <name>');
    process.exit(1);
  }

  const err = validateProfileName(name);
  if (err) {
    error(err);
    process.exit(1);
  }

  if (profileExists(name)) {
    error(`Profile "${name}" already exists`);
    process.exit(1);
  }

  const meta = readMeta();
  createProfile(name, meta.shareSettings !== false);
  success(`Created profile: ${name}`);
  console.log(`  Run ${color.cyan(`claude-switch use ${name}`)} to activate it`);
}
