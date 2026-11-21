import { describe, expect, it } from 'vitest';
import {
  cleanText,
  collectCandidates,
  createChangeGate,
  matchSources,
  normalizeItems,
  type NodeLike,
} from './todos';

const node = (
  o: Partial<NodeLike> & { text?: string; items?: NodeLike[]; self?: boolean },
): NodeLike => ({
  textContent: o.text ?? '',
  innerText: o.text ?? '',
  matches: () => o.self ?? false,
  querySelectorAll: () => o.items ?? [],
  getAttribute: () => null,
  ...o,
});

describe('normalizeItems', () => {
  it('skips checked, empty, and duplicates; keeps first line', () => {
    expect(
      normalizeItems([
        { text: ' Buy milk \nDue today', checked: false },
        { text: 'Done thing', checked: true },
        { text: '   ', checked: false },
        { text: 'Buy milk', checked: false },
        { text: 'Lab report', checked: false },
      ]),
    ).toEqual(['Buy milk', 'Lab report']);
  });
  it('cleans whitespace', () => expect(cleanText('\n  a \t b  \n')).toBe('a b'));
});

describe('collectCandidates', () => {
  it('treats a matched item as one item and detects checked', () => {
    const c = collectCandidates([
      node({ text: 'A', self: true }),
      node({ text: 'B', self: true, getAttribute: (n) => (n === 'aria-checked' ? 'true' : null) }),
      node({ text: 'C', self: true, isStruckThrough: () => true }),
    ]);
    expect(normalizeItems(c)).toEqual(['A']);
  });
  it('finds items inside a container', () => {
    const c = collectCandidates([
      node({ items: [node({ text: 'one' }), node({ text: 'two', className: 'task is-checked' })] }),
    ]);
    expect(normalizeItems(c)).toEqual(['one']);
  });
  it('splits plain text blocks into lines', () => {
    expect(normalizeItems(collectCandidates([node({ text: 'x\n\ny' })]))).toEqual(['x', 'y']);
  });
});

describe('matchSources and gate', () => {
  const src = (id: string, path: string) => ({ id, origin: 'https://a.com', path, selector: 'ul' });
  it('matches origin and path', () => {
    const list = [src('1', '/x'), src('2', '/y')];
    expect(matchSources(list, 'https://a.com', '/x').map((s) => s.id)).toEqual(['1']);
    expect(matchSources(list, 'https://b.com', '/x')).toEqual([]);
  });
  it('only reports changes', () => {
    const g = createChangeGate();
    expect(g.changed('1', ['a'])).toBe(true);
    expect(g.changed('1', ['a'])).toBe(false);
    expect(g.changed('1', ['a', 'b'])).toBe(true);
    expect(g.changed('1', [])).toBe(true);
  });
});
