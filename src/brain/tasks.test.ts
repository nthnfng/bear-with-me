// Tasks: Start runs Lock In for the estimate, time's up asks "Done?", the Confrontation shows the plan.
import { describe, expect, it } from 'vitest';
import type { BarryEvent, BarryState, CalendarBlock, Task } from '../contracts';
import { TASK_EXTEND_MS } from '../contracts';
import { brain, initialState, planFor } from '.';
import { resolveMode } from './helpers';

const YT = 'https://www.youtube.com/watch?v=1';
const DOCS = 'https://docs.google.com/';
const T0 = 10_000_000;
const MIN = 60_000;

function run(state: BarryState, ...events: BarryEvent[]) {
  let s = state;
  const effects = events.map((e) => {
    const r = brain.reduce(s, e);
    s = r.state;
    return r.effects;
  });
  return { state: s, effects, last: effects[effects.length - 1] ?? [] };
}
const task = (id: string, estimateMin = 30, done = false): Task => ({
  id,
  title: `Task ${id}`,
  description: '',
  estimateMs: estimateMin * MIN,
  done,
  doneAt: done ? T0 : null,
});
const setTasks = (tasks: Task[], now = T0): BarryEvent => ({ type: 'tasksSet', tasks, now });
const start = (id: string, now = T0): BarryEvent => ({ type: 'taskStarted', id, now });
const answer = (id: string, a: 'done' | 'extend', now: number, extendMs?: number): BarryEvent => ({
  type: 'taskAnswered',
  id,
  answer: a,
  now,
  extendMs,
});
const tick = (now: number): BarryEvent => ({ type: 'tick', now });
const nav = (tabId: number, url: string, now = T0): BarryEvent => ({
  type: 'tabNavigated',
  tabId,
  url,
  now,
});
const act = (tabId: number, now = T0): BarryEvent => ({ type: 'tabActivated', tabId, now });
const block = (title: string, start: number, end: number): CalendarBlock => ({
  id: title,
  title,
  start,
  end,
  allDay: false,
  source: 'ics',
});

const withTasks = () => run(initialState(), setTasks([task('a'), task('b'), task('c')])).state;

describe('Start and Lock In', () => {
  it('Lock In runs for the estimate, then the time is up', () => {
    const s = run(withTasks(), start('b')).state;
    expect(s.activeTask).toEqual({ id: 'b', startedAt: T0, endsAt: T0 + 30 * MIN });
    expect(resolveMode(s, T0 + 29 * MIN)).toBe('lockIn');
    expect(brain.nextDeadline(s)).toBe(T0 + 30 * MIN);
    // Starting moves it to the top.
    expect(s.tasks.map((t) => t.id)).toEqual(['b', 'a', 'c']);

    const up = run(s, tick(T0 + 30 * MIN)).state;
    expect(up.activeTask).toBeNull();
    expect(up.taskCheck).toEqual({ id: 'b', at: T0 + 30 * MIN });
    expect(resolveMode(up, T0 + 30 * MIN)).toBe('chill');
  });

  it('ignores a checked or missing Task; Stop ends Lock In early', () => {
    const s = run(initialState(), setTasks([task('a', 30, true)]), start('a'), start('zz')).state;
    expect(s.activeTask).toBeNull();
    const running = run(withTasks(), start('a')).state;
    const stopped = run(running, { type: 'taskStopped', now: T0 + MIN }).state;
    expect(stopped.activeTask).toBeNull();
    expect(stopped.tasks.find((t) => t.id === 'a')!.done).toBe(false);
    expect(resolveMode(stopped, T0 + MIN)).toBe('chill');
  });

  it('deleting or checking off the running Task clears it', () => {
    const s = run(withTasks(), start('a')).state;
    expect(run(s, setTasks([task('b')], T0 + MIN)).state.activeTask).toBeNull();
    expect(
      run(s, setTasks([task('a', 30, true), task('b')], T0 + MIN)).state.activeTask,
    ).toBeNull();
    expect(run(s, setTasks([task('a'), task('b')], T0 + MIN)).state.activeTask?.id).toBe('a');
  });
});

describe('"Done?" answers', () => {
  const timesUp = () => run(withTasks(), start('a'), tick(T0 + 30 * MIN)).state;

  it('done checks it off', () => {
    const s = run(timesUp(), answer('a', 'done', T0 + 31 * MIN)).state;
    expect(s.taskCheck).toBeNull();
    // Checked off where it is.
    expect(s.tasks.map((t) => t.id)).toEqual(['a', 'b', 'c']);
    expect(s.tasks[0]).toMatchObject({ id: 'a', done: true, doneAt: T0 + 31 * MIN });
  });

  it('extend runs it 15 more minutes in Lock In', () => {
    const at = T0 + 31 * MIN;
    const s = run(timesUp(), answer('a', 'extend', at)).state;
    expect(s.activeTask).toEqual({ id: 'a', startedAt: at, endsAt: at + TASK_EXTEND_MS });
    expect(resolveMode(s, at + MIN)).toBe('lockIn');
  });

  it('extend runs it for the minutes the user typed (clamped)', () => {
    const at = T0 + 31 * MIN;
    expect(run(timesUp(), answer('a', 'extend', at, 40 * MIN)).state.activeTask).toEqual({
      id: 'a',
      startedAt: at,
      endsAt: at + 40 * MIN,
    });
    expect(run(timesUp(), answer('a', 'extend', at, 5)).state.activeTask?.endsAt).toBe(at + MIN);
    expect(run(timesUp(), answer('a', 'extend', at, NaN)).state.activeTask?.endsAt).toBe(
      at + TASK_EXTEND_MS,
    );
  });

  it('ignores an answer for a Task nobody asked about', () => {
    const s = timesUp();
    expect(run(s, answer('b', 'done', T0 + 31 * MIN)).state).toMatchObject({
      taskCheck: s.taskCheck,
    });
  });

  it('the running Task can be finished early', () => {
    const s = run(withTasks(), start('a'), answer('a', 'done', T0 + 5 * MIN)).state;
    expect(s.activeTask).toBeNull();
    expect(s.tasks.find((t) => t.id === 'a')!.done).toBe(true);
  });

  it('calm corner Barry carries the question', () => {
    const s = run(timesUp(), nav(1, DOCS, T0 + 30 * MIN), act(1, T0 + 30 * MIN)).state;
    expect(brain.viewFor(s, 1, T0 + 30 * MIN).taskCheck).toEqual({ id: 'a', title: 'Task a' });
  });
});

describe('the plan under the Confrontation line', () => {
  it('shows the running Task first and the calendar block under it', () => {
    const s = run(
      withTasks(),
      { type: 'scheduleUpdated', blocks: [block('ETF prep', T0 - MIN, T0 + 60 * MIN)], now: T0 },
      start('b'),
      nav(1, YT),
      act(1),
    ).state;
    const v = brain.viewFor(s, 1, T0);
    expect(v.placement).toBe('face');
    expect(v.line).toBe("Get back to it ,':/");
    expect(v.plan).toEqual({
      task: { title: 'Task b', timing: { kind: 'left', endsAt: T0 + 30 * MIN } },
      block: { title: 'ETF prep', endsAt: T0 + 60 * MIN },
    });
  });

  it('a started Task alone puts Barry in your face', () => {
    const s = run(withTasks(), start('a'), nav(1, YT), act(1)).state;
    expect(brain.viewFor(s, 1, T0).plan).toEqual({
      task: { title: 'Task a', timing: { kind: 'left', endsAt: T0 + 30 * MIN } },
      block: null,
    });
  });

  it('forced Lock In with nothing started shows the top Task and its estimate', () => {
    const s = run(withTasks(), { type: 'modeOverrideSet', override: 'lockIn', now: T0 }).state;
    expect(planFor(s, T0)).toEqual({
      task: { title: 'Task a', timing: { kind: 'estimate', ms: 30 * MIN } },
      block: null,
    });
  });

  it('a Task waiting for "Done?" says time\'s up', () => {
    const s = run(withTasks(), start('b'), tick(T0 + 30 * MIN)).state;
    expect(planFor(s, T0 + 30 * MIN)?.task).toEqual({
      title: 'Task b',
      timing: { kind: 'timesUp' },
    });
  });

  it('is null with no Tasks and no block', () => {
    expect(planFor(initialState(), T0)).toBeNull();
  });
});

describe('Tasks drive the mode', () => {
  const mode = (o: 'auto' | 'chill' | 'lockIn', now = T0): BarryEvent => ({
    type: 'modeOverrideSet',
    override: o,
    now,
  });

  it('Start switches to Lock In; time up and Done return to Auto', () => {
    const s = run(withTasks(), start('a')).state;
    expect(s.modeOverride).toBe('lockIn');
    expect(run(s, tick(T0 + 30 * MIN)).state.modeOverride).toBe('auto');
    expect(run(s, answer('a', 'done', T0 + 5 * MIN)).state.modeOverride).toBe('auto');
    // Extending after time up locks in again.
    const up = run(s, tick(T0 + 30 * MIN)).state;
    expect(run(up, answer('a', 'extend', T0 + 31 * MIN)).state.modeOverride).toBe('lockIn');
  });

  it('checking off or deleting the running Task returns to Auto', () => {
    const s = run(withTasks(), start('a')).state;
    expect(run(s, setTasks([task('a', 30, true), task('b')], T0 + MIN)).state.modeOverride).toBe(
      'auto',
    );
    expect(run(s, setTasks([task('b')], T0 + MIN)).state.modeOverride).toBe('auto');
  });

  it('leaving Lock In mid-Task pauses it with its time left; Start resumes from there', () => {
    const s = run(withTasks(), start('a'), mode('chill', T0 + 10 * MIN)).state;
    expect(s.modeOverride).toBe('chill');
    expect(s.activeTask).toBeNull();
    expect(s.tasks[0]).toMatchObject({ id: 'a', leftMs: 20 * MIN, done: false });
    const resumed = run(s, start('a', T0 + 60 * MIN)).state;
    expect(resumed.activeTask).toEqual({
      id: 'a',
      startedAt: T0 + 60 * MIN,
      endsAt: T0 + 80 * MIN,
    });
    expect(resumed.tasks[0]!.leftMs).toBeNull();
    expect(resumed.modeOverride).toBe('lockIn');
  });

  it('the pause button pauses into Auto; Lock In while running changes nothing', () => {
    const s = run(withTasks(), start('a'), { type: 'taskStopped', now: T0 + 5 * MIN }).state;
    expect(s.modeOverride).toBe('auto');
    expect(s.tasks[0]!.leftMs).toBe(25 * MIN);
    const r = run(withTasks(), start('a'), mode('lockIn', T0 + MIN)).state;
    expect(r.activeTask?.id).toBe('a');
  });
});

describe('breaks pause the Task timer', () => {
  const slack = (ms: number, now: number): BarryEvent => ({
    type: 'slackPassStarted',
    durationMs: ms,
    now,
  });

  it('a Slack pass pauses the Task (Lock In stays) and Stop Slacking resumes it', () => {
    let s = run(withTasks(), start('a'), slack(5 * MIN, T0 + 10 * MIN)).state;
    expect(s.phase).toBe('slackPass');
    expect(s.activeTask).toBeNull();
    expect(s.taskOnBreak).toBe('a');
    expect(s.tasks[0]!.leftMs).toBe(20 * MIN);
    expect(s.modeOverride).toBe('lockIn');
    // Time on the break doesn't count, and the Task never times out during it.
    s = run(s, tick(T0 + 14 * MIN)).state;
    expect(s.taskCheck).toBeNull();
    s = run(s, { type: 'slackPassStopped', now: T0 + 14 * MIN }).state;
    expect(s.activeTask).toEqual({ id: 'a', startedAt: T0 + 14 * MIN, endsAt: T0 + 34 * MIN });
    expect(s.taskOnBreak).toBeNull();
  });

  it('the Slack pass running out resumes the Task', () => {
    const s = run(
      withTasks(),
      start('a'),
      slack(5 * MIN, T0 + 10 * MIN),
      tick(T0 + 15 * MIN),
    ).state;
    expect(s.phase).toBe('warning');
    expect(s.activeTask).toEqual({ id: 'a', startedAt: T0 + 15 * MIN, endsAt: T0 + 35 * MIN });
  });

  it('leaving Lock In or pausing during a break keeps it paused (no resume)', () => {
    const onBreak = run(withTasks(), start('a'), slack(5 * MIN, T0 + 10 * MIN)).state;
    const chill = run(onBreak, {
      type: 'modeOverrideSet',
      override: 'chill',
      now: T0 + 11 * MIN,
    }).state;
    expect(chill.taskOnBreak).toBeNull();
    expect(chill.activeTask).toBeNull();
    expect(chill.tasks[0]!.leftMs).toBe(20 * MIN);
    const paused = run(
      onBreak,
      { type: 'taskStopped', now: T0 + 11 * MIN },
      tick(T0 + 20 * MIN),
    ).state;
    expect(paused.activeTask).toBeNull();
    expect(paused.tasks[0]!.leftMs).toBe(20 * MIN);
  });

  it('finishing the Task during a break means nothing resumes', () => {
    const onBreak = run(withTasks(), start('a'), slack(5 * MIN, T0 + 10 * MIN)).state;
    const s = run(
      onBreak,
      setTasks([{ ...task('a', 30, true) }, task('b'), task('c')], T0 + 11 * MIN),
      { type: 'slackPassStopped', now: T0 + 12 * MIN },
    ).state;
    expect(s.activeTask).toBeNull();
    expect(s.taskOnBreak).toBeNull();
  });
});

describe('▶ works in any state', () => {
  it('starting a Task during a Slack pass ends the break and runs the Task', () => {
    const s = run(
      withTasks(),
      { type: 'modeOverrideSet', override: 'lockIn', now: T0 },
      { type: 'slackPassStarted', durationMs: 5 * MIN, now: T0 },
      start('b', T0 + MIN),
    ).state;
    expect(s.phase).not.toBe('slackPass');
    expect(s.slackPassEndsAt).toBeNull();
    expect(s.activeTask).toEqual({ id: 'b', startedAt: T0 + MIN, endsAt: T0 + 31 * MIN });
    expect(s.taskOnBreak).toBeNull();
    expect(s.modeOverride).toBe('lockIn');
  });

  it('starting a Task while already in Lock In runs it', () => {
    const s = run(
      withTasks(),
      { type: 'modeOverrideSet', override: 'lockIn', now: T0 },
      start('c', T0 + MIN),
    ).state;
    expect(s.activeTask?.id).toBe('c');
  });
});

