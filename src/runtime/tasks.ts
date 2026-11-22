// Pure Task bookkeeping for the runtime. No browser imports.

import { TASK_DEFAULT_ESTIMATE_MS, TASK_MAX } from '../contracts';
import type { Task } from '../contracts';

/**
 * Todos typed into the old popup list become Tasks (30 min estimate), unless Tasks already
 * exist. Returns `existing` unchanged when there is nothing to move.
 */
export function migrateLegacyTodos(
  legacy: unknown,
  existing: Task[],
  newId: () => string,
): Task[] {
  if (existing.length > 0 || !Array.isArray(legacy)) return existing;
  const tasks = legacy
    .filter(
      (t): t is { text: string; done?: boolean } =>
        !!t && typeof t.text === 'string' && t.text.trim() !== '' && !t.done,
    )
    .slice(0, TASK_MAX)
    .map(
      (t): Task => ({
        id: newId(),
        title: t.text.trim(),
        description: '',
        estimateMs: TASK_DEFAULT_ESTIMATE_MS,
        done: false,
        doneAt: null,
      }),
    );
  return tasks.length ? tasks : existing;
}
