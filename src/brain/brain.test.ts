import { describe, expect, it } from 'vitest';
import type { BarryEvent, BarryState, TabId } from '../contracts';
import { DEFAULT_TUNING } from '../contracts';
import { OKAY_MS, SNOOZE_KNOCKED_MS, brain, initialState } from '.';

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
    // switching away and back does not burst again
    const back = run(r.state, nav(2, DOCS), act(2, T0 + 1), act(1, T0 + 2));
    expect(back.effects.flat()).toEqual([]);
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
      pose: 'suspicious',
      line: "You planned ETF prep ,':/",
      showBackToIt: true,
      eatInput: true,
      pauseMedia: true,
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
    expect(v.pose).toBe('suspicious');
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
    s = run(r.state, {
      type: 'dev',
      now: T0,
      command: { kind: 'setFatness', fatness: 1000 },
    }).state;
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
  });

  it('persists on a non-Restricted tab while a Restricted tab is open, view goes calm', () => {
    let s = run(confronted(), eat(1), nav(2, DOCS), act(2)).state;
    expect(s.phase).toBe('clear');
    expect(s.fatness).toBe(1);
    expect(brain.viewFor(s, 2, T0)).toMatchObject({
      placement: 'corner',
      pose: 'studious',
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
      pose: 'chill-mug',
      position: 'right',
    });
  });

  it('Chill on a Restricted site is just chill Barry', () => {
    const s = run(initialState(), nav(1, YT), act(1)).state;
    expect(brain.viewFor(s, 1, T0)).toMatchObject({ pose: 'chill-mug', placement: 'corner' });
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

// ---------------------------------------------------------------- Phase 2
const tickAt = (now: number): BarryEvent => ({ type: 'tick', now });
const slack = (durationMs: number, now = T0): BarryEvent => ({
  type: 'slackPassStarted',
  durationMs,
  now,
});
const push = (tabId: TabId, now: number): BarryEvent => ({ type: 'pushed', tabId, now });
const tune = (tuning: Partial<BarryState['tuning']>, now = T0): BarryEvent => ({
  type: 'dev',
  now,
  command: { kind: 'setTuning', tuning },
});
const SLACK = 10_000;
const WARN = 5_000;
const REACH = 8_000;
const SNOOZE = 300_000;

/** Lock In for a long time, YouTube (1) active and a Reddit tab (2) open, short test timings. */
function lockedIn() {
  return run(
    initialState(),
    { type: 'modeOverrideSet', override: 'lockIn', now: T0 },
    tune({ warningMs: WARN, reachMs: REACH, snoozeMs: SNOOZE, maxPushes: 5 }),
    nav(1, YT),
    nav(2, 'https://reddit.com/'),
    act(1),
  ).state;
}
/** Slack pass started from the Confrontation, then ticked into the Reach. */
function reaching(extra: BarryEvent[] = []) {
  return run(lockedIn(), slack(SLACK), ...extra, tickAt(T0 + SLACK + WARN)).state;
}

describe('Slack pass', () => {
  it('is ignored in Chill and while a break is running', () => {
    const chill = run(initialState(), nav(1, YT), act(1), slack(SLACK)).state;
    expect(chill.phase).toBe('clear');
    expect(chill.slackPassEndsAt).toBeNull();
    const s = run(lockedIn(), slack(SLACK), slack(99_999, T0 + 1)).state;
    expect(s.slackPassEndsAt).toBe(T0 + SLACK);
  });

  it('from a Confrontation: okay pose, Fatness reset, corner, countdown, nothing eaten', () => {
    const s = run(lockedIn(), eat(1), eat(1), { ...slack(SLACK), now: T0 + 5 }).state;
    expect(s.phase).toBe('slackPass');
    expect(s.fatness).toBe(0);
    expect(s.slackPassEndsAt).toBe(T0 + 5 + SLACK);
    expect(brain.viewFor(s, 1, T0 + 5)).toMatchObject({
      visible: true,
      placement: 'corner',
      pose: 'suspicious',
      line: 'Okay... -_-',
      eatInput: false,
      pauseMedia: false,
      breakEndsAt: T0 + 5 + SLACK,
      reach: null,
    });
    // eating does nothing now
    expect(run(s, eat(1)).state.fatness).toBe(0);
  });

  it('okay lingers OKAY_MS on the interrupted tab only, then chill', () => {
    const s = run(lockedIn(), slack(SLACK)).state;
    expect(brain.viewFor(s, 1, T0 + OKAY_MS - 1).pose).toBe('suspicious');
    const later = brain.viewFor(s, 1, T0 + OKAY_MS);
    expect(later).toMatchObject({ pose: 'chill', line: null, breakEndsAt: T0 + SLACK });
    expect(brain.viewFor(s, 2, T0)).toMatchObject({ pose: 'chill', line: null });
  });

  it('from clear (no Confrontation) is chill on the Restricted tab, no okay line', () => {
    const s = run(lockedIn(), act(null), slack(SLACK)).state;
    expect(s.phase).toBe('slackPass');
    expect(brain.viewFor(s, 1, T0)).toMatchObject({ pose: 'chill', line: null });
  });

  it('opening/activating a Restricted tab does not confront; shows chud meter', () => {
    let s = run(lockedIn(), slack(SLACK), {
      type: 'dev',
      now: T0,
      command: { kind: 'setChudMeter', value: 0.2 },
    }).state;
    s = run(s, nav(3, YT), act(3), tickAt(T0 + 5000)).state;
    expect(s.phase).toBe('slackPass');
    expect(brain.viewFor(s, 3, T0 + 5000)).toMatchObject({
      placement: 'corner',
      eatInput: false,
      pauseMedia: false,
    });
  });

  it('non-Restricted tabs show plain studious Barry (no countdown)', () => {
    const s = run(lockedIn(), nav(3, DOCS), slack(SLACK)).state;
    expect(brain.viewFor(s, 3, T0)).toMatchObject({
      pose: 'studious',
      breakEndsAt: null,
      reach: null,
    });
  });
});

describe('warning and Reach', () => {
  it('slack pass end -> warning with deadline-based end', () => {
    const s = run(lockedIn(), slack(SLACK), tickAt(T0 + SLACK + 1000)).state;
    expect(s.phase).toBe('warning');
    expect(s.warningEndsAt).toBe(T0 + SLACK + WARN);
    expect(s.slackPassEndsAt).toBeNull();
    expect(brain.viewFor(s, 1, T0 + SLACK + 1000)).toMatchObject({
      line: 'Wrap it up!',
      breakEndsAt: T0 + SLACK + WARN,
      eatInput: false,
      pauseMedia: false,
    });
  });

  it('warning end -> reaching, reachStartedAt = the deadline', () => {
    const s = run(lockedIn(), slack(SLACK), tickAt(T0 + SLACK + WARN + 700)).state;
    expect(s.phase).toBe('reaching');
    expect(s.reachStartedAt).toBe(T0 + SLACK + WARN);
  });

  it('one very late tick jumps slack pass, warning and still lands correctly', () => {
    const s = run(lockedIn(), slack(SLACK), tickAt(T0 + SLACK + WARN + 3000)).state;
    expect(s.phase).toBe('reaching');
    expect(s.reachStartedAt).toBe(T0 + SLACK + WARN);
    const way = run(lockedIn(), slack(SLACK), tickAt(T0 + SLACK + WARN + REACH + 1));
    expect(way.state.phase).toBe('clear');
    expect(way.last).toEqual([{ type: 'explodeAndClose', tabIds: [1, 2] }]);
  });

  it('every Restricted tab shows the same arm; page works; non-Restricted does not', () => {
    const s = run(reaching(), nav(3, DOCS)).state;
    const start = T0 + SLACK + WARN;
    const want = {
      pose: 'close-tab',
      placement: 'corner',
      line: 'Closing restricted tabs 💣',
      reach: { startedAt: start, durationMs: REACH },
      pushesLeft: 5,
      eatInput: false,
      pauseMedia: false,
    };
    expect(brain.viewFor(s, 1, start + 10)).toMatchObject(want);
    expect(brain.viewFor(s, 2, start + 10)).toMatchObject(want);
    expect(brain.viewFor(s, 3, start + 10)).toMatchObject({
      reach: null,
      pushesLeft: null,
      line: null,
    });
  });

  it('opening a Restricted tab during the fight does not confront', () => {
    const s = run(reaching(), nav(3, YT), act(3)).state;
    expect(s.phase).toBe('reaching');
  });

  it('warning ending with no Restricted tab open goes back to clear', () => {
    const s = run(
      lockedIn(),
      slack(SLACK),
      { type: 'tabClosed', tabId: 1, now: T0 + 1 },
      { type: 'tabClosed', tabId: 2, now: T0 + 2 },
      tickAt(T0 + SLACK + 1),
    ).state;
    expect(s.phase).toBe('warning'); // still warns
    const done = run(s, tickAt(T0 + SLACK + WARN));
    expect(done.state.phase).toBe('clear');
    expect(done.last).toEqual([]);
    expect(done.state.warningEndsAt).toBeNull();
  });

  it('user closing every Restricted tab mid-Reach ends the fight', () => {
    const s = run(
      reaching([push(1, T0 + SLACK + WARN + 1)]),
      { type: 'tabClosed', tabId: 1, now: T0 + SLACK + WARN + 2 },
      { type: 'tabClosed', tabId: 2, now: T0 + SLACK + WARN + 3 },
    ).state;
    expect(s.phase).toBe('clear');
    expect(s.pushes).toBe(0);
  });
});

describe('Push and landing', () => {
  const t1 = T0 + SLACK + WARN + 1000;

  it('Push: punch on that tab, restarts the Reach, counts down', () => {
    const r = run(reaching(), push(2, t1));
    expect(r.last).toEqual([{ type: 'playSound', tabId: 2, sound: 'punch' }]);
    expect(r.state.pushes).toBe(1);
    expect(r.state.reachStartedAt).toBe(t1);
    expect(brain.viewFor(r.state, 1, t1)).toMatchObject({
      reach: { startedAt: t1, durationMs: REACH },
      pushesLeft: 4,
    });
  });

  it('Push is ignored outside the Reach and after it ran out', () => {
    expect(run(lockedIn(), push(1, T0 + 1)).state.pushes).toBe(0);
    const late = T0 + SLACK + WARN + REACH;
    const r = run(reaching(), push(1, late));
    expect(r.state.pushes).toBe(0);
    expect(r.state.phase).toBe('clear'); // landed by timeout
  });

  it('stale reachLanded is ignored; matching one explodes every Restricted tab', () => {
    const start = T0 + SLACK + WARN;
    const s = run(reaching(), push(1, t1)).state;
    const stale = run(s, { type: 'reachLanded', tabId: 1, reachStartedAt: start, now: t1 + 5 });
    expect(stale.state.phase).toBe('reaching');
    expect(stale.last).toEqual([]);
    const ok = run(s, nav(3, DOCS), {
      type: 'reachLanded',
      tabId: 1,
      reachStartedAt: t1,
      now: t1 + REACH,
    });
    expect(ok.last).toEqual([{ type: 'explodeAndClose', tabIds: [1, 2] }]);
    expect(ok.state).toMatchObject({
      phase: 'clear',
      pushes: 0,
      fatness: 0,
      reachStartedAt: null,
      warningEndsAt: null,
      slackPassEndsAt: null,
      snoozeEndsAt: null,
    });
    expect(ok.state.openTabs).toEqual({ 3: DOCS });
    // a second report does nothing
    expect(
      run(ok.state, { type: 'reachLanded', tabId: 2, reachStartedAt: t1, now: t1 + REACH + 1 })
        .last,
    ).toEqual([]);
  });

  it('a tick past the Reach end lands it without the overlay', () => {
    const t = T0 + SLACK + WARN + REACH;
    const r = run(reaching(), tickAt(t - 1), tickAt(t));
    expect(r.effects[0]).toEqual([]);
    expect(r.last).toEqual([{ type: 'explodeAndClose', tabIds: [1, 2] }]);
    expect(r.state.phase).toBe('clear');
  });

  it('muted suppresses punch/ow but not explosion', () => {
    const m = { type: 'mutedSet', muted: true, now: T0 } as const;
    const s = reaching([m]);
    expect(run(s, push(1, t1)).last).toEqual([]);
    expect(
      run(s, { type: 'reachLanded', tabId: 1, reachStartedAt: T0 + SLACK + WARN, now: t1 }).last,
    ).toHaveLength(1);
  });
});

describe('Snooze', () => {
  it('5th Push: ow only, beaten corner view with line, pushes reset', () => {
    let s = reaching();
    let now = T0 + SLACK + WARN;
    for (let i = 0; i < 4; i++) s = run(s, push(1, (now += 100))).state;
    expect(s.pushes).toBe(4);
    expect(brain.viewFor(s, 1, now).pushesLeft).toBe(1);
    const r = run(s, push(1, (now += 100)));
    expect(r.last).toEqual([{ type: 'playSound', tabId: 1, sound: 'ow' }]);
    expect(r.state).toMatchObject({ phase: 'snoozing', pushes: 0, snoozeEndsAt: now + SNOOZE });
    expect(brain.viewFor(r.state, 2, now)).toMatchObject({
      placement: 'corner',
      pose: 'got-owned',
      line: null,
      breakEndsAt: now + SNOOZE,
      reach: null,
      eatInput: false,
    });
    // opening a Restricted tab during the Snooze does not confront
    expect(run(r.state, nav(3, YT), act(3)).state.phase).toBe('snoozing');
  });

  it('Snooze end restarts the Reach immediately, no warning, from the deadline', () => {
    let s = run(reaching(), tune({ maxPushes: 1 }), push(1, T0 + SLACK + WARN + 1)).state;
    expect(s.phase).toBe('snoozing');
    const end = s.snoozeEndsAt!;
    s = run(s, tickAt(end - 1)).state;
    expect(s.phase).toBe('snoozing');
    s = run(s, tickAt(end + 2000)).state;
    expect(s).toMatchObject({
      phase: 'reaching',
      reachStartedAt: end,
      snoozeEndsAt: null,
      pushes: 0,
    });
    expect(brain.viewFor(s, 1, end + 2000).pushesLeft).toBe(1);
  });
});

describe('Lock In ending mid-break', () => {
  it.each([
    ['slackPass', (s: BarryState) => s],
    ['warning', (s: BarryState) => run(s, tickAt(T0 + SLACK)).state],
    ['reaching', (s: BarryState) => run(s, tickAt(T0 + SLACK + WARN)).state],
  ])('override to Chill during %s drops everything, keeps chud meter', (_n, to) => {
    const base = run(
      lockedIn(),
      { type: 'dev', now: T0, command: { kind: 'setChudMeter', value: 0.4 } },
      slack(SLACK),
    ).state;
    const s = to(base);
    const r = run(s, { type: 'modeOverrideSet', override: 'chill', now: T0 + SLACK + WARN + 1 });
    expect(r.state).toMatchObject({
      phase: 'clear',
      slackPassEndsAt: null,
      warningEndsAt: null,
      reachStartedAt: null,
      snoozeEndsAt: null,
      pushes: 0,
      chudMeter: 0.4,
    });
    expect(r.last).toEqual([]);
  });

  it('block ending ends a Snooze too', () => {
    let s = run(
      initialState(),
      tune({ warningMs: WARN, reachMs: REACH, maxPushes: 1 }),
      inject(),
      nav(1, YT),
      act(1),
      slack(1000),
      tickAt(T0 + 1000 + WARN),
      push(1, T0 + 1000 + WARN + 1),
    ).state;
    expect(s.phase).toBe('snoozing');
    s = run(s, tickAt(T0 + 60_000)).state;
    expect(s.phase).toBe('clear');
    expect(s.snoozeEndsAt).toBeNull();
  });
});

describe('nextDeadline (Phase 2)', () => {
  it('tracks slack pass, warning, reach and snooze ends', () => {
    let s = run(lockedIn(), slack(SLACK)).state;
    expect(brain.nextDeadline(s)).toBe(T0 + OKAY_MS); // the okay pose ends first
    s = run(s, tickAt(T0 + OKAY_MS)).state;
    expect(brain.nextDeadline(s)).toBe(T0 + SLACK);
    s = run(s, tickAt(T0 + SLACK)).state;
    expect(brain.nextDeadline(s)).toBe(T0 + SLACK + WARN);
    s = run(s, tickAt(T0 + SLACK + WARN)).state;
    expect(brain.nextDeadline(s)).toBe(T0 + SLACK + WARN + REACH);
    s = run(s, tune({ maxPushes: 1 }), push(1, T0 + SLACK + WARN + 5)).state;
    expect(brain.nextDeadline(s)).toBe(T0 + SLACK + WARN + 5 + SNOOZE_KNOCKED_MS); // first Snooze stage boundary
  });

  it('is the earlier of a break deadline and a block boundary', () => {
    const s = run(initialState(), inject(), nav(1, YT), act(1), slack(100_000)).state;
    expect(brain.nextDeadline(s)).toBe(T0 + OKAY_MS); // okay ends first
    expect(brain.nextDeadline(run(s, tickAt(T0 + OKAY_MS)).state)).toBe(T0 + 60_000); // then the block
  });
});

describe('setTuning during timers', () => {
  it('applies from the next transition', () => {
    const s = run(lockedIn(), slack(SLACK), tune({ warningMs: 1000 })).state;
    expect(run(s, tickAt(T0 + SLACK)).state.warningEndsAt).toBe(T0 + SLACK + 1000);
  });
});
