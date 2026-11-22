// Domain types. Names follow CONTEXT.md; check it before inventing a new word.
// Changing anything here affects every workstream: open a PR and tell the team.
// Pure: no `chrome`, `browser`, or DOM imports (the brain and its tests use this).

/** Epoch milliseconds. Time reaches the brain only through events; it never reads a clock. */
export type Millis = number;
export type TabId = number;

export type Mode = 'chill' | 'lockIn';
/** 'auto' follows the calendar; the others force a Mode. */
export type ModeOverride = 'auto' | Mode;

export type Position = 'left' | 'middle' | 'right';
export type EatKind = 'click' | 'scroll' | 'key' | 'unpause';

export interface CalendarBlock {
  id: string;
  title: string;
  start: Millis;
  end: Millis;
  /** All-day events are kept for display but never put Barry in Lock In. */
  allDay: boolean;
  source: 'ics' | 'dev';
}

/**
 * Something the user plans to do, typed into the popup. The list is in priority order: the
 * first unchecked Task is the top Task. Barry never checks one off by himself.
 */
export interface Task {
  id: string;
  title: string;
  /** Optional detail; empty string for none. */
  description: string;
  /** How long the user thinks it takes. Starting the Task runs Lock In for this long. */
  estimateMs: number;
  done: boolean;
  /** When it was checked off, so the popup can clear yesterday's finished Tasks. */
  doneAt: Millis | null;
  /** Time left when it was paused; Start resumes from here. Absent/null = not paused. */
  leftMs?: number | null;
}

/** The Task the user pressed Start on: Lock In runs until `endsAt`. */
export interface ActiveTask {
  id: string;
  startedAt: Millis;
  endsAt: Millis;
}

/** Answers to "Time's up for X. Done?": check it off, or keep going for more minutes. */
export type TaskAnswer = 'done' | 'extend';

export interface BlocklistEntry {
  /** Bare host, e.g. "youtube.com". Also matches its subdomains. */
  domain: string;
  /** False = toggled off: not restricted until toggled back on. */
  enabled: boolean;
}

/** Every tunable number, so playtesting never touches logic. Defaults in config.ts. */
export interface Tuning {
  /** Fatness picks the Confrontation sprite tier: 0 suspicious, 1-4 fat-1..fat-4, 5+ chud. */
  fatPerEat: number;
  defaultSlackPassMs: number;
  snoozeMs: number;
  /** Heads-up between a break ending and the first Reach. Only after a Slack pass. */
  warningMs: number;
  reachMs: number;
  /** The Push that wins a Snooze. */
  maxPushes: number;
  /** Snooze time that fills the Chud meter from 0 to 1. */
  chudFullMs: number;
  /** Unbroken Studying needed to Lock back in (resets the Chud meter). */
  lockBackInMs: number;
  /** No input for this long counts as idle (passed to chrome.idle). */
  idleAfterSec: number;
  freeGapMinMs: number;
}
