import { describe, expect, it } from 'vitest';
import { buildSelector, isStableId, type ElLike } from './selector';

interface Spec {
  tag: string;
  id?: string;
  attrs?: Record<string, string>;
  matches?: string[];
  kids?: Spec[];
}
function make(spec: Spec, parent: ElLike | null = null): ElLike {
  const kids: ElLike[] = [];
  const el: ElLike = {
    tagName: spec.tag.toUpperCase(),
    id: spec.id ?? '',
    parentElement: parent,
    siblings: () => (parent ? (parent as unknown as { _kids: ElLike[] })._kids : [el]),
    getAttribute: (n) => spec.attrs?.[n] ?? null,
    attributeNames: () => Object.keys(spec.attrs ?? {}),
    matches: (s) => spec.matches?.includes(s) ?? false,
  };
  (el as unknown as { _kids: ElLike[] })._kids = kids;
  for (const k of spec.kids ?? []) kids.push(make(k, el));
  return el;
}
const kid = (el: ElLike, i: number) => (el as unknown as { _kids: ElLike[] })._kids[i]!;

describe('isStableId', () => {
  it('rejects generated ids', () => {
    expect(isStableId('todo-list')).toBe(true);
    expect(isStableId(':r3:')).toBe(false);
    expect(isStableId('ember1234')).toBe(false);
    expect(isStableId('')).toBe(false);
  });
});

describe('buildSelector', () => {
  it('uses a stable id', () => {
    const el = make({ tag: 'ul', id: 'tasks' });
    expect(buildSelector(el, () => 1)).toBe('#tasks');
  });
  it('uses data attributes when unique', () => {
    const el = make({ tag: 'div', attrs: { 'data-block-id': 'abc' } });
    expect(buildSelector(el, (s) => (s === '[data-block-id="abc"]' ? 1 : 2))).toBe(
      '[data-block-id="abc"]',
    );
  });
  it('picks all items for known apps from inside an item', () => {
    const root = make({
      tag: 'div',
      matches: ['.notion-to_do-block'],
      kids: [{ tag: 'span', kids: [{ tag: 'b' }] }],
    });
    expect(buildSelector(kid(kid(root, 0), 0), () => 5)).toBe('.notion-to_do-block');
  });
  it('climbs to a labelled list container', () => {
    const root = make({
      tag: 'div',
      attrs: { role: 'list', 'aria-label': 'Tasks' },
      kids: [{ tag: 'div' }, { tag: 'div' }],
    });
    const second = kid(root, 1);
    const count = (s: string) => (s === 'div[role="list"][aria-label="Tasks"]' ? 1 : 3);
    expect(buildSelector(second, count)).toBe('div[role="list"][aria-label="Tasks"]');
  });
  it('falls back to a nth-of-type path', () => {
    const root = make({ tag: 'body', kids: [{ tag: 'ul', kids: [{ tag: 'li' }, { tag: 'li' }] }] });
    const li2 = kid(kid(root, 0), 1);
    const count = (s: string) => (s === 'body > ul > li:nth-of-type(2)' ? 1 : 2);
    expect(buildSelector(li2, count)).toBe('body > ul > li:nth-of-type(2)');
  });
});
