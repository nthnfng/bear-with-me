import { describe, expect, it } from 'vitest';
import { brain } from '.';

// Smoke test so `npm test` is green from day one. WS-A replaces this with
// scenario tests from the PRD's Testing Decisions.
describe('brain (skeleton)', () => {
  it('starts in auto mode with nothing happening', () => {
    const s = brain.initialState();
    expect(s.modeOverride).toBe('auto');
    expect(s.phase).toBe('clear');
    expect(s.chudMeter).toBe(0);
  });
});
