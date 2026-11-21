import { describe, expect, it } from 'vitest';
import type { CalendarBlock } from '../contracts';
import { currentBlock, isRestricted, resolveMode } from './helpers';
import { initialState } from '.';

const block = (o: Partial<CalendarBlock> = {}): CalendarBlock => ({
  id: 'b',
  title: 'ETF prep',
  start: 1000,
  end: 2000,
  allDay: false,
  source: 'ics',
  ...o,
});

describe('initialState', () => {
  it('is calm and empty', () => {
    const s = initialState();
    expect(s).toMatchObject({ modeOverride: 'auto', phase: 'clear', fatness: 0, cave: false });
    expect(s.openTabs).toEqual({});
    expect(s.activeTabId).toBeNull();
  });
});

describe('resolveMode', () => {
  const s = { ...initialState(), blocks: [block()] };
  it('auto follows a covering block', () => {
    expect(resolveMode(s, 1500)).toBe('lockIn');
    expect(resolveMode(s, 999)).toBe('chill');
    expect(resolveMode(s, 2000)).toBe('chill');
  });
  it('ignores all-day events', () => {
    expect(resolveMode({ ...s, blocks: [block({ allDay: true })] }, 1500)).toBe('chill');
    expect(currentBlock({ blocks: [block({ allDay: true })] }, 1500)).toBeNull();
  });
  it('overrides force the mode', () => {
    expect(resolveMode({ ...s, modeOverride: 'chill' }, 1500)).toBe('chill');
    expect(resolveMode({ ...s, modeOverride: 'lockIn' }, 0)).toBe('lockIn');
  });
});

describe('isRestricted', () => {
  const bl = [
    { domain: 'youtube.com', enabled: true },
    { domain: 'reddit.com', enabled: false },
  ];
  it('matches host and subdomains', () => {
    expect(isRestricted('https://youtube.com/watch', bl)).toBe(true);
    expect(isRestricted('https://www.youtube.com/watch?v=1', bl)).toBe(true);
    expect(isRestricted('https://m.youtube.com/', bl)).toBe(true);
  });
  it('does not match lookalikes', () => {
    expect(isRestricted('https://notyoutube.com/', bl)).toBe(false);
    expect(isRestricted('https://youtube.com.evil.io/', bl)).toBe(false);
  });
  it('ignores disabled entries', () => {
    expect(isRestricted('https://reddit.com/', bl)).toBe(false);
  });
  it('never matches non-http or junk URLs', () => {
    expect(isRestricted('chrome://youtube.com/', bl)).toBe(false);
    expect(isRestricted('about:blank', bl)).toBe(false);
    expect(isRestricted('', bl)).toBe(false);
    expect(isRestricted(undefined, bl)).toBe(false);
  });
});
