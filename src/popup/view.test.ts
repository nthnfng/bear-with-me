import { describe, expect, it } from 'vitest';
import { DEFAULT_TUNING } from '../contracts';
import type { BarryState, CalendarBlock } from '../contracts';
import {
  countdownFor,
  formatCountdown,
  headlineFor,
  nextBlock,
  popupView,
  secondsToMs,
  slackPassStatus,
} from './view';

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
    expect(countdownFor(base())).toBeNull();
    expect(countdownFor(base({ phase: 'slackPass', slackPassEndsAt: 9 }))?.target).toBe(9);
    expect(countdownFor(base({ phase: 'warning', warningEndsAt: 7 }))?.label).toBe('Reach in');
    expect(countdownFor(base({ phase: 'snoozing', snoozeEndsAt: 5 }))?.target).toBe(5);
    expect(countdownFor(base({ phase: 'reaching', reachStartedAt: 1000 }))?.target).toBe(
      1000 + DEFAULT_TUNING.reachMs,
    );
  });

  it('shows pushes left only during the Arm fight in Lock In', () => {
    const s = base({ modeOverride: 'lockIn', phase: 'reaching', pushes: 2 });
    expect(popupView(s, 0).pushesLeft).toBe(DEFAULT_TUNING.maxPushes - 2);
    expect(popupView(base({ modeOverride: 'lockIn' }), 0).pushesLeft).toBeNull();
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
    expect(slackPassStatus('lockIn', 'slackPass').allowed).toBe(false);
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
