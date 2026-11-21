// When to play the explosion sound. The sound is runtime-originated (the brain only emits
// explodeAndClose), so the runtime checks `muted` itself. Pure: no browser imports.

import type { BarryEffect } from '../contracts';

/**
 * The overlay's Back to it arm reach (350 ms) runs before its ~1000 ms explosion, so the
 * bang starts about this long after the effect reaches the page. The runtime closes the tabs
 * at EXPLODE_MS (1300), after the sound has begun.
 */
export const EXPLOSION_SOUND_DELAY_MS = 350;

/** Ms to wait before playing the explosion once for this batch of effects, or null for silence. */
export function explosionSoundDelay(effects: readonly BarryEffect[], muted: boolean): number | null {
  if (muted) return null;
  return effects.some((e) => e.type === 'explodeAndClose') ? EXPLOSION_SOUND_DELAY_MS : null;
}
