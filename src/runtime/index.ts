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
import {
  EMPTY_STATUS,
  isScheduleFresh,
  normalizeIcsUrl,
  refreshSchedule,
  shouldDispatchSchedule,
} from '../schedule/fetcher';
import { playSoundOffscreen } from './offscreen';
import { explosionSoundDelay } from './explosionSound';
import { dropStaleEffects, isScriptableUrl, planTabSync, tabSlotFor } from './tabs';
import { orderTodos, removeSource, replaceSourceTodos, upsertSource } from './todos';

const TICK_ALARM = 'barry-tick';
const ICS_ALARM = 'barry-ics-refresh';
const EXPLODE_MS = 1300; // the overlay's explosion animation is 1000ms; leave room for it to finish
const ICS_FETCH_TIMEOUT_MS = 15_000;
const REINJECT_COOLDOWN_MS = 15_000;
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

  /** Last time we tried to inject the content script into a tab that should show Barry. */
  const reinjectedAt = new Map<TabId, number>();

  /**
   * A tab that should show Barry but has no listener (opened before install, content script lost):
   * inject once in a while. The injected script says hello, which pushes the view again.
   */
  async function reinjectIfNeeded(tabId: TabId) {
    const last = reinjectedAt.get(tabId) ?? 0;
    if (Date.now() - last < REINJECT_COOLDOWN_MS) return;
    reinjectedAt.set(tabId, Date.now());
    try {
      const tab = await browser.tabs.get(tabId);
      if (!isScriptableUrl(tab.url) || tab.discarded || tab.status !== 'complete') return;
      await browser.scripting.executeScript({
        target: { tabId, allFrames: true },
        files: [CONTENT_SCRIPT_FILE],
      });
    } catch {
      // Not injectable after all.
    }
  }

  async function pushViews(state: BarryState, tabIds: TabId[]) {
    const now = Date.now();
    const targets = tabIds.filter((id) => !closing.has(id));
    const views = targets.map((id) => ({ id, view: brain.viewFor(state, id, now) }));
    // The Arm needs each tab's place in its tab strip; only look it up while a Reach is on screen.
    if (views.some((v) => v.view.reach !== null)) {
      const tabs = await browser.tabs.query({}).catch(() => []);
      for (const v of views) if (v.view.reach) v.view.tabSlot = tabSlotFor(tabs, v.id);
    }
    await Promise.all(
      views.map(async ({ id, view }) => {
        const delivered = await browser.tabs.sendMessage(id, { type: 'view', view }).then(
          () => true,
          () => false,
        );
        if (!delivered && view.visible) void reinjectIfNeeded(id);
      }),
    );
  }

  /** While a Reach is on screen, tab moves, opens, closes and pin changes shift where the Arm aims. */
  function repushWhileReaching() {
    void queue.enqueue(async () => {
      const state = await loadState();
      if (state.reachStartedAt !== null)
        await pushViews(state, Object.keys(state.openTabs).map(Number));
    });
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
        await playSoundOffscreen(effect.sound);
        return;
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
    const before = await loadState();
    const result = brain.reduce(before, event);
    const { state } = result;
    // After sleep or a closed browser, episodes that ended meanwhile must not play out now.
    const effects = dropStaleEffects(event, before.lastNow, result.effects);
    await storage.setItem(STORAGE_KEYS.state, state);
    await pushViews(state, Object.keys(state.openTabs).map(Number));
    scheduleDeadline(state);
    applyIdleThreshold(state.tuning.idleAfterSec);
    // The explosion sound is runtime-originated, so the brain's muted filter does not cover it.
    const explosionDelay = explosionSoundDelay(effects, state.muted);
    if (explosionDelay !== null) {
      setTimeout(() => void playSoundOffscreen('explosion').catch(console.error), explosionDelay);
    }
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
        fetchText: (url) =>
          fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(ICS_FETCH_TIMEOUT_MS) }),
        now: Date.now(),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
      await storage.setItem(STORAGE_KEYS.schedule, status);
      if (shouldDispatchSchedule(settings?.icsUrl ?? null, status)) {
        void dispatch({ type: 'scheduleUpdated', now: Date.now(), blocks: status.blocks });
      }
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
        const settings = await loadSettings();
        if (settings.icsUrl !== url) {
          // A different calendar: the old calendar's blocks must not linger if the new fetch fails.
          await storage.setItem(STORAGE_KEYS.schedule, EMPTY_STATUS);
          await handle({ type: 'scheduleUpdated', now: Date.now(), blocks: [] });
        }
        await saveSettings({ ...settings, icsUrl: url });
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

  /**
   * The active tab of the last focused normal window. Popup and DevTools windows are skipped, and
   * focus in another app keeps the last Chrome window (it is still on screen).
   */
  async function focusedActiveTab(): Promise<{ tabId: TabId; windowId: number } | null> {
    try {
      const win = await browser.windows.getLastFocused({ populate: true, windowTypes: ['normal'] });
      const tab = win.tabs?.find((t) => t.active);
      return tab?.id !== undefined && win.id !== undefined
        ? { tabId: tab.id, windowId: win.id }
        : null;
    } catch {
      return null;
    }
  }
  const activeTabOfFocusedWindow = async () => (await focusedActiveTab())?.tabId ?? null;

  /**
   * Make the brain's tab list match the browser's: forget tabs that vanished while the worker was
   * not listening (browser restart, crash), learn unknown ones, then settle the active tab.
   */
  async function syncTabs() {
    const live = await browser.tabs.query({});
    const state = await queue.enqueue(loadState);
    if (!state) return;
    const plan = planTabSync(state.openTabs, live);
    for (const tabId of plan.close) await dispatch({ type: 'tabClosed', now: Date.now(), tabId });
    for (const { tabId, url } of plan.navigate) {
      await dispatch({ type: 'tabNavigated', now: Date.now(), tabId, url });
    }
    const active = await activeTabOfFocusedWindow();
    if (active !== null && active !== state.activeTabId) {
      await dispatch({ type: 'tabActivated', now: Date.now(), tabId: active });
    }
  }

  async function injectIntoOpenTabs() {
    for (const tab of await browser.tabs.query({ url: ['http://*/*', 'https://*/*'] })) {
      if (tab.id === undefined || tab.discarded) continue;
      await browser.scripting
        .executeScript({ target: { tabId: tab.id, allFrames: true }, files: [CONTENT_SCRIPT_FILE] })
        .catch(() => {}); // restricted pages (web store etc.)
    }
  }

  browser.tabs.onActivated.addListener(async ({ tabId, windowId }) => {
    // A tab switching in a window that is not the focused one is not what the user is looking at.
    const focused = await focusedActiveTab();
    if (focused && focused.windowId !== windowId) return;
    dispatch({ type: 'tabActivated', now: Date.now(), tabId });
  });
  browser.tabs.onUpdated.addListener((tabId, changeInfo) => {
    // SPAs (YouTube) change url via history.pushState: no reload, but onUpdated still reports it.
    if (changeInfo.url) {
      dispatch({ type: 'tabNavigated', now: Date.now(), tabId, url: changeInfo.url });
    }
    if (changeInfo.pinned !== undefined) repushWhileReaching();
  });
  browser.tabs.onRemoved.addListener((tabId) => {
    closing.delete(tabId);
    reinjectedAt.delete(tabId);
    dispatch({ type: 'tabClosed', now: Date.now(), tabId });
  });
  // Prerendered or instant-search tabs swap in under a new id.
  browser.tabs.onReplaced.addListener(async (addedTabId, removedTabId) => {
    closing.delete(removedTabId);
    await dispatch({ type: 'tabClosed', now: Date.now(), tabId: removedTabId });
    try {
      const tab = await browser.tabs.get(addedTabId);
      const url = tab.url || tab.pendingUrl;
      if (url) await dispatch({ type: 'tabNavigated', now: Date.now(), tabId: addedTabId, url });
      if (tab.active) await dispatch({ type: 'tabActivated', now: Date.now(), tabId: addedTabId });
    } catch {
      // gone again
    }
  });
  browser.tabs.onCreated.addListener(repushWhileReaching);
  browser.tabs.onMoved.addListener(repushWhileReaching);
  browser.tabs.onAttached.addListener(repushWhileReaching);
  browser.tabs.onDetached.addListener(repushWhileReaching);
  // Focus leaving Chrome (another app, or a DevTools window) keeps the last real tab active:
  // it's still on screen, and dev commands typed in the worker console need a tab to target.
  browser.windows.onFocusChanged.addListener(async (windowId) => {
    if (windowId === browser.windows.WINDOW_ID_NONE) return;
    const tabId = await activeTabOfFocusedWindow();
    if (tabId !== null) dispatch({ type: 'tabActivated', now: Date.now(), tabId });
  });

  browser.runtime.onInstalled.addListener(async () => {
    await syncTabs();
    await injectIntoOpenTabs();
  });
  browser.runtime.onStartup.addListener(() => {
    void syncTabs();
  });

  // ---- worker (re)start -----------------------------------------------------------------
  // The worker may have been killed mid-Reach. Everything lives in storage, so a tick with
  // the real `now` recomputes the phase, re-pushes views to all known open tabs (the overlay
  // derives arm progress from reachStartedAt) and re-arms the deadline timer.
  void dispatch({ type: 'tick', now: Date.now() });
  // Tab ids don't survive a browser restart, and events may have been missed: reconcile.
  void syncTabs().catch(() => console.error('[barry] tab sync failed'));
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
      // Learn the tab first if its navigation event hasn't been processed yet (or was missed).
      const url = sender.tab?.url;
      void queue.enqueue(async () => {
        const state = await loadState();
        if (url && state.openTabs[tabId] !== url) {
          await handle({ type: 'tabNavigated', now: Date.now(), tabId, url });
        } else {
          await pushViews(state, [tabId]);
        }
      });
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
  // Only create missing alarms: re-creating one on every worker start restarts its period, and
  // the worker starts every ~30s, so the slower ICS alarm would never get to fire.
  async function ensureAlarm(name: string, periodInMinutes: number) {
    if (!(await browser.alarms.get(name))) browser.alarms.create(name, { periodInMinutes });
  }
  void ensureAlarm(TICK_ALARM, TICK_ALARM_SECONDS / 60);
  void ensureAlarm(ICS_ALARM, ICS_REFRESH_MINUTES);
  browser.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === TICK_ALARM) dispatch({ type: 'tick', now: Date.now() });
    if (alarm.name === ICS_ALARM) void refreshScheduleNow();
  });
  // Worker start: refresh, unless the last fetch is fresh (then just tell the brain about it).
  void (async () => {
    const [settings, status] = await Promise.all([
      queue.enqueue(loadSettings),
      storage.getItem<ScheduleStatus>(STORAGE_KEYS.schedule),
    ]);
    if (
      settings?.icsUrl &&
      status &&
      isScheduleFresh(status, Date.now(), ICS_REFRESH_MINUTES * 60_000)
    ) {
      void dispatch({ type: 'scheduleUpdated', now: Date.now(), blocks: status.blocks });
    } else {
      await refreshScheduleNow();
    }
  })().catch(() => console.error('[barry] schedule start failed'));

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
