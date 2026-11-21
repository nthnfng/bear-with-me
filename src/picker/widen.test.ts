import { describe, expect, it } from 'vitest';
import { ancestorChain, stepInChain, suggestContainer, type TreeEl } from './widen';

interface N extends TreeEl<N> {
  name: string;
}
function n(tagName: string, kids: N[] = [], attrs: Record<string, string> = {}): N {
  const node: N = {
    name: tagName,
    tagName: tagName.toUpperCase(),
    parentElement: null,
    children: kids,
    getAttribute: (k) => attrs[k] ?? null,
  };
  for (const k of kids) k.parentElement = node;
  return node;
}

describe('suggestContainer', () => {
  it('climbs from a span in a li to the ul', () => {
    const span = n('span');
    const ul = n('ul', [n('li', [span]), n('li', [n('span')]), n('li', [n('span')])]);
    n('body', [n('div', [ul])]);
    expect(suggestContainer(span)).toBe(ul);
  });
  it('climbs to a div that holds repeated div rows', () => {
    const span = n('span');
    const board = n('div', [n('div', [span]), n('div', [n('span')])]);
    n('body', [n('div', [board])]);
    expect(suggestContainer(span)).toBe(board);
  });
  it('keeps a container when it is clicked directly', () => {
    const ul = n('ul', [n('li'), n('li')]);
    n('body', [ul]);
    expect(suggestContainer(ul)).toBe(ul);
  });
  it('uses role=list', () => {
    const inner = n('span');
    const list = n('div', [n('div', [inner])], { role: 'list' });
    n('body', [list]);
    expect(suggestContainer(inner)).toBe(list);
  });
  it('returns the element itself when there is no list nearby', () => {
    const p = n('p');
    n('body', [n('div', [p])]);
    expect(suggestContainer(p)).toBe(p);
  });
});

describe('chain stepping', () => {
  it('widens and narrows, clamped', () => {
    const span = n('span');
    const li = n('li', [span]);
    const ul = n('ul', [li, n('li')]);
    n('body', [ul]);
    const chain = ancestorChain(span);
    expect(chain).toEqual([span, li, ul]);
    expect(stepInChain(chain, li, 1)).toBe(ul);
    expect(stepInChain(chain, ul, 1)).toBe(ul);
    expect(stepInChain(chain, li, -5)).toBe(span);
  });
});
