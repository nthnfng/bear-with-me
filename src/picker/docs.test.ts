import { describe, expect, it } from 'vitest';
import { docPathPrefix, exportUrl, parseDocsExport, pathMatches, struckClasses } from './docs';
import { matchSources, normalizeItems } from './todos';

const SAMPLE = `<html><head><meta content="text/html; charset=UTF-8" http-equiv="content-type"><style type="text/css">ol{margin:0;padding:0}.lst-kix_abc-0{list-style-type:none}.c1{color:#000000;font-weight:400;font-size:11pt;font-family:"Arial"}.c2{color:#000000;text-decoration:line-through;font-size:11pt}.c3,.c4{padding-top:0pt}.c5{text-decoration:none}</style></head><body class="c9 doc-content"><p class="c6"><span class="c1">Shopping notes &amp; plans</span></p><ul class="c7 lst-kix_abc-0 start"><li class="c0"><span class="c1">Buy milk</span></li><li class="c0"><span class="c2">Email prof</span></li><li class="c0"><span class="c1">Write </span><span class="c2">half struck</span></li><li class="c0"><span class="c1">Outer</span><ul class="c7"><li class="c8"><span class="c1">Inner &lt;b&gt;</span></li></ul></li><li class="c0"><span class="c1">☑ Done glyph</span></li><li class="c0"><span class="c1">Buy milk</span></li></ul><p class="c6"><span class="c1">Not a list line</span></p></body></html>`;

describe('parseDocsExport', () => {
  it('finds struck classes', () => {
    expect([...struckClasses(SAMPLE)]).toEqual(['c2']);
  });
  it('reads list items, skipping struck/checked ones', () => {
    const c = parseDocsExport(SAMPLE);
    expect(normalizeItems(c)).toEqual(['Buy milk', 'Write half struck', 'Outer', 'Inner <b>']);
    expect(c.find((x) => x.text === 'Email prof')?.checked).toBe(true);
  });
  it('falls back to paragraphs without lists', () => {
    const html =
      '<style>.c2{text-decoration:line-through}</style><p><span>A</span></p><p></p><p><span class="c2">B</span></p><p>C</p>';
    expect(normalizeItems(parseDocsExport(html))).toEqual(['A', 'C']);
  });
  it('honours aria-checked on li', () => {
    expect(
      normalizeItems(parseDocsExport('<ul><li aria-checked="true">x</li><li>y</li></ul>')),
    ).toEqual(['y']);
  });
});

describe('docs paths', () => {
  it('extracts the prefix', () => {
    expect(docPathPrefix('/document/d/abc/edit')).toBe('/document/d/abc');
    expect(docPathPrefix('/document/u/1/d/abc/edit')).toBe('/document/u/1/d/abc');
    expect(docPathPrefix('/spreadsheets/d/abc')).toBeNull();
    expect(exportUrl('https://docs.google.com', '/document/d/abc/edit?x=1')).toBe(
      'https://docs.google.com/document/d/abc/export?format=html',
    );
  });
  it('matches by prefix for docs, exactly otherwise', () => {
    const d = { selector: '@gdocs', path: '/document/d/abc' };
    expect(pathMatches(d, '/document/d/abc/edit')).toBe(true);
    expect(pathMatches(d, '/document/d/abcd/edit')).toBe(false);
    expect(pathMatches({ selector: 'li', path: '/x' }, '/x/y')).toBe(false);
    const src = { id: '1', origin: 'https://docs.google.com', ...d };
    expect(matchSources([src], 'https://docs.google.com', '/document/d/abc/edit')).toHaveLength(1);
  });
});
