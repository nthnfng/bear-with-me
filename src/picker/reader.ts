// Re-reads saved todo sources on this page and reports changes. Debounced, capped.

import { storage } from 'wxt/utils/storage';
import { STORAGE_KEYS, type ContentMessage, type Settings, type TodoSource } from '../contracts';
import { exportUrl, isDocsSource, parseDocsExport } from './docs';
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

export const DOCS_POLL_MS = 60_000;

/** Google Docs: the doc's HTML export first; if that fails, the canvas accessibility layer. */
export async function readDocs(): Promise<string[]> {
  const url = exportUrl(location.origin, location.pathname);
  let reason: string | number = 'no url';
  if (url) {
    try {
      const res = await fetch(url, { credentials: 'include' });
      const sameHost = new URL(res.url || url).hostname === location.hostname;
      if (res.ok && sameHost && /html/i.test(res.headers.get('content-type') ?? '')) {
        return normalizeItems(parseDocsExport(await res.text()));
      }
      reason = res.ok ? 'not html / redirected' : res.status;
    } catch (e) {
      reason = e instanceof Error ? e.name : 'error';
    }
    console.warn('[barry] docs read failed', reason);
  }
  return readDocsDom();
}

/** Best-effort fallback from the live DOM (aria-labelled canvas fragments, then kix paragraphs). */
function readDocsDom(): string[] {
  const lines: string[] = [];
  for (const g of document.querySelectorAll('.kix-canvas-tile-content g[role="paragraph"]'))
    lines.push(
      Array.from(g.querySelectorAll('rect[aria-label]'))
        .map((r) => r.getAttribute('aria-label') ?? '')
        .join(''),
    );
  if (lines.every((l) => !l.trim()))
    for (const r of document.querySelectorAll('.kix-canvas-tile-content svg rect[aria-label]'))
      lines.push(r.getAttribute('aria-label') ?? '');
  if (lines.every((l) => !l.trim()))
    for (const p of document.querySelectorAll('.kix-paragraphrenderer'))
      lines.push((p as HTMLElement).innerText ?? '');
  return normalizeItems(lines.map((text) => ({ text, checked: false })));
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
    for (const s of here()) {
      const items = readSource(s);
      if (gate.changed(s.id, items)) send({ type: 'todosCaptured', sourceId: s.id, items });
    }
  };
  const here = () =>
    matchSources(sources, location.origin, location.pathname).filter((s) => !isDocsSource(s));
  const docsHere = () =>
    window === window.top
      ? matchSources(sources, location.origin, location.pathname).filter(isDocsSource)
      : [];
  const readDocsAll = async () => {
    const mine = docsHere();
    if (mine.length === 0 || docsBusy) return;
    docsBusy = true;
    try {
      const items = await readDocs();
      for (const s of mine)
        if (gate.changed(s.id, items)) send({ type: 'todosCaptured', sourceId: s.id, items });
    } finally {
      docsBusy = false;
    }
  };
  let docsBusy = false;
  // Docs mutates constantly, so no mutation-driven re-reads: load, pick, then a slow visible tick.
  const docsTick = setInterval(() => {
    if (document.visibilityState === 'visible') void readDocsAll();
  }, DOCS_POLL_MS);

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
    if (here().length > 0) schedule();
  };
  const mo = new MutationObserver(onMutation);
  mo.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
  window.addEventListener('popstate', onMutation);
  // MutationObserver cannot see inside shadow roots (Brightspace), so also re-check on a slow tick.
  const poll = setInterval(() => {
    if (here().length > 0) schedule();
  }, POLL_MS);

  const apply = (s: Settings | null) => {
    sources = s?.todoSources ?? [];
    readAll();
    void readDocsAll();
  };
  storage.getItem<Settings>(STORAGE_KEYS.settings).then(apply, () => {});
  const unwatch = storage.watch<Settings>(STORAGE_KEYS.settings, (s) => apply(s));

  return {
    captureNow(source) {
      if (isDocsSource(source)) {
        if (!sources.some((x) => x.id === source.id)) sources = [...sources, source];
        void readDocsAll();
        return;
      }
      const items = readSource(source);
      if (gate.changed(source.id, items))
        send({ type: 'todosCaptured', sourceId: source.id, items });
    },
    destroy() {
      mo.disconnect();
      clearInterval(poll);
      clearInterval(docsTick);
      window.removeEventListener('popstate', onMutation);
      unwatch();
      if (timer) clearTimeout(timer);
    },
  };
}
