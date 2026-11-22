// Defaults. Every number here is a placeholder to tune in playtesting.
// The dev panel can override Tuning at runtime.

import type { BlocklistEntry, Tuning } from './domain';
import type { Settings } from './storage';

const SEC = 1000;
const MIN = 60 * SEC;

export const DEFAULT_TUNING: Tuning = {
  fatPerEat: 1,
  defaultSlackPassMs: 15 * MIN,
  snoozeMs: 5 * MIN,
  warningMs: 15 * SEC,
  reachMs: 8 * SEC,
  maxPushes: 5,
  chudFullMs: 15 * MIN, // three full Snoozes
  lockBackInMs: 10 * MIN,
  idleAfterSec: 5 * 60,
  freeGapMinMs: 20 * MIN,
};

/** Fast timings for playtesting and the stage demo. The dev panel applies them via setTuning. */
export const DEMO_TUNING: Partial<Tuning> = {
  warningMs: 10 * SEC,
  reachMs: 6 * SEC,
  snoozeMs: 20 * SEC,
  chudFullMs: 60 * SEC,
  lockBackInMs: 60 * SEC,
  idleAfterSec: 15,
};

export const DEFAULT_BLOCKLIST: BlocklistEntry[] = [
  'youtube.com',
  'reddit.com',
  'x.com',
  'twitter.com',
  'instagram.com',
  'tiktok.com',
  'netflix.com',
  'twitch.tv',
  'facebook.com',
].map((domain) => ({ domain, enabled: true }));

export const DEFAULT_SETTINGS: Settings = {
  icsUrl: null,
};

/** Most unchecked Tasks the list holds. */
export const TASK_MAX = 15;
/** Adding a Task that takes the unchecked total past this asks "Are you sure?". */
export const TASK_WARN_TOTAL_MS = 8 * 60 * MIN;
/** Longest a Task's title may be. */
export const TASK_TITLE_MAX = 50;
/** Longest estimate (or typed extension) one Task may have: 8h 30m. */
export const TASK_ESTIMATE_MAX_MS = 8 * 60 * MIN + 30 * MIN;
/** "+15 min" on the "Done?" check (the default when no time is typed). */
export const TASK_EXTEND_MS = 15 * MIN;
/** Longest a typed extension may run. */
export const TASK_EXTEND_MAX_MS = TASK_ESTIMATE_MAX_MS;
export const TASK_ESTIMATE_PRESETS_MIN = [15, 30, 60, 120] as const;
export const TASK_DEFAULT_ESTIMATE_MS = 30 * MIN;

/** How often the background re-fetches the ICS feed. */
export const ICS_REFRESH_MINUTES = 5;
/** Safety-net alarm; precise deadlines use nextDeadline() while the worker is alive. */
export const TICK_ALARM_SECONDS = 30;
