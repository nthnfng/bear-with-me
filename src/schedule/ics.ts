// Workstream B: ICS Parser (test seam #2). Pure.
// Handles recurrence rules, exception dates, moved occurrences, time zones and all-day events.
// Put fixture .ics files in src/schedule/fixtures/.

import type { CalendarBlock, Millis } from '../contracts';

export function parseIcs(
  _icsText: string,
  _windowStart: Millis,
  _windowEnd: Millis,
  _timeZone: string,
): CalendarBlock[] {
  // TODO(WS-B)
  return [];
}
