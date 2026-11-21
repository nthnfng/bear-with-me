// Re-reads saved todo sources on this page and reports changes. Debounced, capped.

import { storage } from 'wxt/utils/storage';
import { STORAGE_KEYS, type ContentMessage, type Settings, type TodoSource } from '../contracts';
import { queryAllPiercing, queryDeep } from './deep';
import {
  collectCandidates,
  createChangeGate,
  matchSources,
  normalizeItems,
  type NodeLike,
} from './todos';

export const DEBOUNCE_MS = 800;
export const MIN_GAP_MS = 2000;
export const MAX_REREADS = 100;
export const POLL_MS = 5000;

/** Wraps a real Element in the NodeLike shape. */
export function asNode(el: Element): NodeLike {
  return {
    textContent: el.textContent,
    get innerText() {
      return (el as HTMLElement).innerText ?? el.textContent ?? '';
    },
    className: typeof el.className === 'string' ? el.className : '',
    matches: (s) => el.matches(s),
    querySelectorAll: (s) => queryAllPiercing(el, s).map(asNode),
    getAttribute: (n) => el.getAttribute(n),
    hasCheckedBox: () =>
      (el instanceof HTMLInputElement && el.type === 'checkbox' && el.checked) ||
      !!el.querySelector(
        'input[type="checkbox"]:checked, [aria-checked="true"], [data-checked="true"]',
      ),
    isStruckThrough: () => {
      try {
        const own = getComputedStyle(el).textDecorationLine;
        if (own.includes('line-through')) return true;
        const kid = el.querySelector('[style*="line-through"], s, del, strike');
        return !!kid;
      } catch {
        return false;
      }
    },
  };
}

export function readSource(source: TodoSource, root: ParentNode = document): string[] {
  let els: Element[] = [];
  try {
    els = queryDeep(root, source.selector);
  } catch {
    return []; // bad selector saved earlier
  }
  return normalizeItems(collectCandidates(els.map(asNode)));
}

export interface TodoReader {
  /** Read one source now (used right after picking) and send if changed. */
  captureNow(source: TodoSource): void;
  destroy(): void;
}

export function startTodoReader(send: (msg: ContentMessage) => void): TodoReader {
  const gate = createChangeGate();
  let sources: TodoSource[] = [];
  let rereads = 0;
  let lastRead = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let lastHref = location.href;

  const readAll = () => {
    lastRead = Date.now();
    const here = matchSources(sources, location.origin, location.pathname);
    for (const s of here) {
      const items = readSource(s);
      if (gate.changed(s.id, items)) send({ type: 'todosCaptured', sourceId: s.id, items });
    }
  };

  const schedule = () => {
    if (timer || rereads >= MAX_REREADS) return;
    const wait = Math.max(DEBOUNCE_MS, MIN_GAP_MS - (Date.now() - lastRead));
    timer = setTimeout(() => {
      timer = undefined;
      rereads++;
      readAll();
    }, wait);
  };

  const onMutation = () => {
    if (location.href !== lastHref) {
      lastHref = location.href;
      rereads = 0; // new route: fresh budget
    }
    if (matchSources(sources, location.origin, location.pathname).length > 0) schedule();
  };
  const mo = new MutationObserver(onMutation);
  mo.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
  window.addEventListener('popstate', onMutation);
  // MutationObserver cannot see inside shadow roots (Brightspace), so also re-check on a slow tick.
  const poll = setInterval(() => {
    if (matchSources(sources, location.origin, location.pathname).length > 0) schedule();
  }, POLL_MS);

  const apply = (s: Settings | null) => {
    sources = s?.todoSources ?? [];
    readAll();
  };
  storage.getItem<Settings>(STORAGE_KEYS.settings).then(apply, () => {});
  const unwatch = storage.watch<Settings>(STORAGE_KEYS.settings, (s) => apply(s));

  return {
    captureNow(source) {
      const items = readSource(source);
      if (gate.changed(source.id, items))
        send({ type: 'todosCaptured', sourceId: source.id, items });
    },
    destroy() {
      mo.disconnect();
      clearInterval(poll);
      window.removeEventListener('popstate', onMutation);
      unwatch();
      if (timer) clearTimeout(timer);
    },
  };
}
