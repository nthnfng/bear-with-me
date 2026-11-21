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
  type PoseId,
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
    okayStartedAt: null,
    snoozeEndsAt: null,
    snoozeStartedAt: null,
    gotUpAt: null,
    warningEndsAt: null,
    slackPassStartedAt: null,
    confrontSince: null,
    fightStartedAt: null,
    reachStartedAt: null,
    pushes: 0,
    chudMeter: 0,
    studyingSince: null,
    lastGapSuggested: null,
    scheduleKnown: false,
    lastNow: null,
    arrivedTabs: [],
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
      // The feed replaces the ICS blocks only: an injected dev block must survive the
      // 5-minute refresh (and the refresh every worker wake does).
      return {
        state: {
          ...state,
          blocks: [...state.blocks.filter((b) => b.source === 'dev'), ...event.blocks],
          scheduleKnown: true,
        },
      };
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
      // Only the tab Barry is confronting. A stale click (the tab navigated away, a break
      // started, Chill) must never close a work tab.
      if (state.phase !== 'confronting' || confrontedTab(state, event.now) !== event.tabId) {
        return { state };
      }
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
      return applyDev(state, event, effects);
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
          slackPassStartedAt: event.now,
          okayStartedAt: wasConfronting ? event.now : null,
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
            fightStartedAt: null,
            snoozeStartedAt: event.now,
            gotUpAt: null,
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
    case 'gotUp': {
      // Only tired Barry can be told to get up. Past the Snooze's end it has already ended.
      if (
        state.phase !== 'snoozing' ||
        state.gotUpAt !== null ||
        state.snoozeEndsAt === null ||
        event.now >= state.snoozeEndsAt ||
        snoozeStage(state, event.now) !== 'tired'
      ) {
        return { state };
      }
      return {
        state: {
          ...state,
          gotUpAt: event.now,
          snoozeEndsAt: Math.min(state.snoozeEndsAt, event.now + GOT_UP_HAPPY_MS),
        },
      };
    }
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
    okayStartedAt: null,
    warningEndsAt: null,
    slackPassStartedAt: null,
    fightStartedAt: null,
    reachStartedAt: null,
    snoozeEndsAt: null,
    snoozeStartedAt: null,
    gotUpAt: null,
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
        okayStartedAt: null,
      };
    } else if (state.phase === 'warning' && state.warningEndsAt !== null) {
      if (now < state.warningEndsAt) break;
      // Nothing left to close: no Reach.
      if (restrictedTabIds(state).length === 0) return toClear(state);
      state = {
        ...state,
        phase: 'reaching',
        reachStartedAt: state.warningEndsAt,
        fightStartedAt: state.warningEndsAt,
        warningEndsAt: null,
        slackPassStartedAt: null,
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
        fightStartedAt: state.snoozeEndsAt,
        snoozeEndsAt: null,
        snoozeStartedAt: null,
        gotUpAt: null,
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
  effects: BarryEffect[],
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
      // Also forgets arrivals, so the chud song can be tested again.
      return {
        state: { ...state, chudMeter: Math.min(1, Math.max(0, c.value)), arrivedTabs: [] },
      };
    case 'triggerFreeGap': {
      // Forces a suggestion now, ignoring mode, gap length and `lastGapSuggested`.
      const next = nextBlockStart(state, event.now);
      const freeMs = next === null ? null : next - event.now;
      pushSuggestion(state, freeMs, effects);
      return { state };
    }
    case 'reset':
      // Everything the runtime feeds the brain survives (it would not be re-sent): real tabs,
      // idle, the ICS schedule (dev blocks go) and the captured todos. Settings (blocklist,
      // position, cave, muted, tuning) return to their defaults.
      return {
        state: {
          ...initialState(),
          openTabs: state.openTabs,
          activeTabId: state.activeTabId,
          userIdle: state.userIdle,
          blocks: state.blocks.filter((b) => b.source !== 'dev'),
          scheduleKnown: state.scheduleKnown,
          todos: state.todos,
        },
      };
  }
}

/** The Snooze's stages, timed from `snoozeStartedAt`. A Snooze shorter than them just ends early. */
export const SNOOZE_KNOCKED_MS = 5000; // got-owned, spinning
export const SNOOZE_GET_UP_MS = 600; // get-up (the overlay adds the in-between frames)
export const SNOOZE_STANDING_MS = 2000; // default
export const SNOOZE_OW_MS = 1000; // suspicious + "ow"
export const SNOOZE_GRIEVED_MS = 2200; // grieved + "my arm hurts..."; then tired until the end
/** How long Barry jumps happily after Get up before the Snooze ends. */
export const GOT_UP_HAPPY_MS = 1000;

type SnoozeStage = 'knocked' | 'getUp' | 'standing' | 'ow' | 'grieved' | 'tired' | 'happy';
const SNOOZE_STAGES: { stage: SnoozeStage; ms: number }[] = [
  { stage: 'knocked', ms: SNOOZE_KNOCKED_MS },
  { stage: 'getUp', ms: SNOOZE_GET_UP_MS },
  { stage: 'standing', ms: SNOOZE_STANDING_MS },
  { stage: 'ow', ms: SNOOZE_OW_MS },
  { stage: 'grieved', ms: SNOOZE_GRIEVED_MS },
];

/** Start of each timed stage after the first, as offsets from the Snooze start. */
function stageStarts(): { stage: SnoozeStage; at: number }[] {
  const out: { stage: SnoozeStage; at: number }[] = [];
  let at = 0;
  for (const s of SNOOZE_STAGES) {
    out.push({ stage: s.stage, at });
    at += s.ms;
  }
  out.push({ stage: 'tired', at });
  return out;
}

/** The Snooze stage at `now` and when it began, or null outside a Snooze. */
function snoozeStageAt(
  state: BarryState,
  now: Millis,
): { stage: SnoozeStage; since: Millis } | null {
  if (state.phase !== 'snoozing' || state.snoozeStartedAt === null) return null;
  if (state.gotUpAt !== null && now >= state.gotUpAt)
    return { stage: 'happy', since: state.gotUpAt };
  const elapsed = now - state.snoozeStartedAt;
  let cur = stageStarts()[0]!;
  for (const st of stageStarts()) if (elapsed >= st.at) cur = st;
  return { stage: cur.stage, since: state.snoozeStartedAt + cur.at };
}
function snoozeStage(state: BarryState, now: Millis): SnoozeStage | null {
  return snoozeStageAt(state, now)?.stage ?? null;
}

/** Chud fill is clamped to 0..1 and snapped to 1 against float dust. */
function clampChud(v: number): number {
  return v >= 1 - 1e-9 ? 1 : Math.max(0, v);
}

/**
 * The Chud meter at `now`: stored value plus Snooze time since `lastNow` (capped at the
 * Snooze's end). Timestamps only, so it fills smoothly even between events.
 */
function liveChud(state: BarryState, now: Millis): number {
  if (
    state.phase !== 'snoozing' ||
    state.snoozeEndsAt === null ||
    state.lastNow === null ||
    state.gotUpAt !== null // Barry got up: no more Snooze time is used
  ) {
    return state.chudMeter;
  }
  const ms = Math.max(0, Math.min(now, state.snoozeEndsAt) - state.lastNow);
  if (ms === 0) return state.chudMeter;
  const full = state.tuning.chudFullMs;
  return full <= 0 ? 1 : clampChud(state.chudMeter + ms / full);
}

/**
 * Studying: Lock In, no Slack pass or Snooze, no Restricted tab active, user not idle.
 * (A warning or Arm fight on a non-Restricted active tab still counts: the user is working.)
 */
function isStudying(state: BarryState, now: Millis): boolean {
  if (resolveMode(state, now) !== 'lockIn') return false;
  if (state.userIdle) return false;
  if (state.phase === 'slackPass' || state.phase === 'snoozing') return false;
  const active = state.activeTabId === null ? undefined : state.openTabs[state.activeTabId];
  return !isRestricted(active, state.blocklist);
}

/** Start of the next timed Calendar block after `now` (any day), or null. */
function nextBlockStart(state: BarryState, now: Millis): Millis | null {
  const starts = state.blocks.filter((b) => !b.allDay && b.start > now).map((b) => b.start);
  return starts.length ? Math.min(...starts) : null;
}

/** Suggestion for the top todo on the active tab (the tab the user is looking at). */
function pushSuggestion(state: BarryState, freeMs: Millis | null, effects: BarryEffect[]): boolean {
  const todo = state.todos[0];
  if (!todo || state.activeTabId === null) return false;
  effects.push({
    type: 'showSuggestion',
    tabId: state.activeTabId,
    todo,
    freeMinutes: freeMs === null ? null : Math.floor(freeMs / 60_000),
  });
  return true;
}

/**
 * Free-time suggestion: Chill, no block running, and the next timed block (any day) is at
 * least freeGapMinMs away, or there is none (an open-ended gap, `freeMinutes: null`). Once per gap (`lastGapSuggested` = the gap's start: the end of the block
 * before it, or the moment of the suggestion when there is none). Not marked as suggested
 * while there is no todo, no active tab, or the cave is on, so it fires once those clear.
 * With no next block the gap runs from the last block's end, or from the first suggestion.
 */
function maybeSuggest(state: BarryState, now: Millis, effects: BarryEffect[]): BarryState {
  if (resolveMode(state, now) !== 'chill' || currentBlock(state, now) !== null || state.cave) {
    return state;
  }
  // Fresh install: todos can load before the calendar. Without the schedule "free right now"
  // would be a guess, so wait for the first scheduleUpdated.
  if (!state.scheduleKnown) return state;
  const next = nextBlockStart(state, now);
  if (next !== null && next - now < state.tuning.freeGapMinMs) return state;
  const ends = state.blocks.filter((b) => !b.allDay && b.end <= now).map((b) => b.end);
  const gapStart = ends.length ? Math.max(...ends) : null;
  const last = state.lastGapSuggested;
  if (last !== null && (gapStart === null || last >= gapStart) && (next === null || last < next)) {
    return state;
  }
  if (!pushSuggestion(state, next === null ? null : next - now, effects)) return state;
  return { ...state, lastGapSuggested: gapStart ?? now };
}

/**
 * Arrival: the first time Barry is on a Restricted tab this episode (Confrontation or Arm
 * fight) he bursts (Confrontation only) and, with a full Chud meter, starts the chud song.
 * Coming back to a tab in `arrivedTabs` plays nothing. The list is forgotten when a Slack
 * pass or Snooze is running, when Lock In is not on, and for tabs that are closed or no
 * longer Restricted (so it is empty once no Restricted tab is open).
 */
function arrive(state: BarryState, now: Millis, effects: BarryEffect[]): BarryState {
  const forget =
    resolveMode(state, now) !== 'lockIn' ||
    state.phase === 'slackPass' ||
    state.phase === 'snoozing';
  const kept = forget
    ? []
    : state.arrivedTabs.filter((id) => isRestricted(state.openTabs[id], state.blocklist));
  let arrived = kept;
  const id = state.activeTabId;
  if (
    (state.phase === 'confronting' || state.phase === 'reaching') &&
    id !== null &&
    isRestricted(state.openTabs[id], state.blocklist) &&
    !kept.includes(id)
  ) {
    arrived = [...kept, id];
    if (state.phase === 'confronting')
      effects.push({ type: 'playSound', tabId: id, sound: 'burst' });
    if (liveChud(state, now) >= 1)
      effects.push({ type: 'playSound', tabId: id, sound: 'chudSong' });
  }
  return arrived.length === state.arrivedTabs.length &&
    arrived.every((t, i) => t === state.arrivedTabs[i])
    ? state
    : { ...state, arrivedTabs: arrived };
}

function reduce(prev: BarryState, event: BarryEvent): ReduceResult {
  const effects: BarryEffect[] = [];
  // Snooze time since the last event fills the Chud meter (uses the pre-event phase).
  const chudNow = liveChud(prev, event.now);
  const applied = apply(
    chudNow === prev.chudMeter ? prev : { ...prev, chudMeter: chudNow },
    event,
    effects,
  );
  // lastNow never moves back: a clock step backwards must not make time-based growth
  // (the Chud meter) count the same stretch twice.
  let state: BarryState = {
    ...applied.state,
    lastNow: Math.max(event.now, prev.lastNow ?? event.now),
  };

  // Derived: break/fight phases first, then Confrontation, then Fatness lifetime.
  state = advance(state, event.now, effects);
  if (state.phase === 'clear' || state.phase === 'confronting') {
    const tab = confrontedTab(state, event.now);
    state = { ...state, phase: tab === null ? 'clear' : 'confronting' };
  }
  // The Confrontation pose run restarts when the pose (tier or chud-point) changes or begins.
  const prevPose = prev.phase === 'confronting' ? tierPose(prev.fatness, prev.chudMeter) : null;
  const newPose = state.phase === 'confronting' ? tierPose(state.fatness, state.chudMeter) : null;
  if (newPose === null) {
    if (state.confrontSince !== null) state = { ...state, confrontSince: null };
  } else if (newPose !== prevPose || state.confrontSince === null) {
    state = { ...state, confrontSince: event.now };
  }
  // Fatness resets only when no Restricted tab is open anywhere.
  if (!applied.keepFatness && state.fatness !== 0 && !anyRestrictedOpen(state)) {
    state = { ...state, fatness: 0 };
  }

  // Lock back in: an unbroken Studying stretch of lockBackInMs resets the Chud meter. The
  // stretch ended at `now`, or (going idle) idleAfterSec earlier, since the idle event is late.
  if (prev.studyingSince !== null && state.chudMeter > 0) {
    const stretchEnd =
      event.type === 'idleChanged' && event.idle
        ? event.now - state.tuning.idleAfterSec * 1000
        : event.now;
    if (stretchEnd >= prev.studyingSince + state.tuning.lockBackInMs) {
      state = { ...state, chudMeter: 0 };
    }
  }
  state = arrive(state, event.now, effects);

  const studying = isStudying(state, event.now);
  state = { ...state, studyingSince: studying ? (prev.studyingSince ?? event.now) : null };

  state = maybeSuggest(state, event.now, effects);

  return { state, effects: state.muted ? effects.filter((e) => e.type !== 'playSound') : effects };
}

/** Confrontation pose: full Chud meter is chud-point, else the Fatness tier. */
function tierPose(fatness: number, chud: number): PoseId {
  if (chud >= 1) return 'chud-point';
  const tier = Math.floor(fatness);
  if (tier <= 0) return 'suspicious';
  return tier >= 5 ? 'chud' : (`fat-${tier}` as PoseId);
}

function viewFor(state: BarryState, tabId: TabId, now: Millis): TabView {
  const mode = resolveMode(state, now);

  const inBreak = state.phase !== 'clear' && state.phase !== 'confronting';
  if (!inBreak && confrontedTab(state, now) === tabId) {
    const block = currentBlock(state, now);
    const chud = liveChud(state, now);
    const full = chud >= 1;
    return {
      ...HIDDEN_VIEW,
      visible: true,
      placement: 'face',
      position: state.position,
      pose: tierPose(state.fatness, chud),
      poseSince: state.confrontSince ?? 0,
      line: full
        ? chudLine
        : block
          ? `You planned ${block.title} ,':/`
          : "You said you'd lock in ,':/",
      showBackToIt: true,
      eatInput: true,
      pauseMedia: true,
      chudMeter: chud > 0 ? chud : null,
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
    pose: mode === 'lockIn' ? 'studious' : 'chill-mug',
  };
}

/** How long the "Okay... -_-" pose lingers on the tab a Slack pass interrupted. */
export const OKAY_MS = 4000;

const chudLine = "♪ I'm a chud ♪";
const warningLine = 'Wrap it up!';
const reachLine = 'Closing restricted tabs 💣';

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
    return state.cave ? { ...HIDDEN_VIEW, position: state.position } : base;
  }
  const chud = liveChud(state, now);
  const full = chud >= 1;
  const shared = { ...base, chudMeter: chud };
  switch (state.phase) {
    case 'slackPass': {
      if (state.cave) return { ...HIDDEN_VIEW, position: state.position };
      const okay =
        state.okayStartedAt != null &&
        tabId === state.activeTabId &&
        now < state.okayStartedAt + OKAY_MS;
      return {
        ...shared,
        pose: 'chill',
        poseSince: state.slackPassStartedAt ?? 0,
        breakEndsAt: state.slackPassEndsAt,
        ...(okay
          ? {
              pose: 'suspicious' as const,
              poseSince: state.okayStartedAt ?? 0,
              line: 'Okay... -_-',
            }
          : {}),
      };
    }
    case 'warning':
      return {
        ...shared,
        pose: 'suspicious-tap',
        poseSince: state.warningEndsAt === null ? 0 : state.warningEndsAt - state.tuning.warningMs,
        line: warningLine,
        breakEndsAt: state.warningEndsAt,
      };
    case 'reaching':
      return {
        ...shared,
        pose: full ? 'chud' : 'close-tab',
        poseSince: state.fightStartedAt ?? state.reachStartedAt ?? 0,
        line: reachLine,
        reach:
          state.reachStartedAt === null
            ? null
            : { startedAt: state.reachStartedAt, durationMs: state.tuning.reachMs },
        pushesLeft: Math.max(0, state.tuning.maxPushes - state.pushes),
      };
    case 'snoozing': {
      const at = snoozeStageAt(state, now);
      const stage = at?.stage ?? 'knocked';
      const pose: PoseId = {
        knocked: 'got-owned',
        getUp: 'get-up',
        standing: 'default',
        ow: 'suspicious',
        grieved: 'grieved',
        tired: 'tired',
        happy: 'happy',
      }[stage] as PoseId;
      const line =
        stage === 'ow'
          ? 'ow'
          : stage === 'grieved'
            ? 'my arm hurts i guess ill leave u alone'
            : null;
      return {
        ...shared,
        pose,
        poseSince: at?.since ?? state.snoozeStartedAt ?? 0,
        line,
        canGetUp: stage === 'tired',
        breakEndsAt: state.snoozeEndsAt,
      };
    }
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
    okayDeadline(state),
    snoozeStageDeadline(state),
    blockDeadline(state),
    lockBackInDeadline(state),
    chudFullDeadline(state),
  ].filter((d): d is Millis => d !== null);
  return all.length ? Math.min(...all) : null;
}

/** When the "Okay... -_-" pose gives way to chill Barry. */
function okayDeadline(state: BarryState): Millis | null {
  if (state.phase !== 'slackPass' || state.okayStartedAt === null || state.lastNow === null)
    return null;
  const at = state.okayStartedAt + OKAY_MS;
  return at > state.lastNow ? at : null;
}

/** Next Snooze stage boundary after the last event and before the Snooze ends (views re-push then). */
function snoozeStageDeadline(state: BarryState): Millis | null {
  if (
    state.phase !== 'snoozing' ||
    state.snoozeStartedAt === null ||
    state.snoozeEndsAt === null ||
    state.lastNow === null ||
    state.gotUpAt !== null
  ) {
    return null;
  }
  const last = state.lastNow;
  const end = state.snoozeEndsAt;
  const next = stageStarts()
    .map((st) => state.snoozeStartedAt! + st.at)
    .filter((t) => t > last && t < end);
  return next.length ? Math.min(...next) : null;
}

/** When the current Studying stretch reaches lockBackInMs (only matters while the meter is up). */
function lockBackInDeadline(state: BarryState): Millis | null {
  if (state.studyingSince === null || state.chudMeter <= 0) return null;
  return state.studyingSince + state.tuning.lockBackInMs;
}

/** When the Chud meter hits 1 during a Snooze (the view flips to chud Barry then). */
function chudFullDeadline(state: BarryState): Millis | null {
  if (
    state.phase !== 'snoozing' ||
    state.lastNow === null ||
    state.chudMeter >= 1 ||
    state.gotUpAt !== null
  )
    return null;
  const at = state.lastNow + Math.ceil((1 - state.chudMeter) * state.tuning.chudFullMs);
  return state.snoozeEndsAt !== null && at > state.snoozeEndsAt ? null : at;
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

/**
 * Whether the cave can hide Barry right now. False in Lock In while he is confronting,
 * warning, Reaching or Snoozed (a Restricted tab is in play); the popup greys the toggle.
 */
export function caveAllowed(state: BarryState, now: Millis): boolean {
  if (resolveMode(state, now) !== 'lockIn') return true;
  return state.phase === 'clear' || state.phase === 'slackPass';
}

export const brain: Brain = { initialState, reduce, viewFor, nextDeadline };
