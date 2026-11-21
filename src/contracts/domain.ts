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

export interface Todo {
  text: string;
  sourceId: string;
}

/** Where the element picker found a todo list. */
export interface TodoSource {
  id: string;
  origin: string;
  path: string;
  selector: string;
}

export interface BlocklistEntry {
  /** Bare host, e.g. "youtube.com". Also matches its subdomains. */
  domain: string;
  /** False = toggled off: not restricted until toggled back on. */
  enabled: boolean;
}

/** Every tunable number, so playtesting never touches logic. Defaults in config.ts. */
export interface Tuning {
  fatPerEat: number;
  /** Confrontation sprite scale = 1 + fatness * scalePerFat, capped at maxScale. */
  scalePerFat: number;
  maxScale: number;
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
