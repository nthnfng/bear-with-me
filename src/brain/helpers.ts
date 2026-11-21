// Pure helpers for the brain: mode resolution and Restricted-site matching.

import type { BarryState, BlocklistEntry, CalendarBlock, Millis, Mode } from '../contracts';

/** The non-all-day Calendar block covering `now` (earliest start wins), or null. */
export function currentBlock(state: Pick<BarryState, 'blocks'>, now: Millis): CalendarBlock | null {
  const covering = state.blocks
    .filter((b) => !b.allDay && b.start <= now && now < b.end)
    .sort((a, b) => a.start - b.start);
  return covering[0] ?? null;
}

export function resolveMode(state: Pick<BarryState, 'modeOverride' | 'blocks'>, now: Millis): Mode {
  if (state.modeOverride !== 'auto') return state.modeOverride;
  return currentBlock(state, now) ? 'lockIn' : 'chill';
}

/** True if the URL's host equals, or is a subdomain of, an enabled blocklist entry. */
export function isRestricted(url: string | undefined, blocklist: BlocklistEntry[]): boolean {
  if (!url) return false;
  let host: string;
  try {
    const u = new URL(url);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
    host = u.hostname.toLowerCase().replace(/\.$/, '');
  } catch {
    return false;
  }
  return blocklist.some((e) => {
    if (!e.enabled) return false;
    const d = e.domain.toLowerCase();
    return host === d || host.endsWith('.' + d);
  });
}
