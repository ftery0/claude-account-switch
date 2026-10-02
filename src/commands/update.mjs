import { parseArgs } from 'node:util';
import { computeUpdatePlan } from '../lib/updater.mjs';
import { info, warn, error } from '../lib/ui.mjs';

export async function update(args = []) {
  const { values, positionals } = parseArgs({ args, allowPositionals: true, options: {
    check: { type: 'boolean', short: 'n' },
    self: { type: 'boolean' },
    'claude-code': { type: 'boolean' },
    yes: { type: 'boolean', short: 'y' },
  } });
  if (positionals.length) throw new Error('Usage: update [--check] [--self]');
  if (values['claude-code']) {
    info('Claude Code manages its own updates. Run claude update (or your package manager).');
    info('See https://code.claude.com/docs/en/setup');
    if (values.check) {
      warn('Claude Code update status was not checked.');
      process.exitCode = 2;
    }
    if (!values.self) return;
  }
  let self;
  try {
    ({ self } = await computeUpdatePlan());
  } catch (err) {
    error(err.message);
    process.exitCode = 2;
    return;
  }
  console.log('Package                 Installed   Latest');
  console.log(`${self.pkg}   ${self.installed}       ${self.latest}`);
  if (self.hasUpdate) info('Update shell integration: npx claude-account-switch@latest install-shell');
  else info('This package is up to date.');
  if (values.yes) info('Updates require the explicit install-shell command; no installation was run.');
  if (values.check && !values['claude-code']) process.exitCode = self.hasUpdate ? 1 : 0;
}
