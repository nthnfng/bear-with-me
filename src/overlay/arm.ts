// Pure geometry and timing for the Reach arm. DOM-free.

import type { Millis } from '../contracts';

export interface Pt {
  x: number;
  y: number;
}
export interface RectLike {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** 0..1 from the shared start time. Recomputed every frame, never accumulated. */
export function reachProgress(
  now: Millis,
  reach: { startedAt: Millis; durationMs: number },
): number {
  if (reach.durationMs <= 0) return 1;
  const p = (now - reach.startedAt) / reach.durationMs;
  return Math.min(1, Math.max(0, p));
}

/** Where a sprite-frame anchor lands in the viewport, given the sprite's on-screen rect. */
export function anchorToViewport(
  rect: RectLike,
  anchor: [number, number],
  frameSize: [number, number],
): Pt {
  return {
    x: rect.left + (anchor[0] / frameSize[0]) * rect.width,
    y: rect.top + (anchor[1] / frameSize[1]) * rect.height,
  };
}

/** How far above the viewport's top edge the hand aims, so it exits the page. */
export const REACH_ABOVE_PX = 20;

/**
 * The Reach grabs the tab: up out of the top edge at the tab's x. `tabX` comes from
 * tabViewportX; null (no slot, or estimate off-screen) falls back to straight up from the
 * hand, which reads as "reaching for the tab strip" without claiming a wrong tab.
 */
export function reachTarget(vw: number, hand: Pt, tabX: number | null): Pt {
  const x = tabX ?? hand.x;
  return { x: Math.min(Math.max(x, 0), vw), y: -REACH_ABOVE_PX };
}

/** Length in px and angle (CSS rotate, clockwise, 0 = pointing right) from hand to target. */
export function armVector(hand: Pt, target: Pt): { length: number; angleDeg: number } {
  const dx = target.x - hand.x;
  const dy = target.y - hand.y;
  return { length: Math.hypot(dx, dy), angleDeg: (Math.atan2(dy, dx) * 180) / Math.PI };
}

/** Fires true at most once per startedAt, the first time progress reaches 1. */
export function createLandingGate() {
  let reported: Millis | null = null;
  return {
    check(progress: number, startedAt: Millis): boolean {
      if (progress < 1 || reported === startedAt) return false;
      reported = startedAt;
      return true;
    },
  };
}
