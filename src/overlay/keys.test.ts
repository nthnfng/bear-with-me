import { describe, expect, it } from 'vitest';
import { shouldEatKey } from './keys';
import { createThrottle } from './throttle';

const k = (key: string, mods: Partial<Record<'ctrlKey' | 'metaKey' | 'altKey', boolean>> = {}) => ({
  key,
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  ...mods,
});

describe('shouldEatKey', () => {
  it('eats YouTube-style keys', () => {
    for (const key of [' ', 'ArrowDown', 'PageDown', 'End', 'j', 'k', 'l', 'f', 'm', 'Escape'])
      expect(shouldEatKey(k(key))).toBe(true);
  });
  it('lets modifiers, F-keys and browser shortcuts through', () => {
    expect(shouldEatKey(k('Control'))).toBe(false);
    expect(shouldEatKey(k('F5'))).toBe(false);
    expect(shouldEatKey(k('F12'))).toBe(false);
    expect(shouldEatKey(k('w', { ctrlKey: true }))).toBe(false);
    expect(shouldEatKey(k('t', { metaKey: true }))).toBe(false);
    expect(shouldEatKey(k('ArrowLeft', { altKey: true }))).toBe(false);
  });
});

describe('createThrottle', () => {
  it('allows one event per window', () => {
    let t = 0;
    const gate = createThrottle(300, () => t);
    expect(gate()).toBe(true);
    t = 100;
    expect(gate()).toBe(false);
    t = 300;
    expect(gate()).toBe(true);
  });
});
