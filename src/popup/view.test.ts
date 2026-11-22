import { describe, expect, it } from 'vitest';
import { DEFAULT_TUNING, DEMO_TUNING } from '../contracts';
import type { BarryState, CalendarBlock } from '../contracts';
import {
  speedPreset,
  countdownFor,
  formatCountdown,
  headlineFor,
  nextBlock,
  popupView,
  secondsToMs,
  slackPassStatus,
  slackChangePreview,
  withStateDefaults,
} from './view';
import { brain } from '../brain';

const block = (id: string, start: number, end: number, allDay = false): CalendarBlock => ({
  id,
  title: id,
  start,
  end,
  allDay,
  source: 'dev',
});

const base = (over: Partial<BarryState> = {}): BarryState =>
  ({
    modeOverride: 'auto',
    blocks: [],
    phase: 'clear',
    slackPassEndsAt: null,
    snoozeEndsAt: null,
    warningEndsAt: null,
    reachStartedAt: null,
    pushes: 0,
    tuning: DEFAULT_TUNING,
    ...over,
  }) as BarryState;

describe('popup view', () => {
  it('picks the next timed block', () => {
    const s = base({
      blocks: [block('a', 500, 600), block('b', 200, 300), block('c', 100, 900, true)],
    });
    expect(nextBlock(s, 100)?.id).toBe('b');
    expect(nextBlock(s, 1000)).toBeNull();
  });

  it('chooses the countdown per phase', () => {
    expect(countdownFor(base(), 0)).toBeNull();
    expect(countdownFor(base({ phase: 'slackPass', slackPassEndsAt: 9 }), 0)?.target).toBe(9);
    expect(countdownFor(base({ phase: 'warning', warningEndsAt: 7 }), 0)?.label).toBe('Reach in');
    expect(countdownFor(base({ phase: 'reaching', reachStartedAt: 1000 }), 0)?.target).toBe(
      1000 + DEFAULT_TUNING.reachMs,
    );
  });

  it('hides the Snooze countdown until Barry sits tired, then says to tap him', () => {
    const snooze = base({
      modeOverride: 'lockIn',
      phase: 'snoozing',
      snoozeStartedAt: 0,
      snoozeEndsAt: 5 * 60_000,
    });
    // Knocked down / getting up: no time yet.
    expect(countdownFor(snooze, 1000)).toBeNull();
    expect(popupView(snooze, 1000).countdownHint).toBeNull();
    // Sitting tired.
    const sitting = 60_000;
    expect(countdownFor(snooze, sitting)?.target).toBe(5 * 60_000);
    expect(popupView(snooze, sitting).countdownHint).toBe('Tap Barry to lock in again');
    expect(popupView(base({ modeOverride: 'lockIn' }), 0).countdownHint).toBeNull();
  });

  it('reports mode source', () => {
    expect(popupView(base(), 0).modeSource).toBe('calendar');
    const forced = popupView(base({ modeOverride: 'chill' }), 0);
    expect(forced.modeSource).toBe('forced');
    expect(forced.mode).toBe('chill');
  });

  it('gates the Slack pass', () => {
    expect(slackPassStatus('chill', 'clear').allowed).toBe(false);
    expect(slackPassStatus('chill', 'clear').hint).toBeTruthy();
    expect(slackPassStatus('lockIn', 'clear')).toEqual({ allowed: true, hint: null });
    // During a Slack pass the chips stay live: they change its length (after a confirm).
    expect(slackPassStatus('lockIn', 'slackPass')).toEqual({ allowed: true, hint: null });
  });

  it('describes a running Slack pass', () => {
    const on = base({
      modeOverride: 'lockIn',
      phase: 'slackPass',
      slackPassStartedAt: 0,
      slackPassEndsAt: 5 * 60_000,
    });
    expect(popupView(on, 0).onSlackPass).toBe(true);
    expect(popupView(on, 0).slackCurrentMin).toBe(5);
    expect(popupView(base({ modeOverride: 'lockIn' }), 0).onSlackPass).toBe(false);
    expect(popupView(base({ modeOverride: 'lockIn' }), 0).slackCurrentMin).toBeNull();
  });

  it('previews a Slack pass length change from its start', () => {
    const s = { slackPassStartedAt: 0 };
    expect(slackChangePreview(s, 10, 3 * 60_000)).toBe('10 min total, 7:00 left.');
    expect(slackChangePreview(s, 1, 3 * 60_000)).toBe('This ends your break now.');
  });

  it('headlines', () => {
    expect(headlineFor('chill', { phase: 'clear' })).toMatch(/chill/i);
    expect(headlineFor('lockIn', { phase: 'reaching' })).toMatch(/arm/i);
  });

  it('formats countdowns', () => {
    expect(formatCountdown(65_000)).toBe('1:05');
    expect(formatCountdown(-5)).toBe('0:00');
    expect(formatCountdown(3_661_000)).toBe('1:01:01');
    expect(formatCountdown(1)).toBe('0:01');
  });

  it('converts seconds to ms', () => {
    expect(secondsToMs('10')).toBe(10_000);
    expect(secondsToMs('0.5')).toBe(500);
    expect(secondsToMs('')).toBeNull();
    expect(secondsToMs('abc')).toBeNull();
    expect(secondsToMs('-3')).toBeNull();
  });
});

import {
  addDomain,
  caveStatus,
  chudPercent,
  formatAgo,
  normalizeDomain,
  removeDomain,
  scheduleStatusLine,
  toggleDomain,
} from './view';

describe('blocklist editing', () => {
  it('normalises typed input to a bare host', () => {
    expect(normalizeDomain('https://www.YouTube.com/watch?v=1')).toBe('youtube.com');
    expect(normalizeDomain(' Reddit.com/ ')).toBe('reddit.com');
    expect(normalizeDomain('old.reddit.com:8080/r/x')).toBe('old.reddit.com');
    expect(normalizeDomain('twitch.tv')).toBe('twitch.tv');
  });
  it('rejects junk', () => {
    for (const bad of ['', '  ', 'localhost', 'not a domain', 'a..b', '-a.com', 'x.com y']) {
      expect(normalizeDomain(bad)).toBeNull();
    }
  });
  it('adds, dedupes (re-enabling) and removes', () => {
    const base = [{ domain: 'x.com', enabled: false }];
    const added = addDomain(base, 'https://news.ycombinator.com');
    expect(added.ok && added.blocklist.map((e) => e.domain)).toEqual([
      'x.com',
      'news.ycombinator.com',
    ]);
    const again = addDomain(base, 'X.com');
    expect(again.ok && again.blocklist).toEqual([{ domain: 'x.com', enabled: true }]);
    expect(addDomain(base, 'nope').ok).toBe(false);
    expect(removeDomain(base, 'x.com')).toEqual([]);
    expect(toggleDomain(base, 'x.com')[0]!.enabled).toBe(true);
  });
});

describe('settings display', () => {
  it('cave follows the brain: locked during a Lock In fight, free otherwise', () => {
    const lockIn = { modeOverride: 'lockIn' as const };
    for (const phase of ['confronting', 'warning', 'reaching', 'snoozing'] as const) {
      expect(caveStatus(base({ ...lockIn, phase }), 0).disabled).toBe(true);
    }
    expect(caveStatus(base({ ...lockIn, phase: 'confronting' }), 0).reason).toBeTruthy();
    expect(caveStatus(base({ ...lockIn, phase: 'clear' }), 0)).toEqual({
      disabled: false,
      reason: null,
    });
    expect(caveStatus(base({ modeOverride: 'chill', phase: 'snoozing' }), 0).disabled).toBe(false);
  });
  it('chud percent clamps', () => {
    expect(chudPercent(0.456)).toBe(46);
    expect(chudPercent(2)).toBe(100);
    expect(chudPercent(NaN)).toBe(0);
  });
  it('formats ago and status lines', () => {
    expect(formatAgo(10_000)).toBe('just now');
    expect(formatAgo(5 * 60_000)).toBe('5 min ago');
    expect(formatAgo(3 * 3_600_000)).toBe('3 h ago');
    expect(scheduleStatusLine(null, false, 0).text).toMatch(/No calendar/);
    expect(
      scheduleStatusLine({ fetchedAt: 0, error: null, blocks: [1, 2] }, true, 120_000).text,
    ).toBe('Fetched 2 min ago (2 events).');
    const err = scheduleStatusLine({ fetchedAt: 0, error: 'Nope', blocks: [] }, true, 120_000);
    expect(err.isError).toBe(true);
    expect(err.text).toContain('Last good fetch 2 min ago');
  });
});

describe('speedPreset', () => {
  it('recognises the presets', () => {
    expect(speedPreset(DEFAULT_TUNING)).toBe('normal');
    expect(speedPreset({ ...DEFAULT_TUNING, ...DEMO_TUNING })).toBe('demo');
    expect(speedPreset({ ...DEFAULT_TUNING, snoozeMs: 1234 })).toBe('custom');
  });
});

describe('withStateDefaults', () => {
  it('returns null for nothing saved', () => {
    expect(withStateDefaults(null)).toBeNull();
  });
  it('fills fields and tuning missing from an old saved state', () => {
    const init = brain.initialState();
    const { gotUpAt, snoozeStartedAt, ...old } = init as any;
    const merged = withStateDefaults({ ...old, tuning: { reachMs: 1234 } } as any)!;
    expect(merged.gotUpAt).toBe(init.gotUpAt);
    expect(merged.gotUpAt).not.toBeUndefined();
    expect(merged.snoozeStartedAt).not.toBeUndefined();
    expect(merged.tuning.reachMs).toBe(1234);
    expect(merged.tuning.snoozeMs).toBe(init.tuning.snoozeMs);
  });
});

describe('pixel popup helpers', () => {
  it('picks the chill scene over the Lock In phase', async () => {
    const { sceneKey, BUBBLE } = await import('./view');
    expect(sceneKey('chill', 'reaching')).toBe('chill');
    expect(BUBBLE[sceneKey('lockIn', 'snoozing')]).toBe('Beaten... zzz');
  });

  it('times the block card from the phase, then the block, then the next block', async () => {
    const { blockCardTimer } = await import('./view');
    const base = {
      countdown: null,
      currentBlock: null,
      nextBlock: null,
    } as unknown as Parameters<typeof blockCardTimer>[0];
    const cur = { ...block('a', 0, 5000), end: 5000 };
    const nxt = block('b', 9000, 12000);
    expect(blockCardTimer(base)).toBeNull();
    expect(blockCardTimer({ ...base, nextBlock: nxt })).toEqual({ label: 'Next block in', target: 9000 });
    expect(blockCardTimer({ ...base, currentBlock: cur, nextBlock: nxt })).toEqual({
      label: 'Time left',
      target: 5000,
    });
    const slack = { label: 'Slack pass ends in', target: 42 };
    expect(blockCardTimer({ ...base, countdown: slack, currentBlock: cur })).toBe(slack);
  });

  it('shows days instead of a ticking timer a day or more out', async () => {
    const { formatTimeLeft, DAY_MS } = await import('./view');
    expect(formatTimeLeft(90_000)).toBe('1:30');
    expect(formatTimeLeft(DAY_MS - 1000)).toBe('23:59:59');
    expect(formatTimeLeft(DAY_MS)).toBe('1 day');
    expect(formatTimeLeft(3.5 * DAY_MS)).toBe('3 days');
  });

  it('lights the chud sign in eighths', async () => {
    const { chudSignSegments } = await import('./view');
    expect(chudSignSegments(0).filter(Boolean)).toHaveLength(0);
    expect(chudSignSegments(0.4).filter(Boolean)).toHaveLength(3);
    expect(chudSignSegments(1).every(Boolean)).toBe(true);
    expect(chudSignSegments(NaN).some(Boolean)).toBe(false);
  });


  it('Task list: add, tick, reorder, totals and limits', async () => {
    const v = await import('./view');
    const MIN = 60_000;
    let list = v.addTask([], { title: '  Gym  ', estimateMs: 30 * MIN }, '1');
    expect(v.addTask(list, { title: '   ' }, 'x')).toBe(list);
    list = v.addTask(list, { title: 'Lab', description: ' notes ', estimateMs: 90 * MIN }, '2');
    expect(list.map((t) => [t.title, t.description])).toEqual([
      ['Gym', ''],
      ['Lab', 'notes'],
    ]);
    // Ticking and unticking never reorder.
    list = v.toggleTask(list, '1', 5);
    expect(list.map((t) => [t.id, t.done, t.doneAt])).toEqual([
      ['1', true, 5],
      ['2', false, null],
    ]);
    list = v.addTask(list, { title: 'Read' }, '3');
    expect(list.map((t) => t.id)).toEqual(['1', '2', '3']);
    expect(v.totalEstimateMs(list)).toBe(120 * MIN);
    expect(v.formatEstimate(v.totalEstimateMs(list))).toBe('2h');
    expect(v.toggleTask(list, '1', 6).map((t) => [t.id, t.done])).toEqual([
      ['1', false],
      ['2', false],
      ['3', false],
    ]);
    expect(v.moveTask(list, '3', -1).map((t) => t.id)).toEqual(['1', '3', '2']);
    expect(v.moveTask(list, '3', 1)).toBe(list); // already last
    expect(v.removeTask(list, '2').map((t) => t.id)).toEqual(['1', '3']);
  });

  it('warns past 8h, caps at 15 unchecked, parses custom minutes', async () => {
    const v = await import('./view');
    const HOUR = 3_600_000;
    let list = v.addTask([], { title: 'a', estimateMs: 7 * HOUR }, 'a');
    expect(v.wouldExceedTotal(list, HOUR)).toBe(false);
    expect(v.wouldExceedTotal(list, HOUR + 60_000)).toBe(true);
    list = [];
    for (let i = 0; i < 15; i++) list = v.addTask(list, { title: `t${i}` }, `t${i}`);
    expect(v.atTaskLimit(list)).toBe(true);
    expect(v.addTask(list, { title: 'one more' }, 'x')).toBe(list);
    expect(v.atTaskLimit(v.toggleTask(list, 't0', 1))).toBe(false);
    // Hours (0-8) and minutes (0-59) boxes; 8h 30m max per Task.
    expect(v.hoursField('12')).toBe('2');
    expect(v.hoursField('9')).toBe('8');
    expect(v.hoursField('a')).toBe('');
    expect(v.minutesField('75')).toBe('59');
    expect(v.minutesField('4x5')).toBe('45');
    expect(v.minutesField('123')).toBe('12');
    expect(v.hoursMinutesMs('', '')).toEqual({ ms: null, error: null });
    expect(v.hoursMinutesMs('1', '15')).toEqual({ ms: 75 * 60_000, error: null });
    expect(v.hoursMinutesMs('', '45')).toEqual({ ms: 45 * 60_000, error: null });
    expect(v.hoursMinutesMs('8', '30').ms).toBe(8.5 * HOUR);
    expect(v.hoursMinutesMs('8', '31')).toEqual({ ms: null, error: 'Max 8h 30m per task.' });
    expect(v.hoursMinutesMs('0', '0').error).toBe('Enter at least 1 minute.');
    // Titles are cut to 50 characters, on add and rename.
    const long = 'x'.repeat(80);
    expect(v.addTask([], { title: long }, 'l')[0]!.title).toHaveLength(50);
    expect(v.renameTask(v.addTask([], { title: 'a' }, 'r'), 'r', long, '')[0]!.title).toHaveLength(50);
  });

  it('clears Tasks finished before today', async () => {
    const v = await import('./view');
    const now = new Date(2026, 10, 21, 15).getTime();
    const yesterday = new Date(2026, 10, 20, 23).getTime();
    const base = { description: '', estimateMs: 1, title: 't' };
    const list = [
      { ...base, id: 'old', done: true, doneAt: yesterday },
      { ...base, id: 'today', done: true, doneAt: now - 1000 },
      { ...base, id: 'open', done: false, doneAt: null },
    ];
    expect(v.dropStaleDone(list, now).map((t) => t.id)).toEqual(['today', 'open']);
    expect(v.dropStaleDone(list.slice(1), now)).toHaveLength(2);
  });

  it('drag and drop puts a Task before or after another unchecked one', async () => {
    const v = await import('./view');
    const base = { description: '', estimateMs: 1, doneAt: null };
    const list = ['a', 'b', 'c'].map((id) => ({ ...base, id, title: id, done: false }));
    const withDone = [...list, { ...base, id: 'x', title: 'x', done: true }];
    const ids = (l: { id: string }[]) => l.map((t) => t.id);
    expect(ids(v.moveTaskTo(withDone, 'c', 'a', 'before'))).toEqual(['c', 'a', 'b', 'x']);
    expect(ids(v.moveTaskTo(withDone, 'a', 'c', 'after'))).toEqual(['b', 'c', 'a', 'x']);
    expect(ids(v.moveTaskTo(withDone, 'a', 'b', 'after'))).toEqual(['b', 'a', 'c', 'x']);
    // A checked Task can be a drop target; it just isn't dragged itself.
    expect(ids(v.moveTaskTo(withDone, 'a', 'x', 'after'))).toEqual(['b', 'c', 'x', 'a']);
    // No-ops: onto itself, a finished Task, the same spot.
    expect(v.moveTaskTo(withDone, 'a', 'a', 'after')).toBe(withDone);
    expect(v.moveTaskTo(withDone, 'x', 'a', 'before')).toBe(withDone);
    expect(v.moveTaskTo(withDone, 'a', 'b', 'before')).toBe(withDone);
  });

  it('renames a Task and its details; a blank title keeps the old one', async () => {
    const v = await import('./view');
    const list = v.addTask([], { title: 'Gym', description: 'legs' }, '1');
    expect(v.renameTask(list, '1', ' Run ', ' 5k ')[0]).toMatchObject({
      title: 'Run',
      description: '5k',
    });
    expect(v.renameTask(list, '1', '  ', '')[0]).toMatchObject({ title: 'Gym', description: '' });
    expect(v.renameTask(list, '1', 'Gym', 'legs')).toBe(list);
    expect(v.renameTask(list, 'nope', 'x', '')).toBe(list);
  });
});
