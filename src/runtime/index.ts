// Background runtime (Workstream B). Hosts the pure brain inside the MV3 service worker:
// - loads/saves BarryState (STORAGE_KEYS.state), processing events strictly one at a time
// - turns tab, alarm and message activity into BarryEvents (stamping `now`)
// - pushes viewFor() to tabs after each event and executes BarryEffects
// - schedules a precise wake-up at brain.nextDeadline(), with the alarm as a safety net

import { storage } from 'wxt/utils/storage';
import {
  STORAGE_KEYS,
  TICK_ALARM_SECONDS,
  type BackgroundMessage,
  type BarryEffect,
  type BarryEvent,
  type BarryState,
  type Brain,
  type ContentMessage,
  type DevCommand,
  type PopupMessage,
  type TabId,
} from '../contracts';
import { contentMessageToEvent, isPopupMessage, popupMessageToEvent } from './messageToEvent';
import { createSerialQueue } from './serialQueue';

const TICK_ALARM = 'barry-tick';
const EXPLODE_MS = 1000;
const CONTENT_SCRIPT_FILE = '/content-scripts/content.js'; // WXT output path for entrypoints/content.ts

export function startRuntime(brain: Brain) {
  const queue = createSerialQueue((err) => console.error('[barry] event failed', err));
  let deadlineTimer: ReturnType<typeof setTimeout> | undefined;
  /** Tabs mid-explosion: never push views to them (a hidden view would cut the animation). */
  const closing = new Set<TabId>();

  // ---- state ----------------------------------------------------------------------------

  async function loadState(): Promise<BarryState> {
    return (await storage.getItem<BarryState>(STORAGE_KEYS.state)) ?? brain.initialState();
  }

  // ---- talking to tabs ------------------------------------------------------------------

  function sendToTab(tabId: TabId, msg: BackgroundMessage): Promise<void> {
    // Tabs without a content script (chrome://, store pages, discarded) reject: ignore.
    return browser.tabs.sendMessage(tabId, msg).then(
      () => {},
      () => {},
    );
  }

  async function pushViews(state: BarryState, tabIds: TabId[]) {
    const now = Date.now();
    await Promise.all(
      tabIds
        .filter((id) => !closing.has(id))
        .map((id) => sendToTab(id, { type: 'view', view: brain.viewFor(state, id, now) })),
    );
  }

  // ---- effects --------------------------------------------------------------------------

  async function runEffect(effect: BarryEffect) {
    switch (effect.type) {
      case 'explodeAndClose': {
        const ids = [...new Set(effect.tabIds)];
        ids.forEach((id) => closing.add(id));
        await Promise.all(ids.map((id) => sendToTab(id, { type: 'effect', effect })));
        await new Promise((r) => setTimeout(r, EXPLODE_MS));
        // One call for every tab and window; closed tabs raise onRemoved -> tabClosed via the queue.
        try {
          await browser.tabs.remove(ids);
        } catch {
          // Some were already closed (the call may have aborted): remove the rest one by one.
          await Promise.all(ids.map((id) => browser.tabs.remove(id).catch(() => {})));
        }
        // Tabs that survived (remove failed) should show views again.
        ids.forEach((id) => closing.delete(id));
        return;
      }
      case 'playSound':
      case 'showSuggestion':
        await sendToTab(effect.tabId, { type: 'effect', effect });
        return;
      case 'setBadge':
        await browser.action.setBadgeText({ text: effect.text });
        return;
    }
  }

  // ---- the event loop -------------------------------------------------------------------

  function scheduleDeadline(state: BarryState) {
    clearTimeout(deadlineTimer);
    const deadline = brain.nextDeadline(state);
    if (deadline === null) return;
    const delay = Math.min(Math.max(0, deadline - Date.now()), 2 ** 31 - 1);
    deadlineTimer = setTimeout(() => dispatch({ type: 'tick', now: Date.now() }), delay);
  }

  /** load → reduce → save → push views → run effects, one event at a time. */
  function dispatch(event: BarryEvent) {
    return queue.enqueue(async () => {
      const { state, effects } = brain.reduce(await loadState(), event);
      await storage.setItem(STORAGE_KEYS.state, state);
      await pushViews(state, Object.keys(state.openTabs).map(Number));
      scheduleDeadline(state);
      // Not awaited: explodeAndClose waits ~1s and must not stall the queue.
      for (const effect of effects) void runEffect(effect).catch(console.error);
    });
  }

  // ---- tab tracking ---------------------------------------------------------------------

  async function activeTabOfFocusedWindow(): Promise<TabId | null> {
    const [tab] = await browser.tabs.query({ active: true, lastFocusedWindow: true });
    return tab?.id ?? null;
  }

  async function seedOpenTabs() {
    const now = Date.now();
    for (const tab of await browser.tabs.query({})) {
      if (tab.id !== undefined && tab.url) {
        await dispatch({ type: 'tabNavigated', now, tabId: tab.id, url: tab.url });
      }
    }
    await dispatch({
      type: 'tabActivated',
      now: Date.now(),
      tabId: await activeTabOfFocusedWindow(),
    });
  }

  async function injectIntoOpenTabs() {
    for (const tab of await browser.tabs.query({ url: ['http://*/*', 'https://*/*'] })) {
      if (tab.id === undefined) continue;
      await browser.scripting
        .executeScript({ target: { tabId: tab.id }, files: [CONTENT_SCRIPT_FILE] })
        .catch(() => {}); // restricted pages (web store etc.)
    }
  }

  browser.tabs.onActivated.addListener(({ tabId }) => {
    dispatch({ type: 'tabActivated', now: Date.now(), tabId });
  });
  browser.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (changeInfo.url) {
      dispatch({ type: 'tabNavigated', now: Date.now(), tabId, url: changeInfo.url });
    }
  });
  browser.tabs.onRemoved.addListener((tabId) => {
    closing.delete(tabId);
    dispatch({ type: 'tabClosed', now: Date.now(), tabId });
  });
  browser.windows.onFocusChanged.addListener(async (windowId) => {
    const tabId =
      windowId === browser.windows.WINDOW_ID_NONE ? null : await activeTabOfFocusedWindow();
    dispatch({ type: 'tabActivated', now: Date.now(), tabId });
  });

  browser.runtime.onInstalled.addListener(async () => {
    await seedOpenTabs();
    await injectIntoOpenTabs();
  });
  browser.runtime.onStartup.addListener(() => {
    void seedOpenTabs();
  });

  // ---- worker (re)start -----------------------------------------------------------------
  // The worker may have been killed mid-Reach. Everything lives in storage, so a tick with
  // the real `now` recomputes the phase, re-pushes views to all known open tabs (the overlay
  // derives arm progress from reachStartedAt) and re-arms the deadline timer.
  void dispatch({ type: 'tick', now: Date.now() });

  // ---- messages -------------------------------------------------------------------------

  browser.runtime.onMessage.addListener((msg: ContentMessage | PopupMessage, sender) => {
    const now = Date.now();
    if (isPopupMessage(msg)) {
      const event = popupMessageToEvent(msg, now);
      if (event) dispatch(event);
      return;
    }
    const tabId = sender.tab?.id;
    if (tabId === undefined) return;
    if (msg.type === 'hello') {
      // Make sure the brain knows this tab, then push its view.
      queue.enqueue(async () => pushViews(await loadState(), [tabId]));
      return;
    }
    const event = contentMessageToEvent(msg, tabId, now);
    if (event) dispatch(event);
  });

  // ---- clock ----------------------------------------------------------------------------

  // Chrome's minimum alarm period is 30s (0.5 min), which equals TICK_ALARM_SECONDS.
  browser.alarms.create(TICK_ALARM, { periodInMinutes: TICK_ALARM_SECONDS / 60 });
  browser.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === TICK_ALARM) dispatch({ type: 'tick', now: Date.now() });
  });

  // ---- temporary dev hook: run `barry.injectBlock()` in the service worker's DevTools -----

  const dev = (command: DevCommand) => dispatch({ type: 'dev', now: Date.now(), command });
  const override = (o: 'auto' | 'chill' | 'lockIn') =>
    dispatch({ type: 'modeOverrideSet', now: Date.now(), override: o });
  (globalThis as any).barry = {
    dev,
    state: loadState,
    injectBlock: (title = 'ETF prep', minutes = 60) =>
      dev({ kind: 'injectBlock', title, durationMs: minutes * 60_000 }),
    lockIn: () => override('lockIn'),
    chill: () => override('chill'),
    auto: () => override('auto'),
  };

  console.log('[barry] runtime started');
}
