// The brain's contract: state, events in, effects out, and the per-tab view.
// See docs/adr/0001-pure-brain-dumb-renderers.md. Pure: no browser imports.

import type { PoseId, SoundId } from './assets';
import type {
  BlocklistEntry,
  CalendarBlock,
  EatKind,
  Millis,
  ModeOverride,
  Position,
  TabId,
  Todo,
  Tuning,
} from './domain';

/**
 * What Barry is doing in Lock In. Always 'clear' in Chill.
 *
 *   clear ──open Restricted tab──▶ confronting ──last Restricted tab closed──▶ clear
 *     │                                │
 *     └────────── Slack pass started ──┴──▶ slackPass ──ends──▶ warning ──▶ reaching (Arm fight)
 *                                                                              │  ▲
 *                              Reach lands: close all Restricted tabs ◀────────┘  │ Snooze ends
 *                              5th Push ──▶ snoozing ─────────────────────────────┘
 *
 * Lock In ending (block over, or override to Chill) returns to 'clear' and
 * drops any Slack pass or Snooze. The Chud meter is NOT reset by that.
 */
export type Phase =
  | 'clear' // no Restricted tab active and no break: studious Barry in the corner
  | 'confronting' // Restricted tab active: Barry in your face, eating input
  | 'slackPass' // user-started break: Barry in the corner on Restricted tabs
  | 'warning' // Slack pass over: heads-up before the Reach
  | 'reaching' // Arm fight: arm stretching toward the Restricted tabs
  | 'snoozing'; // 5th Push landed: beaten Barry, Chud meter filling

export interface BarryState {
  modeOverride: ModeOverride;
  blocklist: BlocklistEntry[];
  blocks: CalendarBlock[];
  todos: Todo[];
  /** Every open tab's current URL, so the brain can find all Restricted tabs. */
  openTabs: Record<TabId, string>;
  activeTabId: TabId | null;
  /** From chrome.idle: away, screen locked, or asleep. Pauses Studying. */
  userIdle: boolean;

  phase: Phase;
  fatness: number;
  /** End of the running Slack pass ('slackPass' phase). */
  slackPassEndsAt: Millis | null;
  /** When a Slack pass started mid-Confrontation: Barry says "Okay... -_-" for a moment. */
  okayStartedAt: Millis | null;
  /** End of the running Snooze ('snoozing' phase). */
  snoozeEndsAt: Millis | null;
  /** Start of the running Snooze. Its stages (knocked down, getting up, "ow", ..., tired) are timed from it. */
  snoozeStartedAt: Millis | null;
  /** When the user clicked tired Barry (Get up). The Snooze then ends after a short happy jump. */
  gotUpAt: Millis | null;
  warningEndsAt: Millis | null;
  /** Start of the running Slack pass ('slackPass' phase). Chill Barry's pose run starts here. */
  slackPassStartedAt: Millis | null;
  /** When the current Confrontation pose (Fatness tier or chud-point) began; shared start for its poseSince. */
  confrontSince: Millis | null;
  /** Start of the current Arm fight run (not reset by a Push), so the Reach pose isn't restarted by each Push. */
  fightStartedAt: Millis | null;
  /** One shared start time so the Reach is in sync on every tab. */
  reachStartedAt: Millis | null;
  /** Pushes in the current Arm fight. Resets when a Snooze is won. */
  pushes: number;

  /** 0..1. Long-lived: fills during Snoozes, returns to 0 on Lock back in. */
  chudMeter: number;
  /** Start of the current unbroken Studying stretch, or null if not Studying. */
  studyingSince: Millis | null;

  /** Start of the last free gap a todo was suggested for (once per gap). */
  lastGapSuggested: Millis | null;
  /** True once any scheduleUpdated has arrived (even an empty one). Free-gap suggestions wait for it. */
  scheduleKnown: boolean;
  /** `now` of the last processed event; time-based growth integrates from here. */
  lastNow: Millis | null;
  /**
   * Restricted tabs Barry has already arrived on this episode (burst, and the chud song when the
   * Chud meter is full). Coming back to one plays nothing. Clears when a break starts, Lock In
   * ends, or no Restricted tab is open anywhere.
   */
  arrivedTabs: TabId[];

  position: Position;
  cave: boolean;
  muted: boolean;
  tuning: Tuning;
}

type Ev<T extends string, P = {}> = { type: T; now: Millis } & P;

export type DevCommand =
  | { kind: 'injectBlock'; title: string; durationMs: number }
  | { kind: 'setTuning'; tuning: Partial<Tuning> }
  | { kind: 'setFatness'; fatness: number }
  | { kind: 'setChudMeter'; value: number }
  | { kind: 'triggerFreeGap' }
  | { kind: 'reset' };

export type BarryEvent =
  | Ev<'tick'>
  | Ev<'scheduleUpdated', { blocks: CalendarBlock[] }>
  | Ev<'todosUpdated', { todos: Todo[] }>
  | Ev<'tabActivated', { tabId: TabId | null }>
  | Ev<'tabNavigated', { tabId: TabId; url: string }>
  | Ev<'tabClosed', { tabId: TabId }>
  | Ev<'idleChanged', { idle: boolean }>
  | Ev<'eaten', { tabId: TabId; kind: EatKind }>
  | Ev<'backToIt', { tabId: TabId }>
  /** Ignored unless in Lock In (the popup disables the button in Chill). */
  | Ev<'slackPassStarted', { durationMs: number }>
  | Ev<'pushed', { tabId: TabId }>
  /** Sent by the overlay; ignored if `reachStartedAt` is stale (a Push restarted it). */
  | Ev<'reachLanded', { tabId: TabId; reachStartedAt: Millis }>
  /** Get up: the user clicked tired Barry (or the popup button). Ignored unless `canGetUp`. */
  | Ev<'gotUp'>
  | Ev<'modeOverrideSet', { override: ModeOverride }>
  | Ev<'blocklistSet', { blocklist: BlocklistEntry[] }>
  | Ev<'positionSet', { position: Position }>
  | Ev<'caveSet', { cave: boolean }>
  | Ev<'mutedSet', { muted: boolean }>
  | Ev<'dev', { command: DevCommand }>;

/** One-shot side effects. Anything persistent on screen belongs in TabView instead. */
export type BarryEffect =
  | { type: 'playSound'; tabId: TabId; sound: SoundId }
  /** Explosion on each tab, then close them. */
  | { type: 'explodeAndClose'; tabIds: TabId[] }
  /** Shown as a speech bubble from chill Barry in his corner. */
  /** freeMinutes is null when no block is coming up (an open-ended gap). */
  | { type: 'showSuggestion'; tabId: TabId; todo: Todo; freeMinutes: number | null }
  | { type: 'setBadge'; pose: PoseId; text: string };

export interface ReduceResult {
  state: BarryState;
  effects: BarryEffect[];
}

/**
 * Everything one tab should show. Content scripts render this and nothing else.
 * Produced by the brain's `viewFor(state, tabId, now)`.
 */
export interface TabView {
  visible: boolean;
  placement: 'corner' | 'face';
  position: Position;
  pose: PoseId;
  /**
   * When this pose began, so every tab starts the pose's strip and entrance animation from
   * the same moment. A view with the same pose and a new poseSince restarts it.
   */
  poseSince: Millis;
  /** Tired Barry during a Snooze: clicking him sends 'gotUp'. */
  canGetUp: boolean;
  /** Speech bubble text, or null for none. */
  line: string | null;
  showBackToIt: boolean;
  /** True only during a Confrontation. Pages work normally during an Arm fight. */
  eatInput: boolean;
  pauseMedia: boolean;
  /** 0..1, or null to hide the meter. */
  chudMeter: number | null;
  /** The renderer counts down to this; null hides the countdown. */
  breakEndsAt: Millis | null;
  /** The arm stretching out of corner Barry. Progress = (now - startedAt) / durationMs. Null = no arm. */
  reach: { startedAt: Millis; durationMs: number } | null;
  pushesLeft: number | null;
  /**
   * Where this tab sits in its window's tab strip, so the Arm can reach for it.
   * The brain always leaves this null; the runtime fills it in before sending the view.
   */
  tabSlot: TabSlot | null;
}

/** A tab's place in its window's horizontal tab strip. Pinned tabs sit first and are narrow. */
export interface TabSlot {
  /** 0-based index among all tabs in the window (pinned included). */
  index: number;
  /** Tabs in the window, pinned included. */
  count: number;
  /** Pinned tabs in the window. */
  pinned: number;
}

export const HIDDEN_VIEW: TabView = {
  visible: false,
  placement: 'corner',
  position: 'right',
  pose: 'studious',
  poseSince: 0,
  canGetUp: false,
  line: null,
  showBackToIt: false,
  eatInput: false,
  pauseMedia: false,
  chudMeter: null,
  breakEndsAt: null,
  reach: null,
  pushesLeft: null,
  tabSlot: null,
};

/** The brain's public surface. Implemented in src/brain (Workstream A). */
export interface Brain {
  initialState(): BarryState;
  reduce(state: BarryState, event: BarryEvent): ReduceResult;
  viewFor(state: BarryState, tabId: TabId, now: Millis): TabView;
  /** Next moment the brain needs a tick (break end, warning end, Reach end, Lock back in). */
  nextDeadline(state: BarryState): Millis | null;
}
