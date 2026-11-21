import { describe, expect, it } from 'vitest';
import type { BarryEffect } from '../contracts';
import { BACK_TO_IT_SOUND_DELAY_MS, explosionSoundDelay } from './explosionSound';

describe('explosionSoundDelay', () => {
  const boom: BarryEffect = { type: 'explodeAndClose', tabIds: [1, 2] };
  const landed = { type: 'reachLanded' } as const;
  it('plays once per batch, right away when a Reach lands', () => {
    expect(explosionSoundDelay(landed, [boom, boom], false)).toBe(0);
  });
  it('waits for the overlay pop and arm on Back to it', () => {
    expect(explosionSoundDelay({ type: 'backToIt' }, [boom], false)).toBe(BACK_TO_IT_SOUND_DELAY_MS);
  });
  it('is silent when muted', () => {
    expect(explosionSoundDelay(landed, [boom], true)).toBeNull();
  });
  it('is silent without an explosion', () => {
    expect(
      explosionSoundDelay(landed, [{ type: 'playSound', tabId: 1, sound: 'punch' }], false),
    ).toBeNull();
    expect(explosionSoundDelay(landed, [], false)).toBeNull();
  });
  it('starts before the runtime closes the tabs', () => {
    expect(BACK_TO_IT_SOUND_DELAY_MS).toBeLessThan(1300);
  });
});
