// Element picker: highlight under the cursor in a shadow-root overlay, click saves, Esc cancels.

import type { ContentMessage, TodoSource } from '../contracts';
import { buildSelector, makeSourceId, type ElLike } from './selector';

export interface PickerOptions {
  send(msg: ContentMessage): void;
  /** Called right after saving so the reader can send an initial todosCaptured. */
  onSaved?(source: TodoSource): void;
}

export function asElLike(el: Element): ElLike {
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

let active = false;

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
  </style><div class="box"></div><div class="tip">Click your task list. Esc to cancel.</div>`;
  const box = shadow.querySelector('.box') as HTMLElement;
  document.documentElement.appendChild(host);

  let target: Element | null = null;
  const pick = (x: number, y: number): Element | null => {
    const el = document.elementFromPoint(x, y);
    return el && el !== host && !host.contains(el) ? el : null;
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
    for (const t of ['mousemove', 'click', 'mousedown', 'mouseup', 'pointerdown', 'pointerup'])
      window.removeEventListener(t, handlers[t]!, true);
    window.removeEventListener('keydown', onKey, true);
    window.removeEventListener('scroll', draw, true);
    host.remove();
  };

  const swallow = (e: Event) => {
    e.preventDefault();
    e.stopImmediatePropagation();
  };
  const onMove = (e: Event) => {
    const m = e as MouseEvent;
    target = pick(m.clientX, m.clientY);
    draw();
  };
  const onClick = (e: Event) => {
    swallow(e);
    const m = e as MouseEvent;
    const el = pick(m.clientX, m.clientY) ?? target;
    if (!el) return;
    const selector = buildSelector(asElLike(el), (s) => {
      try {
        return document.querySelectorAll(s).length;
      } catch {
        return 0;
      }
    });
    const source: TodoSource = {
      id: makeSourceId(),
      origin: location.origin,
      path: location.pathname,
      selector,
    };
    stop();
    opts.send({ type: 'pickerSaved', source });
    opts.onSaved?.(source);
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key !== 'Escape') return;
    swallow(e);
    stop();
  };

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
}
