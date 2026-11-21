import { describe, expect, it } from 'vitest';
import type { BarryEvent, BarryState, TabId } from '../contracts';
import { brain, initialState } from '.';

const YT = 'https://www.youtube.com/watch?v=1';
const DOCS = 'https://docs.google.com/';
const T0 = 1_000_000;

function run(state: BarryState, ...events: BarryEvent[]) {
  let s = state;
  const effects = events.map((e) => {
    const r = brain.reduce(s, e);
    s = r.state;
    return r.effects;
  });
  return { state: s, effects, last: effects[effects.length - 1] ?? [] };
}
const nav = (tabId: TabId, url: string, now = T0): BarryEvent => ({
  type: 'tabNavigated',
  tabId,
  url,
  now,
});
const act = (tabId: TabId | null, now = T0): BarryEvent => ({ type: 'tabActivated', tabId, now });
const inject = (now = T0): BarryEvent => ({
  type: 'dev',
  now,
  command: { kind: 'injectBlock', title: 'ETF prep', durationMs: 60_000 },
});
const eat = (tabId: TabId, now = T0): BarryEvent => ({ type: 'eaten', tabId, kind: 'click', now });

/** Lock In block active, tab 1 = YouTube active and confronted. */
function confronted() {
  return run(initialState(), inject(), nav(1, YT), act(1)).state;
}

describe('Confrontation arrival', () => {
  it('confronts when a Restricted tab becomes active in Lock In, bursting once', () => {
    const base = run(initialState(), inject(), nav(1, YT)).state;
    expect(base.phase).toBe('clear');
    const r = run(base, act(1));
    expect(r.state.phase).toBe('confronting');
    expect(r.last).toEqual([{ type: 'playSound', tabId: 1, sound: 'burst' }]);
    const again = run(r.state, { type: 'tick', now: T0 + 1 });
    expect(again.last).toEqual([]);
  });

  it('confronts on navigating the active tab to a Restricted site', () => {
    const r = run(initialState(), inject(), nav(1, DOCS), act(1), nav(1, YT));
    expect(r.state.phase).toBe('confronting');
  });

  it('does not confront in Chill', () => {
    const r = run(initialState(), nav(1, YT), act(1));
    expect(r.state.phase).toBe('clear');
    expect(r.last).toEqual([]);
  });

  it('confronts when Lock In begins with a Restricted tab already active', () => {
    const s = run(initialState(), nav(1, YT), act(1)).state;
    for (const ev of [
      inject(),
      { type: 'modeOverrideSet', override: 'lockIn', now: T0 } as BarryEvent,
    ]) {
      const r = run(s, ev);
      expect(r.state.phase).toBe('confronting');
      expect(r.last).toContainEqual({ type: 'playSound', tabId: 1, sound: 'burst' });
    }
    const block = {
      id: 'x',
      title: 'T',
      start: T0 - 10,
      end: T0 + 10,
      allDay: false,
      source: 'ics' as const,
    };
    const sched = run(s, { type: 'scheduleUpdated', blocks: [block], now: T0 });
    expect(sched.state.phase).toBe('confronting');
    // block starts later; a tick at the start confronts
    const later = run(s, {
      type: 'scheduleUpdated',
      blocks: [{ ...block, start: T0 + 100, end: T0 + 200 }],
      now: T0,
    });
    expect(later.state.phase).toBe('clear');
    expect(run(later.state, { type: 'tick', now: T0 + 100 }).state.phase).toBe('confronting');
  });

  it('returns to clear when Lock In ends', () => {
    const s = confronted();
    const r = run(s, { type: 'tick', now: T0 + 60_000 });
    expect(r.state.phase).toBe('clear');
  });

  it('view: in your face with the planned task', () => {
    const s = confronted();
    expect(brain.viewFor(s, 1, T0)).toMatchObject({
      visible: true,
      placement: 'face',
      pose: 'confrontation',
      line: "You planned ETF prep ,':/",
      showBackToIt: true,
      eatInput: true,
      pauseMedia: true,
      scale: 1,
    });
  });

  it('view: fallback line for forced Lock In without a block', () => {
    const s = run(
      initialState(),
      { type: 'modeOverrideSet', override: 'lockIn', now: T0 },
      nav(1, YT),
      act(1),
    ).state;
    const v = brain.viewFor(s, 1, T0);
    expect(v.pose).toBe('confrontation');
    expect(v.line).toBeTruthy();
    expect(v.line).not.toContain('undefined');
  });

  it('a Restricted tab that is not active shows the calm corner view', () => {
    const s = run(confronted(), nav(2, DOCS), nav(3, YT)).state;
    const v = brain.viewFor(s, 3, T0);
    expect(v.placement).toBe('corner');
    expect(v.eatInput).toBe(false);
  });
});

describe('eating', () => {
  it('adds fatness, grows the view (capped), and chomps', () => {
    let s = confronted();
    const r = run(s, eat(1));
    expect(r.state.fatness).toBe(1);
    expect(r.last).toEqual([{ type: 'playSound', tabId: 1, sound: 'chomp' }]);
    expect(brain.viewFor(r.state, 1, T0).scale).toBeCloseTo(1.06);
    s = run(r.state, {
      type: 'dev',
      now: T0,
      command: { kind: 'setFatness', fatness: 1000 },
    }).state;
    expect(brain.viewFor(s, 1, T0).scale).toBe(2);
  });

  it('only counts while confronting on that tab', () => {
    const s = run(confronted(), nav(2, DOCS)).state;
    expect(run(s, eat(2)).state.fatness).toBe(0);
    expect(run(s, eat(2)).last).toEqual([]);
    expect(run(initialState(), eat(1)).state.fatness).toBe(0);
  });

  it('uses tuning.fatPerEat', () => {
    const s = run(confronted(), {
      type: 'dev',
      now: T0,
      command: { kind: 'setTuning', tuning: { fatPerEat: 5 } },
    }).state;
    expect(run(s, eat(1)).state.fatness).toBe(5);
  });
});

describe('fatness lifetime', () => {
  it('is kept when switching between Restricted tabs', () => {
    let s = run(confronted(), eat(1), eat(1), eat(1)).state;
    s = run(s, nav(2, 'https://reddit.com/'), act(2)).state;
    expect(s.phase).toBe('confronting');
    expect(s.fatness).toBe(3);
    expect(brain.viewFor(s, 2, T0).scale).toBeGreaterThan(1.1);
  });

  it('persists on a non-Restricted tab while a Restricted tab is open, view goes calm', () => {
    let s = run(confronted(), eat(1), nav(2, DOCS), act(2)).state;
    expect(s.phase).toBe('clear');
    expect(s.fatness).toBe(1);
    expect(brain.viewFor(s, 2, T0)).toMatchObject({
      placement: 'corner',
      pose: 'studious',
      scale: 1,
    });
    s = run(s, act(1)).state;
    expect(s.phase).toBe('confronting');
    expect(s.fatness).toBe(1);
  });

  it('resets when no Restricted tab is open anywhere', () => {
    let s = run(confronted(), eat(1), nav(2, 'https://reddit.com/')).state;
    s = run(s, { type: 'tabClosed', tabId: 1, now: T0 }).state;
    expect(s.fatness).toBe(1);
    s = run(s, { type: 'tabClosed', tabId: 2, now: T0 }).state;
    expect(s.fatness).toBe(0);
  });

  it('resets when the active tab navigates away and none remain', () => {
    const s = run(confronted(), eat(1), nav(1, DOCS)).state;
    expect(s.fatness).toBe(0);
    expect(s.phase).toBe('clear');
  });
});

describe('backToIt', () => {
  it('explodes and closes that tab, no fatness', () => {
    const s = run(confronted(), eat(1)).state;
    const r = run(s, { type: 'backToIt', tabId: 1, now: T0 });
    expect(r.last).toEqual([{ type: 'explodeAndClose', tabIds: [1] }]);
    expect(r.state.fatness).toBe(1);
  });
});

describe('clear view', () => {
  it('Lock In: studious corner; Chill: chill corner; uses position', () => {
    const lock = run(initialState(), inject(), nav(1, DOCS), act(1), {
      type: 'positionSet',
      position: 'left',
      now: T0,
    }).state;
    expect(brain.viewFor(lock, 1, T0)).toMatchObject({
      visible: true,
      placement: 'corner',
      pose: 'studious',
      position: 'left',
    });
    const chill = run(initialState(), nav(1, DOCS), act(1)).state;
    expect(brain.viewFor(chill, 1, T0)).toMatchObject({
      visible: true,
      pose: 'chill',
      position: 'right',
    });
  });

  it('Chill on a Restricted site is just chill Barry', () => {
    const s = run(initialState(), nav(1, YT), act(1)).state;
    expect(brain.viewFor(s, 1, T0)).toMatchObject({ pose: 'chill', placement: 'corner' });
  });

  it('cave hides calm Barry but never a Confrontation', () => {
    const cave = { type: 'caveSet', cave: true, now: T0 } as const;
    const calm = run(initialState(), cave, nav(1, DOCS), act(1)).state;
    expect(brain.viewFor(calm, 1, T0).visible).toBe(false);
    const s = run(confronted(), cave).state;
    expect(brain.viewFor(s, 1, T0)).toMatchObject({ visible: true, placement: 'face' });
  });

  it('shows the calm view for tabs the brain has not seen (hello)', () => {
    expect(brain.viewFor(initialState(), 99, T0).visible).toBe(true);
  });
});

describe('dev commands', () => {
  it('injectBlock makes auto mode Lock In', () => {
    const s = run(initialState(), inject()).state;
    expect(s.blocks[0]).toMatchObject({
      title: 'ETF prep',
      source: 'dev',
      start: T0,
      end: T0 + 60_000,
      allDay: false,
    });
    expect(brain.viewFor(s, 1, T0).pose).toBe('studious');
  });

  it('setFatness works even with no Restricted tab; chud meter clamps', () => {
    const s = run(initialState(), {
      type: 'dev',
      now: T0,
      command: { kind: 'setFatness', fatness: 4 },
    }).state;
    expect(s.fatness).toBe(4);
    expect(
      run(s, { type: 'dev', now: T0, command: { kind: 'setChudMeter', value: 3 } }).state.chudMeter,
    ).toBe(1);
  });

  it('reset restores initial state but keeps real tabs', () => {
    const s = run(confronted(), eat(1), {
      type: 'dev',
      now: T0 + 5,
      command: { kind: 'reset' },
    }).state;
    expect(s).toEqual({ ...initialState(), openTabs: { 1: YT }, activeTabId: 1, lastNow: T0 + 5 });
  });
});

describe('simple events', () => {
  it('tabClosed removes the tab and clears the active tab', () => {
    const s = run(initialState(), nav(1, DOCS), nav(2, DOCS), act(1), {
      type: 'tabClosed',
      tabId: 1,
      now: T0,
    }).state;
    expect(s.openTabs).toEqual({ 2: DOCS });
    expect(s.activeTabId).toBeNull();
  });

  it('muted suppresses sounds only', () => {
    const base = run(
      initialState(),
      { type: 'mutedSet', muted: true, now: T0 },
      inject(),
      nav(1, YT),
    ).state;
    const r = run(base, act(1));
    expect(r.state.phase).toBe('confronting');
    expect(r.last).toEqual([]);
    expect(run(r.state, eat(1)).last).toEqual([]);
    expect(run(r.state, { type: 'backToIt', tabId: 1, now: T0 }).last).toHaveLength(1);
  });

  it('blocklistSet re-evaluates', () => {
    const s = confronted();
    const off = run(s, {
      type: 'blocklistSet',
      blocklist: [{ domain: 'youtube.com', enabled: false }],
      now: T0,
    });
    expect(off.state.phase).toBe('clear');
  });

  it('Phase 2/3 events pass through without crashing and update lastNow', () => {
    const evs: BarryEvent[] = [
      { type: 'slackPassStarted', durationMs: 1, now: 5 },
      { type: 'pushed', tabId: 1, now: 6 },
      { type: 'reachLanded', tabId: 1, reachStartedAt: 1, now: 7 },
      { type: 'idleChanged', idle: true, now: 8 },
      { type: 'todosUpdated', todos: [], now: 9 },
      { type: 'dev', now: 10, command: { kind: 'triggerFreeGap' } },
    ];
    const r = run(initialState(), ...evs);
    expect(r.state.lastNow).toBe(10);
    expect(r.state.userIdle).toBe(true);
  });
});

describe('nextDeadline', () => {
  const blk = (start: number, end: number, allDay = false) => ({
    id: `${start}`,
    title: 't',
    start,
    end,
    allDay,
    source: 'ics' as const,
  });
  const at = (blocks: ReturnType<typeof blk>[], now: number, override: 'auto' | 'chill' = 'auto') =>
    brain.nextDeadline(
      run(
        initialState(),
        { type: 'modeOverrideSet', override, now },
        { type: 'scheduleUpdated', blocks, now },
      ).state,
    );

  it('is the end of the current block', () =>
    expect(at([blk(0, 100), blk(200, 300)], 50)).toBe(100));
  it('is the start of the next block when in Chill', () =>
    expect(at([blk(200, 300), blk(400, 500)], 50)).toBe(200));
  it('is null with nothing pending, all-day only, forced mode, or no events yet', () => {
    expect(at([blk(0, 100)], 150)).toBeNull();
    expect(at([blk(0, 1000, true)], 50)).toBeNull();
    expect(at([blk(0, 100)], 50, 'chill')).toBeNull();
    expect(brain.nextDeadline(initialState())).toBeNull();
  });
});
