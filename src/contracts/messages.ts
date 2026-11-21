// Messages between the extension's parts. The background script turns these into BarryEvents,
// stamping `now` itself, so pages and the popup never send times except where noted.

import type { BarryEffect, DevCommand, TabView } from './brain';
import type { BlocklistEntry, EatKind, Millis, ModeOverride, Position, TodoSource } from './domain';

/** Content script → background. The tab id comes from the message sender. */
export type ContentMessage =
  | { type: 'hello' } // content script loaded; background replies with a 'view'
  | { type: 'eaten'; kind: EatKind }
  | { type: 'backToIt' }
  | { type: 'pushed' }
  | { type: 'reachLanded'; reachStartedAt: Millis }
  | { type: 'pickerSaved'; source: TodoSource }
  | { type: 'todosCaptured'; sourceId: string; items: string[] };

/** Background → content script. */
export type BackgroundMessage =
  | { type: 'view'; view: TabView }
  | { type: 'effect'; effect: BarryEffect }
  | { type: 'startPicker' };

/** Popup → background. The popup reads state from storage (see storage.ts). */
export type PopupMessage =
  | { type: 'setModeOverride'; override: ModeOverride }
  | { type: 'startSlackPass'; durationMs: number }
  | { type: 'setCave'; cave: boolean }
  | { type: 'setPosition'; position: Position }
  | { type: 'setMuted'; muted: boolean }
  | { type: 'setBlocklist'; blocklist: BlocklistEntry[] }
  | { type: 'setIcsUrl'; url: string }
  | { type: 'refreshSchedule' }
  | { type: 'startPicker' }
  | { type: 'removeTodoSource'; sourceId: string }
  | { type: 'dev'; command: DevCommand };
