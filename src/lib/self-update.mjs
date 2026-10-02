import { readMeta, writeMeta } from './config.mjs';
import { computeUpdatePlan } from './updater.mjs';

const SELF_UPDATE_INTERVAL_MS = 24 * 60 * 60 * 1000;

export function shouldCheckSelfUpdate(meta, now = Date.now()) {
  const last = Date.parse(meta.lastSelfUpdateCheck ?? '');
  return !Number.isFinite(last) || now - last >= SELF_UPDATE_INTERVAL_MS;
}

export function markSelfUpdateChecked(meta, now = Date.now()) {
  return { ...meta, lastSelfUpdateCheck: new Date(now).toISOString() };
}

export async function maybePromptSelfUpdate({
  env = process.env,
  stdin = process.stdin,
  stdout = process.stderr,
  now = Date.now(),
  readMetaFn = readMeta,
  writeMetaFn = writeMeta,
  computePlan = computeUpdatePlan,
} = {}) {
  if (env.CLAUDE_SWITCH_CHECK_UPDATES !== '1' || env.CLAUDE_SWITCH_DISABLE_AUTO_UPDATE === '1') {
    return { action: 'skipped', reason: 'disabled' };
  }
  if (!stdin.isTTY || !stdout.isTTY) return { action: 'skipped', reason: 'non-tty' };
  const meta = readMetaFn();
  if (!shouldCheckSelfUpdate(meta, now)) return { action: 'skipped', reason: 'recent' };
  try {
    const { self } = await computePlan();
    writeMetaFn(markSelfUpdateChecked(meta, now));
    if (!self.hasUpdate) return { action: 'skipped', reason: 'up-to-date' };
    stdout.write(`claude-account-switch ${self.latest} is available. Run: npx claude-account-switch@latest install-shell\n`);
    return { action: 'notified' };
  } catch {
    return { action: 'skipped', reason: 'check-failed' };
  }
}
