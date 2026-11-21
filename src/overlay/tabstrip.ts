// Estimates where this tab sits in Chrome's tab strip, as a viewport x. DOM-free and pure.
// A page cannot see the strip, so this is a model of Chrome's layout, not a measurement:
// left/right insets for window chrome, pinned tabs narrow, the rest sharing what is left.

import type { TabSlot } from '../contracts';

/** Space left of the first tab: window padding (Win/Linux) or the traffic lights (macOS). */
export const LEFT_INSET_PX = { mac: 78, other: 8 } as const;
/** Space right of the last tab: new-tab button, tab-search, and window controls (Win/Linux). */
export const RIGHT_INSET_PX = { mac: 40, other: 140 } as const;
export const PINNED_TAB_PX = 40;
export const MIN_TAB_PX = 40;
export const MAX_TAB_PX = 240;

export interface StripEnv {
  /** window.outerWidth: the whole browser window, in DIPs. */
  outerWidth: number;
  /** window.innerWidth: the viewport, in CSS px (shrinks as page zoom grows). */
  innerWidth: number;
  isMac: boolean;
}

export function isMacPlatform(nav: {
  userAgentData?: { platform?: string };
  platform?: string;
}): boolean {
  const p = nav.userAgentData?.platform ?? nav.platform ?? '';
  return /mac/i.test(p);
}

/**
 * Centre of the tab, as a fraction (0..1) of the window width, or null when the slot or
 * window is unusable. Pure layout; no zoom involved.
 */
export function tabCentreFraction(slot: TabSlot, env: Pick<StripEnv, 'outerWidth' | 'isMac'>) {
  const { outerWidth: W, isMac } = env;
  if (!(W > 0) || slot.count < 1 || slot.index < 0 || slot.index >= slot.count) return null;
  const left = isMac ? LEFT_INSET_PX.mac : LEFT_INSET_PX.other;
  const right = isMac ? RIGHT_INSET_PX.mac : RIGHT_INSET_PX.other;
  const strip = W - left - right;
  if (strip <= 0) return null;
  const pinned = Math.min(Math.max(slot.pinned, 0), slot.count);
  const unpinned = slot.count - pinned;
  const rest = Math.max(0, strip - pinned * PINNED_TAB_PX);
  const w = unpinned > 0 ? Math.min(MAX_TAB_PX, Math.max(MIN_TAB_PX, rest / unpinned)) : 0;
  const x =
    slot.index < pinned
      ? left + (slot.index + 0.5) * PINNED_TAB_PX
      : left + pinned * PINNED_TAB_PX + (slot.index - pinned + 0.5) * w;
  // Past the strip's end the real strip scrolls or squeezes; stay on its last stretch.
  return Math.min(Math.max(x, left), left + strip) / W;
}

/**
 * Viewport x (CSS px) under the tab, or null (caller falls back) when unknown.
 *
 * Zoom: the strip is laid out in outer-window DIPs while the viewport is in zoomed CSS px, so
 * a DIP-to-CSS scale would need the zoom factor, which a page cannot read reliably (a side
 * panel breaks outerWidth/innerWidth, devicePixelRatio mixes zoom with display scaling). Instead
 * map by fraction of width: the centre sits at f * outerWidth in the window, and the viewport
 * spans the same window width, so x = f * innerWidth. Independent of zoom by construction;
 * only an open side panel skews it, and only by the panel's share.
 */
export function tabViewportX(slot: TabSlot | null, env: StripEnv): number | null {
  if (!slot || !(env.innerWidth > 0)) return null;
  const f = tabCentreFraction(slot, env);
  if (f === null) return null;
  const x = f * env.innerWidth;
  return x >= 0 && x <= env.innerWidth ? x : null;
}
