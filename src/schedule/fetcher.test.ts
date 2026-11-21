import { describe, expect, it } from 'vitest';
import type { ScheduleStatus } from '../contracts';
import { normalizeIcsUrl, refreshSchedule, scheduleWindow } from './fetcher';

const NOW = Date.parse('2025-01-15T12:00:00Z');
const ICS =
  'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:a\r\nDTSTART:20250115T140000Z\r\nDTEND:20250115T150000Z\r\nSUMMARY:Study\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n';
const prev: ScheduleStatus = {
  blocks: [{ id: 'old', title: 'Old', start: 1, end: 2, allDay: false, source: 'ics' }],
  fetchedAt: 5,
  error: null,
};
const ok = (text: string) => async () => ({ ok: true, status: 200, text: async () => text });
const deps = (fetchText: any) => ({ fetchText, now: NOW, timeZone: 'UTC' });

describe('refreshSchedule', () => {
  it('parses and stamps fetchedAt', async () => {
    const r = await refreshSchedule('https://x/secret', prev, deps(ok(ICS)));
    expect(r.error).toBeNull();
    expect(r.fetchedAt).toBe(NOW);
    expect(r.blocks.map((b) => b.title)).toEqual(['Study']);
  });
  it('keeps last good blocks on HTTP failure, without leaking the URL', async () => {
    const r = await refreshSchedule(
      'https://x/secret',
      prev,
      deps(async () => ({ ok: false, status: 404, text: async () => '' })),
    );
    expect(r.blocks).toEqual(prev.blocks);
    expect(r.fetchedAt).toBe(5);
    expect(r.error).toContain('404');
    expect(r.error).not.toContain('secret');
  });
  it('keeps last good blocks when the network throws', async () => {
    const r = await refreshSchedule(
      'https://x/secret',
      prev,
      deps(async () => {
        throw new Error('boom https://x/secret');
      }),
    );
    expect(r.blocks).toEqual(prev.blocks);
    expect(r.error).not.toContain('secret');
  });
  it('rejects non-calendar responses', async () => {
    const r = await refreshSchedule('https://x/s', prev, deps(ok('<html>')));
    expect(r.blocks).toEqual(prev.blocks);
    expect(r.error).toBeTruthy();
  });
  it('clears everything when the URL is removed', async () => {
    expect(await refreshSchedule(null, prev, deps(ok(ICS)))).toEqual({
      blocks: [],
      fetchedAt: null,
      error: null,
    });
  });
});

describe('helpers', () => {
  it('window is -1d to +7d', () => {
    const w = scheduleWindow(NOW);
    expect(NOW - w.start).toBe(86_400_000);
    expect(w.end - NOW).toBe(7 * 86_400_000);
  });
  it('normalises urls', () => {
    expect(normalizeIcsUrl(' webcal://a.com/x.ics ')).toBe('https://a.com/x.ics');
    expect(normalizeIcsUrl('javascript:alert(1)')).toBeNull();
    expect(normalizeIcsUrl('nope')).toBeNull();
  });
});
