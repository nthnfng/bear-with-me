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

export type Listener = [type: string, passive: boolean, kind: EatKind | null];

// kind = what gets reported; null = eaten silently (part of a gesture reported elsewhere).
// Only clicks chomp. Keys are blocked silently (YouTube's space/k can't unpause, but no Fatness).
// Scrolling and touch swipes pass through to the page; a tap still ends in a click, eaten here.
export const LISTENERS: Listener[] = [
  ['click', false, 'click'],
  ['auxclick', false, 'click'],
  ['contextmenu', false, 'click'],
  ['dblclick', false, null],
  ['mousedown', false, null],
  ['mouseup', false, null],
  ['pointerdown', false, null],
  ['pointerup', false, null],
  ['keydown', false, null],
  ['keyup', false, null],
  ['keypress', false, null],
];

/** Attribute on <html> the isolated-world eater sets while eating; the MAIN-world early script reads it. */
export const EAT_FLAG = 'data-barry-eat';
/** CustomEvent the MAIN-world early script fires on document for each event it ate. */
export const EATEN_EVENT = 'barry:eaten';

export function createInputEater(opts: InputEaterOptions) {
  const throttles: Partial<Record<EatKind, () => boolean>> = {
    scroll: createThrottle(300),
    key: createThrottle(250),
  };
  let active = false;
  let prevOverflow: string | null = null;

  const handlers = LISTENERS.map(([type, , kind]) => {
    const handler = (e: Event) => {
      if (!active || opts.isOwn(e)) return;
      if (e instanceof KeyboardEvent && !shouldEatKey(e)) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      if (kind && (throttles[kind]?.() ?? true)) opts.report(kind);
    };
    return [type, handler] as const;
  });

  // Installed once, as early as the content script runs (document_start), and left in place:
  // same-target capture listeners fire in registration order, so re-adding on every
  // activation would put us behind the page's own handlers (YouTube's key shortcuts).
  for (const [type, handler] of handlers)
    window.addEventListener(type, handler, { capture: true, passive: false });

  function set(on: boolean) {
    if (on === active) return;
    active = on;
    document.documentElement.toggleAttribute(EAT_FLAG, on);
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

  // Events the MAIN-world early script already ate arrive here (it runs before the page's own
  // listeners, which an isolated-world listener cannot guarantee).
  const onEarly = (e: Event) => {
    const kind = (e as CustomEvent<EatKind | null>).detail;
    if (active && kind && (throttles[kind]?.() ?? true)) opts.report(kind);
  };
  document.addEventListener(EATEN_EVENT, onEarly);

  function destroy() {
    document.removeEventListener(EATEN_EVENT, onEarly);
    set(false);
    for (const [type, handler] of handlers) window.removeEventListener(type, handler, { capture: true });
  }

  return { set, destroy };
}
