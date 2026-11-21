// Pure selector building for the element picker. Works on a minimal element shape so it can be
// tested without a DOM. Prefers stable attributes over positional paths.

export interface ElLike {
  tagName: string;
  id: string;
  parentElement: ElLike | null;
  /** Sibling elements of the parent, in order (including this one). */
  siblings(): ElLike[];
  getAttribute(name: string): string | null;
  /** Names of this element's attributes. */
  attributeNames(): string[];
  matches(selector: string): boolean;
}

/** Item selectors for apps whose DOM we know. Picking inside one selects all of them. */
export const KNOWN_ITEM_SELECTORS = [
  '.notion-to_do-block', // Notion to_do block
  'd2l-list-item', // Brightspace list rows (Lit web components)
  '.task_list_item', // Todoist task row
  'li[data-item-id]', // Todoist (data-item-id)
  '[data-testid="task-list-item"]',
];

export const MAX_ANCESTOR_STEPS = 4;
const PATH_DEPTH_CAP = 6;

const esc = (v: string) => v.replace(/\\/g, '\\\\').replace(/"/g, '\\"');

/** Ids that look generated (react-ish, long digit runs, colons) are unstable across loads. */
export function isStableId(id: string): boolean {
  if (!id || id.length > 60) return false;
  if (/\d{4,}/.test(id) || /[:]/.test(id)) return false;
  if (/^(r|ember|radix|headlessui)[-_:]?[\w-]*\d/i.test(id)) return false;
  return /^[A-Za-z][\w-]*$/.test(id);
}

const STABLE_ATTRS = ['data-testid', 'data-test-id', 'data-id', 'data-block-id', 'data-item-id'];

function attrCandidates(el: ElLike): string[] {
  const out: string[] = [];
  const tag = el.tagName.toLowerCase();
  if (isStableId(el.id)) out.push(`#${el.id}`);
  const names = el.attributeNames();
  const dataNames = [
    ...STABLE_ATTRS.filter((n) => names.includes(n)),
    ...names.filter((n) => n.startsWith('data-') && !STABLE_ATTRS.includes(n)),
  ];
  for (const n of dataNames) {
    const v = el.getAttribute(n);
    if (v && v.length <= 80) out.push(`[${n}="${esc(v)}"]`);
  }
  const role = el.getAttribute('role');
  const label = el.getAttribute('aria-label');
  if (role && label) out.push(`${tag}[role="${esc(role)}"][aria-label="${esc(label)}"]`);
  else if (label) out.push(`${tag}[aria-label="${esc(label)}"]`);
  if (role && ['list', 'listbox', 'tree', 'grid', 'table'].includes(role))
    out.push(`${tag}[role="${esc(role)}"]`);
  return out;
}

function nthPart(el: ElLike): string {
  const tag = el.tagName.toLowerCase();
  const same = el.siblings().filter((s) => s.tagName === el.tagName);
  if (same.length <= 1) return tag;
  const at = same.indexOf(el);
  return at < 0 ? tag : `${tag}:nth-of-type(${at + 1})`;
}

/**
 * Builds a selector for `el`. `count(selector)` returns how many elements in the document match;
 * a candidate is accepted only if it matches exactly one (or, for known list items, at least one).
 */
export function knownItemSelector(el: ElLike): string | null {
  let node: ElLike | null = el;
  for (let i = 0; node && i <= MAX_ANCESTOR_STEPS * 2; i++, node = node.parentElement) {
    for (const sel of KNOWN_ITEM_SELECTORS) if (node.matches(sel)) return sel;
  }
  return null;
}

export function buildSelector(el: ElLike, count: (selector: string) => number): string {
  // 1. Known list apps: pick the whole list of items.
  const known = knownItemSelector(el);
  if (known) return known;
  let node: ElLike | null = el;
  // 2. A stable attribute on the element itself, then on a close ancestor.
  node = el;
  for (let i = 0; node && i <= MAX_ANCESTOR_STEPS; i++, node = node.parentElement) {
    for (const c of attrCandidates(node)) if (count(c) === 1) return c;
  }
  // 3. Short path, anchored at the nearest stable ancestor when there is one.
  const parts: string[] = [];
  node = el;
  for (let depth = 0; node && depth < PATH_DEPTH_CAP; depth++, node = node.parentElement) {
    if (node.tagName.toLowerCase() === 'html') break;
    if (node !== el) {
      const anchor = attrCandidates(node).find((c) => count(c) === 1);
      if (anchor) {
        parts.unshift(anchor);
        break;
      }
    }
    parts.unshift(nthPart(node));
    if (node.tagName.toLowerCase() === 'body') break;
    const candidate = parts.join(' > ');
    if (count(candidate) === 1) return candidate;
  }
  return parts.join(' > ');
}

/**
 * Sites whose DOM we cannot pick from by pointing. Google Docs paints text on a canvas, so the
 * click lands on a canvas tile; the readable text (when present) lives in .kix-paragraphrenderer.
 */
export function pageSpecificSelector(host: string, path: string): string | null {
  if (host === 'docs.google.com' && path.startsWith('/document/')) return '.kix-paragraphrenderer';
  return null;
}

export function makeSourceId(): string {
  const rand =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2) + Date.now().toString(36);
  return `src-${rand}`;
}
