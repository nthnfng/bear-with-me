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

// Real items are typed wrappers (d2l-w2d-list-item-content / -assignment / ...), none of which end
// in "-list-item"; generic list items and role=listitem still count.
const isItem = (n: TNode) =>
  n.nodeType === 1 &&
  (/^d2l-w2d-list-item-/i.test(n.tagName ?? '') ||
    /-list-item$/i.test(n.tagName ?? '') ||
    n.getAttribute?.('role') === 'listitem');

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

const CONTENT_TAG = 'd2l-list-item-content';

function findContent(n: TNode, depth = 0): TNode | null {
  if (depth > 40) return null;
  if (n.nodeType === 1 && (n.tagName ?? '').toLowerCase() === CONTENT_TAG) return n;
  if (n.nodeType === 1 && skip(n)) return null;
  for (const c of composedChildren(n)) {
    if (c.nodeType !== 1) continue;
    const f = findContent(c, depth + 1);
    if (f) return f;
  }
  return null;
}

function findUnnamedSlot(n: TNode, depth = 0): TNode | null {
  if (depth > 20) return null;
  for (const c of Array.from(n.childNodes)) {
    if (c.nodeType !== 1) continue;
    if ((c.tagName ?? '').toLowerCase() === 'slot' && !c.getAttribute?.('name')) return c;
    const f = findUnnamedSlot(c, depth + 1);
    if (f) return f;
  }
  return null;
}

/** Primary text of a d2l-list-item-content: what is assigned to its default (unnamed) slot. */
function primaryText(content: TNode): string {
  let nodes: TNode[] = [];
  const slot = content.shadowRoot ? findUnnamedSlot(content.shadowRoot as unknown as TNode) : null;
  if (slot?.assignedNodes) nodes = slot.assignedNodes({ flatten: true });
  if (nodes.length === 0)
    nodes = Array.from(content.childNodes).filter(
      (c) => c.nodeType === 3 || (c.nodeType === 1 && !c.getAttribute?.('slot')),
    );
  const runs: string[] = [];
  for (const nd of nodes) textRuns(nd, runs);
  return runs.join(' ').trim();
}

const NOT_TITLE = /^(Due|Availability|Available|Starts?|Ends?|Overdue|Closes?|Opens?)\b/i;
const COURSE = /^[A-Z]{2,}\s?\d{3,}/;

function itemTitle(item: TNode): string {
  const label = item.getAttribute?.('label');
  if (label) return label;
  const content = findContent(item);
  const primary = content ? primaryText(content) : '';
  if (primary) return primary;
  const runs = textRuns(item);
  return runs.find((r) => !NOT_TITLE.test(r) && !COURSE.test(r)) ?? runs[0] ?? '';
}

/** One candidate per Work To Do item: its label, else the primary slot text, else the first non-date run. */
export function w2dCandidates(widget: TNode): Candidate[] {
  return findItems(widget).map((item) => ({
    text: itemTitle(item),
    checked: false, // Work To Do lists only unfinished work
  }));
}
