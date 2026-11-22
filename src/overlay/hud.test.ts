import { describe, expect, it } from 'vitest';
import {
  formatMinutes,
  parseMinutes,
  taskCheckText,
  truncate,
} from './hud';

const MIN = 60_000;

describe('hud text', () => {
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
