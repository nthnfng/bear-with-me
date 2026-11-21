import { describe, expect, it } from 'vitest';
import type { BarryEvent, BarryState, CalendarBlock, Todo } from '../contracts';
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
const todos = (now: number, ...texts: string[]): BarryEvent => ({
  type: 'todosUpdated',
  now,
  todos: texts.map((text): Todo => ({ text, sourceId: 's' })),
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
    // live view value between events
    expect(brain.viewFor(s, 1, t + MIN).chudMeter).toBeCloseTo(MIN / T.chudFullMs);
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
    expect(brain.nextDeadline(s)).toBe(at);
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
  it('uses chud pose and singChud in a Confrontation and the Arm fight', () => {
    const c = run(working(), setChud(1), act(1)).state;
    expect(brain.viewFor(c, 1, T0)).toMatchObject({
      pose: 'chud',
      placement: 'face',
      singChud: true,
      chudMeter: 1,
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
      singChud: true,
    });
    // the warning is not an Arm fight
    expect(brain.viewFor(r, 1, T0).pose).toBeDefined();
  });

  it('is not chud below full, and muted silences the song', () => {
    const c = run(working(), setChud(0.99), act(1)).state;
    expect(brain.viewFor(c, 1, T0)).toMatchObject({ pose: 'confrontation', singChud: false });
    const m = run(working(), setChud(1), act(1), { type: 'mutedSet', muted: true, now: T0 }).state;
    expect(brain.viewFor(m, 1, T0)).toMatchObject({ pose: 'chud', singChud: false });
  });

  it('ends when the user Locks back in', () => {
    let s = run(working(), setChud(1)).state;
    s = run(s, tick(T0 + T.lockBackInMs), act(1, T0 + T.lockBackInMs)).state;
    expect(brain.viewFor(s, 1, T0 + T.lockBackInMs)).toMatchObject({
      pose: 'confrontation',
      singChud: false,
    });
  });

  it('becomes chud when the meter fills during a Snooze, then the Reach returns', () => {
    let s = { ...snoozing(), chudMeter: 0.9 };
    const full = s.lastNow! + 0.1 * T.chudFullMs;
    expect(brain.viewFor(s, 1, full).chudMeter).toBe(1);
    s = run(s, tick(s.snoozeEndsAt!)).state;
    expect(s.phase).toBe('reaching');
    expect(brain.viewFor(s, 1, s.lastNow!)).toMatchObject({ pose: 'chud', singChud: true });
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
      todos(T0, 'Lab report', 'Laundry'),
      sched(T0, block(T0 - 60 * MIN, gapStart), block(nextStart, nextStart + 60 * MIN)),
      ...extra,
    );

  it('suggests the top todo on the active tab, once per gap', () => {
    const r = chillWith();
    expect(r.last).toEqual([
      {
        type: 'showSuggestion',
        tabId: 1,
        todo: { text: 'Lab report', sourceId: 's' },
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

  it('with no upcoming block there is nothing to fill: no suggestion', () => {
    const r = run(initialState(), nav(1, DOCS), act(1), todos(T0, 'x'), tick(T0 + MIN));
    expect(r.effects.flat()).toEqual([]);
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

  it('dev triggerFreeGap forces one', () => {
    const r = run(initialState(), nav(1, DOCS), act(1), todos(T0, 'x'), {
      type: 'dev',
      now: T0,
      command: { kind: 'triggerFreeGap' },
    });
    expect(r.last).toEqual([
      { type: 'showSuggestion', tabId: 1, todo: { text: 'x', sourceId: 's' }, freeMinutes: 20 },
    ]);
  });
});

describe('Cave rules and settings events', () => {
  it('cave hides calm Barry on non-Restricted tabs in any break phase, never a Restricted-tab fight view', () => {
    const s = { ...snoozing(), cave: true };
    expect(brain.viewFor(s, 2, s.lastNow!).visible).toBe(false);
    expect(brain.viewFor(s, 1, s.lastNow!)).toMatchObject({ visible: true, pose: 'beaten' });
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

  it('todosUpdated and scheduleUpdated store their data', () => {
    const s = run(initialState(), todos(T0, 'a'), sched(T0, block(1, 2))).state;
    expect(s.todos[0]?.text).toBe('a');
    expect(s.blocks).toHaveLength(1);
  });
});
