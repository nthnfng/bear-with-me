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
    case 'slackPassStarted': {
      // Lock In only, and not while a break or fight is already running.
      if (
        (state.phase !== 'clear' && state.phase !== 'confronting') ||
        resolveMode(state, event.now) !== 'lockIn'
      ) {
        return { state };
      }
      const wasConfronting = confrontedTab(state, event.now) !== null;
      return {
        state: {
          ...state,
          phase: 'slackPass',
          slackPassEndsAt: event.now + event.durationMs,
          // The "Okay... -_-" marker (see OKAY_MS): only set if it began mid-Confrontation.
          reachStartedAt: wasConfronting ? event.now : null,
          fatness: 0,
        },
        keepFatness: true,
      };
    }
    case 'pushed': {
      if (state.phase !== 'reaching' || state.reachStartedAt === null) return { state };
      // A Push after the Reach already ran out is too late; the deadline lands it.
      if (event.now >= state.reachStartedAt + state.tuning.reachMs) return { state };
      const pushes = state.pushes + 1;
      if (pushes >= state.tuning.maxPushes) {
        // The winning Push plays only 'ow' (the beaten cry replaces the punch).
        effects.push({ type: 'playSound', tabId: event.tabId, sound: 'ow' });
        return {
          state: {
            ...state,
            phase: 'snoozing',
            pushes: 0,
            reachStartedAt: null,
            snoozeEndsAt: event.now + state.tuning.snoozeMs,
          },
        };
      }
      effects.push({ type: 'playSound', tabId: event.tabId, sound: 'punch' });
      return { state: { ...state, pushes, reachStartedAt: event.now } };
    }
    case 'reachLanded':
      if (state.phase === 'reaching' && event.reachStartedAt === state.reachStartedAt) {
        return { state: land(state, effects) };
      }
      return { state };
  }
}

function restrictedTabIds(state: BarryState): TabId[] {
  return Object.entries(state.openTabs)
    .filter(([, url]) => isRestricted(url, state.blocklist))
    .map(([id]) => Number(id))
    .sort((a, b) => a - b);
}

/** Back to 'clear' with every break/fight field dropped. The Chud meter is left alone. */
function toClear(state: BarryState): BarryState {
  return {
    ...state,
    phase: 'clear',
    slackPassEndsAt: null,
    warningEndsAt: null,
    reachStartedAt: null,
    snoozeEndsAt: null,
    pushes: 0,
  };
}

/** The Reach lands: explode every Restricted tab, forget them, reset Fatness and Pushes. */
function land(state: BarryState, effects: BarryEffect[]): BarryState {
  const ids = restrictedTabIds(state);
  if (ids.length > 0) effects.push({ type: 'explodeAndClose', tabIds: ids });
  const openTabs = { ...state.openTabs };
  for (const id of ids) delete openTabs[id];
  return {
    ...toClear(state),
    openTabs,
    activeTabId:
      state.activeTabId !== null && ids.includes(state.activeTabId) ? null : state.activeTabId,
    fatness: 0,
  };
}

/**
 * Moves the break/fight phases forward to `now`, following deadlines (not `now`) so a late
 * tick that jumps several of them lands in the right place with the right start times.
 */
function advance(start: BarryState, now: Millis, effects: BarryEffect[]): BarryState {
  let state = start;
  if (state.phase === 'clear' || state.phase === 'confronting') return state;

  // Lock In ending drops any break or fight. The Chud meter stays (Phase 3 owns it).
  if (resolveMode(state, now) !== 'lockIn') return toClear(state);

  for (let guard = 0; guard < 10; guard++) {
    const t = state.tuning;
    if (state.phase === 'slackPass' && state.slackPassEndsAt !== null) {
      if (now < state.slackPassEndsAt) break;
      state = {
        ...state,
        phase: 'warning',
        warningEndsAt: state.slackPassEndsAt + t.warningMs,
        slackPassEndsAt: null,
        reachStartedAt: null,
      };
    } else if (state.phase === 'warning' && state.warningEndsAt !== null) {
      if (now < state.warningEndsAt) break;
      // Nothing left to close: no Reach.
      if (restrictedTabIds(state).length === 0) return toClear(state);
      state = {
        ...state,
        phase: 'reaching',
        reachStartedAt: state.warningEndsAt,
        warningEndsAt: null,
      };
    } else if (state.phase === 'reaching' && state.reachStartedAt !== null) {
      // The user closed every Restricted tab themselves: the fight is over.
      if (restrictedTabIds(state).length === 0) return { ...toClear(state), fatness: 0 };
      if (now < state.reachStartedAt + t.reachMs) break;
      return land(state, effects); // timed out without the overlay reporting
    } else if (state.phase === 'snoozing' && state.snoozeEndsAt !== null) {
      if (now < state.snoozeEndsAt) break;
      if (restrictedTabIds(state).length === 0) return toClear(state);
      // The Reach comes straight back, no warning.
      state = {
        ...state,
        phase: 'reaching',
        reachStartedAt: state.snoozeEndsAt,
        snoozeEndsAt: null,
      };
    } else {
      break;
    }
  }
  return state;
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

  // Derived: break/fight phases first, then Confrontation, then Fatness lifetime.
  state = advance(state, event.now, effects);
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

  const inBreak = state.phase !== 'clear' && state.phase !== 'confronting';
  if (!inBreak && confrontedTab(state, now) === tabId) {
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

  const breakView = viewForBreak(state, tabId, now);
  if (breakView) return breakView;

  // Cave hides calm Barry; a Confrontation (above) is never hidden.
  if (state.cave) return { ...HIDDEN_VIEW, position: state.position };
  return {
    ...HIDDEN_VIEW,
    visible: true,
    position: state.position,
    pose: mode === 'lockIn' ? 'studious' : 'chill',
  };
}

/** How long the "Okay... -_-" pose lingers on the tab a Slack pass interrupted. */
export const OKAY_MS = 4000;

const warningLine = 'Wrapping up?';
const reachLine = 'Closing restricted tabs 💣';

function snoozeLine(ms: number): string {
  const secs = Math.round(ms / 1000);
  const span =
    secs >= 60
      ? `${Math.round(secs / 60)} minute${Math.round(secs / 60) === 1 ? '' : 's'}`
      : `${secs} seconds`;
  return `Ow... T-T my hand hurts so I'll leave you alone for ${span}...`;
}

/** Views during a Slack pass, warning, Arm fight or Snooze. Null = not in a break. */
function viewForBreak(state: BarryState, tabId: TabId, now: Millis): TabView | null {
  if (state.phase === 'clear' || state.phase === 'confronting') return null;
  const base: TabView = {
    ...HIDDEN_VIEW,
    visible: true,
    position: state.position,
    pose: 'studious',
  };
  // Other tabs just see calm studious Barry (no arm, no countdown).
  if (!isRestricted(state.openTabs[tabId], state.blocklist)) {
    return state.cave && state.phase === 'slackPass'
      ? { ...HIDDEN_VIEW, position: state.position }
      : base;
  }
  const shared = { ...base, chudMeter: state.chudMeter };
  switch (state.phase) {
    case 'slackPass': {
      if (state.cave) return { ...HIDDEN_VIEW, position: state.position };
      const okay =
        state.reachStartedAt !== null &&
        tabId === state.activeTabId &&
        now < state.reachStartedAt + OKAY_MS;
      return {
        ...shared,
        breakEndsAt: state.slackPassEndsAt,
        ...(okay ? { pose: 'okay' as const, line: 'Okay... -_-' } : {}),
      };
    }
    case 'warning':
      return { ...shared, line: warningLine, breakEndsAt: state.warningEndsAt };
    case 'reaching':
      return {
        ...shared,
        line: reachLine,
        reach:
          state.reachStartedAt === null
            ? null
            : { startedAt: state.reachStartedAt, durationMs: state.tuning.reachMs },
        pushesLeft: state.tuning.maxPushes - state.pushes,
      };
    case 'snoozing':
      return {
        ...shared,
        pose: 'beaten',
        line: snoozeLine(state.tuning.snoozeMs),
        breakEndsAt: state.snoozeEndsAt,
      };
  }
}

/** Earliest moment a tick is needed: a break/fight deadline or a block boundary. */
function nextDeadline(state: BarryState): Millis | null {
  const reachEnd =
    state.phase === 'reaching' && state.reachStartedAt !== null
      ? state.reachStartedAt + state.tuning.reachMs
      : null;
  const all = [
    state.slackPassEndsAt,
    state.warningEndsAt,
    reachEnd,
    state.snoozeEndsAt,
    blockDeadline(state),
  ].filter((d): d is Millis => d !== null);
  return all.length ? Math.min(...all) : null;
}

/** Next moment a tick is needed: end of the current block, else start of the next one. */
function blockDeadline(state: BarryState): Millis | null {
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
