import { parseArgs } from 'node:util';
import { computeUpdatePlan, compareSemver } from '../lib/updater.mjs';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { installedRuntimeDirectory, runSelfUpdate } from '../lib/self-update.mjs';
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
    const runtime = installedRuntimeDirectory();
    if (runtime) {
      self.installed = JSON.parse(readFileSync(join(runtime, 'package.json'), 'utf8')).version;
      self.hasUpdate = compareSemver(self.installed, self.latest) < 0;
    }
  } catch (err) {
    error(err.message);
    process.exitCode = 2;
    return;
  }
  console.log('Package                 Installed   Latest');
  console.log(`${self.pkg}   ${self.installed}       ${self.latest}`);
  if (!self.hasUpdate) info('This package is up to date.');
  else if (values.check) info('Run claude-account-switch update to install.');
  else {
    const result = await runSelfUpdate({ force: true, computePlan: async () => ({ self }) });
    if (result.action === 'updated') info(`Updated to ${result.version}. New launches use this version; active sessions keep their files.`);
    else if (result.reason === 'not-installed') info('Local runtime is not installed; no installation was run. Run: npx claude-account-switch@latest install-shell');
    else if (result.reason === 'busy') { warn('An update is already running.'); process.exitCode = 2; }
    else if (result.action === 'failed') { error(`Update failed; existing runtime retained: ${result.error}`); process.exitCode = 2; }
  }
  if (values.check && !values['claude-code']) process.exitCode = self.hasUpdate ? 1 : 0;
}
