// Maps messages from pages and the popup to BarryEvents, stamping `now`.
// Pure: no browser imports.

import type { BarryEvent, ContentMessage, Millis, PopupMessage, TabId } from '../contracts';

export function contentMessageToEvent(
  msg: ContentMessage,
  tabId: TabId,
  now: Millis,
): BarryEvent | null {
  switch (msg.type) {
    case 'eaten':
      return { type: 'eaten', now, tabId, kind: msg.kind };
    case 'backToIt':
      return { type: 'backToIt', now, tabId };
    case 'pushed':
      return { type: 'pushed', now, tabId };
    case 'reachLanded':
      return { type: 'reachLanded', now, tabId, reachStartedAt: msg.reachStartedAt };
    case 'gotUp':
      return { type: 'gotUp', now };
    // 'hello' is answered with a view by the runtime; picker messages are TODO Phase 3.
    default:
      return null;
  }
}

export function popupMessageToEvent(msg: PopupMessage, now: Millis): BarryEvent | null {
  switch (msg.type) {
    case 'dev':
      return { type: 'dev', now, command: msg.command };
    case 'setModeOverride':
      return { type: 'modeOverrideSet', now, override: msg.override };
    case 'startSlackPass':
      return { type: 'slackPassStarted', now, durationMs: msg.durationMs };
    case 'stopSlackPass':
      return { type: 'slackPassStopped', now };
    case 'changeSlackPass':
      return { type: 'slackPassChanged', now, durationMs: msg.durationMs };
    case 'gotUp':
      return { type: 'gotUp', now };
    case 'setCave':
      return { type: 'caveSet', now, cave: msg.cave };
    case 'setPosition':
      return { type: 'positionSet', now, position: msg.position };
    case 'setMuted':
      return { type: 'mutedSet', now, muted: msg.muted };
    case 'setBlocklist':
      return { type: 'blocklistSet', now, blocklist: msg.blocklist };
    // setIcsUrl, refreshSchedule, startPicker, removeTodoSource: Phase 3.
    default:
      return null;
  }
}

const POPUP_TYPES = new Set([
  'setModeOverride',
  'startSlackPass',
  'stopSlackPass',
  'changeSlackPass',
  'setCave',
  'setPosition',
  'setMuted',
  'setBlocklist',
  'setIcsUrl',
  'refreshSchedule',
  'startPicker',
  'removeTodoSource',
  'setPopupTodos',
  'gotUp', // also sent by content scripts (tired Barry); both map to the same event
  'dev',
]);

/** Popup messages have no tab sender; content messages always do. */
export function isPopupMessage(msg: { type?: string }): msg is PopupMessage {
  return typeof msg?.type === 'string' && POPUP_TYPES.has(msg.type);
}
