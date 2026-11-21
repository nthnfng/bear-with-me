// Selectors that cross open shadow roots. A saved selector is segments joined by " >>> ": the
// first is queried in the document, each next one inside the open shadow roots of the matches.

export const SHADOW_SEP = ' >>> ';

export function splitDeep(selector: string): string[] {
  return selector
    .split('>>>')
    .map((s) => s.trim())
    .filter(Boolean);
}

export function joinDeep(segments: string[]): string {
  return segments.join(SHADOW_SEP);
}

/** querySelectorAll that also searches inside every open shadow root below `root`. */
export function queryAllPiercing(root: ParentNode, selector: string, cap = 5000): Element[] {
  const out = new Set<Element>();
  const walk = (r: ParentNode) => {
    for (const el of Array.from(r.querySelectorAll(selector))) out.add(el);
    for (const el of Array.from(r.querySelectorAll('*'))) {
      if (out.size >= cap) return;
      if (el.shadowRoot) walk(el.shadowRoot);
    }
  };
  walk(root);
  return [...out];
}

/** Resolve a saved (possibly deep) selector to elements. Throws on invalid CSS. */
export function queryDeep(root: ParentNode, selector: string): Element[] {
  const segs = splitDeep(selector);
  if (segs.length === 0) return [];
  let scopes: ParentNode[] = [root];
  let found: Element[] = [];
  segs.forEach((seg, i) => {
    found = scopes.flatMap((sc) => Array.from(sc.querySelectorAll(seg)));
    if (i < segs.length - 1) scopes = found.flatMap((e) => (e.shadowRoot ? [e.shadowRoot] : []));
  });
  return found;
}

/** The deepest element at a point, descending into open shadow roots. */
export function deepElementFromPoint(x: number, y: number, skip: (el: Element) => boolean) {
  let root: Document | ShadowRoot = document as Document | ShadowRoot;
  let el: Element | null = null;
  for (let i = 0; i < 20; i++) {
    const stack: Element[] = root.elementsFromPoint(x, y);
    const hit: Element | undefined = stack.find((e: Element) => !skip(e));
    if (!hit) break;
    el = hit;
    if (hit.shadowRoot && hit.shadowRoot !== root) root = hit.shadowRoot;
    else break;
  }
  return el;
}

/** Parent that crosses a shadow boundary to the host. */
export function composedParent(el: Element): Element | null {
  if (el.parentElement) return el.parentElement;
  const root = el.getRootNode();
  return root instanceof ShadowRoot ? root.host : null;
}
