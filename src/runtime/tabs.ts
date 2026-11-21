// Pure helpers for the runtime's tab handling. No browser imports.

import type { BarryEffect, BarryEvent, Millis, TabId, TabSlot } from '../contracts';

export interface TabInfo {
  id?: number;
  windowId: number;
  /** 0-based position in the window's tab strip. */
  index: number;
  pinned?: boolean;
}

/** Where `tabId` sits in its window's tab strip, or null if the tab isn't in the list. */
export function tabSlotFor(tabs: TabInfo[], tabId: TabId): TabSlot | null {
  const tab = tabs.find((t) => t.id === tabId);
  if (!tab) return null;
  const inWindow = tabs.filter((t) => t.windowId === tab.windowId);
  return {
    index: tab.index,
    count: inWindow.length,
    pinned: inWindow.filter((t) => t.pinned).length,
  };
}

/** Content scripts only run on http(s) pages: not chrome://, the Web Store, file://, view-source: ... */
export function isScriptableUrl(url: string | undefined): boolean {
  return (
    !!url &&
    /^https?:\/\//i.test(url) &&
    !/^https:\/\/(chromewebstore\.google\.com|chrome\.google\.com\/webstore)/i.test(url)
  );
}

export interface LiveTab {
  id?: number;
  url?: string;
  pendingUrl?: string;
}

/**
 * Bring the brain's tab list in line with the browser's: tabs that vanished while the worker was
 * not listening (browser restart, crash) must be closed, and unknown or changed tabs navigated.
 */
export function planTabSync(
  openTabs: Record<TabId, string>,
  live: LiveTab[],
): { close: TabId[]; navigate: { tabId: TabId; url: string }[] } {
  const liveIds = new Set<number>();
  const navigate: { tabId: TabId; url: string }[] = [];
  for (const tab of live) {
    if (tab.id === undefined) continue;
    liveIds.add(tab.id);
    const url = tab.url || tab.pendingUrl;
    if (url && openTabs[tab.id] !== url) navigate.push({ tabId: tab.id, url });
  }
  const close = Object.keys(openTabs)
    .map(Number)
    .filter((id) => !liveIds.has(id));
  return { close, navigate };
}

/** A gap longer than this between events means the computer slept or the browser was closed. */
export const STALE_GAP_MS = 2 * 60_000;

/** Events the world produces by itself. User actions are never stale: the user wants their effect. */
const AMBIENT_EVENTS = new Set<BarryEvent['type']>([
  'tick',
  'idleChanged',
  'scheduleUpdated',
  'todosUpdated',
  'tabActivated',
  'tabNavigated',
  'tabClosed',
]);

/**
 * After a long silence (sleep), an ambient event may advance the brain past episodes that ended
 * while nobody was looking. Its one-shot effects (explosions, sounds, suggestions) are stale:
 * drop them. The brain's state still catches up; only the badge is kept.
 */
export function dropStaleEffects(
  event: BarryEvent,
  previousNow: Millis | null,
  effects: BarryEffect[],
): BarryEffect[] {
  if (previousNow === null || !AMBIENT_EVENTS.has(event.type)) return effects;
  if (event.now - previousNow <= STALE_GAP_MS) return effects;
  return effects.filter((e) => e.type === 'setBadge');
}
