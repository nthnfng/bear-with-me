import { describe, expect, it } from 'vitest';
import {
  orderTodos,
  removeSource,
  replaceSourceTodos,
  upsertSource,
  withPopupTodos,
  withoutHidden,
  addHidden,
} from './todos';

describe('popup todos', () => {
  it('puts unfinished popup todos first and skips done or blank ones', () => {
    const out = withPopupTodos(
      [{ text: 'a1', sourceId: 'a' }],
      [
        { id: '1', text: ' Gym ', done: false },
        { id: '2', text: 'Done thing', done: true },
        { id: '3', text: '  ', done: false },
      ],
    );
    expect(out).toEqual([
      { text: 'Gym', sourceId: 'popup' },
      { text: 'a1', sourceId: 'a' },
    ]);
  });
  it('replaces earlier popup todos instead of stacking them', () => {
    const once = withPopupTodos([], [{ id: '1', text: 'x', done: false }]);
    expect(withPopupTodos(once, [{ id: '1', text: 'x', done: true }])).toEqual([]);
  });
});

const src = (id: string) => ({ id, origin: 'https://a', path: '/', selector: 'ul' });

describe('todo sources', () => {
  it('dedupes by id', () => {
    const out = upsertSource([src('a')], { ...src('a'), selector: 'ol' });
    expect(out).toHaveLength(1);
    expect(out[0]!.selector).toBe('ol');
    expect(upsertSource(out, src('b')).map((s) => s.id)).toEqual(['a', 'b']);
  });
  it('replaces only that source and trims blanks', () => {
    const t = replaceSourceTodos(
      [
        { text: 'x', sourceId: 'a' },
        { text: 'y', sourceId: 'b' },
      ],
      'a',
      [' one ', '', 'two'],
    );
    expect(t.map((x) => x.text)).toEqual(['y', 'one', 'two']);
  });
  it('orders by source order, keeping capture order within a source', () => {
    const todos = [
      { text: 'b1', sourceId: 'b' },
      { text: 'a1', sourceId: 'a' },
      { text: 'a2', sourceId: 'a' },
      { text: 'gone', sourceId: 'z' },
    ];
    expect(orderTodos(todos, [src('a'), src('b')]).map((t) => t.text)).toEqual(['a1', 'a2', 'b1']);
  });
  it('removeSource', () => {
    expect(removeSource([src('a'), src('b')], 'a').map((s) => s.id)).toEqual(['b']);
  });
});

describe('hidden (deleted) copied todos', () => {
  it('drops hidden todos from their source only, matching trimmed text', () => {
    const todos = [
      { text: 'read ch 3', sourceId: 'a' },
      { text: 'read ch 3', sourceId: 'b' },
      { text: 'essay', sourceId: 'a' },
    ];
    expect(withoutHidden(todos, [{ sourceId: 'a', text: ' read ch 3 ' }])).toEqual([
      { text: 'read ch 3', sourceId: 'b' },
      { text: 'essay', sourceId: 'a' },
    ]);
    expect(withoutHidden(todos, undefined)).toBe(todos);
  });

  it('adds a hidden todo once', () => {
    const once = addHidden(undefined, { sourceId: 'a', text: 'essay ' });
    expect(once).toEqual([{ sourceId: 'a', text: 'essay' }]);
    expect(addHidden(once, { sourceId: 'a', text: 'essay' })).toBe(once);
  });
});
