import { spawn } from 'node:child_process';
import { readMeta, writeMeta } from './config.mjs';
import { SELF_PKG } from './constants.mjs';
import { buildInstallCommand, computeUpdatePlan, runInstall } from './updater.mjs';
import { color, info, success, warn } from './ui.mjs';
import * as prompt from './prompt.mjs';

export const SELF_UPDATE_INTERVAL_MS = 24 * 60 * 60 * 1000;

function envFlag(value) {
  return ['1', 'true', 'yes', 'on'].includes(String(value ?? '').toLowerCase());
}

export function shouldCheckSelfUpdate(meta, now = Date.now(), intervalMs = SELF_UPDATE_INTERVAL_MS) {
  const last = Date.parse(meta?.lastSelfUpdateCheck ?? '');
  return !Number.isFinite(last) || now - last >= intervalMs;
}

export function markSelfUpdateChecked(meta, now = Date.now()) {
  return { ...meta, lastSelfUpdateCheck: new Date(now).toISOString() };
}

export function runShellRefresh() {
  return new Promise((resolve) => {
    const child = spawn('claude-account-switch', ['shell', 'refresh'], {
      stdio: 'inherit',
      shell: process.platform === 'win32',
    });
    child.on('close', code => resolve(code ?? 0));
    child.on('error', () => resolve(1));
  });
}

export async function maybePromptSelfUpdate({
  env = process.env,
  stdin = process.stdin,
  stdout = process.stdout,
  now = Date.now(),
  readMetaFn = readMeta,
  writeMetaFn = writeMeta,
  computePlan = computeUpdatePlan,
  confirmFn = prompt.confirm,
  runInstallFn = runInstall,
  runShellRefreshFn = runShellRefresh,
} = {}) {
  if (envFlag(env.CLAUDE_SWITCH_DISABLE_AUTO_UPDATE)) {
    return { action: 'skipped', reason: 'disabled' };
  }
  if (!stdin.isTTY || !stdout.isTTY) {
    return { action: 'skipped', reason: 'non-tty' };
  }

  const meta = readMetaFn();
  if (!shouldCheckSelfUpdate(meta, now)) {
    return { action: 'skipped', reason: 'recent' };
  }
  writeMetaFn(markSelfUpdateChecked(meta, now));

  let plan;
  try {
    plan = await computePlan({ checkSelf: true, checkClaude: false });
  } catch {
    return { action: 'skipped', reason: 'check-failed' };
  }

  const entry = plan.self;
  if (!entry?.hasUpdate || entry.isDev) {
    return { action: 'skipped', reason: entry?.isDev ? 'dev-install' : 'up-to-date' };
  }

  console.log();
  info(`${SELF_PKG} ${color.cyan(entry.latest)} is available (current ${entry.installed}).`);
  const proceed = await confirmFn(`Update ${SELF_PKG} now?`, false);
  if (!proceed) {
    return { action: 'skipped', reason: 'declined' };
  }

  const { cmd, args, displayCmd } = buildInstallCommand(entry.pm, SELF_PKG);
  if (entry.needsSudo) {
    warn('Global install prefix is not writable by the current user.');
    info(`Run ${color.cyan(`sudo ${displayCmd}`)} to update manually.`);
    return { action: 'skipped', reason: 'needs-sudo' };
  }

  console.log();
  info(`-> ${displayCmd}`);
  const code = await runInstallFn({ cmd, args });
  if (code !== 0) {
    warn(`Update command exited with code ${code}.`);
    return { action: 'failed', code };
  }

  success(`Updated ${SELF_PKG} to ${entry.latest}`);
  const refreshCode = await runShellRefreshFn();
  if (refreshCode === 0) {
    success('Shell integration refreshed.');
  } else {
    warn('Updated package, but shell integration refresh failed. Run claude-account-switch install-shell manually.');
  }
  info('Run claude again to use the new version.');
  return { action: 'updated', shouldExit: true };
}
