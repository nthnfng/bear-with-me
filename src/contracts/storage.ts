// Storage keys and shapes in chrome.storage.local. The background script is the only writer;
// the popup reads these and listens for changes. Pure: no browser imports.

import type { BarryState } from './brain';
import type { CalendarBlock, HiddenTodo, Millis, PopupTodo, TodoSource } from './domain';

export const STORAGE_KEYS = {
  /** BarryState: the brain's whole state. */
  state: 'local:barry:state',
  /** Settings: things the brain doesn't need to reason about. */
  settings: 'local:barry:settings',
  /** ScheduleStatus: last ICS fetch result, for the popup. */
  schedule: 'local:barry:schedule',
} as const;

export type StoredState = BarryState;

export interface Settings {
  icsUrl: string | null;
  todoSources: TodoSource[];
  /** Todos typed into the popup, in the order shown. */
  popupTodos: PopupTodo[];
  /** Copied todos deleted in the popup. Optional: settings saved before this field lack it. */
  hiddenTodos?: HiddenTodo[];
}

export interface ScheduleStatus {
  blocks: CalendarBlock[];
  fetchedAt: Millis | null;
  error: string | null;
}
