// Input eater: while active, swallows page input in the capture phase and reports it.
// No decisions here beyond "is this input?" and rate limiting (ADR 0001).

import type { EatKind } from '../contracts';
import { shouldEatKey } from './keys';
import { createThrottle } from './throttle';

export interface InputEaterOptions {
  report(kind: EatKind): void;
  /** True for events that originate in Barry's own UI (his button stays clickable). */
  isOwn(e: Event): boolean;
}

type Listener = [type: string, passive: boolean, kind: EatKind | null];

// kind = what gets reported; null = eaten silently (part of a gesture reported elsewhere).
const LISTENERS: Listener[] = [
  ['click', false, 'click'],
  ['auxclick', false, 'click'],
  ['contextmenu', false, 'click'],
  ['dblclick', false, null],
  ['mousedown', false, null],
  ['mouseup', false, null],
  ['pointerdown', false, null],
  ['pointerup', false, null],
  ['wheel', false, 'scroll'],
  ['touchstart', false, 'click'], // preventDefault on touchstart cancels the synthetic click
  ['touchmove', false, 'scroll'],
  ['keydown', false, 'key'],
  ['keyup', false, null],
  ['keypress', false, null],
];

export function createInputEater(opts: InputEaterOptions) {
  const throttles: Partial<Record<EatKind, () => boolean>> = {
    scroll: createThrottle(300),
    key: createThrottle(250),
  };
  let active = false;
  let prevOverflow: string | null = null;

  const handlers = LISTENERS.map(([type, , kind]) => {
    const handler = (e: Event) => {
      if (opts.isOwn(e)) return;
      if (e instanceof KeyboardEvent && !shouldEatKey(e)) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      if (kind && (throttles[kind]?.() ?? true)) opts.report(kind);
    };
    return [type, handler] as const;
  });

  function set(on: boolean) {
    if (on === active) return;
    active = on;
    for (const [type, handler] of handlers) {
      if (on) window.addEventListener(type, handler, { capture: true, passive: false });
      else window.removeEventListener(type, handler, { capture: true });
    }
    // Scrollbar drags and programmatic-less scrolling: lock the page itself too.
    const root = document.documentElement;
    if (on) {
      prevOverflow = root.style.overflow;
      root.style.overflow = 'hidden';
    } else if (prevOverflow !== null) {
      root.style.overflow = prevOverflow;
      prevOverflow = null;
    }
  }

  return { set };
}
