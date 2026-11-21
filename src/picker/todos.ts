// Pure todo-extraction helpers plus a thin DOM walker over a minimal element shape.

import type { TodoSource } from '../contracts';

export interface Candidate {
  text: string;
  checked: boolean;
}

export const MAX_ITEMS = 50;
export const MAX_TEXT = 200;

/** Collapse whitespace, take the first non-empty line, cap the length. */
export function cleanText(raw: string | null | undefined): string {
  if (!raw) return '';
  const line = raw
    .split(/\r?\n/)
    .map((l) => l.replace(/[​\s]+/g, ' ').trim())
    .find((l) => l.length > 0);
  return (line ?? '').slice(0, MAX_TEXT);
}

/** Drop checked and empty items, dedupe in order, cap the count. */
export function normalizeItems(candidates: Candidate[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const c of candidates) {
    if (c.checked) continue;
    const text = cleanText(c.text);
    if (!text || seen.has(text)) continue;
    seen.add(text);
    out.push(text);
    if (out.length >= MAX_ITEMS) break;
  }
  return out;
}

export function sameItems(a: string[] | undefined, b: string[]): boolean {
  return !!a && a.length === b.length && a.every((v, i) => v === b[i]);
}

/** Sources saved for the page we're on (exact origin and path). */
export function matchSources(sources: TodoSource[], origin: string, path: string): TodoSource[] {
  return sources.filter((s) => s.origin === origin && s.path === path);
}

/** Remembers what was last sent per source so unchanged reads stay quiet. */
export function createChangeGate() {
  const last = new Map<string, string[]>();
  return {
    /** True if `items` differs from the last sent value (and records it). */
    changed(sourceId: string, items: string[]): boolean {
      if (sameItems(last.get(sourceId), items)) return false;
      last.set(sourceId, items);
      return true;
    },
    forget(sourceId: string) {
      last.delete(sourceId);
    },
  };
}

// ---- DOM walking (minimal shape; fakes in tests) ----

export interface NodeLike {
  textContent: string | null;
  innerText?: string;
  matches(selector: string): boolean;
  querySelectorAll(selector: string): ArrayLike<NodeLike>;
  getAttribute(name: string): string | null;
  className?: unknown;
  /** True if rendered with a strike-through (Notion/Docs style completion). */
  isStruckThrough?(): boolean;
  /** True if it contains or is a checked native checkbox. */
  hasCheckedBox?(): boolean;
}

export const ITEM_SELECTOR = [
  'li',
  '[role="listitem"]',
  '[role="checkbox"]',
  '[role="treeitem"]',
  '.notion-to_do-block',
  '.task_list_item',
  '[data-item-id]',
  'd2l-list-item',
  '.kix-paragraphrenderer',
].join(',');

export function isChecked(n: NodeLike): boolean {
  if (n.getAttribute('aria-checked') === 'true') return true;
  if (n.getAttribute('data-checked') === 'true') return true;
  if (n.hasCheckedBox?.()) return true;
  const cls = typeof n.className === 'string' ? n.className : '';
  if (/\b(is-)?(checked|completed|complete|done)\b/i.test(cls)) return true;
  return n.isStruckThrough?.() ?? false;
}

export function candidateOf(n: NodeLike): Candidate {
  return { text: n.innerText ?? n.textContent ?? '', checked: isChecked(n) };
}

/** Turn the elements a selector matched into candidates. */
export function collectCandidates(matched: NodeLike[]): Candidate[] {
  const out: Candidate[] = [];
  for (const root of matched) {
    if (root.matches(ITEM_SELECTOR)) {
      out.push(candidateOf(root));
      continue;
    }
    const inner = Array.from(root.querySelectorAll(ITEM_SELECTOR));
    if (inner.length > 0) {
      for (const n of inner) out.push(candidateOf(n));
      continue;
    }
    // Plain text block (e.g. Docs lines, a <div> of lines): one item per non-empty line.
    const text = root.innerText ?? root.textContent ?? '';
    for (const line of text.split(/\r?\n/)) out.push({ text: line, checked: false });
  }
  return out;
}
