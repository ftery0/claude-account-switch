import { existsSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { HOME, IS_WINDOWS } from './constants.mjs';

export const CLAUDE_SOURCE_MARKERS = [
  '.claude.json',
  '.credentials.json',
  'settings.json',
  'settings.local.json',
  'commands',
  'agents',
  'plugins',
  'projects',
  'plans',
];

export function rootStateFileForSource(sourceDir, home = HOME) {
  const defaultDir = join(home, '.claude');
  if (sourceDir === defaultDir || basename(sourceDir) === '.claude') {
    return join(dirname(sourceDir), '.claude.json');
  }
  return null;
}

export function describeClaudeSource(sourceDir, { home = HOME } = {}) {
  const markers = CLAUDE_SOURCE_MARKERS.filter(name => existsSync(join(sourceDir, name)));
  const rootStateFile = rootStateFileForSource(sourceDir, home);
  const hasRootState = Boolean(rootStateFile && existsSync(rootStateFile));

  return {
    path: sourceDir,
    markers,
    rootStateFile: hasRootState ? rootStateFile : null,
    hasData: markers.length > 0 || hasRootState,
    hasCredentials: markers.includes('.credentials.json') || markers.includes('.claude.json') || hasRootState,
  };
}

export function knownClaudeSources({ home = HOME } = {}) {
  const homeLabel = IS_WINDOWS ? '%USERPROFILE%' : '~';
  return [
    { path: join(home, '.claude'), label: `${homeLabel}/.claude` },
    { path: join(home, '.claude-work'), label: `${homeLabel}/.claude-work` },
    { path: join(home, '.claude-personal'), label: `${homeLabel}/.claude-personal` },
  ];
}

export function detectClaudeSources({ home = HOME } = {}) {
  return knownClaudeSources({ home })
    .map(source => ({ ...source, ...describeClaudeSource(source.path, { home }) }))
    .filter(source => source.hasData);
}

export function hasExistingClaudeSetup({ home = HOME } = {}) {
  return detectClaudeSources({ home }).length > 0;
}
