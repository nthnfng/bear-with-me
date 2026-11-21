import { describe, expect, it } from 'vitest';
import { createRepauseCounter, isUserCausedPlay } from './media-pauser';

describe('isUserCausedPlay', () => {
  it('autoplay (no activation) is not user caused', () => {
    expect(isUserCausedPlay({ userActive: false, sinceSourceMs: 60_000 })).toBe(false);
  });
  it('a play right after a source change is the next video, not the user', () => {
    expect(isUserCausedPlay({ userActive: true, sinceSourceMs: 200 })).toBe(false);
  });
  it('activation plus an established source is the user', () => {
    expect(isUserCausedPlay({ userActive: true, sinceSourceMs: 20_000 })).toBe(true);
  });
});

describe('createRepauseCounter', () => {
  it('fires on the third re-pause within the window', () => {
    const c = createRepauseCounter(3, 2000);
    expect(c.record(0)).toBe(false);
    expect(c.record(500)).toBe(false);
    expect(c.record(1000)).toBe(true);
  });
  it('forgets slow re-pauses', () => {
    const c = createRepauseCounter(3, 2000);
    c.record(0);
    c.record(1500);
    expect(c.record(3100)).toBe(false);
  });
});
