// Pure parts of the ICS fetcher. The runtime supplies `fetch`, the clock and the stored status.
// The ICS URL is a private secret: nothing here may log it or put it in an error message.

import type { Millis, ScheduleStatus } from '../contracts';
import { parseIcs } from './ics';

export const WINDOW_BEFORE_MS = 24 * 60 * 60 * 1000;
export const WINDOW_AFTER_MS = 7 * 24 * 60 * 60 * 1000;

export function scheduleWindow(now: Millis): { start: Millis; end: Millis } {
  return { start: now - WINDOW_BEFORE_MS, end: now + WINDOW_AFTER_MS };
}

export const EMPTY_STATUS: ScheduleStatus = { blocks: [], fetchedAt: null, error: null };

/** Only http(s) URLs; webcal:// is rewritten to https://. Returns null for anything else. */
export function normalizeIcsUrl(input: string): string | null {
  const trimmed = input.trim().replace(/^webcal:\/\//i, 'https://');
  try {
    const u = new URL(trimmed);
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.toString() : null;
  } catch {
    return null;
  }
}

export interface FetchDeps {
  fetchText: (url: string) => Promise<{ ok: boolean; status: number; text: () => Promise<string> }>;
  now: Millis;
  timeZone: string;
}

/**
 * Fetch and parse. On any failure the previous blocks are kept and only `error` changes.
 * No URL, no response body, no raw exception text ends up in the result.
 */
export async function refreshSchedule(
  url: string | null,
  previous: ScheduleStatus,
  deps: FetchDeps,
): Promise<ScheduleStatus> {
  if (!url) return { blocks: [], fetchedAt: null, error: null };
  const fail = (error: string): ScheduleStatus => ({ ...previous, error });
  let text: string;
  try {
    const res = await deps.fetchText(url);
    if (!res.ok) return fail(`Calendar fetch failed (HTTP ${res.status})`);
    text = await res.text();
  } catch {
    return fail("Couldn't reach the calendar (offline or bad URL)");
  }
  if (!/BEGIN:VCALENDAR/i.test(text)) return fail("That URL didn't return a calendar feed");
  const { start, end } = scheduleWindow(deps.now);
  try {
    const blocks = parseIcs(text, start, end, deps.timeZone);
    return { blocks, fetchedAt: deps.now, error: null };
  } catch {
    return fail("Couldn't read the calendar feed");
  }
}
