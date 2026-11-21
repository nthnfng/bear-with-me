// Defaults. Every number here is a placeholder to tune in playtesting.
// The dev panel can override Tuning at runtime.

import type { BlocklistEntry, Tuning } from './domain';
import type { Settings } from './storage';

const SEC = 1000;
const MIN = 60 * SEC;

export const DEFAULT_TUNING: Tuning = {
  fatPerEat: 1,
  tierThresholds: { chubby: 5, chud: 12 },
  defaultSlackPassMs: 15 * MIN,
  snoozeMs: 5 * MIN,
  warningMs: 30 * SEC,
  reachMs: 8 * SEC,
  maxPushes: 5,
  chudFullMs: 15 * MIN, // three full Snoozes
  lockBackInMs: 10 * MIN,
  idleAfterSec: 5 * 60,
  freeGapMinMs: 20 * MIN,
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
  todoSources: [],
};

/** How often the background re-fetches the ICS feed. */
export const ICS_REFRESH_MINUTES = 5;
/** Safety-net alarm; precise deadlines use nextDeadline() while the worker is alive. */
export const TICK_ALARM_SECONDS = 30;
