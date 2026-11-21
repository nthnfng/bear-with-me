// ICS parser (test seam #2). Pure: no chrome APIs. Turns an iCalendar feed into CalendarBlocks
// inside [windowStart, windowEnd): recurrence rules, exception dates, moved occurrences,
// time zones and all-day events.

import ICAL from 'ical.js';
import type { CalendarBlock, Millis } from '../contracts';

const MAX_OCCURRENCES = 5000; // safety cap for runaway rules

/** Wall-clock time in an IANA zone -> epoch ms (handles DST by iterating the offset). */
export function zonedToMillis(
  y: number,
  mo: number,
  d: number,
  h: number,
  mi: number,
  s: number,
  timeZone: string,
): Millis {
  const asUtc = Date.UTC(y, mo - 1, d, h, mi, s);
  let guess = asUtc;
  for (let i = 0; i < 3; i++) {
    const next = asUtc - offsetAt(guess, timeZone);
    if (next === guess) break;
    guess = next;
  }
  return guess;
}

function offsetAt(ms: Millis, timeZone: string): number {
  let fmt: Intl.DateTimeFormat;
  try {
    fmt = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
    });
  } catch {
    return 0; // unknown zone: treat as UTC
  }
  const p: Record<string, number> = Object.fromEntries(
    fmt.formatToParts(ms).map((x) => [x.type, Number(x.value)]),
  );
  return (
    Date.UTC(p.year!, p.month! - 1, p.day!, p.hour!, p.minute!, p.second!) -
    Math.floor(ms / 1000) * 1000
  );
}

function toMillis(t: InstanceType<typeof ICAL.Time>, timeZone: string): Millis {
  const floating = t.isDate || !t.zone || t.zone.tzid === 'floating';
  if (floating) return zonedToMillis(t.year, t.month, t.day, t.hour, t.minute, t.second, timeZone);
  return t.toUnixTime() * 1000;
}

export function parseIcs(
  icsText: string,
  windowStart: Millis,
  windowEnd: Millis,
  timeZone: string,
): CalendarBlock[] {
  let root: InstanceType<typeof ICAL.Component>;
  try {
    root = new ICAL.Component(ICAL.parse(icsText));
  } catch {
    return [];
  }

  for (const vtz of root.getAllSubcomponents('vtimezone')) {
    try {
      ICAL.TimezoneService.register(vtz);
    } catch {
      /* bad VTIMEZONE: fall back to floating handling */
    }
  }

  // Group by UID: one master, any number of moved-occurrence overrides.
  const masters = new Map<string, InstanceType<typeof ICAL.Event>>();
  const overrides: InstanceType<typeof ICAL.Event>[] = [];
  const singles: InstanceType<typeof ICAL.Event>[] = [];
  for (const vevent of root.getAllSubcomponents('vevent')) {
    try {
      const ev = new ICAL.Event(vevent);
      if (vevent.hasProperty('recurrence-id')) overrides.push(ev);
      else if (ev.isRecurring()) masters.set(ev.uid, ev);
      else singles.push(ev);
    } catch {
      /* skip malformed event */
    }
  }
  for (const ov of overrides) {
    const master = masters.get(ov.uid);
    if (master) master.relateException(ov);
    else singles.push(ov); // override whose master isn't in the feed: show it as-is
  }

  const blocks: CalendarBlock[] = [];
  const add = (
    uid: string,
    title: string,
    start: InstanceType<typeof ICAL.Time>,
    end: InstanceType<typeof ICAL.Time> | null,
    status: string | null,
  ) => {
    if (status && status.toUpperCase() === 'CANCELLED') return;
    const allDay = start.isDate;
    const s = toMillis(start, timeZone);
    let e = end ? toMillis(end, timeZone) : allDay ? toMillis(start.clone(), timeZone) : s;
    if (!end && allDay) {
      const next = start.clone();
      next.day += 1;
      e = toMillis(next, timeZone);
    }
    if (e <= s) return;
    if (!(s < windowEnd && e > windowStart)) return;
    blocks.push({
      id: `${uid}@${s}`,
      title: title || '(no title)',
      start: s,
      end: e,
      allDay,
      source: 'ics',
    });
  };

  for (const ev of singles) {
    try {
      add(
        ev.uid,
        ev.summary,
        ev.startDate,
        ev.endDate,
        ev.component.getFirstPropertyValue('status') as string | null,
      );
    } catch {
      /* skip */
    }
  }

  for (const master of masters.values()) {
    try {
      const it = master.iterator();
      for (let i = 0; i < MAX_OCCURRENCES; i++) {
        const next = it.next();
        if (!next) break;
        if (toMillis(next, timeZone) >= windowEnd + 86_400_000) break; // moved ones can shift a day or so
        const d = master.getOccurrenceDetails(next);
        const item = d.item;
        add(
          master.uid,
          item.summary,
          d.startDate,
          d.endDate,
          item.component.getFirstPropertyValue('status') as string | null,
        );
      }
    } catch {
      /* skip a broken rule */
    }
  }

  return blocks.sort((a, b) => a.start - b.start);
}
