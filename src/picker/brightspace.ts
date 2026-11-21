// Brightspace (D2L) "Work To Do" widget. Its items live in nested open shadow roots, so the
// generic reader (light-DOM innerText) sees nothing. Picking anywhere inside the widget saves
// the marker selector below; the reader then walks the composed tree for list items.

import type { Candidate } from './todos';

export const W2D_TAG = 'd2l-w2d-work-to-do';
export const W2D_SELECTOR = '@d2l-w2d';

/** Minimal node shape (real DOM nodes satisfy it; tests use fakes). */
export interface TNode {
  nodeType: number; // 1 element, 3 text
  textContent: string | null;
  childNodes: ArrayLike<TNode>;
  tagName?: string;
  shadowRoot?: { childNodes: ArrayLike<TNode> } | null;
  getAttribute?(name: string): string | null;
  hasAttribute?(name: string): boolean;
  assignedNodes?(opts?: { flatten?: boolean }): TNode[];
  classList?: { contains(c: string): boolean };
}

const SKIP_TAGS = new Set(['style', 'script', 'template', 'svg', 'd2l-icon', 'd2l-offscreen']);

function skip(el: TNode): boolean {
  const t = (el.tagName ?? '').toLowerCase();
  if (SKIP_TAGS.has(t)) return true;
  if (el.hasAttribute?.('hidden')) return true;
  if (el.getAttribute?.('aria-hidden') === 'true') return true;
  return !!el.classList?.contains('d2l-offscreen');
}

/** Children in the composed (rendered) tree: shadow content, with slots replaced by what's slotted. */
function composedChildren(n: TNode): TNode[] {
  if (n.nodeType === 1 && (n.tagName ?? '').toLowerCase() === 'slot' && n.assignedNodes) {
    const assigned = n.assignedNodes({ flatten: true });
    if (assigned.length > 0) return assigned;
  }
  if (n.shadowRoot) return Array.from(n.shadowRoot.childNodes);
  return Array.from(n.childNodes);
}

/** Visible text runs in composed order, trimmed and non-empty. */
export function textRuns(n: TNode, out: string[] = [], depth = 0): string[] {
  if (depth > 60) return out;
  if (n.nodeType === 3) {
    const t = (n.textContent ?? '').replace(/\s+/g, ' ').trim();
    if (t) out.push(t);
    return out;
  }
  if (n.nodeType !== 1 && n.nodeType !== 11) return out;
  if (n.nodeType === 1 && skip(n)) return out;
  for (const c of composedChildren(n)) textRuns(c, out, depth + 1);
  return out;
}

const isItem = (n: TNode) =>
  n.nodeType === 1 &&
  (/-list-item$/i.test(n.tagName ?? '') || n.getAttribute?.('role') === 'listitem');

/** Outermost list items under `n` in the composed tree (an item's own sub-items are not separate). */
export function findItems(n: TNode, out: TNode[] = [], depth = 0): TNode[] {
  if (depth > 60 || out.length >= 200) return out;
  if (n.nodeType === 1 && isItem(n)) {
    out.push(n);
    return out;
  }
  if (n.nodeType === 1 && skip(n)) return out;
  for (const c of composedChildren(n))
    if (c.nodeType === 1 || c.nodeType === 11) findItems(c, out, depth + 1);
  return out;
}

/** One candidate per Work To Do item: its label attribute, else its first visible text run. */
export function w2dCandidates(widget: TNode): Candidate[] {
  return findItems(widget).map((item) => ({
    text: item.getAttribute?.('label') || textRuns(item)[0] || '',
    checked: false, // Work To Do lists only unfinished work
  }));
}
