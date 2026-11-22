import { describe, expect, it } from 'vitest';
import { TASK_DEFAULT_ESTIMATE_MS } from '../contracts';
import { migrateLegacyTodos } from './tasks';

describe('migrateLegacyTodos', () => {
  let n = 0;
  const id = () => `id${++n}`;

  it('turns unfinished old popup todos into Tasks', () => {
    const out = migrateLegacyTodos(
      [
        { text: ' Gym ', done: false },
        { text: 'Old', done: true },
        { text: '   ', done: false },
      ],
      [],
      id,
    );
    expect(out).toEqual([
      {
        id: expect.any(String),
        title: 'Gym',
        description: '',
        estimateMs: TASK_DEFAULT_ESTIMATE_MS,
        done: false,
        doneAt: null,
      },
    ]);
  });

  it('leaves existing Tasks alone and ignores junk', () => {
    const existing = [
      { id: 'x', title: 'x', description: '', estimateMs: 1, done: false, doneAt: null },
    ];
    expect(migrateLegacyTodos([{ text: 'a', done: false }], existing, id)).toBe(existing);
    const none: never[] = [];
    expect(migrateLegacyTodos(undefined, none, id)).toBe(none);
    expect(migrateLegacyTodos([{ text: 'done', done: true }], none, id)).toBe(none);
  });
});
