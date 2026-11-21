import { describe, expect, it } from 'vitest';
import type { BarryEffect } from '../contracts';
import { EXPLOSION_SOUND_DELAY_MS, explosionSoundDelay } from './explosionSound';

describe('explosionSoundDelay', () => {
  const boom: BarryEffect = { type: 'explodeAndClose', tabIds: [1, 2] };
  it('plays once per batch, even with several explodeAndClose effects', () => {
    expect(explosionSoundDelay([boom, boom], false)).toBe(EXPLOSION_SOUND_DELAY_MS);
  });
  it('is silent when muted', () => {
    expect(explosionSoundDelay([boom], true)).toBeNull();
  });
  it('is silent without an explosion', () => {
    expect(explosionSoundDelay([{ type: 'playSound', tabId: 1, sound: 'punch' }], false)).toBeNull();
    expect(explosionSoundDelay([], false)).toBeNull();
  });
  it('starts before the runtime closes the tabs', () => {
    expect(EXPLOSION_SOUND_DELAY_MS).toBeLessThan(1300);
  });
});
