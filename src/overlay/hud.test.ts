import { describe, expect, it } from 'vitest';
import { formatMinutes, parseMinutes, planLines, taskCheckText, truncate } from './hud';

const MIN = 60_000;
const clock = () => '6:00 PM';

describe('plan lines', () => {
  it('task first, then the calendar block', () => {
    const plan = {
      task: { title: 'Problem set abc', timing: { kind: 'left' as const, endsAt: 32 * MIN } },
      block: { title: 'ETF prep', endsAt: 99 },
    };
    expect(planLines(plan, 0, clock)).toEqual([
      '★ Problem set abc · 32m left',
      '📅 ETF prep · until 6:00 PM',
    ]);
  });

  it('estimate, time up, and nothing', () => {
    expect(
      planLines({ task: { title: 'A', timing: { kind: 'estimate', ms: 90 * MIN } }, block: null }, 0),
    ).toEqual(['★ A · ~1h 30m']);
    expect(planLines({ task: { title: 'A', timing: { kind: 'timesUp' } }, block: null }, 0)).toEqual([
      "★ A · time's up",
    ]);
    expect(planLines(null, 0)).toEqual([]);
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
