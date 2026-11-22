// Messages between the extension's parts. The background script turns these into BarryEvents,
// stamping `now` itself, so pages and the popup never send times except where noted.

import type { BarryEffect, DevCommand, TabView } from './brain';
import type {
  BlocklistEntry,
  EatKind,
  Millis,
  ModeOverride,
  Position,
  Task,
  TaskAnswer,
} from './domain';

/** Content script → background. The tab id comes from the message sender. */
export type ContentMessage =
  | { type: 'hello' } // content script loaded; background replies with a 'view'
  | { type: 'eaten'; kind: EatKind }
  | { type: 'backToIt' }
  | { type: 'pushed' }
  | { type: 'reachLanded'; reachStartedAt: Millis }
  | { type: 'gotUp' }
  /** From the on-page "Done?" bubble. */
  | { type: 'answerTask'; id: string; answer: TaskAnswer; extendMs?: number };

/** Background → content script. */
export type BackgroundMessage =
  | { type: 'view'; view: TabView }
  | { type: 'effect'; effect: BarryEffect };

/** Popup → background. The popup reads state from storage (see storage.ts). */
export type PopupMessage =
  | { type: 'setModeOverride'; override: ModeOverride }
  | { type: 'startSlackPass'; durationMs: number }
  | { type: 'stopSlackPass' }
  | { type: 'changeSlackPass'; durationMs: number }
  | { type: 'gotUp' }
  | { type: 'setCave'; cave: boolean }
  | { type: 'setPosition'; position: Position }
  | { type: 'setMuted'; muted: boolean }
  | { type: 'setBlocklist'; blocklist: BlocklistEntry[] }
  | { type: 'setIcsUrl'; url: string }
  | { type: 'refreshSchedule' }
  /** The whole Task list after an add, edit, reorder, tick or delete. */
  | { type: 'setTasks'; tasks: Task[] }
  | { type: 'startTask'; id: string }
  | { type: 'stopTask' }
  /** extendMs: how long "extend" runs (default 15 min). */
  | { type: 'answerTask'; id: string; answer: TaskAnswer; extendMs?: number }
  | { type: 'dev'; command: DevCommand };
