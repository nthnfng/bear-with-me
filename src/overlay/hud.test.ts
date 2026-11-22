import { describe, expect, it } from 'vitest';
import {
  formatMinutes,
  humanDuration,
  parseMinutes,
  planLines,
  taskCheckText,
  truncate,
} from './hud';

const MIN = 60_000;

describe('plan lines', () => {
  it('task first, then the calendar event, in words', () => {
    const plan = {
      task: { title: 'Problem set abc', timing: { kind: 'left' as const, endsAt: 330 * MIN } },
      block: { title: 'Hack Western', endsAt: 40 * 60 * MIN },
    };
    expect(planLines(plan, 0)).toEqual([
      'Task Problem set abc: ~5 hours 30 minutes left',
      'Event Hack Western: ~1 day 16 hours left',
    ]);
  });

  it('estimate, time up, and nothing', () => {
    expect(
      planLines(
        { task: { title: 'A', timing: { kind: 'estimate', ms: 5 * MIN } }, block: null },
        0,
      ),
    ).toEqual(['Task A: ~5 minutes']);
    expect(
      planLines({ task: { title: 'A', timing: { kind: 'timesUp' } }, block: null }, 0),
    ).toEqual(["Task A: time's up"]);
    expect(planLines(null, 0)).toEqual([]);
  });

  it('says lengths in words', () => {
    expect(humanDuration(1)).toBe('1 minute');
    expect(humanDuration(25 * MIN)).toBe('25 minutes');
    expect(humanDuration(60 * MIN)).toBe('1 hour');
    expect(humanDuration(61 * MIN)).toBe('1 hour 1 minute');
    expect(humanDuration(24 * 60 * MIN)).toBe('1 day');
    expect(humanDuration(50 * 60 * MIN)).toBe('2 days 2 hours');
  });

  it('formats minutes and truncates long titles', () => {
    expect(formatMinutes(15 * MIN)).toBe('15m');
    expect(formatMinutes(60 * MIN)).toBe('1h');
    expect(formatMinutes(61 * MIN)).toBe('1h 1m');
    expect(formatMinutes(1)).toBe('1m');
    expect(truncate('short')).toBe('short');
    const long = truncate('a'.repeat(50));
    expect(long).toHaveLength(32);
    expect(long.endsWith('…')).toBe(true);
    expect(taskCheckText('Lab report')).toBe("Time's up for Lab report. Done?");
    expect(parseMinutes('25')).toBe(25 * MIN);
    expect(parseMinutes(' ')).toBeNull();
    expect(parseMinutes('-3')).toBeNull();
    expect(parseMinutes('511')).toBeNull();
    expect(parseMinutes('510')).toBe(510 * MIN);
  });
});
