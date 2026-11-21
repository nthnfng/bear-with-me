// Google Docs todo reading. Docs paints text on a canvas, so the DOM is no use; instead we read the
// doc's own HTML export (same origin, cookies flow). This file is the pure part: path matching and
// export-HTML parsing. The export markup is simple and flat, so careful regexes beat a DOM here
// (and run under Vitest without one).

import type { Candidate } from './todos';

/** Marker saved as `selector` for a Docs source; the reader knows to use the export. */
export const GDOCS_SELECTOR = '@gdocs';
export const DOCS_HOST = 'docs.google.com';
export const MAX_FALLBACK_LINES = 50;

const DOC_PREFIX = /^\/document\/(?:u\/\d+\/)?d\/[^/]+/;

/** `/document/(u/N/)?d/<id>` prefix of a Docs pathname, or null if it isn't a document. */
export function docPathPrefix(pathname: string): string | null {
  return DOC_PREFIX.exec(pathname)?.[0] ?? null;
}

export function isDocsPage(hostname: string, pathname: string): boolean {
  return hostname === DOCS_HOST && docPathPrefix(pathname) !== null;
}

export function isDocsSource(s: { selector: string }): boolean {
  return s.selector === GDOCS_SELECTOR;
}

/** Docs sources match by prefix (the doc id), everything else exactly. */
export function pathMatches(s: { selector: string; path: string }, pathname: string): boolean {
  if (!isDocsSource(s)) return s.path === pathname;
  return pathname === s.path || pathname.startsWith(s.path + '/');
}

export function exportUrl(origin: string, pathname: string): string | null {
  const p = docPathPrefix(pathname);
  return p ? `${origin}${p}/export?format=html` : null;
}

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
};

export function decodeEntities(s: string): string {
  return s.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === '#') {
      const n = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : m;
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

/** Class names whose CSS rule (in any <style>) contains a line-through. */
export function struckClasses(html: string): Set<string> {
  const out = new Set<string>();
  for (const style of html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)) {
    for (const rule of style[1]!.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
      if (!/line-through/i.test(rule[2]!)) continue;
      for (const sel of rule[1]!.split(',')) {
        const m = /^\s*(?:span)?\.([\w-]+)\s*$/.exec(sel);
        if (m) out.add(m[1]!);
      }
    }
  }
  return out;
}

const stripTags = (h: string) =>
  decodeEntities(h.replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, ''))
    .replace(/\s+/g, ' ')
    .trim();

/** Checked if every non-blank span is struck, a leading check glyph, or a checked marker in attrs. */
function candidateFrom(attrs: string, inner: string, struck: Set<string>): Candidate {
  const text = stripTags(inner);
  let checked =
    /aria-checked\s*=\s*["']?true|data-checked\s*=\s*["']?true|(?:^|\s)checked(?:[\s=]|$)/i.test(
      attrs,
    ) || /^[☑✓✔]/.test(text);
  if (!checked && struck.size > 0) {
    let total = 0;
    let struckLen = 0;
    for (const sp of inner.matchAll(/<span\b([^>]*)>([\s\S]*?)<\/span>/gi)) {
      const len = stripTags(sp[2]!).replace(/\s/g, '').length;
      if (!len) continue;
      total += len;
      const cls = /class\s*=\s*["']([^"']*)["']/i.exec(sp[1]!)?.[1] ?? '';
      if (cls.split(/\s+/).some((c) => struck.has(c))) struckLen += len;
    }
    checked = total > 0 && struckLen === total;
  }
  return { text: text.replace(/^[☑✓✔☐]\s*/, ''), checked };
}

/** `li` items in order (nested lists give each item only its own text). */
function listItems(html: string, struck: Set<string>): Candidate[] {
  const slots: (Candidate | null)[] = [];
  const stack: { slot: number; attrs: string; html: string }[] = [];
  const flush = () => {
    const top = stack[stack.length - 1];
    if (top) slots[top.slot] = candidateFrom(top.attrs, top.html, struck);
  };
  let last = 0;
  for (const m of html.matchAll(/<(\/?)li\b([^>]*)>/gi)) {
    const top = stack[stack.length - 1];
    if (top) top.html += html.slice(last, m.index);
    last = m.index! + m[0].length;
    if (m[1]) {
      flush();
      stack.pop();
    } else {
      flush(); // the parent's text so far (a nested list is starting)
      slots.push(null);
      stack.push({ slot: slots.length - 1, attrs: m[2]!, html: '' });
    }
  }
  return slots.filter((c): c is Candidate => !!c && c.text.length > 0);
}

function paragraphs(html: string, struck: Set<string>): Candidate[] {
  const out: Candidate[] = [];
  for (const m of html.matchAll(/<p\b([^>]*)>([\s\S]*?)<\/p>/gi)) {
    const c = candidateFrom(m[1]!, m[2]!, struck);
    if (c.text) out.push(c);
    if (out.length >= MAX_FALLBACK_LINES) break;
  }
  return out;
}

/** Candidates from a Docs HTML export: list items, else non-empty paragraphs (capped). */
export function parseDocsExport(html: string): Candidate[] {
  const body = html.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '');
  const struck = struckClasses(html);
  const items = listItems(body, struck);
  return items.length > 0 ? items : paragraphs(body, struck);
}
