// Background runtime (Workstream B). Hosts the pure brain inside the MV3 service worker:
// - loads/saves BarryState (STORAGE_KEYS.state), processing events strictly one at a time
// - turns tab, alarm and message activity into BarryEvents (stamping `now`)
// - pushes viewFor() to tabs after each event and executes BarryEffects
// - schedules a precise wake-up at brain.nextDeadline(), with the alarm as a safety net

import { windowsEmptiedBy } from './windowsEmptiedBy';
import { storage } from 'wxt/utils/storage';
import {
  DEFAULT_SETTINGS,
  ICS_REFRESH_MINUTES,
  STORAGE_KEYS,
  TICK_ALARM_SECONDS,
  type BackgroundMessage,
  type BarryEffect,
  type BarryEvent,
  type BarryState,
  type Brain,
  type ContentMessage,
  type DevCommand,
  type ScheduleStatus,
  type Settings,
  type PopupMessage,
  type TabId,
} from '../contracts';
import { contentMessageToEvent, isPopupMessage, popupMessageToEvent } from './messageToEvent';
import { createSerialQueue } from './serialQueue';
import { EMPTY_STATUS, normalizeIcsUrl, refreshSchedule } from '../schedule/fetcher';
import { orderTodos, removeSource, replaceSourceTodos, upsertSource } from './todos';

const TICK_ALARM = 'barry-tick';
const ICS_ALARM = 'barry-ics-refresh';
const EXPLODE_MS = 1000;
const CONTENT_SCRIPT_FILE = '/content-scripts/content.js'; // WXT output path for entrypoints/content.ts

export function startRuntime(brain: Brain) {
  const queue = createSerialQueue((err) => console.error('[barry] event failed', err));
  let deadlineTimer: ReturnType<typeof setTimeout> | undefined;
  /** Tabs mid-explosion: never push views to them (a hidden view would cut the animation). */
  const closing = new Set<TabId>();

  // ---- state ----------------------------------------------------------------------------

  async function loadState(): Promise<BarryState> {
    // Fill fields added since this state was saved (e.g. arrivedTabs) from the defaults.
    const init = brain.initialState();
    const saved = await storage.getItem<BarryState>(STORAGE_KEYS.state);
    return saved ? { ...init, ...saved, tuning: { ...init.tuning, ...saved.tuning } } : init;
  }

  async function loadSettings(): Promise<Settings> {
    return {
      ...DEFAULT_SETTINGS,
      ...((await storage.getItem<Settings>(STORAGE_KEYS.settings)) ?? {}),
    };
  }
  const saveSettings = (s: Settings) => storage.setItem(STORAGE_KEYS.settings, s);

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
        // Chrome closes a window with its last tab: keep each such window open with a fresh tab.
        const allTabs = await browser.tabs.query({});
        await Promise.all(
          windowsEmptiedBy(allTabs, ids).map((windowId) =>
            browser.tabs.create({ windowId, active: true }).catch(() => {}),
          ),
        );
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

  /** load → reduce → save → push views → run effects. Call only from inside the queue. */
  async function handle(event: BarryEvent) {
    const { state, effects } = brain.reduce(await loadState(), event);
    await storage.setItem(STORAGE_KEYS.state, state);
    await pushViews(state, Object.keys(state.openTabs).map(Number));
    scheduleDeadline(state);
    applyIdleThreshold(state.tuning.idleAfterSec);
    // Not awaited: explodeAndClose waits ~1s and must not stall the queue.
    for (const effect of effects) void runEffect(effect).catch(console.error);
  }

  /** One event at a time, in order. */
  function dispatch(event: BarryEvent) {
    return queue.enqueue(() => handle(event));
  }

  // ---- idle -----------------------------------------------------------------------------

  let idleSec = 0;
  function applyIdleThreshold(sec: number) {
    const clamped = Math.max(15, Math.round(sec)); // chrome.idle minimum is 15s
    if (clamped === idleSec) return;
    idleSec = clamped;
    browser.idle.setDetectionInterval(clamped);
  }
  browser.idle.onStateChanged.addListener((s) => {
    dispatch({ type: 'idleChanged', now: Date.now(), idle: s !== 'active' });
  });

  // ---- calendar -------------------------------------------------------------------------

  let refreshing: Promise<void> | null = null;
  /** Fetch the ICS feed, keep the last good result on failure, tell the brain. Never logs the URL. */
  function refreshScheduleNow(): Promise<void> {
    refreshing ??= (async () => {
      const settings = await queue.enqueue(loadSettings);
      const previous =
        (await storage.getItem<ScheduleStatus>(STORAGE_KEYS.schedule)) ?? EMPTY_STATUS;
      const status = await refreshSchedule(settings?.icsUrl ?? null, previous, {
        fetchText: (url) => fetch(url),
        now: Date.now(),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
      await storage.setItem(STORAGE_KEYS.schedule, status);
      void dispatch({ type: 'scheduleUpdated', now: Date.now(), blocks: status.blocks });
    })()
      .catch(() => console.error('[barry] schedule refresh failed'))
      .finally(() => {
        refreshing = null;
      });
    return refreshing;
  }

  // ---- settings and todos ---------------------------------------------------------------

  function setIcsUrl(raw: string) {
    return queue
      .enqueue(async () => {
        const url = raw.trim() === '' ? null : normalizeIcsUrl(raw);
        if (raw.trim() !== '' && !url) {
          const prev =
            (await storage.getItem<ScheduleStatus>(STORAGE_KEYS.schedule)) ?? EMPTY_STATUS;
          await storage.setItem(STORAGE_KEYS.schedule, {
            ...prev,
            error: 'That is not a valid calendar URL',
          });
          return false;
        }
        await saveSettings({ ...(await loadSettings()), icsUrl: url });
        return true;
      })
      .then(async (saved) => {
        if (saved) await refreshScheduleNow();
      });
  }

  /** Recompute the brain's todos from the sources list and a change to one source's items. */
  function updateTodos(
    change: (todos: BarryState['todos'], settings: Settings) => BarryState['todos'],
  ) {
    return queue.enqueue(async () => {
      const settings = await loadSettings();
      const state = await loadState();
      const todos = orderTodos(change(state.todos, settings), settings.todoSources);
      await handle({ type: 'todosUpdated', now: Date.now(), todos });
    });
  }

  async function startPickerInActiveTab() {
    const tabId = await activeTabOfFocusedWindow();
    if (tabId !== null) await sendToTab(tabId, { type: 'startPicker' });
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
  // Sync idle state (a worker restart or browser start may have missed a change).
  void queue.enqueue(async () => {
    const state = await loadState();
    applyIdleThreshold(state.tuning.idleAfterSec);
    const idle = (await browser.idle.queryState(idleSec)) !== 'active';
    if (idle !== state.userIdle) await handle({ type: 'idleChanged', now: Date.now(), idle });
  });

  // ---- messages -------------------------------------------------------------------------

  browser.runtime.onMessage.addListener((msg: ContentMessage | PopupMessage, sender) => {
    const now = Date.now();
    if (isPopupMessage(msg)) {
      switch (msg.type) {
        case 'setIcsUrl':
          void setIcsUrl(msg.url);
          return;
        case 'refreshSchedule':
          void refreshScheduleNow();
          return;
        case 'startPicker':
          void startPickerInActiveTab();
          return;
        case 'removeTodoSource':
          void queue.enqueue(async () => {
            const settings = await loadSettings();
            await saveSettings({
              ...settings,
              todoSources: removeSource(settings.todoSources, msg.sourceId),
            });
          });
          void updateTodos((todos) => todos.filter((t) => t.sourceId !== msg.sourceId));
          return;
      }
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
    if (msg.type === 'pickerSaved') {
      // Saves the source; the content script follows with todosCaptured for it.
      void queue.enqueue(async () => {
        const settings = await loadSettings();
        await saveSettings({
          ...settings,
          todoSources: upsertSource(settings.todoSources, msg.source),
        });
      });
      return;
    }
    if (msg.type === 'todosCaptured') {
      void updateTodos((todos, settings) =>
        settings.todoSources.some((s) => s.id === msg.sourceId)
          ? replaceSourceTodos(todos, msg.sourceId, msg.items)
          : todos,
      );
      return;
    }
    const event = contentMessageToEvent(msg, tabId, now);
    if (event) dispatch(event);
  });

  // ---- clock ----------------------------------------------------------------------------

  // Chrome's minimum alarm period is 30s (0.5 min), which equals TICK_ALARM_SECONDS.
  browser.alarms.create(TICK_ALARM, { periodInMinutes: TICK_ALARM_SECONDS / 60 });
  browser.alarms.create(ICS_ALARM, { periodInMinutes: ICS_REFRESH_MINUTES });
  browser.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === TICK_ALARM) dispatch({ type: 'tick', now: Date.now() });
    if (alarm.name === ICS_ALARM) void refreshScheduleNow();
  });
  // Refresh on worker start too (the alarm only fires after its first period).
  void refreshScheduleNow();

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
    /** Dev: fake captured todos, e.g. barry.todos(['Lab report']). */
    todos: (items: string[]) =>
      dispatch({
        type: 'todosUpdated',
        now: Date.now(),
        todos: items.map((text) => ({ text, sourceId: 'dev' })),
      }),
  };

  console.log('[barry] runtime started');
}
