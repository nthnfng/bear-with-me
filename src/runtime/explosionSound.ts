// When to play the explosion sound. The sound is runtime-originated (the brain only emits
// explodeAndClose), so the runtime checks `muted` itself. Pure: no browser imports.

import type { BarryEffect, BarryEvent } from '../contracts';

/**
 * Back to it: the overlay pops close-tab Barry (250 ms), then a 350 ms arm reaches the tab,
 * then the particles start. A landed Reach explodes at the arm's tip right away.
 * The runtime closes the tabs at EXPLODE_MS (1300), after the sound has begun.
 */
export const BACK_TO_IT_SOUND_DELAY_MS = 600;

/** Ms to wait before playing the explosion once for this batch of effects, or null for silence. */
export function explosionSoundDelay(
  event: Pick<BarryEvent, 'type'>,
  effects: readonly BarryEffect[],
  muted: boolean,
): number | null {
  if (muted || !effects.some((e) => e.type === 'explodeAndClose')) return null;
  return event.type === 'backToIt' ? BACK_TO_IT_SOUND_DELAY_MS : 0;
}
