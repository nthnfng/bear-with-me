// Workstream A: Barry Brain. Pure: imports only from src/contracts, never reads a clock.
// Time arrives as `event.now`. See docs/adr/0001-pure-brain-dumb-renderers.md.

import {
  DEFAULT_BLOCKLIST,
  DEFAULT_TUNING,
  HIDDEN_VIEW,
  type BarryEffect,
  type BarryEvent,
  type BarryState,
  type Brain,
  type Millis,
  type ReduceResult,
  type TabId,
  type TabView,
} from '../contracts';
import { currentBlock, isRestricted, resolveMode } from './helpers';

export function initialState(): BarryState {
  return {
    modeOverride: 'auto',
    blocklist: DEFAULT_BLOCKLIST,
    blocks: [],
    todos: [],
    openTabs: {},
    activeTabId: null,
    userIdle: false,
    phase: 'clear',
    fatness: 0,
    slackPassEndsAt: null,
    snoozeEndsAt: null,
    warningEndsAt: null,
    reachStartedAt: null,
    pushes: 0,
    chudMeter: 0,
    studyingSince: null,
    lastGapSuggested: null,
    lastNow: null,
    position: 'right',
    cave: false,
    muted: false,
    tuning: DEFAULT_TUNING,
  };
}

/** The tab Barry is confronting right now: the active tab, if Restricted, in Lock In. */
function confrontedTab(state: BarryState, now: Millis): TabId | null {
  if (state.activeTabId === null) return null;
  if (resolveMode(state, now) !== 'lockIn') return null;
  return isRestricted(state.openTabs[state.activeTabId], state.blocklist)
    ? state.activeTabId
    : null;
}

function anyRestrictedOpen(state: BarryState): boolean {
  return Object.values(state.openTabs).some((url) => isRestricted(url, state.blocklist));
}

/** Applies the event's direct changes to state (no derived phase/fatness logic). */
function apply(
  state: BarryState,
  event: BarryEvent,
  effects: BarryEffect[],
): { state: BarryState; keepFatness?: boolean } {
  switch (event.type) {
    case 'tick':
    case 'todosUpdated':
      return { state: event.type === 'todosUpdated' ? { ...state, todos: event.todos } : state };
    case 'scheduleUpdated':
      return { state: { ...state, blocks: event.blocks } };
    case 'tabActivated':
      return { state: { ...state, activeTabId: event.tabId } };
    case 'tabNavigated':
      return { state: { ...state, openTabs: { ...state.openTabs, [event.tabId]: event.url } } };
    case 'tabClosed': {
      const { [event.tabId]: _gone, ...openTabs } = state.openTabs;
      return {
        state: {
          ...state,
          openTabs,
          activeTabId: state.activeTabId === event.tabId ? null : state.activeTabId,
        },
      };
    }
    case 'idleChanged':
      return { state: { ...state, userIdle: event.idle } };
    case 'eaten':
      if (state.phase === 'confronting' && event.tabId === state.activeTabId) {
        effects.push({ type: 'playSound', tabId: event.tabId, sound: 'chomp' });
        return {
          state: { ...state, fatness: state.fatness + state.tuning.fatPerEat },
          keepFatness: true,
        };
      }
      return { state };
    case 'backToIt':
      effects.push({ type: 'explodeAndClose', tabIds: [event.tabId] });
      return { state };
    case 'modeOverrideSet':
      return { state: { ...state, modeOverride: event.override } };
    case 'blocklistSet':
      return { state: { ...state, blocklist: event.blocklist } };
    case 'positionSet':
      return { state: { ...state, position: event.position } };
    case 'caveSet':
      return { state: { ...state, cave: event.cave } };
    case 'mutedSet':
      return { state: { ...state, muted: event.muted } };
    case 'dev':
      return applyDev(state, event);
    // TODO(Phase 2): Slack pass, Reach, Push, Snooze.
    case 'slackPassStarted':
    case 'pushed':
    case 'reachLanded':
      return { state };
  }
}

function applyDev(
  state: BarryState,
  event: Extract<BarryEvent, { type: 'dev' }>,
): { state: BarryState; keepFatness?: boolean } {
  const c = event.command;
  switch (c.kind) {
    case 'injectBlock':
      return {
        state: {
          ...state,
          blocks: [
            ...state.blocks,
            {
              id: `dev-${event.now}-${state.blocks.length}`,
              title: c.title,
              start: event.now,
              end: event.now + c.durationMs,
              allDay: false,
              source: 'dev',
            },
          ],
        },
      };
    case 'setTuning':
      return { state: { ...state, tuning: { ...state.tuning, ...c.tuning } } };
    case 'setFatness':
      return { state: { ...state, fatness: Math.max(0, c.fatness) }, keepFatness: true };
    case 'setChudMeter':
      return { state: { ...state, chudMeter: Math.min(1, Math.max(0, c.value)) } };
    case 'triggerFreeGap':
      // TODO(Phase 3): free-gap suggestion.
      return { state };
    case 'reset':
      // openTabs/activeTabId mirror real browser tabs, so they survive a reset.
      return {
        state: { ...initialState(), openTabs: state.openTabs, activeTabId: state.activeTabId },
      };
  }
}

function reduce(prev: BarryState, event: BarryEvent): ReduceResult {
  const effects: BarryEffect[] = [];
  const applied = apply(prev, event, effects);
  let state: BarryState = { ...applied.state, lastNow: event.now };

  // Derived: phase (only the Phase 1 phases are owned here) and Fatness lifetime.
  if (state.phase === 'clear' || state.phase === 'confronting') {
    const tab = confrontedTab(state, event.now);
    state = { ...state, phase: tab === null ? 'clear' : 'confronting' };
    const prevTab = prev.phase === 'confronting' ? prev.activeTabId : null;
    if (tab !== null && tab !== prevTab) {
      effects.push({ type: 'playSound', tabId: tab, sound: 'burst' });
    }
  }
  // Fatness resets only when no Restricted tab is open anywhere.
  if (!applied.keepFatness && state.fatness !== 0 && !anyRestrictedOpen(state)) {
    state = { ...state, fatness: 0 };
  }

  return { state, effects: state.muted ? effects.filter((e) => e.type !== 'playSound') : effects };
}

function viewFor(state: BarryState, tabId: TabId, now: Millis): TabView {
  const mode = resolveMode(state, now);

  if (confrontedTab(state, now) === tabId) {
    const block = currentBlock(state, now);
    return {
      ...HIDDEN_VIEW,
      visible: true,
      placement: 'face',
      position: state.position,
      pose: 'confrontation',
      scale: Math.min(1 + state.fatness * state.tuning.scalePerFat, state.tuning.maxScale),
      line: block ? `You planned ${block.title} ,':/` : "You said you'd lock in ,':/",
      showBackToIt: true,
      eatInput: true,
      pauseMedia: true,
    };
  }

  // Cave hides calm Barry; a Confrontation (above) is never hidden.
  if (state.cave) return { ...HIDDEN_VIEW, position: state.position };
  return {
    ...HIDDEN_VIEW,
    visible: true,
    position: state.position,
    pose: mode === 'lockIn' ? 'studious' : 'chill',
  };
}

/** Next moment a tick is needed: end of the current block, else start of the next one. */
function nextDeadline(state: BarryState): Millis | null {
  const now = state.lastNow;
  if (now === null || state.modeOverride !== 'auto') return null;
  const timed = state.blocks.filter((b) => !b.allDay);
  const current = currentBlock(state, now);
  if (current)
    return Math.min(...timed.filter((b) => b.start <= now && now < b.end).map((b) => b.end));
  const upcoming = timed.filter((b) => b.start > now).map((b) => b.start);
  return upcoming.length ? Math.min(...upcoming) : null;
}

export const brain: Brain = { initialState, reduce, viewFor, nextDeadline };
