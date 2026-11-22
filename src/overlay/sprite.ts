// Pure sprite maths for the overlay. DOM-free: everything is computed from sizes and the clock,
// so every tab shows the same frame at the same moment (views carry `poseSince`).

import type { Millis, PoseId, PoseSprite } from '../contracts';

/** Frame shown at `now` for a strip that began at `since`. Stills are always frame 0. */
export function frameIndex(now: Millis, since: Millis, frames: number, frameMs?: number): number {
  if (frames <= 1 || !frameMs || frameMs <= 0) return 0;
  const elapsed = Math.max(0, now - since);
  return Math.floor(elapsed / frameMs) % frames;
}

/** On-screen box and background sizing of one pose at integer scale `s`. */
export function spriteBox(pose: Pick<PoseSprite, 'w' | 'h' | 'frames'>, s: number) {
  return {
    width: pose.w * s,
    height: pose.h * s,
    // The whole strip is scaled to w*frames*s so a PNG saved at a larger multiple still lines up.
    bgWidth: pose.w * pose.frames * s,
    bgHeight: pose.h * s,
  };
}

/** background-position-x of a frame. */
export function frameOffset(pose: Pick<PoseSprite, 'w'>, s: number, frame: number): number {
  return -frame * pose.w * s;
}

/**
 * Integer scale to draw a sprite of art height `h`: the manifest's `base`, stepped down (never
 * below 2, never above base) only when it would fill more than `maxFraction` of a short viewport.
 */
export function fitScale(base: number, h: number, viewportH: number, maxFraction = 0.55): number {
  let s = base;
  while (s > 2 && h * s > viewportH * maxFraction) s--;
  return s;
}


export const GET_UP_STEP_MS = 300;
/** Local in-between frame while the view's pose is `get-up`: get-up-2 holds until the brain moves on. */
export function getUpFrame(elapsedMs: number): 'get-up' | 'get-up-2' {
  return elapsedMs < GET_UP_STEP_MS ? 'get-up' : 'get-up-2';
}

export const SWAY_MS = 900;
export const SWAY_PX = 90;
/** Max chud dance: middle for the first beat, then right, left, right... every 0.9 s. */
export function swayOffset(elapsedMs: number): number {
  const beat = Math.floor(Math.max(0, elapsedMs) / SWAY_MS);
  if (beat === 0) return 0;
  return beat % 2 === 1 ? SWAY_PX : -SWAY_PX;
}

/** Poses whose entrance is a one-off pop / unsquash / jump rather than a looping idle. */
export type EntranceAnim = 'pop' | 'chomp' | 'unsquash' | 'slowjump' | 'squash' | '';

export interface PoseLook {
  /** Looping class while the pose is held. */
  idle: string;
  /** Played once when the pose begins. */
  entrance: EntranceAnim;
}

/** Overlay animation per pose (docs/implementation-plan.md, "Pose map"). */
export function poseLook(pose: PoseId, placement: 'corner' | 'face', prev: PoseId | null): PoseLook {
  switch (pose) {
    case 'chill':
      return { idle: 'breathe', entrance: '' };
    case 'thinking':
      return { idle: 'breathe', entrance: 'pop' };
    case 'suspicious':
      return placement === 'face'
        ? { idle: '', entrance: 'pop' }
        : { idle: '', entrance: 'unsquash' };
    case 'fat-1':
    case 'fat-2':
    case 'fat-3':
    case 'fat-4':
      return { idle: '', entrance: 'chomp' };
    case 'chud':
      return { idle: '', entrance: prev === 'chud' ? 'chomp' : 'pop' };
    case 'chud-point':
      return { idle: 'bounce', entrance: 'pop' };
    case 'close-tab':
      return { idle: '', entrance: placement === 'face' ? 'pop' : '' };
    case 'default':
    case 'grieved':
    case 'tired':
      return { idle: '', entrance: 'unsquash' };
    case 'happy':
      return { idle: '', entrance: 'slowjump' };
    default:
      return { idle: '', entrance: '' };
  }
}
