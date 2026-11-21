import { describe, expect, it } from 'vitest';
import {
  orderTodos,
  removeSource,
  replaceSourceTodos,
  upsertSource,
  withPopupTodos,
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
