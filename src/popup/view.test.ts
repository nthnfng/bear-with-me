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

  it('lights the chud sign in eighths', async () => {
    const { chudSignSegments } = await import('./view');
    expect(chudSignSegments(0).filter(Boolean)).toHaveLength(0);
    expect(chudSignSegments(0.4).filter(Boolean)).toHaveLength(3);
    expect(chudSignSegments(1).every(Boolean)).toBe(true);
    expect(chudSignSegments(NaN).some(Boolean)).toBe(false);
  });

  it('adds, ticks and removes popup todos', async () => {
    const { addPopupTodo, togglePopupTodo, removePopupTodo, todosLeft } = await import('./view');
    let list = addPopupTodo([], '  Gym  ', '1');
    expect(addPopupTodo(list, '   ', '2')).toBe(list);
    list = addPopupTodo(list, 'Lab report', '2');
    expect(list.map((t) => t.text)).toEqual(['Gym', 'Lab report']);
    list = togglePopupTodo(list, '1');
    expect(list[0]!.done).toBe(true);
    expect(todosLeft(list, [{ sourceId: 'notion' }, { sourceId: 'popup' }])).toBe(2);
    expect(removePopupTodo(list, '1').map((t) => t.id)).toEqual(['2']);
  });
});
