import { describe, expect, it } from 'vitest';
import { createSerialQueue } from './serialQueue';

describe('createSerialQueue', () => {
  it('runs jobs one at a time in order, even if an earlier one is slower', async () => {
    const q = createSerialQueue();
    const log: string[] = [];
    const slow = q.enqueue(async () => {
      log.push('a start');
      await new Promise((r) => setTimeout(r, 20));
      log.push('a end');
    });
    const fast = q.enqueue(async () => {
      log.push('b');
    });
    await Promise.all([slow, fast]);
    expect(log).toEqual(['a start', 'a end', 'b']);
  });

  it('keeps going after a failing job', async () => {
    const errors: unknown[] = [];
    const q = createSerialQueue((e) => errors.push(e));
    await q.enqueue(async () => {
      throw new Error('boom');
    });
    expect(await q.enqueue(async () => 42)).toBe(42);
    expect(errors).toHaveLength(1);
  });
});
