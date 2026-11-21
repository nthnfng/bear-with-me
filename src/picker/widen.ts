// Pure helpers for choosing what the picker highlights: start from the element under the cursor,
// climb to the list that holds it, and let the user widen or narrow along the ancestor chain.

export interface TreeEl<E> {
  tagName: string;
  parentElement: E | null;
  children: ArrayLike<E>;
  getAttribute(name: string): string | null;
}

const LIST_ROLES = ['list', 'listbox', 'tree', 'grid'];
const MAX_CLIMB = 8;

const tag = (e: { tagName: string }) => e.tagName.toLowerCase();

/** True for elements that are clearly a list container by tag or role. */
export function isListContainer<E extends TreeEl<E>>(el: E): boolean {
  const t = tag(el);
  return t === 'ul' || t === 'ol' || LIST_ROLES.includes(el.getAttribute('role') ?? '');
}

/** True if `el` has two or more element children sharing one tag (a repeated-row container). */
function hasRepeatedChildren<E extends TreeEl<E>>(el: E): boolean {
  const counts = new Map<string, number>();
  for (const c of Array.from(el.children)) counts.set(tag(c), (counts.get(tag(c)) ?? 0) + 1);
  return [...counts.values()].some((n) => n >= 2);
}

/**
 * The element to highlight first for a pointer over `el`: the list that contains it. Climbs while
 * we are inside a single row, stops at the first list-like container, and gives up (returning `el`)
 * when no list is within a few levels, so a plain paragraph still highlights itself.
 */
export function suggestContainer<E extends TreeEl<E>>(
  el: E,
  parent: (e: E) => E | null = (e) => e.parentElement,
): E {
  let node: E | null = el;
  for (let i = 0; node && i <= MAX_CLIMB; i++, node = parent(node)) {
    const t = tag(node);
    if (t === 'body' || t === 'html') break;
    if (isListContainer(node) || hasRepeatedChildren(node)) return node;
  }
  return el;
}

/** Ancestors of `el` from itself upward, stopping before body. */
export function ancestorChain<E extends TreeEl<E>>(
  el: E,
  parent: (e: E) => E | null = (e) => e.parentElement,
): E[] {
  const out: E[] = [];
  for (let n: E | null = el; n && tag(n) !== 'body' && tag(n) !== 'html'; n = parent(n))
    out.push(n);
  return out.length > 0 ? out : [el];
}

/** Moves along the chain (0 = deepest). `delta` > 0 widens. Result is clamped. */
export function stepInChain<E>(chain: E[], from: E, delta: number): E {
  const i = Math.max(0, Math.min(chain.length - 1, chain.indexOf(from) + delta));
  return chain[i]!;
}
