import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseIcs } from './ics';

const fx = (name: string) =>
  readFileSync(new URL(`./fixtures/${name}.ics`, import.meta.url), 'utf8');
const t = (iso: string) => Date.parse(iso);
const W_START = t('2025-01-06T00:00:00Z');
const W_END = t('2025-01-21T00:00:00Z');
const starts = (bs: { start: number }[]) => bs.map((b) => new Date(b.start).toISOString());

describe('parseIcs', () => {
  it('expands a recurring event inside the window', () => {
    const bs = parseIcs(fx('recurring'), W_START, W_END, 'UTC');
    expect(starts(bs)).toEqual([
      '2025-01-06T14:00:00.000Z',
      '2025-01-13T14:00:00.000Z',
      '2025-01-20T14:00:00.000Z',
    ]);
    expect(bs[0]).toMatchObject({ title: 'Weekly study', allDay: false, source: 'ics' });
    expect(bs[0]!.end - bs[0]!.start).toBe(3_600_000);
    expect(new Set(bs.map((b) => b.id)).size).toBe(3);
  });

  it('skips a cancelled occurrence (EXDATE)', () => {
    const bs = parseIcs(fx('exdate'), W_START, W_END, 'UTC');
    expect(starts(bs)).toEqual(['2025-01-06T14:00:00.000Z', '2025-01-20T14:00:00.000Z']);
  });

  it('uses the moved occurrence (RECURRENCE-ID)', () => {
    const bs = parseIcs(fx('moved'), W_START, W_END, 'UTC');
    expect(starts(bs)).toEqual([
      '2025-01-06T14:00:00.000Z',
      '2025-01-14T18:00:00.000Z',
      '2025-01-20T14:00:00.000Z',
    ]);
    expect(bs[1]!.title).toBe('Weekly study (moved)');
    expect(bs[1]!.end).toBe(t('2025-01-14T19:30:00Z'));
  });

  it('handles TZID with VTIMEZONE, UTC and floating times', () => {
    const bs = parseIcs(fx('timezones'), W_START, W_END, 'America/Vancouver');
    const by: Record<string, (typeof bs)[number]> = Object.fromEntries(bs.map((b) => [b.title, b]));
    expect(by['Toronto lecture']!.start).toBe(t('2025-01-15T14:00:00Z'));
    expect(by['Toronto lecture']!.end).toBe(t('2025-01-15T15:30:00Z'));
    expect(by['UTC meeting']!.start).toBe(t('2025-01-15T20:00:00Z'));
    // Floating = wall clock in the user's zone (Vancouver is UTC-8 in January).
    expect(by['Floating']!.start).toBe(t('2025-01-16T18:00:00Z'));
  });

  it('marks all-day events, spanning local midnight to midnight', () => {
    const bs = parseIcs(fx('allday'), W_START, W_END, 'America/Toronto');
    expect(bs).toHaveLength(1);
    expect(bs[0]).toMatchObject({
      allDay: true,
      start: t('2025-01-15T05:00:00Z'),
      end: t('2025-01-16T05:00:00Z'),
    });
  });

  it('excludes events outside the window and cancelled events, keeps edge overlaps', () => {
    const bs = parseIcs(fx('window'), t('2025-01-15T00:00:00Z'), t('2025-01-16T00:00:00Z'), 'UTC');
    expect(bs.map((b) => b.title)).toEqual(['Overlaps start']);
  });

  it('returns [] for garbage input rather than throwing', () => {
    expect(parseIcs('<html>nope</html>', W_START, W_END, 'UTC')).toEqual([]);
  });
});
