import { parseArgs } from 'node:util';
import { color, success, warn, error, info, sym } from '../lib/ui.mjs';
import * as prompt from '../lib/prompt.mjs';
import { installAllShells } from '../lib/shell.mjs';
import { CLAUDE_CODE_PKG, SELF_PKG, IS_WINDOWS } from '../lib/constants.mjs';
import {
  computeUpdatePlan, buildInstallCommand, runInstall,
  getInstalledBinMap, compareSemver,
} from '../lib/updater.mjs';

export async function update(argv = []) {
  const { values } = parseArgs({
    args: argv,
    allowPositionals: true,
    strict: false,
    options: {
      check:         { type: 'boolean', short: 'n', default: false },
      self:          { type: 'boolean', default: false },
      'claude-code': { type: 'boolean', default: false },
      yes:           { type: 'boolean', short: 'y', default: false },
    },
  });

  const onlySelf = values.self && !values['claude-code'];
  const onlyClaude = values['claude-code'] && !values.self;
  const checkSelf = !onlyClaude;
  const checkClaude = !onlySelf;

  process.stdout.write('\n  Checking for updates …\n\n');

  const plan = await computeUpdatePlan({ checkSelf, checkClaude });

  renderTable(plan, { checkSelf, checkClaude });

  for (const w of plan.warnings) warn(w);
  for (const e of plan.errors) error(e);

  if (plan.errors.length > 0 && !plan.self?.hasUpdate && !plan.claude?.hasUpdate) {
    process.exit(2);
  }

  if (values.check) {
    const anyUpdate = (plan.self?.hasUpdate) || (plan.claude?.hasUpdate);
    if (!anyUpdate) {
      console.log();
      info('All up to date.');
    } else {
      console.log();
      info(`Run ${color.cyan('claude-account-switch update')} to install.`);
    }
    process.exit(anyUpdate ? 1 : 0);
  }

  // Print self-update instruction (never executed)
  if (checkSelf && plan.self?.hasUpdate && !plan.self.isDev) {
    const { displayCmd } = buildInstallCommand(plan.self.pm, SELF_PKG);
    console.log();
    info(`To finish updating ${color.bold(SELF_PKG)}, run:`);
    console.log(`    ${color.cyan(displayCmd)}`);
  }

  // Claude Code install (the only thing we actually execute)
  if (checkClaude && plan.claude?.hasUpdate) {
    if (IS_WINDOWS && plan.errors.some(e => e.includes('claude.exe is locked'))) {
      console.log();
      error('Refusing to update Claude Code while it is running on Windows.');
      process.exit(3);
    }
    if (plan.claude.needsSudo) {
      const { displayCmd } = buildInstallCommand(plan.claude.pm, CLAUDE_CODE_PKG);
      console.log();
      warn(`Global install prefix needs sudo. Re-run:`);
      console.log(`    ${color.cyan(`sudo ${displayCmd}`)}`);
      process.exit(4);
    }

    const proceed = values.yes
      || !process.stdin.isTTY
      || await prompt.confirm(`Update ${CLAUDE_CODE_PKG} now?`, true);
    if (!proceed) {
      console.log();
      info('Cancelled.');
      process.exit(0);
    }

    const { cmd, args, displayCmd } = buildInstallCommand(plan.claude.pm, CLAUDE_CODE_PKG);
    console.log();
    info(`→ ${displayCmd}`);
    const code = await runInstall({ cmd, args });
    if (code !== 0) {
      console.log();
      error(`Install command exited with code ${code}.`);
      process.exit(code);
    }

    // Post-install verification
    const binAfter = getInstalledBinMap(CLAUDE_CODE_PKG);
    if (plan.claude.binBefore && binAfter && JSON.stringify(plan.claude.binBefore) !== JSON.stringify(binAfter)) {
      warn(`bin entry changed (${JSON.stringify(plan.claude.binBefore)} → ${JSON.stringify(binAfter)}). Shell templates may need an update.`);
    }

    success(`Updated ${CLAUDE_CODE_PKG}`);

    // Refresh shell integration with the latest templates
    const { newlyInstalled, alreadyInstalled } = installAllShells();
    const shells = [...newlyInstalled, ...alreadyInstalled];
    if (shells.length > 0) {
      success(`Shell integration refreshed (${shells.join(', ')})`);
    }

    console.log();
    info('Open a new terminal so the binary cache picks up the new version.');
  } else if (checkClaude && plan.claude && !plan.claude.hasUpdate && !plan.errors.length) {
    console.log();
    info(`${CLAUDE_CODE_PKG} is up to date.`);
  }

  console.log();
}

// ── Rendering ───────────────────────────────────────────────────────────────

function renderTable(plan, { checkSelf, checkClaude }) {
  const rows = [];
  if (checkSelf && plan.self) rows.push(rowFor(plan.self));
  if (checkClaude && plan.claude) rows.push(rowFor(plan.claude));
  if (rows.length === 0) return;

  const widths = {
    pkg: Math.max(...rows.map(r => r.pkg.length), 'Package'.length),
    installed: Math.max(...rows.map(r => r.installed.length), 'Installed'.length),
    latest: Math.max(...rows.map(r => r.latest.length), 'Latest'.length),
  };

  const header = `  ${pad('Package', widths.pkg)}   ${pad('Installed', widths.installed)}   ${pad('Latest', widths.latest)}   Action`;
  const sep = `  ${'─'.repeat(widths.pkg + widths.installed + widths.latest + 15)}`;
  console.log(color.bold(header));
  console.log(sep);
  for (const r of rows) {
    const line = `  ${pad(r.pkg, widths.pkg)}   ${pad(r.installed, widths.installed)}   ${pad(r.latest, widths.latest)}   ${r.action}`;
    console.log(line);
  }
  console.log();
}

function rowFor(entry) {
  const installed = entry.installed ?? '—';
  const latest = entry.latest ?? '—';
  let action;
  if (entry.isDev && entry.pkg === SELF_PKG) {
    action = color.yellow('skip (dev symlink)');
  } else if (!entry.latest) {
    action = color.red('error');
  } else if (!entry.installed) {
    action = color.cyan(`install (via ${entry.pm})`);
  } else if (entry.hasUpdate) {
    action = entry.pkg === SELF_PKG
      ? color.yellow('manual (see below)')
      : color.cyan(`update via ${entry.pm}`);
  } else {
    action = color.dim('up to date');
  }
  return { pkg: entry.pkg, installed, latest, action };
}

function pad(s, w) {
  return s + ' '.repeat(Math.max(0, w - s.length));
}
