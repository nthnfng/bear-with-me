// Phase 4 bug bash: edge cases a live demo will hit. Each test names the edge it covers.
import { describe, expect, it } from 'vitest';
import type { BarryEvent, BarryState, CalendarBlock, TabId, Tuning } from '../contracts';
import { DEFAULT_TUNING, DEMO_TUNING } from '../contracts';
import { brain, initialState } from '.';

const YT = 'https://www.youtube.com/watch?v=1';
const REDDIT = 'https://www.reddit.com/r/x';
const DOCS = 'https://docs.google.com/';
const T0 = 10_000_000;
const SEC = 1000;
const MIN = 60_000;
const T = DEFAULT_TUNING;

function run(state: BarryState, ...events: BarryEvent[]) {
  let s = state;
  const effects = events.map((e) => {
    const r = brain.reduce(s, e);
    s = r.state;
    return r.effects;
  });
  return { state: s, effects, last: effects[effects.length - 1] ?? [] };
}
const tick = (now: number): BarryEvent => ({ type: 'tick', now });
const block = (
  start: number,
  end: number,
  source: CalendarBlock['source'] = 'ics',
): CalendarBlock => ({
  id: `b${start}`,
  title: 'Study',
  start,
  end,
  allDay: false,
  source,
});
const sched = (now: number, ...blocks: CalendarBlock[]): BarryEvent => ({
  type: 'scheduleUpdated',
  blocks,
  now,
});
const nav = (tabId: TabId, url: string, now = T0): BarryEvent => ({
  type: 'tabNavigated',
  tabId,
  url,
  now,
});
const act = (tabId: TabId | null, now = T0): BarryEvent => ({ type: 'tabActivated', tabId, now });
const close = (tabId: TabId, now = T0): BarryEvent => ({ type: 'tabClosed', tabId, now });
const idle = (v: boolean, now: number): BarryEvent => ({ type: 'idleChanged', idle: v, now });
const eat = (tabId: TabId, now = T0): BarryEvent => ({ type: 'eaten', tabId, kind: 'click', now });
const back = (tabId: TabId, now = T0): BarryEvent => ({ type: 'backToIt', tabId, now });
const push = (tabId: TabId, now: number): BarryEvent => ({ type: 'pushed', tabId, now });
const slack = (durationMs: number, now = T0): BarryEvent => ({
  type: 'slackPassStarted',
  durationMs,
  now,
});
const mode = (override: 'auto' | 'chill' | 'lockIn', now = T0): BarryEvent => ({
  type: 'modeOverrideSet',
  override,
  now,
});
const tune = (tuning: Partial<Tuning>, now = T0): BarryEvent => ({
  type: 'dev',
  now,
  command: { kind: 'setTuning', tuning },
});
const dev = (command: Extract<BarryEvent, { type: 'dev' }>['command'], now = T0): BarryEvent => ({
  type: 'dev',
  now,
  command,
});

/** Lock In (long block), YouTube = tab 1, docs = tab 2, YouTube active (confronted). */
function confronted(): BarryState {
  return run(
    initialState(),
    sched(T0, block(T0 - MIN, T0 + 600 * MIN)),
    nav(1, YT),
    nav(2, DOCS),
    act(1),
  ).state;
}
const REACH_AT = T0 + MIN + T.warningMs;
/** Slack pass (1 min) from `confronted()`, then the first Reach is running (started at REACH_AT). */
function reaching(): BarryState {
  return run(confronted(), slack(MIN), tick(REACH_AT)).state;
}
function snoozing(): BarryState {
  let s = reaching();
  for (let i = 1; i <= T.maxPushes; i++) s = run(s, push(1, REACH_AT + i * 100)).state;
  return s;
}

describe('reset', () => {
  it('keeps what the runtime feeds (tabs, idle, ICS blocks, schedule known, todos) and drops dev blocks', () => {
    const s = run(
      initialState(),
      sched(T0, block(T0 + 5 * MIN, T0 + 9 * MIN)),
      dev({ kind: 'injectBlock', title: 'dev', durationMs: MIN }),
      nav(1, YT),
      act(1),
      idle(true, T0),
      { type: 'todosUpdated', todos: [{ text: 'x', sourceId: 's' }], now: T0 },
      eat(1),
      dev({ kind: 'reset' }, T0 + 5),
    ).state;
    expect(s.scheduleKnown).toBe(true);
    expect(s.blocks.map((b) => b.source)).toEqual(['ics']);
    expect(s.todos).toHaveLength(1);
    expect(s.userIdle).toBe(true);
    expect(s.openTabs).toEqual({ 1: YT });
    expect(s.activeTabId).toBe(1);
    expect(s.phase).toBe('clear');
    expect(s.fatness).toBe(0);
    expect(s.chudMeter).toBe(0);
  });
});

describe('dev blocks survive schedule refreshes', () => {
  it('an ICS refresh (every 5 minutes, and on every worker wake) does not wipe an injected block', () => {
    const s = run(
      initialState(),
      dev({ kind: 'injectBlock', title: 'ETF prep', durationMs: 10 * MIN }),
      nav(1, YT),
      act(1),
      sched(T0 + MIN),
    ).state;
    expect(s.blocks.map((b) => b.source)).toEqual(['dev']);
    expect(s.phase).toBe('confronting');
  });
  it('ICS blocks are still replaced wholesale', () => {
    const s = run(
      initialState(),
      sched(T0, block(T0, T0 + MIN)),
      sched(T0, block(T0 + 5, T0 + 9)),
    ).state;
    expect(s.blocks).toHaveLength(1);
    expect(s.blocks[0]?.start).toBe(T0 + 5);
  });
});

describe('Back to it', () => {
  it('only acts on the tab being confronted: stale or wrong-tab clicks never close a work tab', () => {
    const s = confronted();
    expect(run(s, back(2)).last).toEqual([]); // docs tab: not Restricted
    expect(run(s, back(99)).last).toEqual([]); // unknown tab
    expect(run(s, back(1)).last).toEqual([{ type: 'explodeAndClose', tabIds: [1] }]);
  });
  it('is ignored in Chill and once the tab has navigated to a work site', () => {
    const chill = run(confronted(), mode('chill'));
    expect(run(chill.state, back(1)).last).toEqual([]);
    const away = run(confronted(), nav(1, DOCS));
    expect(run(away.state, back(1)).last).toEqual([]);
  });
  it('is ignored during a Slack pass and the Arm fight', () => {
    expect(run(run(confronted(), slack(MIN)).state, back(1)).last).toEqual([]);
    expect(run(reaching(), back(1)).last).toEqual([]);
  });
});

describe('eaten on the wrong tab', () => {
  it('does nothing for a non-Restricted, closed or unknown tab', () => {
    const s = confronted();
    for (const id of [2, 99]) {
      const r = run(s, eat(id));
      expect(r.last).toEqual([]);
      expect(r.state.fatness).toBe(0);
    }
    const closed = run(s, close(1), eat(1));
    expect(closed.last).toEqual([]);
    expect(closed.state.fatness).toBe(0);
  });
});

describe('stale Arm fight events', () => {
  it('a Push after the Reach already landed is ignored', () => {
    const landed = run(reaching(), tick(REACH_AT + T.reachMs)).state;
    expect(landed.phase).toBe('clear');
    const r = run(landed, push(1, REACH_AT + T.reachMs + 5));
    expect(r.last).toEqual([]);
    expect(r.state.pushes).toBe(0);
  });
  it('a reachLanded from an old Reach (a Push restarted it) is ignored', () => {
    const s = run(reaching(), push(1, REACH_AT + 1000)).state;
    const r = run(s, {
      type: 'reachLanded',
      tabId: 1,
      reachStartedAt: REACH_AT,
      now: REACH_AT + T.reachMs,
    });
    expect(r.state.phase).toBe('reaching');
    expect(r.last).toEqual([]);
  });
  it('a duplicate reachLanded after landing does not explode twice', () => {
    const ev: BarryEvent = {
      type: 'reachLanded',
      tabId: 1,
      reachStartedAt: REACH_AT,
      now: REACH_AT + T.reachMs,
    };
    const first = run(reaching(), ev);
    expect(first.last).toEqual([{ type: 'explodeAndClose', tabIds: [1] }]);
    expect(run(first.state, ev).last).toEqual([]);
  });
  it('a second slackPassStarted is ignored (no restart, no extension)', () => {
    const s = run(confronted(), slack(MIN)).state;
    const r = run(s, slack(10 * MIN, T0 + 5)).state;
    expect(r.slackPassEndsAt).toBe(T0 + MIN);
  });
});

describe('mode flips mid-phase', () => {
  it('Confrontation -> Chill override: Barry goes calm; back to Lock In: confronts again', () => {
    const chill = run(confronted(), mode('chill', T0 + 1)).state;
    expect(chill.phase).toBe('clear');
    expect(brain.viewFor(chill, 1, T0 + 1).placement).toBe('corner');
    const lock = run(chill, mode('lockIn', T0 + 2)).state;
    expect(lock.phase).toBe('confronting');
    expect(brain.viewFor(lock, 1, T0 + 2).eatInput).toBe(true);
  });
  it('warning, Reach and Snooze all drop to clear on Chill, with nothing closed', () => {
    for (const s of [run(confronted(), slack(MIN), tick(T0 + MIN)).state, reaching(), snoozing()]) {
      const r = run(s, mode('chill', REACH_AT + 1000));
      expect(r.state.phase).toBe('clear');
      expect(r.last).toEqual([]);
      expect(r.state.pushes).toBe(0);
      expect(r.state.reachStartedAt).toBeNull();
      expect(r.state.snoozeEndsAt).toBeNull();
      expect(brain.viewFor(r.state, 1, REACH_AT + 1000)).toMatchObject({
        reach: null,
        pushesLeft: null,
      });
    }
  });
  it('a Snooze cut short by Chill keeps the Chud meter it earned', () => {
    const s = snoozing();
    const at = (s.snoozeEndsAt as number) - 2 * MIN;
    const r = run(s, mode('chill', at)).state;
    expect(r.chudMeter).toBeCloseTo((at - (REACH_AT + T.maxPushes * 100)) / T.chudFullMs, 5);
  });
  it('a calendar block ending mid-Arm-fight ends the fight (tick at the block end)', () => {
    const s = run(
      initialState(),
      sched(T0, block(T0 - MIN, REACH_AT + 2 * SEC)),
      nav(1, YT),
      act(1),
      slack(MIN),
      tick(REACH_AT),
    ).state;
    expect(s.phase).toBe('reaching');
    const r = run(s, tick(REACH_AT + 2 * SEC));
    expect(r.state.phase).toBe('clear');
    expect(r.last).toEqual([]);
    expect(r.state.openTabs[1]).toBe(YT);
  });
  it('a block starting while Chill with a Restricted tab active confronts, with the burst', () => {
    const s = run(
      initialState(),
      sched(T0, block(T0 + MIN, T0 + 10 * MIN)),
      nav(1, YT),
      act(1),
    ).state;
    expect(s.phase).toBe('clear');
    const r = run(s, tick(T0 + MIN));
    expect(r.state.phase).toBe('confronting');
    expect(r.last).toEqual([{ type: 'playSound', tabId: 1, sound: 'burst' }]);
  });
  it('a block ending during a Slack pass drops it; a forced Lock In keeps it', () => {
    const auto = run(
      initialState(),
      sched(T0, block(T0 - MIN, T0 + 30 * SEC)),
      nav(1, YT),
      act(1),
      slack(MIN),
    ).state;
    expect(run(auto, tick(T0 + 30 * SEC)).state.phase).toBe('clear');
    const forced = run(auto, mode('lockIn'), tick(T0 + 30 * SEC)).state;
    expect(forced.phase).toBe('slackPass');
  });
});

describe('tabs', () => {
  it('closing the confronted tab clears the Confrontation and Fatness (no Restricted tab left)', () => {
    const s = run(confronted(), eat(1), eat(1), close(1)).state;
    expect(s.phase).toBe('clear');
    expect(s.fatness).toBe(0);
    expect(s.arrivedTabs).toEqual([]);
  });
  it('closing the active Restricted tab mid-Reach with another still open keeps the Reach', () => {
    const s = run(reaching(), nav(3, REDDIT), close(1)).state;
    expect(s.phase).toBe('reaching');
    const r = run(s, {
      type: 'reachLanded',
      tabId: 3,
      reachStartedAt: REACH_AT,
      now: REACH_AT + T.reachMs,
    });
    expect(r.last).toEqual([{ type: 'explodeAndClose', tabIds: [3] }]);
  });
  it('closing the last Restricted tab mid-Reach or mid-warning ends the fight quietly', () => {
    const r = run(reaching(), close(1), tick(REACH_AT + 100));
    expect(r.state.phase).toBe('clear');
    expect(r.effects.flat()).toEqual([]);
    const w = run(
      run(confronted(), slack(MIN), tick(T0 + MIN)).state,
      close(1),
      tick(T0 + MIN + T.warningMs),
    );
    expect(w.state.phase).toBe('clear');
    expect(w.effects.flat()).toEqual([]);
  });
  it('navigating the confronted tab to a work site shows corner Barry; Fatness stays while another Restricted tab is open', () => {
    const s = run(confronted(), nav(3, REDDIT), eat(1), eat(1), nav(1, DOCS)).state;
    expect(s.phase).toBe('clear');
    expect(s.fatness).toBe(2);
    expect(brain.viewFor(s, 1, T0).placement).toBe('corner');
    expect(run(s, close(3)).state.fatness).toBe(0);
  });
  it('tabActivated(null) (Chrome unfocused) is calm and safe', () => {
    const r = run(confronted(), act(null));
    expect(r.state.phase).toBe('clear');
    expect(r.state.studyingSince).not.toBeNull(); // no active tab = not on a Restricted tab
    expect(brain.viewFor(r.state, 1, T0).placement).toBe('corner');
  });
  it('two Restricted tabs: only the active one is confronted; one Reach closes both', () => {
    let s = run(confronted(), nav(3, REDDIT)).state;
    expect(brain.viewFor(s, 3, T0).placement).toBe('corner');
    expect(brain.viewFor(s, 1, T0).placement).toBe('face');
    s = run(s, slack(MIN), tick(REACH_AT)).state;
    const r = run(s, {
      type: 'reachLanded',
      tabId: 1,
      reachStartedAt: REACH_AT,
      now: REACH_AT + T.reachMs,
    });
    expect(r.last).toEqual([{ type: 'explodeAndClose', tabIds: [1, 3] }]);
  });
  it('every view has tabSlot null (the runtime fills it in)', () => {
    for (const s of [confronted(), reaching(), snoozing(), initialState()]) {
      for (const id of [1, 2, 99]) expect(brain.viewFor(s, id, REACH_AT + 500).tabSlot).toBeNull();
    }
  });
});

describe('time jumps', () => {
  const HOURS3 = 3 * 60 * MIN;
  it('a tick 3 hours into a Snooze: Reach has long since landed, Chud meter capped, tabs closed once', () => {
    const s = snoozing();
    const before = s.chudMeter;
    const r = run(s, tick(REACH_AT + HOURS3));
    expect(r.state.phase).toBe('clear');
    expect(r.last).toEqual([{ type: 'explodeAndClose', tabIds: [1] }]);
    // Only the Snooze's own length (5 min of 15) counts, not the 3 hours.
    expect(r.state.chudMeter).toBeGreaterThan(before);
    expect(r.state.chudMeter).toBeLessThanOrEqual(T.snoozeMs / T.chudFullMs + 0.01);
    expect(r.state.fatness).toBe(0);
  });
  it('a tick 3 hours into a Reach lands it once', () => {
    const r = run(reaching(), tick(REACH_AT + HOURS3));
    expect(r.state.phase).toBe('clear');
    expect(r.last).toEqual([{ type: 'explodeAndClose', tabIds: [1] }]);
  });
  it('a tick 3 hours into a Slack pass walks warning -> Reach -> landing in one step', () => {
    const r = run(run(confronted(), slack(MIN)).state, tick(T0 + HOURS3));
    expect(r.state.phase).toBe('clear');
    expect(r.last).toEqual([{ type: 'explodeAndClose', tabIds: [1] }]);
  });
  it('Chud meter and studyingSince stay finite and in range across a 3 hour gap', () => {
    const s = run(snoozing(), tick(REACH_AT + HOURS3), tick(REACH_AT + 2 * HOURS3)).state;
    expect(s.chudMeter).toBeGreaterThanOrEqual(0);
    expect(s.chudMeter).toBeLessThanOrEqual(1);
    expect(Number.isFinite(s.chudMeter)).toBe(true);
  });
  it('now going backwards a little never reduces the Chud meter or double counts Snooze time', () => {
    const s = snoozing();
    const t = REACH_AT + 5 * SEC;
    const a = run(s, tick(t)).state;
    const b = run(a, tick(t - 50)).state; // clock stepped back 50ms
    expect(b.chudMeter).toBeGreaterThanOrEqual(a.chudMeter);
    const c = run(b, tick(t + 100)).state; // and forward again: only 50ms new time since `a`
    const d = run(a, tick(t + 100)).state;
    expect(c.chudMeter).toBeCloseTo(d.chudMeter, 9);
    expect(b.lastNow).toBe(t);
  });
  it('now going backwards does not break phases or timers', () => {
    const s = reaching();
    const r = run(s, tick(REACH_AT - 5000));
    expect(r.state.phase).toBe('reaching');
    expect(Number.isFinite(brain.nextDeadline(r.state) as number)).toBe(true);
  });
});

describe('idleChanged in every phase', () => {
  it('never changes the phase, never throws, and only Studying cares', () => {
    const phases: [string, BarryState][] = [
      ['confronting', confronted()],
      ['warning', run(confronted(), slack(MIN), tick(T0 + MIN)).state],
      ['slackPass', run(confronted(), slack(MIN)).state],
      ['reaching', reaching()],
      ['snoozing', snoozing()],
    ];
    for (const [name, s] of phases) {
      const at = (s.lastNow as number) + 1000;
      const a = run(s, idle(true, at));
      expect(a.state.phase, name).toBe(s.phase);
      expect(a.state.studyingSince, name).toBeNull();
      const b = run(a.state, idle(false, at + 1000));
      expect(b.state.phase, name).toBe(s.phase);
      expect(b.effects.flat(), name).toEqual([]);
    }
  });
  it('idle then active on a work tab restarts the Studying stretch at the return', () => {
    const s = run(confronted(), act(2, T0 + 1000)).state;
    expect(s.studyingSince).toBe(T0 + 1000);
    const away = run(s, idle(true, T0 + 5000)).state;
    expect(away.studyingSince).toBeNull();
    expect(run(away, idle(false, T0 + 9000)).state.studyingSince).toBe(T0 + 9000);
  });
  it('idle during a Snooze does not stop the Chud meter filling (it is wall time)', () => {
    const s = snoozing();
    const r = run(s, idle(true, REACH_AT + MIN), tick(REACH_AT + 2 * MIN)).state;
    expect(r.chudMeter).toBeGreaterThan(s.chudMeter);
  });
});

describe('setTuning mid-phase', () => {
  it('DEMO_TUNING applied mid-Snooze keeps the running Snooze and Chud meter, and speeds the fill', () => {
    const s = snoozing();
    const at = REACH_AT + 10 * SEC;
    const r = run(s, tune(DEMO_TUNING, at));
    expect(r.state.snoozeEndsAt).toBe(s.snoozeEndsAt);
    const later = run(r.state, tick(at + 30 * SEC)).state;
    // Chud fills at 1/60s after the switch (30s = +0.5), plus what the default rate gave before.
    expect(later.chudMeter).toBeCloseTo(r.state.chudMeter + 0.5, 3);
    expect(later.chudMeter).toBeLessThanOrEqual(1);
  });
  it('lowering maxPushes below the pushes already made never shows negative pushesLeft', () => {
    let s = reaching();
    s = run(
      s,
      push(1, REACH_AT + 100),
      push(1, REACH_AT + 200),
      push(1, REACH_AT + 300),
      tune({ maxPushes: 2 }, REACH_AT + 400),
    ).state;
    expect(brain.viewFor(s, 1, REACH_AT + 400).pushesLeft).toBe(0);
    expect(run(s, push(1, REACH_AT + 500)).state.phase).toBe('snoozing');
  });
  it('a shorter reachMs mid-Reach lands on the next tick', () => {
    const s = run(reaching(), tune({ reachMs: 1000 }, REACH_AT + 2000)).state;
    expect(s.phase).toBe('clear'); // already past the new end: lands at once
  });
  it('a shorter snoozeMs only applies to the next Snooze', () => {
    const s = snoozing();
    expect(run(s, tune({ snoozeMs: SEC }, REACH_AT + 1000)).state.snoozeEndsAt).toBe(
      s.snoozeEndsAt,
    );
  });
  it('a shorter warningMs does not touch a running warning', () => {
    const s = run(confronted(), slack(MIN), tick(T0 + MIN)).state;
    expect(run(s, tune({ warningMs: SEC }, T0 + MIN + 1)).state.warningEndsAt).toBe(
      s.warningEndsAt,
    );
  });
});

describe('Slack pass controls (Stop Slacking, change length)', () => {
  const stop = (now: number): BarryEvent => ({ type: 'slackPassStopped', now });
  const change = (durationMs: number, now: number): BarryEvent => ({
    type: 'slackPassChanged',
    durationMs,
    now,
  });

  it('Stop Slacking on a Restricted tab confronts right away and closes nothing', () => {
    const s = run(confronted(), slack(5 * MIN), stop(T0 + MIN));
    expect(s.state.phase).toBe('confronting');
    expect(s.state.slackPassEndsAt).toBeNull();
    expect(s.state.slackPassStartedAt).toBeNull();
    expect(s.last.some((e) => e.type === 'explodeAndClose')).toBe(false);
    expect(brain.viewFor(s.state, 1, T0 + MIN).eatInput).toBe(true);
  });

  it('Stop Slacking on a normal tab goes back to studying', () => {
    const s = run(confronted(), slack(5 * MIN), act(2, T0 + 1), stop(T0 + MIN)).state;
    expect(s.phase).toBe('clear');
    expect(brain.nextDeadline(s)).not.toBe(T0 + 5 * MIN);
  });

  it('Stop Slacking outside a Slack pass is ignored', () => {
    const r = run(reaching(), stop(REACH_AT + 5)).state;
    expect(r.phase).toBe('reaching');
  });

  it('changing the length counts from the original start', () => {
    const s = run(confronted(), slack(MIN), change(10 * MIN, T0 + 30 * SEC)).state;
    expect(s.phase).toBe('slackPass');
    expect(s.slackPassStartedAt).toBe(T0);
    expect(s.slackPassEndsAt).toBe(T0 + 10 * MIN);
    expect(brain.nextDeadline(s)).toBe(T0 + 10 * MIN);
  });

  it('shortening past the time already used ends the break into the warning', () => {
    const s = run(confronted(), slack(15 * MIN), change(MIN, T0 + MIN + SEC)).state;
    expect(s.phase).toBe('warning');
    expect(s.warningStartedAt).toBe(T0 + MIN);
    expect(s.warningEndsAt).toBe(T0 + MIN + T.warningMs);
  });

  it('changing outside a Slack pass is ignored', () => {
    const s = run(confronted(), change(10 * MIN, T0 + 5)).state;
    expect(s.phase).toBe('confronting');
    expect(s.slackPassEndsAt).toBeNull();
  });
});
