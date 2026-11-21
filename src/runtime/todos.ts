// Pure todo-source bookkeeping. No browser imports.

import { POPUP_TODO_SOURCE_ID } from '../contracts';
import type { PopupTodo, Todo, TodoSource } from '../contracts';

/** Unfinished popup todos first (the user typed them in Barry's own list), then the rest. */
export function withPopupTodos(todos: Todo[], popupTodos: PopupTodo[]): Todo[] {
  const mine = popupTodos
    .filter((t) => !t.done && t.text.trim())
    .map((t) => ({ text: t.text.trim(), sourceId: POPUP_TODO_SOURCE_ID }));
  return [...mine, ...todos.filter((t) => t.sourceId !== POPUP_TODO_SOURCE_ID)];
}

/** Add (or replace by id) a source, keeping existing order. */
export function upsertSource(sources: TodoSource[], source: TodoSource): TodoSource[] {
  return sources.some((s) => s.id === source.id)
    ? sources.map((s) => (s.id === source.id ? source : s))
    : [...sources, source];
}

export function removeSource(sources: TodoSource[], sourceId: string): TodoSource[] {
  return sources.filter((s) => s.id !== sourceId);
}

/** Replace one source's items in the flat list; other sources keep their todos. */
export function replaceSourceTodos(todos: Todo[], sourceId: string, items: string[]): Todo[] {
  const rest = todos.filter((t) => t.sourceId !== sourceId);
  const mine = items
    .map((x) => x.trim())
    .filter(Boolean)
    .map((text) => ({ text, sourceId }));
  return [...rest, ...mine];
}

/** Merge per source order (the source list order), each source's items in captured order (top first). */
export function orderTodos(todos: Todo[], sources: TodoSource[]): Todo[] {
  const rank = new Map(sources.map((s, i) => [s.id, i]));
  return todos
    .filter((t) => rank.has(t.sourceId))
    .map((t, i) => ({ t, i }))
    .sort((a, b) => rank.get(a.t.sourceId)! - rank.get(b.t.sourceId)! || a.i - b.i)
    .map((x) => x.t);
}
