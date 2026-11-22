// Phase 5: sprite poses, Fatness tiers, Snooze stages, Get up, poseSince.
import { describe, expect, it } from 'vitest';
import type { BarryEvent, BarryState, CalendarBlock, TabId, Tuning } from '../contracts';
import { DEFAULT_TUNING } from '../contracts';
import {
  brain,
  initialState,
  GOT_UP_HAPPY_MS,
  OKAY_MS,
  SNOOZE_GET_UP_MS,
  SNOOZE_GRIEVED_MS,
  SNOOZE_KNOCKED_MS,
  SNOOZE_OW_MS,
} from '.';

const YT = 'https://www.youtube.com/watch?v=1';
const REDDIT = 'https://www.reddit.com/r/x';
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
  return { state: s, effects, last: effects[effects.length - 1] ?? [] };
}
const block = (start: number, end: number): CalendarBlock => ({
  id: 'b',
  title: 'Study',
  start,
  end,
  allDay: false,
  source: 'ics',
});
const nav = (tabId: TabId, url: string, now = T0): BarryEvent => ({
  type: 'tabNavigated',
  tabId,
  url,
  now,
});
const act = (tabId: TabId | null, now = T0): BarryEvent => ({ type: 'tabActivated', tabId, now });
const eat = (tabId: TabId, now = T0): BarryEvent => ({ type: 'eaten', tabId, kind: 'click', now });
const push = (tabId: TabId, now: number): BarryEvent => ({ type: 'pushed', tabId, now });
const slack = (durationMs: number, now = T0): BarryEvent => ({
  type: 'slackPassStarted',
  durationMs,
  now,
});
const tick = (now: number): BarryEvent => ({ type: 'tick', now });
const gotUp = (now: number): BarryEvent => ({ type: 'gotUp', now });
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
const view = (s: BarryState, tab: TabId, now: number) => brain.viewFor(s, tab, now);

function confronted(): BarryState {
  return run(
    initialState(),
    { type: 'scheduleUpdated', blocks: [block(T0 - MIN, T0 + 600 * MIN)], now: T0 },
    nav(1, YT),
    nav(2, DOCS),
    nav(3, REDDIT),
    act(1),
  ).state;
}
const REACH_AT = T0 + MIN + T.warningMs;
function reaching(): BarryState {
  return run(confronted(), slack(MIN), tick(REACH_AT)).state;
}
/** The 5th Push lands at SN0. */
const SN0 = REACH_AT + 500;
function snoozing(extra: Partial<Tuning> = {}): BarryState {
  let s = run(reaching(), tune(extra, REACH_AT)).state;
  for (let i = 1; i <= 4; i++) s = run(s, push(1, REACH_AT + i * 100)).state;
  return run(s, push(1, SN0)).state;
}

describe('Fatness tiers', () => {
  it.each([
    [0, 'suspicious'],
    [1, 'fat-1'],
    [2, 'fat-2'],
    [3, 'fat-3'],
    [4, 'fat-4'],
    [5, 'chud'],
    [9, 'chud'],
  ])('%i eats show %s', (eats, pose) => {
    let s = confronted();
    for (let i = 0; i < eats; i++) s = run(s, eat(1)).state;
    expect(view(s, 1, T0).pose).toBe(pose);
  });
  it('fractional Fatness floors to the tier below', () => {
    const s = run(confronted(), dev({ kind: 'setFatness', fatness: 2.9 })).state;
    expect(view(s, 1, T0).pose).toBe('fat-2');
  });
  it('switching Restricted tabs keeps the tier', () => {
    let s = confronted();
    s = run(s, eat(1), eat(1), eat(1)).state;
    s = run(s, act(3, T0 + 10)).state;
    expect(view(s, 3, T0 + 10).pose).toBe('fat-3');
    expect(view(s, 1, T0 + 10).visible).toBe(true); // calm corner Barry elsewhere
    expect(view(s, 1, T0 + 10).placement).toBe('corner');
  });
  it('poseSince restarts when the tier changes, not on another eat in the same tier', () => {
    let s = confronted();
    const a = view(s, 1, T0).poseSince;
    s = run(s, eat(1, T0 + 100)).state;
    expect(view(s, 1, T0 + 100).poseSince).toBe(T0 + 100);
    s = run(s, dev({ kind: 'setFatness', fatness: 1.2 }, T0 + 150), tick(T0 + 200)).state;
    expect(view(s, 1, T0 + 200).poseSince).toBe(T0 + 100);
    s = run(s, eat(1, T0 + 300)).state;
    expect(view(s, 1, T0 + 300)).toMatchObject({ pose: 'fat-2', poseSince: T0 + 300 });
    expect(a).toBeLessThanOrEqual(T0);
  });
  it('switching Restricted tabs does not restart the pose', () => {
    let s = run(confronted(), eat(1, T0 + 5)).state;
    const since = view(s, 1, T0 + 5).poseSince;
    s = run(s, act(3, T0 + 20)).state;
    expect(view(s, 3, T0 + 20).poseSince).toBe(since);
  });
});

describe('max chud Confrontation', () => {
  it('chud-point with the chud line, regardless of Fatness', () => {
    const s = run(confronted(), dev({ kind: 'setChudMeter', value: 1 }), eat(1), eat(1)).state;
    expect(view(s, 1, T0)).toMatchObject({
      pose: 'chud-point',
      line: "♪ You're a chud ♪",
      placement: 'face',
    });
  });
  it('chud song still plays once per arrival', () => {
    let s = run(confronted(), dev({ kind: 'setChudMeter', value: 1 })).state;
    const first = run(s, act(3, T0 + 1));
    expect(first.last).toContainEqual({ type: 'playSound', tabId: 3, sound: 'chudSong' });
    s = first.state;
    const back = run(s, act(1, T0 + 2), act(3, T0 + 3));
    expect(back.last).toEqual([]);
  });
});

describe('other poses', () => {
  it('Chill corner is chill-mug, Lock In clear is studious', () => {
    const chill = run(initialState(), nav(2, DOCS), act(2), {
      type: 'modeOverrideSet',
      override: 'chill',
      now: T0,
    }).state;
    expect(view(chill, 2, T0).pose).toBe('chill-mug');
    const lock = run(chill, { type: 'modeOverrideSet', override: 'lockIn', now: T0 }).state;
    expect(view(lock, 2, T0).pose).toBe('studious');
  });
  it('Slack pass: chill on Restricted tabs with countdown and meter, studious elsewhere', () => {
    const s = run(confronted(), slack(MIN, T0 + 10)).state;
    const t = T0 + 10 + OKAY_MS + 1;
    expect(view(s, 3, t)).toMatchObject({
      pose: 'chill',
      breakEndsAt: T0 + 10 + MIN,
      poseSince: T0 + 10,
    });
    expect(view(s, 2, t).pose).toBe('studious');
  });
  it('Okay moment is suspicious on the interrupted tab, then chill', () => {
    const s = run(confronted(), slack(MIN, T0 + 10)).state;
    expect(view(s, 1, T0 + 20)).toMatchObject({
      pose: 'suspicious',
      line: 'Okay... -_-',
      poseSince: T0 + 10,
    });
    expect(view(s, 3, T0 + 20).pose).toBe('chill');
    expect(view(s, 1, T0 + 10 + OKAY_MS).pose).toBe('chill');
    expect(brain.nextDeadline(s)).toBe(T0 + 10 + OKAY_MS);
  });
  it('warning is suspicious-tap, "Wrap it up!", countdown, shared poseSince', () => {
    const s = run(confronted(), slack(MIN), tick(T0 + MIN + 1)).state;
    const v = view(s, 1, T0 + MIN + 1);
    expect(v).toMatchObject({
      pose: 'suspicious-tap',
      line: 'Wrap it up!',
      breakEndsAt: T0 + MIN + T.warningMs,
      poseSince: T0 + MIN,
    });
    expect(view(s, 3, T0 + MIN + 1).poseSince).toBe(v.poseSince);
  });
  it('Reach is close-tab, chud when the meter is full; poseSince survives Pushes', () => {
    let s = reaching();
    expect(view(s, 1, REACH_AT)).toMatchObject({ pose: 'close-tab', poseSince: REACH_AT });
    s = run(s, push(1, REACH_AT + 100)).state;
    expect(view(s, 1, REACH_AT + 100).poseSince).toBe(REACH_AT);
    expect(view(s, 1, REACH_AT + 100).reach?.startedAt).toBe(REACH_AT + 100);
    s = run(s, dev({ kind: 'setChudMeter', value: 1 }, REACH_AT + 200)).state;
    expect(view(s, 1, REACH_AT + 200).pose).toBe('chud');
  });
});

describe('Snooze stages', () => {
  const stageAt = (s: BarryState, ms: number) => view(s, 1, SN0 + ms);
  const B1 = SNOOZE_KNOCKED_MS;
  const B2 = B1 + SNOOZE_GET_UP_MS;
  const B4 = B2 + SNOOZE_OW_MS;
  const B5 = B4 + SNOOZE_GRIEVED_MS;

  it('stage durations', () => {
    expect([
      SNOOZE_KNOCKED_MS,
      SNOOZE_GET_UP_MS,
      SNOOZE_OW_MS,
      SNOOZE_GRIEVED_MS,
    ]).toEqual([5000, 600, 1000, 2200]);
    expect(GOT_UP_HAPPY_MS).toBe(1000);
  });
  it('walks knocked down, get up, ow, grieved, tired (no standing in between)', () => {
    const s = snoozing();
    expect(s.snoozeStartedAt).toBe(SN0);
    expect(stageAt(s, 0)).toMatchObject({ pose: 'got-owned', poseSince: SN0, canGetUp: false });
    expect(stageAt(s, B1 - 1).pose).toBe('got-owned');
    expect(stageAt(s, B1)).toMatchObject({ pose: 'get-up', poseSince: SN0 + B1, canGetUp: false });
    expect(stageAt(s, B2 - 1).pose).toBe('get-up');
    expect(stageAt(s, B2)).toMatchObject({ pose: 'suspicious', line: 'ow', poseSince: SN0 + B2 });
    expect(stageAt(s, B4)).toMatchObject({
      pose: 'grieved',
      line: 'my arm hurts i guess ill leave u alone',
      poseSince: SN0 + B4,
    });
    expect(stageAt(s, B5)).toMatchObject({ pose: 'tired', canGetUp: true, poseSince: SN0 + B5 });
    expect(stageAt(s, T.snoozeMs - 1)).toMatchObject({ pose: 'tired', canGetUp: true });
  });
  it('all Restricted tabs agree, other tabs stay studious and cannot get up', () => {
    const s = snoozing();
    expect(view(s, 3, SN0 + B5)).toEqual(view(s, 1, SN0 + B5));
    expect(view(s, 2, SN0 + B5)).toMatchObject({ pose: 'studious', canGetUp: false });
  });
  it('keeps the Snooze countdown', () => {
    expect(stageAt(snoozing(), B5).breakEndsAt).toBe(SN0 + T.snoozeMs);
  });
  it('nextDeadline walks the stage boundaries, then the end', () => {
    let s = snoozing();
    const seen: number[] = [];
    for (let i = 0; i < 8; i++) {
      const d = brain.nextDeadline(s)!;
      seen.push(d);
      if (d >= SN0 + T.snoozeMs) break;
      s = run(s, tick(d)).state;
    }
    expect(seen.slice(0, 4)).toEqual([SN0 + B1, SN0 + B2, SN0 + B4, SN0 + B5]);
    expect(seen[4]).toBe(SN0 + T.snoozeMs);
  });
  it('snoozeMs shorter than the stages truncates them; nothing past the end is a deadline', () => {
    const s = snoozing({ snoozeMs: 3000 });
    expect(s.snoozeEndsAt).toBe(SN0 + 3000);
    expect(stageAt(s, 2999)).toMatchObject({ pose: 'got-owned', canGetUp: false });
    expect(brain.nextDeadline(s)).toBe(SN0 + 3000);
    const mid = snoozing({ snoozeMs: B2 + 500 });
    expect(stageAt(mid, B2 - 1).pose).toBe('get-up');
    expect(stageAt(mid, B2 + 100)).toMatchObject({ pose: 'suspicious', canGetUp: false });
    const end = run(mid, tick(SN0 + B2 + 500)).state;
    expect(end.phase).toBe('reaching');
  });
  it('the Reach comes back after the Snooze with a fresh fight run', () => {
    const s = run(snoozing(), tick(SN0 + T.snoozeMs)).state;
    expect(s).toMatchObject({
      phase: 'reaching',
      reachStartedAt: SN0 + T.snoozeMs,
      snoozeStartedAt: null,
    });
    expect(view(s, 1, SN0 + T.snoozeMs).poseSince).toBe(SN0 + T.snoozeMs);
  });
});

describe('Get up', () => {
  const TIRED =
    SNOOZE_KNOCKED_MS + SNOOZE_GET_UP_MS + SNOOZE_OW_MS + SNOOZE_GRIEVED_MS;
  it('is ignored at every stage before tired', () => {
    const s = snoozing();
    for (const ms of [0, 1000, 5000, 5700, 6000, 7000, TIRED - 1]) {
      const r = run(s, gotUp(SN0 + ms));
      expect(r.state.gotUpAt).toBeNull();
      expect(r.state.snoozeEndsAt).toBe(s.snoozeEndsAt);
      expect(r.last).toEqual([]);
    }
  });
  it('ignored outside a Snooze', () => {
    for (const s of [initialState(), confronted(), reaching()]) {
      const r = run(s, gotUp(T0 + 5));
      expect(r.state.gotUpAt).toBeNull();
      expect(r.state.phase).toBe(s.phase);
    }
  });
  it('in the tired stage: happy for a moment, then the Snooze ends and the Arm comes back', () => {
    const at = SN0 + TIRED + 3000;
    let s = run(snoozing(), gotUp(at)).state;
    expect(s.gotUpAt).toBe(at);
    expect(s.phase).toBe('snoozing');
    expect(view(s, 1, at)).toMatchObject({
      pose: 'happy',
      poseSince: at,
      canGetUp: false,
      line: null,
    });
    expect(view(s, 3, at + GOT_UP_HAPPY_MS - 1).pose).toBe('happy');
    expect(brain.nextDeadline(s)).toBe(at + GOT_UP_HAPPY_MS);
    // a second Get up does nothing
    expect(run(s, gotUp(at + 10)).state.gotUpAt).toBe(at);
    s = run(s, tick(at + GOT_UP_HAPPY_MS)).state;
    expect(s).toMatchObject({
      phase: 'reaching',
      reachStartedAt: at + GOT_UP_HAPPY_MS,
      snoozeStartedAt: null,
      snoozeEndsAt: null,
      gotUpAt: null,
    });
    expect(view(s, 1, at + GOT_UP_HAPPY_MS).pose).toBe('close-tab');
  });
  it('the Chud meter counts only the Snooze time actually used', () => {
    const at = SN0 + TIRED + 3000;
    const s = run(snoozing(), gotUp(at), tick(at + GOT_UP_HAPPY_MS)).state;
    expect(s.chudMeter).toBeCloseTo((TIRED + 3000) / T.chudFullMs);
    const live = run(snoozing(), gotUp(at)).state;
    expect(run(live, tick(at + 500)).state.chudMeter).toBeCloseTo((TIRED + 3000) / T.chudFullMs);
  });
  it('a laptop-sleep jump past the Snooze end ignores Get up (the Snooze already ended)', () => {
    const s = snoozing();
    const r = run(s, gotUp(SN0 + T.snoozeMs + 60 * MIN));
    expect(r.state.gotUpAt).toBeNull();
    expect(r.state.chudMeter).toBeCloseTo(T.snoozeMs / T.chudFullMs);
  });
  it('a sleep jump during the happy stage still ends the Snooze at its end', () => {
    const at = SN0 + TIRED + 10;
    const r = run(snoozing(), gotUp(at), tick(at + GOT_UP_HAPPY_MS + 1000));
    expect(r.state).toMatchObject({ phase: 'reaching', reachStartedAt: at + GOT_UP_HAPPY_MS });
    expect(r.state.chudMeter).toBeCloseTo((TIRED + 10) / T.chudFullMs);
  });
  it('muted: no sounds either way (Get up makes none)', () => {
    const s = run(snoozing(), { type: 'mutedSet', muted: true, now: SN0 + 1 }).state;
    expect(run(s, gotUp(SN0 + TIRED + 1)).last).toEqual([]);
  });
  it('mode flipping to Chill mid-Snooze or mid-happy drops everything', () => {
    const at = SN0 + TIRED + 10;
    for (const s of [snoozing(), run(snoozing(), gotUp(at)).state]) {
      const r = run(s, { type: 'modeOverrideSet', override: 'chill', now: at + 5 });
      expect(r.state).toMatchObject({
        phase: 'clear',
        snoozeStartedAt: null,
        gotUpAt: null,
        snoozeEndsAt: null,
      });
      expect(view(r.state, 1, at + 5).canGetUp).toBe(false);
    }
  });
  it('after Get up with no Restricted tab left, the Snooze ends clear', () => {
    const at = SN0 + TIRED + 10;
    let s = run(snoozing(), gotUp(at)).state;
    s = run(
      s,
      { type: 'tabClosed', tabId: 1, now: at + 1 },
      { type: 'tabClosed', tabId: 3, now: at + 1 },
      tick(at + GOT_UP_HAPPY_MS),
    ).state;
    expect(s.phase).toBe('clear');
    expect(s.gotUpAt).toBeNull();
  });
  it('the next Snooze starts clean', () => {
    const at = SN0 + TIRED + 10;
    let s = run(snoozing(), gotUp(at), tick(at + GOT_UP_HAPPY_MS)).state;
    const t = at + GOT_UP_HAPPY_MS;
    for (let i = 1; i <= 5; i++) s = run(s, push(1, t + i * 50)).state;
    expect(s).toMatchObject({ phase: 'snoozing', snoozeStartedAt: t + 250, gotUpAt: null });
    expect(view(s, 1, t + 250).pose).toBe('got-owned');
  });
});

describe('review fixes', () => {
  it('a legacy Snooze without snoozeStartedAt still gets stages and Get up', () => {
    const s = { ...snoozing(), snoozeStartedAt: null };
    expect(view(s, 1, SN0 + 100).pose).toBe('got-owned');
    const tired =
      SN0 +
      SNOOZE_KNOCKED_MS +
      SNOOZE_GET_UP_MS +
      SNOOZE_OW_MS +
      SNOOZE_GRIEVED_MS +
      10;
    expect(view(s, 1, tired)).toMatchObject({ pose: 'tired', canGetUp: true });
    const r = run(s, gotUp(tired));
    expect(r.state.gotUpAt).toBe(tired);
  });
  it('gotUpAt undefined (raw old storage) is treated as unset', () => {
    const s = { ...snoozing(), snoozeStartedAt: null, gotUpAt: undefined } as unknown as BarryState;
    expect(view(s, 1, SN0 + 100).pose).toBe('got-owned');
  });
  it('retuning mid-warning keeps the warning poseSince', () => {
    const s = run(confronted(), slack(MIN), tick(T0 + MIN)).state;
    expect(s.phase).toBe('warning');
    const before = view(s, 1, T0 + MIN + 10).poseSince;
    const s2 = run(s, tune({ warningMs: T.warningMs + 5000 }, T0 + MIN + 20)).state;
    expect(view(s2, 1, T0 + MIN + 30).poseSince).toBe(before);
    expect(before).toBe(T0 + MIN);
  });
});
