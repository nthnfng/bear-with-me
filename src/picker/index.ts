// Element picker: highlight under the cursor in a shadow-root overlay, click saves, Esc cancels.

import type { ContentMessage, TodoSource } from '../contracts';
import { docPathPrefix, isDocsPage } from './docs';
import { composedParent, deepElementFromPoint, joinDeep } from './deep';
import {
  buildSelector,
  knownItemSelector,
  makeSourceId,
  pageSpecificSelector,
  type ElLike,
} from './selector';
import { ancestorChain, stepInChain, suggestContainer } from './widen';
import { W2D_SELECTOR, W2D_TAG } from './brightspace';

function insideW2D(el: Element | null): boolean {
  for (let n = el, i = 0; n && i < 80; n = composedParent(n), i++) {
    if (n.tagName.toLowerCase() === W2D_TAG) return true;
  }
  return false;
}

export interface PickerOptions {
  send(msg: ContentMessage): void;
  /** Called right after saving so the reader can send an initial todosCaptured. */
  onSaved?(source: TodoSource): void;
}

const wrappers = new WeakMap<Element, ElLike>();

/** One wrapper per element, so siblings().indexOf(self) works (identity matters for nth-of-type). */
export function asElLike(el: Element): ElLike {
  let w = wrappers.get(el);
  if (!w) {
    w = makeElLike(el);
    wrappers.set(el, w);
  }
  return w;
}

function makeElLike(el: Element): ElLike {
  return {
    tagName: el.tagName,
    id: el.id,
    get parentElement() {
      return el.parentElement ? asElLike(el.parentElement) : null;
    },
    siblings: () => (el.parentElement ? Array.from(el.parentElement.children) : [el]).map(asElLike),
    getAttribute: (n) => el.getAttribute(n),
    attributeNames: () => el.getAttributeNames(),
    matches: (s) => el.matches(s),
  } as ElLike;
}

/** Selector for `el`, with " >>> " segments for each open shadow root it sits inside. */
function deepSelectorFor(el: Element, deepest: Element | null): string {
  // Known apps: pick every row, whichever part of the list was highlighted.
  if (deepest && deepest.getRootNode() === document) {
    const known = knownItemSelector(asElLike(deepest));
    if (known) return known;
  }
  const segments: string[] = [];
  let node: Element | null = el;
  for (let i = 0; node && i < 10; i++) {
    const root = node.getRootNode() as Document | ShadowRoot;
    segments.unshift(
      buildSelector(asElLike(node), (s) => {
        try {
          return root.querySelectorAll(s).length;
        } catch {
          return 0;
        }
      }),
    );
    node = root instanceof ShadowRoot ? root.host : null;
  }
  return joinDeep(segments);
}

let active = false;
let stopActive: (() => void) | null = null;

/** Cancel a running picker (used when another frame saved a source). */
export function stopActivePicker(): void {
  stopActive?.();
}

export function startPicker(opts: PickerOptions): void {
  if (active) return;
  active = true;

  const host = document.createElement('div');
  host.setAttribute('data-barry-picker', '');
  const shadow = host.attachShadow({ mode: 'closed' });
  shadow.innerHTML = `<style>
    :host { all: initial; }
    .box { position: fixed; pointer-events: none; z-index: 2147483647; border: 3px solid #ff5722;
      background: rgba(255, 87, 34, .18); border-radius: 4px; display: none; }
    .tip { position: fixed; left: 50%; top: 12px; transform: translateX(-50%); z-index: 2147483647;
      background: #222; color: #fff; font: 600 14px system-ui, sans-serif; padding: 8px 14px;
      border-radius: 999px; pointer-events: none; }
  </style><div class="box"></div><div class="tip">Click your task list. Up/Down (or Shift + wheel) grows or shrinks the box. Esc cancels.</div>`;
  const onDocs = isDocsPage(location.hostname, location.pathname);
  if (onDocs)
    shadow.querySelector('.tip')!.textContent = 'Click anywhere in the doc to use its checklist';
  const box = shadow.querySelector('.box') as HTMLElement;
  if (window !== window.top) shadow.querySelector('.tip')?.remove(); // one tip, in the top frame
  document.documentElement.appendChild(host);
  if (window === window.top) window.focus(); // so Up/Down reach the picker once the popup closes
  stopActive = () => stop();

  // `deepest` is the element under the cursor; `target` is what we highlight: by default the
  // list holding it, then widened or narrowed with the arrow keys or Shift + wheel.
  let deepest: Element | null = null;
  let target: Element | null = null;
  let chain: Element[] = [];
  const pick = (x: number, y: number): Element | null =>
    deepElementFromPoint(x, y, (el) => el === host || host.contains(el));
  const setDeepest = (el: Element | null) => {
    if (el === deepest) return;
    deepest = el;
    chain = el ? ancestorChain(el, composedParent) : [];
    target = el ? suggestContainer(el, composedParent) : null;
  };
  // After the user resizes the box, keep it while the pointer stays inside it, so a small mouse
  // twitch before clicking doesn't throw the choice away.
  let adjusted = false;
  const keepsTarget = (x: number, y: number) => {
    if (!adjusted || !target) return false;
    const r = target.getBoundingClientRect();
    return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
  };
  const step = (delta: number) => {
    if (target) {
      target = stepInChain(chain, target, delta);
      adjusted = true;
    }
    draw();
  };
  const draw = () => {
    if (!target) {
      box.style.display = 'none';
      return;
    }
    const r = target.getBoundingClientRect();
    box.style.display = 'block';
    box.style.left = `${r.left}px`;
    box.style.top = `${r.top}px`;
    box.style.width = `${r.width}px`;
    box.style.height = `${r.height}px`;
  };
  const stop = () => {
    active = false;
    stopActive = null;
    for (const t of ['mousemove', 'click', 'mousedown', 'mouseup', 'pointerdown', 'pointerup'])
      window.removeEventListener(t, handlers[t]!, true);
    window.removeEventListener('keydown', onKey, true);
    window.removeEventListener('scroll', draw, true);
    window.removeEventListener('wheel', onWheel, true);
    clearTimeout(giveUp);
    host.remove();
  };

  const swallow = (e: Event) => {
    e.preventDefault();
    e.stopImmediatePropagation();
  };
  const onMove = (e: Event) => {
    const m = e as MouseEvent;
    if (keepsTarget(m.clientX, m.clientY)) return;
    adjusted = false;
    setDeepest(pick(m.clientX, m.clientY));
    draw();
  };
  const onClick = (e: Event) => {
    swallow(e);
    const m = e as MouseEvent;
    if (!keepsTarget(m.clientX, m.clientY)) setDeepest(pick(m.clientX, m.clientY) ?? deepest);
    const el = target;
    // Docs: any click saves the marker (the text is read from the export, not the DOM).
    const docsMarker = pageSpecificSelector(location.hostname, location.pathname);
    // Brightspace Work To Do: any click inside the widget saves its marker.
    const marker = docsMarker ?? (insideW2D(deepest ?? el) ? W2D_SELECTOR : null);
    if (!el && !marker) return;
    const source: TodoSource = {
      id: makeSourceId(),
      origin: location.origin,
      path: (docsMarker && docPathPrefix(location.pathname)) || location.pathname,
      selector: marker ?? deepSelectorFor(el!, deepest),
    };
    stop();
    opts.send({ type: 'pickerSaved', source });
    opts.onSaved?.(source);
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      swallow(e);
      step(e.key === 'ArrowUp' ? 1 : -1);
      return;
    }
    if (e.key !== 'Escape') return;
    swallow(e);
    stop();
  };
  const onWheel = (e: WheelEvent) => {
    if (!e.shiftKey) return; // plain wheel still scrolls the page
    swallow(e);
    step((e.deltaY || e.deltaX) < 0 ? 1 : -1);
  };
  // Pickers run in every frame; stop if nothing is chosen (or another frame took the pick).
  const giveUp = setTimeout(stop, 60_000);

  const handlers: Record<string, (e: Event) => void> = {
    mousemove: onMove,
    click: onClick,
    mousedown: swallow,
    mouseup: swallow,
    pointerdown: swallow,
    pointerup: swallow,
  };
  for (const [t, h] of Object.entries(handlers)) window.addEventListener(t, h, true);
  window.addEventListener('keydown', onKey, true);
  window.addEventListener('scroll', draw, true);
  window.addEventListener('wheel', onWheel, { capture: true, passive: false });
}
