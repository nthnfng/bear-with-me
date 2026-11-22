import { describe, expect, it } from 'vitest';
import type { BarryEvent, BarryState, CalendarBlock, Task } from '../contracts';
import { DEFAULT_TUNING } from '../contracts';
import { brain, caveAllowed, initialState } from '.';

const YT = 'https://www.youtube.com/watch?v=1';
const DOCS = 'https://docs.google.com/';
const T0 = 10_000_000;
const MIN = 60_000;
const T = DEFAULT_TUNING;

function run(state: BarryState, ...events: BarryEvent[]) {
  let s = state;
  const effects = events.map((e) => {
    const r = brain.reduce(s, e);
    s = r.state;
    return r.effects;
  });
  return { state: s, last: effects[effects.length - 1] ?? [], effects };
}
const tick = (now: number): BarryEvent => ({ type: 'tick', now });
const block = (start: number, end: number, id = `b${start}`): CalendarBlock => ({
  id,
  title: 'Study',
  start,
  end,
  allDay: false,
  source: 'ics',
});
const sched = (now: number, ...blocks: CalendarBlock[]): BarryEvent => ({
  type: 'scheduleUpdated',
  blocks,
  now,
});
const nav = (tabId: number, url: string, now = T0): BarryEvent => ({
  type: 'tabNavigated',
  tabId,
  url,
  now,
});
const act = (tabId: number | null, now = T0): BarryEvent => ({ type: 'tabActivated', tabId, now });
const idle = (idle: boolean, now: number): BarryEvent => ({ type: 'idleChanged', idle, now });
const setChud = (value: number, now = T0): BarryEvent => ({
  type: 'dev',
  now,
  command: { kind: 'setChudMeter', value },
});
const task = (title: string): Task => ({
  id: title,
  title,
  description: '',
  estimateMs: 30 * 60_000,
  done: false,
  doneAt: null,
});
const todos = (now: number, ...titles: string[]): BarryEvent => ({
  type: 'tasksSet',
  now,
  tasks: titles.map(task),
});

/** Lock In for a long block, a YouTube tab (1) and a docs tab (2), docs active. */
function working(extra: Partial<BarryState> = {}): BarryState {
  return {
    ...run(
      initialState(),
      sched(T0, block(T0 - MIN, T0 + 600 * MIN)),
      nav(1, YT),
      nav(2, DOCS),
      act(2),
    ).state,
    ...extra,
  };
}

/** Fight to a Snooze on tab 1 (YouTube): Slack pass, expire, warning, reach, 5 pushes. */
function snoozing(): BarryState {
  let s = run(working(), act(1), { type: 'slackPassStarted', durationMs: MIN, now: T0 }).state;
  s = run(s, tick(T0 + MIN + T.warningMs)).state; // reaching starts at T0+MIN+warning
  const start = T0 + MIN + T.warningMs;
  for (let i = 0; i < T.maxPushes; i++) {
    s = run(s, { type: 'pushed', tabId: 1, now: start + 100 * (i + 1) }).state;
  }
  expect(s.phase).toBe('snoozing');
  return s;
}

describe('Chud meter fill', () => {
  it('fills from Snooze time only, by timestamps', () => {
    const s = snoozing();
    const t = s.lastNow!;
    const r = run(s, tick(t + T.snoozeMs / 5)).state;
    expect(r.chudMeter).toBeCloseTo(T.snoozeMs / 5 / T.chudFullMs);
  });

  it('stops at the Snooze end and the meter carries across Lock In ending', () => {
    const s = snoozing();
    const end = s.snoozeEndsAt!;
    const r = run(s, tick(end + 10 * MIN)).state;
    expect(r.chudMeter).toBeCloseTo(T.snoozeMs / T.chudFullMs);
    const over = run(r, { type: 'modeOverrideSet', override: 'chill', now: end + 11 * MIN }).state;
    expect(over.chudMeter).toBeCloseTo(T.snoozeMs / T.chudFullMs);
  });

  it('does not fill outside a Snooze (Chill, Slack pass, Confrontation)', () => {
    const chill = run(initialState(), nav(1, YT), act(1), tick(T0 + 99 * MIN)).state;
    expect(chill.chudMeter).toBe(0);
    const c = run(working(), act(1), tick(T0 + 5 * MIN)).state;
    expect(c.phase).toBe('confronting');
    expect(c.chudMeter).toBe(0);
    const slack = run(
      working(),
      act(1),
      { type: 'slackPassStarted', durationMs: 5 * MIN, now: T0 },
      tick(T0 + 4 * MIN),
    ).state;
    expect(slack.chudMeter).toBe(0);
  });

  it('is not reset by mode change or Slack pass, and clamps at 1', () => {
    let s = run(working(), setChud(0.5)).state;
    s = run(s, { type: 'slackPassStarted', durationMs: MIN, now: T0 }).state;
    expect(s.chudMeter).toBe(0.5);
    s = run(s, { type: 'modeOverrideSet', override: 'chill', now: T0 + 1 }).state;
    expect(s.chudMeter).toBe(0.5);
    const sn = { ...snoozing(), chudMeter: 0.9 };
    expect(run(sn, tick(sn.lastNow! + 4 * MIN)).state.chudMeter).toBe(1);
  });

  it('nextDeadline includes the moment the meter fills during a Snooze', () => {
    const s = { ...snoozing(), chudMeter: 0.8 };
    const at = s.lastNow! + 0.2 * T.chudFullMs;
    expect(at).toBeLessThan(s.snoozeEndsAt!);
    // Snooze stage boundaries come first; from the tired stage on, the fill moment is next.
    let t = s;
    for (let i = 0; i < 10 && brain.nextDeadline(t)! < at; i++)
      t = run(t, tick(brain.nextDeadline(t)!)).state;
    expect(brain.nextDeadline(t)).toBe(at);
  });
});

describe('Studying and Locking back in', () => {
  const half = 0.5;

  it('10 unbroken minutes of Studying resets the meter, via the deadline', () => {
    let s = run(working(), setChud(half)).state;
    expect(s.studyingSince).toBe(T0);
    expect(brain.nextDeadline(s)).toBe(T0 + T.lockBackInMs);
    s = run(s, tick(T0 + T.lockBackInMs - 1)).state;
    expect(s.chudMeter).toBe(half);
    s = run(s, tick(T0 + T.lockBackInMs)).state;
    expect(s.chudMeter).toBe(0);
  });

  it('does not run in Chill', () => {
    const s = run(initialState(), setChud(half), nav(2, DOCS), act(2), tick(T0 + 60 * MIN)).state;
    expect(s.studyingSince).toBeNull();
    expect(s.chudMeter).toBe(half);
  });

  it('a Restricted active tab (Confrontation) breaks the stretch', () => {
    let s = run(working(), setChud(half)).state;
    s = run(s, act(1, T0 + 5 * MIN)).state;
    expect(s.studyingSince).toBeNull();
    s = run(s, act(2, T0 + 6 * MIN), tick(T0 + 15 * MIN)).state;
    expect(s.chudMeter).toBe(half);
    expect(s.studyingSince).toBe(T0 + 6 * MIN);
    s = run(s, tick(T0 + 16 * MIN)).state;
    expect(s.chudMeter).toBe(0);
  });

  it('idle pauses and discards the stretch; walking away does not count', () => {
    let s = run(working(), setChud(half)).state;
    s = run(s, idle(true, T0 + 5 * MIN)).state;
    expect(s.studyingSince).toBeNull();
    expect(brain.nextDeadline(s)).not.toBe(T0 + T.lockBackInMs);
    s = run(s, idle(false, T0 + 60 * MIN)).state;
    expect(s.chudMeter).toBe(half);
    expect(s.studyingSince).toBe(T0 + 60 * MIN);
    s = run(s, tick(T0 + 60 * MIN + T.lockBackInMs)).state;
    expect(s.chudMeter).toBe(0);
  });

  it('a late idle event does not credit the idle threshold as Studying', () => {
    let s = run(working(), setChud(half)).state;
    // Idle fires 5 min after last input: the stretch effectively ended at T0+6min.
    s = run(s, idle(true, T0 + 6 * MIN + T.idleAfterSec * 1000)).state;
    expect(s.chudMeter).toBe(half);
  });

  it('Slack pass and Snooze are not Studying', () => {
    const slack = run(working(), { type: 'slackPassStarted', durationMs: 5 * MIN, now: T0 }).state;
    expect(slack.studyingSince).toBeNull();
    expect(snoozing().studyingSince).toBeNull();
  });
});

describe('Full Chud meter', () => {
  it('uses chud pose in a Confrontation and the Arm fight', () => {
    const c = run(working(), setChud(1), act(1)).state;
    expect(brain.viewFor(c, 1, T0)).toMatchObject({
      pose: 'chud-point',
      placement: 'face',
      eatInput: true,
    });
    let r = run(working(), setChud(1), act(1), {
      type: 'slackPassStarted',
      durationMs: MIN,
      now: T0,
    }).state;
    r = run(r, tick(T0 + MIN + T.warningMs)).state;
    expect(r.phase).toBe('reaching');
    expect(brain.viewFor(r, 1, T0 + MIN + T.warningMs)).toMatchObject({
      pose: 'chud',
    });
    // the warning is not an Arm fight
    expect(brain.viewFor(r, 1, T0).pose).toBeDefined();
  });

  it('is not chud below full, and muted silences the song', () => {
    const c = run(working(), setChud(0.99), act(1));
    expect(brain.viewFor(c.state, 1, T0)).toMatchObject({ pose: 'suspicious' });
    expect(c.last).toEqual([{ type: 'playSound', tabId: 1, sound: 'burst' }]);
    const m = run(working(), setChud(1), { type: 'mutedSet', muted: true, now: T0 }, act(1));
    expect(brain.viewFor(m.state, 1, T0)).toMatchObject({ pose: 'chud-point' });
    expect(m.last).toEqual([]);
  });

  it('emits chudSong with the burst on arrival, once per tab', () => {
    const r = run(working(), setChud(1), act(1));
    expect(r.last).toEqual([
      { type: 'playSound', tabId: 1, sound: 'burst' },
      { type: 'playSound', tabId: 1, sound: 'chudSong' },
    ]);
    expect(r.state.arrivedTabs).toEqual([1]);
    // away and back: nothing replays
    const back = run(r.state, act(2, T0 + 1), act(1, T0 + 2));
    expect(back.effects.flat()).toEqual([]);
    expect(back.state.arrivedTabs).toEqual([1]);
  });

  it('forgets arrivals on tabClosed, navigating away, Slack pass, Snooze, Lock In end, reset (re-arrives)', () => {
    const arrived = run(working(), act(1)).state;
    expect(arrived.arrivedTabs).toEqual([1]);
    expect(run(arrived, { type: 'tabClosed', tabId: 1, now: T0 + 1 }).state.arrivedTabs).toEqual(
      [],
    );
    expect(run(arrived, nav(1, DOCS, T0 + 1)).state.arrivedTabs).toEqual([]);
    const slack = run(arrived, { type: 'slackPassStarted', durationMs: MIN, now: T0 + 1 });
    expect(slack.state.arrivedTabs).toEqual([]);
    expect(snoozing().arrivedTabs).toEqual([]);
    const chill = run(arrived, { type: 'modeOverrideSet', override: 'chill', now: T0 + 1 });
    expect(chill.state.arrivedTabs).toEqual([]);
    const rst = run(arrived, { type: 'dev', now: T0 + 1, command: { kind: 'reset' } });
    // The ICS block survives a reset, so the still-confronted tab arrives afresh (burst again).
    expect(rst.last).toContainEqual({ type: 'playSound', tabId: 1, sound: 'burst' });
    const meter = run(arrived, setChud(1, T0 + 1));
    // setChudMeter forgets, so the still-confronted tab arrives again and sings
    expect(meter.last).toContainEqual({ type: 'playSound', tabId: 1, sound: 'chudSong' });
  });

  it('the Arm fight starts the song (no burst) when the meter is full', () => {
    let r = run(working(), setChud(1), act(1), {
      type: 'slackPassStarted',
      durationMs: MIN,
      now: T0,
    });
    const at = T0 + MIN + T.warningMs;
    r = run(r.state, tick(at));
    expect(r.last).toEqual([{ type: 'playSound', tabId: 1, sound: 'chudSong' }]);
    expect(run(r.state, act(2, at + 1), act(1, at + 2)).effects.flat()).toEqual([]);
  });

  it('ends when the user Locks back in', () => {
    let s = run(working(), setChud(1)).state;
    s = run(s, tick(T0 + T.lockBackInMs), act(1, T0 + T.lockBackInMs)).state;
    expect(brain.viewFor(s, 1, T0 + T.lockBackInMs)).toMatchObject({
      pose: 'suspicious',
    });
  });

  it('becomes chud when the meter fills during a Snooze, then the Reach returns', () => {
    let s = { ...snoozing(), chudMeter: 0.9 };
    const full = s.lastNow! + 0.1 * T.chudFullMs;
    expect(run(s, tick(full)).state.chudMeter).toBe(1);
    s = run(s, tick(s.snoozeEndsAt!)).state;
    expect(s.phase).toBe('reaching');
    expect(brain.viewFor(s, 1, s.lastNow!)).toMatchObject({ pose: 'chud' });
  });
});

describe('Free-time suggestion', () => {
  const gapStart = T0;
  const nextStart = T0 + 45 * MIN;
  const chillWith = (...extra: BarryEvent[]) =>
    run(
      initialState(),
      nav(1, DOCS),
      act(1),
      sched(T0, block(T0 - 60 * MIN, gapStart), block(nextStart, nextStart + 60 * MIN)),
      todos(T0, 'Lab report', 'Laundry'),
      ...extra,
    );

  it('suggests the top todo on the active tab, once per gap', () => {
    const r = chillWith();
    expect(r.last).toEqual([
      {
        type: 'showSuggestion',
        tabId: 1,
        task: task('Lab report'),
        freeMinutes: 45,
      },
    ]);
    expect(r.state.lastGapSuggested).toBe(gapStart);
    expect(run(r.state, tick(T0 + MIN), act(1, T0 + 2 * MIN)).effects.flat()).toEqual([]);
  });

  it('does not suggest when the gap is too short', () => {
    const r = run(
      initialState(),
      nav(1, DOCS),
      act(1),
      todos(T0, 'x'),
      sched(T0, block(T0 + 19 * MIN, T0 + 80 * MIN)),
    );
    expect(r.last).toEqual([]);
  });

  it('suggests again in the next gap', () => {
    const s = chillWith().state;
    const end = nextStart + 60 * MIN;
    const r = run(
      s,
      sched(
        end - MIN,
        block(T0 - 60 * MIN, gapStart),
        block(nextStart, end),
        block(end + 30 * MIN, end + 90 * MIN),
      ),
      tick(end),
    );
    expect(r.last).toMatchObject([{ type: 'showSuggestion', freeMinutes: 30 }]);
  });

  it('is Chill only, and not during a running block', () => {
    const lock = run(
      working(),
      todos(T0, 'x'),
      sched(T0, block(T0 - MIN, T0 + 10 * MIN), block(T0 + 60 * MIN, T0 + 90 * MIN)),
    );
    expect(lock.effects.flat()).toEqual([]);
  });

  it('with no upcoming block it suggests once with freeMinutes null', () => {
    const r = run(initialState(), nav(1, DOCS), act(1), sched(T0), todos(T0, 'x'));
    expect(r.last).toMatchObject([{ type: 'showSuggestion', tabId: 1, freeMinutes: null }]);
    expect(run(r.state, tick(T0 + MIN), act(1, T0 + 2 * MIN)).effects.flat()).toEqual([]);
  });

  it('with no next block, suggests again after a block has ended', () => {
    const s = run(initialState(), nav(1, DOCS), act(1), sched(T0), todos(T0, 'x')).state;
    const b = block(T0 + MIN, T0 + 2 * MIN);
    const r = run(s, sched(T0 + MIN, b), tick(T0 + 2 * MIN));
    expect(r.last).toMatchObject([{ type: 'showSuggestion', freeMinutes: null }]);
    expect(run(r.state, tick(T0 + 3 * MIN)).last).toEqual([]);
  });

  it('counts a block on a later day as the next block', () => {
    const r = run(
      initialState(),
      nav(1, DOCS),
      act(1),
      sched(T0, block(T0 + 30 * 60 * MIN, T0 + 31 * 60 * MIN)),
      todos(T0, 'x'),
    );
    expect(r.last).toMatchObject([{ freeMinutes: 1800 }]);
  });

  it('waits (without using up the gap) for a todo, an active tab, and no cave', () => {
    const base = run(initialState(), sched(T0, block(nextStart, nextStart + MIN)), {
      type: 'caveSet',
      cave: true,
      now: T0,
    });
    expect(base.state.lastGapSuggested).toBeNull();
    const later = run(base.state, nav(1, DOCS), act(1), todos(T0, 'x'));
    expect(later.effects.flat()).toEqual([]);
    const uncaved = run(later.state, { type: 'caveSet', cave: false, now: T0 + 1 });
    expect(uncaved.last).toMatchObject([{ type: 'showSuggestion', tabId: 1 }]);
  });

  it('waits for the schedule: todos first on a fresh install never suggest "free right now"', () => {
    const early = run(initialState(), nav(1, DOCS), act(1), todos(T0, 'x'), tick(T0 + MIN));
    expect(early.effects.flat()).toEqual([]);
    expect(early.state.scheduleKnown).toBe(false);
    expect(early.state.lastGapSuggested).toBeNull();
    // The schedule arrives with a block 45 min away: the suggestion carries the real gap.
    const r = run(early.state, sched(T0 + 2 * MIN, block(T0 + 45 * MIN, T0 + 90 * MIN)));
    expect(r.state.scheduleKnown).toBe(true);
    expect(r.last).toMatchObject([{ type: 'showSuggestion', freeMinutes: 43 }]);
  });

  it('an empty schedule still counts as known', () => {
    const r = run(initialState(), nav(1, DOCS), act(1), todos(T0, 'x'), sched(T0));
    expect(r.state.scheduleKnown).toBe(true);
    expect(r.last).toMatchObject([{ type: 'showSuggestion', freeMinutes: null }]);
  });

  it('dev triggerFreeGap forces one even before the schedule is known', () => {
    const r = run(initialState(), nav(1, DOCS), act(1), todos(T0, 'x'), {
      type: 'dev',
      now: T0,
      command: { kind: 'triggerFreeGap' },
    });
    expect(r.state.scheduleKnown).toBe(false);
    expect(r.last).toHaveLength(1);
  });

  it('dev triggerFreeGap forces one', () => {
    const r = run(initialState(), nav(1, DOCS), act(1), todos(T0, 'x'), sched(T0), {
      type: 'dev',
      now: T0,
      command: { kind: 'triggerFreeGap' },
    });
    expect(r.last).toEqual([
      { type: 'showSuggestion', tabId: 1, task: task('x'), freeMinutes: null },
    ]);
  });
});

describe('Cave rules and settings events', () => {
  it('cave hides calm Barry on non-Restricted tabs in any break phase, never a Restricted-tab fight view', () => {
    const s = { ...snoozing(), cave: true };
    expect(brain.viewFor(s, 2, s.lastNow!).visible).toBe(false);
    expect(brain.viewFor(s, 1, s.lastNow!)).toMatchObject({ visible: true, pose: 'got-owned' });
  });

  it('caveAllowed is false in Lock In while a Restricted tab is in play', () => {
    expect(caveAllowed(initialState(), T0)).toBe(true);
    expect(caveAllowed(working(), T0)).toBe(true);
    expect(caveAllowed(run(working(), act(1)).state, T0)).toBe(false);
    expect(caveAllowed(snoozing(), T0)).toBe(false);
  });

  it('blocklistSet re-evaluates the Confrontation', () => {
    const c = run(working(), act(1)).state;
    expect(c.phase).toBe('confronting');
    const off = run(c, {
      type: 'blocklistSet',
      blocklist: [{ domain: 'youtube.com', enabled: false }],
      now: T0 + 1,
    }).state;
    expect(off.phase).toBe('clear');
    expect(off.fatness).toBe(0);
  });

  it('positionSet and mutedSet apply; muted drops playSound', () => {
    let s = run(working(), { type: 'positionSet', position: 'left', now: T0 }).state;
    expect(brain.viewFor(s, 2, T0).position).toBe('left');
    s = run(s, { type: 'mutedSet', muted: true, now: T0 }).state;
    expect(run(s, act(1)).last).toEqual([]);
  });

  it('tasksSet and scheduleUpdated store their data', () => {
    const s = run(initialState(), todos(T0, 'a'), sched(T0, block(1, 2))).state;
    expect(s.tasks[0]?.title).toBe('a');
    expect(s.blocks).toHaveLength(1);
  });
});
