// Derived display logic for the popup (ADR 0001: the React components only draw this).
// Pure: no browser imports.

import type {
  BarryState,
  BlocklistEntry,
  CalendarBlock,
  Millis,
  Mode,
  PoseId,
  PoseSprite,
  TabId,
  ModeOverride,
  Task,
  Tuning,
} from '../contracts';
import {
  DEFAULT_TUNING,
  DEMO_TUNING,
  TASK_DEFAULT_ESTIMATE_MS,
  TASK_ESTIMATE_MAX_MS,
  TASK_MAX,
  TASK_TITLE_MAX,
  TASK_WARN_TOTAL_MS,
} from '../contracts';
import { currentBlock, resolveMode, runningTask } from '../brain/helpers';
import { brain, caveAllowed, snoozeStage } from '../brain';

export interface Countdown {
  label: string;
  /** Epoch ms the countdown runs to; the UI subtracts Date.now() each second. */
  target: Millis;
}

export interface PopupView {
  mode: Mode;
  modeLabel: string;
  /** 'forced' when the override is Chill/Lock In, 'calendar' when Auto. */
  modeSource: 'forced' | 'calendar';
  sourceLabel: string;
  headline: string;
  override: ModeOverride;
  currentBlock: CalendarBlock | null;
  nextBlock: CalendarBlock | null;
  /** The started Task while its time runs, with its end. */
  currentTask: { task: Task; endsAt: Millis } | null;
  countdown: Countdown | null;
  /** Under the countdown while tired Barry can be told to get up, else null. */
  countdownHint: string | null;
  slackAllowed: boolean;
  slackHint: string | null;
  /** A Slack pass is running: the chips change its length and Stop Slacking shows. */
  onSlackPass: boolean;
  /** Length of the running Slack pass in whole minutes (its chip is highlighted), else null. */
  slackCurrentMin: number | null;
}

export const MODE_LABEL: Record<Mode, string> = { chill: 'Chill', lockIn: 'Lock In' };

/** Earliest timed block that starts after `now`. */
export function nextBlock(state: Pick<BarryState, 'blocks'>, now: Millis): CalendarBlock | null {
  let best: CalendarBlock | null = null;
  for (const b of state.blocks) {
    if (b.allDay || b.start <= now) continue;
    if (!best || b.start < best.start) best = b;
  }
  return best;
}

export function countdownFor(state: BarryState, now: Millis): Countdown | null {
  switch (state.phase) {
    case 'slackPass':
      return state.slackPassEndsAt === null
        ? null
        : { label: 'Slack pass ends in', target: state.slackPassEndsAt };
    case 'warning':
      return state.warningEndsAt === null
        ? null
        : { label: 'Reach in', target: state.warningEndsAt };
    case 'reaching':
      return state.reachStartedAt === null
        ? null
        : { label: 'Arm lands in', target: state.reachStartedAt + state.tuning.reachMs };
    case 'snoozing':
      // Hidden while Barry collapses and gets up; shown once he sits tired.
      return state.snoozeEndsAt === null || snoozeStage(state, now) !== 'tired'
        ? null
        : { label: 'Snooze ends in', target: state.snoozeEndsAt };
    default:
      return null;
  }
}

export function headlineFor(mode: Mode, state: Pick<BarryState, 'phase'>): string {
  if (mode === 'chill') return 'Barry is chilling';
  switch (state.phase) {
    case 'clear':
      return 'Barry is studying';
    case 'confronting':
      return 'Barry caught you!';
    case 'slackPass':
      return 'Slack pass: enjoy it';
    case 'warning':
      return 'Break is over...';
    case 'reaching':
      return 'Arm fight! Push him back';
    case 'snoozing':
      return 'Barry is beaten (for now)';
  }
}

export function slackPassStatus(mode: Mode, phase: BarryState['phase']) {
  if (mode === 'chill') return { allowed: false, hint: 'Barry only cares in Lock In.' };
  return { allowed: true, hint: null };
}

/** Length of the running Slack pass in minutes, or null when not on one. */
export function slackCurrentMin(
  state: Pick<BarryState, 'phase' | 'slackPassStartedAt' | 'slackPassEndsAt'>,
): number | null {
  if (state.phase !== 'slackPass') return null;
  if (state.slackPassStartedAt === null || state.slackPassEndsAt === null) return null;
  return Math.round((state.slackPassEndsAt - state.slackPassStartedAt) / 60_000);
}

/** What changing the running Slack pass to `min` minutes (counted from its start) would do. */
export function slackChangePreview(
  state: Pick<BarryState, 'slackPassStartedAt'>,
  min: number,
  now: Millis,
): string {
  if (state.slackPassStartedAt === null) return '';
  const left = state.slackPassStartedAt + min * 60_000 - now;
  if (left <= 0) return 'This ends your break now.';
  return `${min} min total, ${formatCountdown(left)} left.`;
}

/** The started Task while its time runs, or null. */
export function currentTaskOf(
  state: Pick<BarryState, 'tasks' | 'activeTask'>,
  now: Millis,
): PopupView['currentTask'] {
  const a = runningTask(state, now);
  const task = a ? state.tasks.find((t) => t.id === a.id && !t.done) : undefined;
  return a && task ? { task, endsAt: a.endsAt } : null;
}

export function popupView(state: BarryState, now: Millis): PopupView {
  const mode = resolveMode(state, now);
  const slack = slackPassStatus(mode, state.phase);
  const forced = state.modeOverride !== 'auto';
  return {
    mode,
    modeLabel: MODE_LABEL[mode],
    modeSource: forced ? 'forced' : 'calendar',
    sourceLabel: forced ? 'set by you' : 'from calendar',
    headline: headlineFor(mode, state),
    override: state.modeOverride,
    currentBlock: currentBlock(state, now),
    nextBlock: nextBlock(state, now),
    currentTask: currentTaskOf(state, now),
    countdown: countdownFor(state, now),
    countdownHint:
      state.phase === 'snoozing' && snoozeStage(state, now) === 'tired'
        ? 'Tap Barry to lock in again'
        : null,
    slackAllowed: slack.allowed,
    slackHint: slack.hint,
    onSlackPass: state.phase === 'slackPass',
    slackCurrentMin: slackCurrentMin(state),
  };
}

/** m:ss, or h:mm:ss; never negative. */
export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const s = total % 60;
  const m = Math.floor(total / 60) % 60;
  const h = Math.floor(total / 3600);
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

export const DAY_MS = 24 * 60 * 60_000;

/** A countdown under a day ticks (m:ss / h:mm:ss); a day or more just says how many days. */
export function formatTimeLeft(ms: number): string {
  if (ms < DAY_MS) return formatCountdown(ms);
  const d = Math.floor(ms / DAY_MS);
  return `${d} ${d === 1 ? 'day' : 'days'}`;
}

/** "3:00 PM" today; "Tue 3:00 PM" within a week; "Dec 4, 3:00 PM" further out. */
export function formatWhen(ms: Millis, now: Millis): string {
  const d = new Date(ms);
  if (d.toDateString() === new Date(now).toDateString()) return formatClock(ms);
  const opts: Intl.DateTimeFormatOptions =
    ms - now < 6 * DAY_MS
      ? { weekday: 'short', hour: 'numeric', minute: '2-digit' }
      : { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' };
  return d.toLocaleString([], opts);
}

export function formatClock(ms: Millis): string {
  return new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

/** Dev panel: user types seconds, setTuning wants ms. Returns null for junk input. */
export function secondsToMs(input: string): number | null {
  const n = Number(input);
  return input.trim() !== '' && Number.isFinite(n) && n >= 0 ? Math.round(n * 1000) : null;
}

export function tuningSeconds(t: Tuning) {
  return {
    defaultSlackPassMs: t.defaultSlackPassMs / 1000,
    warningMs: t.warningMs / 1000,
    reachMs: t.reachMs / 1000,
    snoozeMs: t.snoozeMs / 1000,
  };
}

/** Which speed preset the tuning is on: Demo if every Demo value is applied, Normal if all defaults. */
export function speedPreset(t: Tuning): 'demo' | 'normal' | 'custom' {
  const matches = (preset: Partial<Tuning>) =>
    (Object.keys(preset) as (keyof Tuning)[]).every((k) => t[k] === preset[k]);
  if (matches(DEFAULT_TUNING)) return 'normal';
  if (matches(DEMO_TUNING)) return 'demo';
  return 'custom';
}

export const SLACK_PRESETS_MIN = [1, 5, 10, 15] as const;

// ---- settings ---------------------------------------------------------------------------

/**
 * Turn what the user typed ("https://www.YouTube.com/watch?v=1", "Reddit.com/") into a bare host
 * ("youtube.com"), or null if it isn't a plausible domain. Strips a leading "www.".
 */
export function normalizeDomain(input: string): string | null {
  let s = input.trim().toLowerCase();
  if (!s) return null;
  s = s.replace(/^[a-z][a-z0-9+.-]*:\/\//, '');
  s = s.split(/[/?#]/)[0] ?? '';
  s = s
    .replace(/^[^@]*@/, '')
    .replace(/:\d+$/, '')
    .replace(/\.$/, '')
    .replace(/^www\./, '');
  const label = '[a-z0-9]([a-z0-9-]*[a-z0-9])?';
  return new RegExp(`^${label}(\\.${label})+$`).test(s) ? s : null;
}

export type AddDomainResult =
  { ok: true; blocklist: BlocklistEntry[] } | { ok: false; error: string };

export function addDomain(blocklist: BlocklistEntry[], input: string): AddDomainResult {
  const domain = normalizeDomain(input);
  if (!domain) return { ok: false, error: 'Enter a site like youtube.com' };
  const existing = blocklist.find((e) => e.domain === domain);
  if (existing) {
    // Re-adding a toggled-off site turns it back on.
    return {
      ok: true,
      blocklist: blocklist.map((e) => (e.domain === domain ? { ...e, enabled: true } : e)),
    };
  }
  return { ok: true, blocklist: [...blocklist, { domain, enabled: true }] };
}

export const removeDomain = (blocklist: BlocklistEntry[], domain: string) =>
  blocklist.filter((e) => e.domain !== domain);

export const toggleDomain = (blocklist: BlocklistEntry[], domain: string) =>
  blocklist.map((e) => (e.domain === domain ? { ...e, enabled: !e.enabled } : e));

/**
 * The Cave hides calm Barry. A Confrontation is never hidden, so during one the toggle is
 * disabled (the current Lane A rule: src/brain viewFor). Keep in sync with the brain.
 */
export function caveStatus(
  state: BarryState,
  now: Millis,
): {
  disabled: boolean;
  reason: string | null;
} {
  return caveAllowed(state, now)
    ? { disabled: false, reason: null }
    : { disabled: true, reason: "Barry can't hide while he's dealing with you." };
}

/** Chud meter as a whole percent, clamped 0-100. */
export function chudPercent(meter: number): number {
  return Math.round(Math.min(1, Math.max(0, Number.isFinite(meter) ? meter : 0)) * 100);
}

/** One line for the ICS section: error wins, then last fetch time. */
export function scheduleStatusLine(
  status: { fetchedAt: Millis | null; error: string | null; blocks: unknown[] } | null,
  hasUrl: boolean,
  now: Millis,
): { text: string; isError: boolean } {
  if (!hasUrl) return { text: 'No calendar connected yet.', isError: false };
  if (status?.error) {
    const when =
      status.fetchedAt === null ? '' : ` Last good fetch ${formatAgo(now - status.fetchedAt)}.`;
    return { text: status.error + '.' + when, isError: true };
  }
  if (!status || status.fetchedAt === null) return { text: 'Fetching...', isError: false };
  const n = status.blocks.length;
  return {
    text: `Fetched ${formatAgo(now - status.fetchedAt)} (${n} ${n === 1 ? 'event' : 'events'}).`,
    isError: false,
  };
}

export function formatAgo(ms: number): string {
  const m = Math.floor(Math.max(0, ms) / 60_000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  return h < 24 ? `${h} h ago` : `${Math.floor(h / 24)} d ago`;
}

// ---- header Barry (pixel art of the current pose) -----------------------------------------

export interface HeaderBarry {
  pose: PoseId;
  /** Restarts the flipbook when the same pose begins again. 0 for the calm fallback. */
  poseSince: Millis;
  canGetUp: boolean;
  /**
   * Draw Barry in the popup's header. False while any tab shows him (he is out on the page)
   * or while he is in the Cave: there is only one Barry.
   */
  inPopup: boolean;
}

/**
 * Which pose the popup shows and whether Get up is offered. Asks the brain what the active
 * tab shows; if that tab hides Barry (or is unknown), uses the first other open tab that shows
 * him, so a Confrontation or Snooze in another tab still appears. With nobody visible, Barry
 * is calm: Chill sips, Lock In studies. Get up shows if any tab's view offers it. `inPopup`
 * says whether to draw him at all (see HeaderBarry).
 */
export function headerBarry(
  state: BarryState,
  now: Millis,
  activeTabId: TabId | null,
): HeaderBarry {
  const ids = Object.keys(state.openTabs).map(Number);
  const ordered =
    activeTabId !== null && ids.includes(activeTabId)
      ? [activeTabId, ...ids.filter((id) => id !== activeTabId)]
      : ids;
  const views = ordered.map((id) => brain.viewFor(state, id, now));
  const shown = views.find((v) => v.visible);
  const canGetUp = views.some((v) => v.canGetUp);
  if (shown) return { pose: shown.pose, poseSince: shown.poseSince, canGetUp, inPopup: false };
  const calm = resolveMode(state, now) === 'chill' ? 'chill-mug' : 'studious';
  return { pose: calm, poseSince: 0, canGetUp, inPopup: !state.cave };
}

/** Which frame of a strip shows `elapsed` ms after the pose began (still images stay on 0). */
export function frameAt(sprite: Pick<PoseSprite, 'frames' | 'frameMs'>, elapsed: number): number {
  if (sprite.frames <= 1 || !sprite.frameMs) return 0;
  return Math.floor(Math.max(0, elapsed) / sprite.frameMs) % sprite.frames;
}

/** Pixel-crisp CSS box for one frame of a strip at an integer scale. */
export function spriteBox(
  sprite: Pick<PoseSprite, 'w' | 'h' | 'frames'>,
  scale: number,
  frame = 0,
) {
  return {
    width: sprite.w * scale,
    height: sprite.h * scale,
    backgroundSize: `${sprite.w * sprite.frames * scale}px ${sprite.h * scale}px`,
    backgroundPosition: `${-frame * sprite.w * scale}px 0px`,
  };
}

// ---- chud bar (35x5 art px outline, fill drawn in code) -----------------------------------

export const CHUD_STEPS = 10;
/** Inner fill area of chud-bar.png in art px, from the demo: 33 x 3 at (1, 1). */
export const CHUD_FILL = { x: 1, y: 1, w: 33, h: 3 } as const;

/** Chud meter 0..1 as whole steps 0..10. */
export function chudSteps(meter: number): number {
  const m = Number.isFinite(meter) ? Math.min(1, Math.max(0, meter)) : 0;
  return Math.round(m * CHUD_STEPS);
}

/** Fill width in art px for a meter value. */
export function chudFillWidth(meter: number): number {
  return Math.round((chudSteps(meter) / CHUD_STEPS) * CHUD_FILL.w);
}

/** Saved state merged over the defaults, so fields added since it was saved are never undefined. Mirrors the runtime's loadState. */
export function withStateDefaults(saved: BarryState | null | undefined): BarryState | null {
  if (!saved) return null;
  const init = brain.initialState();
  return { ...init, ...saved, tuning: { ...init.tuning, ...saved.tuning } };
}

// ---- pixel popup: sky scene, block card timer, chud sign ----------------------------------

export type SceneKey = BarryState['phase'] | 'chill';

/** Which sky and speech bubble the header shows. Chill wins over the Lock In phase. */
export function sceneKey(mode: Mode, phase: BarryState['phase']): SceneKey {
  return mode === 'chill' ? 'chill' : phase;
}

const BLUE_SKY = ['#3a9ff0', '#4eaef4', '#66bdf7', '#80cbfa'];
const RED_SKY = ['#b83a3a', '#c94a42', '#d85d4c', '#e57458'];

/** Four sky bands, top to bottom. */
export const SKY: Record<SceneKey, string[]> = {
  clear: BLUE_SKY,
  chill: BLUE_SKY,
  slackPass: BLUE_SKY,
  confronting: RED_SKY,
  warning: ['#e07a3e', '#ea8c4c', '#f2a05e', '#f7b674'],
  reaching: RED_SKY,
  snoozing: ['#2e2a5a', '#3c3670', '#4b4385', '#5b5197'],
};

export const BUBBLE: Record<SceneKey, string> = {
  clear: 'Studying...',
  chill: 'Hibernating...',
  slackPass: 'Enjoy your break!',
  confronting: 'Caught you!',
  warning: "Break's over...",
  reaching: 'Get back here!',
  snoozing: 'Beaten... zzz',
};

/** Hard-edged CSS bands for the sky, `band` px each. */
export function skyBands(key: SceneKey, band: number): string {
  const c = SKY[key];
  return `linear-gradient(${c[0]} 0 ${band}px, ${c[1]} ${band}px ${band * 2}px, ${c[2]} ${band * 2}px ${band * 3}px, ${c[3]} ${band * 3}px)`;
}

/**
 * The Current Block card's countdown: a phase countdown (Slack pass, Reach...) wins; then the
 * started Task's time left; then time left in the current block, or the time until the next one.
 */
export function blockCardTimer(
  v: Pick<PopupView, 'countdown' | 'currentBlock' | 'nextBlock'> &
    Partial<Pick<PopupView, 'currentTask'>>,
): Countdown | null {
  if (v.countdown) return v.countdown;
  if (v.currentTask) return { label: 'Task time left', target: v.currentTask.endsAt };
  if (v.currentBlock) return { label: 'Time left', target: v.currentBlock.end };
  if (v.nextBlock) return { label: 'Next block in', target: v.nextBlock.start };
  return null;
}

export const CHUD_SIGN_SEGMENTS = 8;

/** Which of the sign's segments are lit, left to right. */
export function chudSignSegments(meter: number): boolean[] {
  const m = Number.isFinite(meter) ? Math.min(1, Math.max(0, meter)) : 0;
  const lit = Math.round(m * CHUD_SIGN_SEGMENTS);
  return Array.from({ length: CHUD_SIGN_SEGMENTS }, (_, i) => i < lit);
}

// ---- Tasks -------------------------------------------------------------------------------

export const openTasks = (tasks: Task[]) => tasks.filter((t) => !t.done);

/** Sum of the unchecked Tasks' estimates. */
export const totalEstimateMs = (tasks: Task[]) =>
  openTasks(tasks).reduce((sum, t) => sum + t.estimateMs, 0);

/** The list is full: TASK_MAX unchecked Tasks (checked ones don't count). */
export const atTaskLimit = (tasks: Task[]) => openTasks(tasks).length >= TASK_MAX;

/** Adding `estimateMs` more would take the unchecked total past TASK_WARN_TOTAL_MS. */
export const wouldExceedTotal = (tasks: Task[], estimateMs: number) =>
  totalEstimateMs(tasks) + estimateMs > TASK_WARN_TOTAL_MS;

/** "15m", "1h", "1h 30m". */
export function formatEstimate(ms: number): string {
  const total = Math.max(0, Math.round(ms / 60_000));
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

/** The hours box: digits only, at most 8. */
export function hoursField(input: string): string {
  const d = input.replace(/\D/g, '').slice(-1);
  return d === '' ? '' : String(Math.min(8, Number(d)));
}

/** The minutes box: digits only, at most 59. */
export function minutesField(input: string): string {
  const d = input.replace(/\D/g, '').slice(0, 2);
  return d === '' ? '' : String(Math.min(59, Number(d)));
}

/**
 * Hours + minutes typed into the custom time boxes. Both empty = nothing typed (ms null, no
 * error). Zero, or over TASK_ESTIMATE_MAX_MS (8h 30m), is an error.
 */
export function hoursMinutesMs(
  hours: string,
  minutes: string,
): { ms: number | null; error: string | null } {
  if (hours.trim() === '' && minutes.trim() === '') return { ms: null, error: null };
  const ms = ((Number(hours) || 0) * 60 + (Number(minutes) || 0)) * 60_000;
  if (ms <= 0) return { ms: null, error: 'Enter at least 1 minute.' };
  if (ms > TASK_ESTIMATE_MAX_MS)
    return { ms: null, error: `Max ${formatEstimate(TASK_ESTIMATE_MAX_MS)} per task.` };
  return { ms, error: null };
}

/** A title cut to TASK_TITLE_MAX characters. */
export const clampTitle = (title: string) => title.trim().slice(0, TASK_TITLE_MAX).trim();

/**
 * Adds a Task after the last unchecked one (so it sits above finished Tasks). Blank titles and a
 * full list change nothing.
 */
export function addTask(
  tasks: Task[],
  input: { title: string; description?: string; estimateMs?: number },
  id: string,
): Task[] {
  const title = clampTitle(input.title);
  if (!title || atTaskLimit(tasks)) return tasks;
  const task: Task = {
    id,
    title,
    description: (input.description ?? '').trim(),
    estimateMs: Math.min(TASK_ESTIMATE_MAX_MS, input.estimateMs ?? TASK_DEFAULT_ESTIMATE_MS),
    done: false,
    doneAt: null,
  };
  const lastOpen = tasks.reduce((at, t, i) => (t.done ? at : i), -1);
  const out = [...tasks];
  out.splice(lastOpen + 1, 0, task);
  return out;
}

/** Ticks or unticks a Task where it is (the list order never changes). */
export function toggleTask(tasks: Task[], id: string, now: Millis): Task[] {
  if (!tasks.some((x) => x.id === id)) return tasks;
  return tasks.map((x) => (x.id === id ? { ...x, done: !x.done, doneAt: x.done ? null : now } : x));
}

/** New title and details for a Task. A blank title keeps the old one. */
export function renameTask(tasks: Task[], id: string, title: string, description: string): Task[] {
  const t = tasks.find((x) => x.id === id);
  if (!t) return tasks;
  const next = { ...t, title: clampTitle(title) || t.title, description: description.trim() };
  if (next.title === t.title && next.description === t.description) return tasks;
  return tasks.map((x) => (x.id === id ? next : x));
}

export const removeTask = (tasks: Task[], id: string): Task[] => tasks.filter((t) => t.id !== id);

/** Swaps an unchecked Task with the unchecked neighbour above (-1) or below (+1). */
export function moveTask(tasks: Task[], id: string, dir: -1 | 1): Task[] {
  const i = tasks.findIndex((t) => t.id === id);
  if (i < 0 || tasks[i]!.done) return tasks;
  let j = i + dir;
  while (j >= 0 && j < tasks.length && tasks[j]!.done) j += dir;
  if (j < 0 || j >= tasks.length) return tasks;
  const out = [...tasks];
  [out[i], out[j]] = [out[j]!, out[i]!];
  return out;
}

/**
 * Drag and drop: puts Task `id` just before or after `targetId` (checked or not). Only
 * unchecked Tasks are dragged.
 */
export function moveTaskTo(
  tasks: Task[],
  id: string,
  targetId: string,
  place: 'before' | 'after',
): Task[] {
  const moving = tasks.find((t) => t.id === id);
  const target = tasks.find((t) => t.id === targetId);
  if (!moving || !target || moving.done || id === targetId) return tasks;
  const rest = tasks.filter((t) => t.id !== id);
  const at = rest.findIndex((t) => t.id === targetId) + (place === 'after' ? 1 : 0);
  const out = [...rest.slice(0, at), moving, ...rest.slice(at)];
  return out.every((t, i) => t === tasks[i]) ? tasks : out;
}

/** Drops Tasks checked off before today (local midnight), so finished ones clear overnight. */
export function dropStaleDone(tasks: Task[], now: Millis): Task[] {
  const midnight = new Date(now);
  midnight.setHours(0, 0, 0, 0);
  const keep = tasks.filter((t) => !t.done || (t.doneAt ?? 0) >= midnight.getTime());
  return keep.length === tasks.length ? tasks : keep;
}

// ---- Today's Events card (from the calendar) ----------------------------------------------

export interface TodayEvent {
  block: CalendarBlock;
  /** "2:00–4:00 PM", or "All day". */
  range: string;
  /** "● now", "in 25m", "done", or "" for all-day events. */
  when: string;
  status: 'allDay' | 'past' | 'now' | 'later';
  /**
   * All-day, or running across midnight (like a 3-day hackathon). Listed first, above a divider,
   * with `range` as its full span: "Nov 20, 12:00 PM – Nov 22, 5:00 PM" or "Nov 20 – Nov 22".
   */
  long: boolean;
  /** 0 multi-day (top), 1 today's timed events, 2 one-day all-day events (bottom). */
  group: 0 | 1 | 2;
}

const dayKey = (ms: Millis) => new Date(ms).toDateString();
const shortDate = (ms: Millis) =>
  new Date(ms).toLocaleDateString([], { month: 'short', day: 'numeric' });

/** Where an event goes in Today's Events: multi-day on top, timed in the middle, all-day last. */
function eventGroup(b: Pick<CalendarBlock, 'start' | 'end' | 'allDay'>): 0 | 1 | 2 {
  if (!isLongEvent(b)) return 1;
  return b.allDay && formatSpan(b) === 'All day' ? 2 : 0;
}

/** True for all-day events and ones that run across midnight. */
export function isLongEvent(b: Pick<CalendarBlock, 'start' | 'end' | 'allDay'>): boolean {
  return b.allDay || dayKey(b.start) !== dayKey(Math.max(b.start, b.end - 1));
}

/**
 * A long event's span: "All day" (one all-day date), "Nov 20 – Nov 22" (all-day, several dates;
 * the feed's end is exclusive), or "Nov 20, 12:00 PM – Nov 22, 5:00 PM" (timed).
 */
export function formatSpan(b: Pick<CalendarBlock, 'start' | 'end' | 'allDay'>): string {
  if (b.allDay) {
    const last = Math.max(b.start, b.end - 1);
    return dayKey(b.start) === dayKey(last)
      ? 'All day'
      : `${shortDate(b.start)} – ${shortDate(last)}`;
  }
  return `${shortDate(b.start)}, ${formatClock(b.start)} – ${shortDate(b.end)}, ${formatClock(b.end)}`;
}

/** "2:00–4:00 PM" when both ends share AM/PM, else "11:30 AM–1:00 PM". */
export function formatRange(start: Millis, end: Millis): string {
  const a = formatClock(start);
  const b = formatClock(end);
  const suffix = /\s?(AM|PM)$/i;
  const sa = a.match(suffix)?.[1];
  const sb = b.match(suffix)?.[1];
  return sa && sa === sb ? `${a.replace(suffix, '')}–${b}` : `${a}–${b}`;
}

/**
 * Everything on today's calendar (local day): multi-day events first, then today's timed events
 * in time order (including ones already over), then one-day all-day events.
 */
export function todayEvents(blocks: CalendarBlock[], now: Millis): TodayEvent[] {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  const dayStart = start.getTime();
  const dayEnd = end.getTime();
  return blocks
    .filter((b) => b.start < dayEnd && b.end > dayStart)
    .map((block) => ({ block, group: eventGroup(block) }))
    .sort((a, b) => a.group - b.group || a.block.start - b.block.start || a.block.end - b.block.end)
    .map(({ block, group }): TodayEvent => {
      const long = isLongEvent(block);
      const range = long ? formatSpan(block) : formatRange(block.start, block.end);
      if (block.allDay) return { block, range, when: '', status: 'allDay', long, group };
      if (block.end <= now) return { block, range, when: 'done', status: 'past', long, group };
      if (block.start <= now) return { block, range, when: '● now', status: 'now', long, group };
      return {
        block,
        range,
        when: `in ${formatEstimate(Math.max(60_000, block.start - now))}`,
        status: 'later',
        long,
        group,
      };
    });
}

/**
 * "+ task" on an event: its title, its length as the estimate. Null for an all-day event or one
 * longer than a Task may be (8h 30m), e.g. a multi-day event: those can't be added.
 */
export function taskFromEvent(block: CalendarBlock): { title: string; estimateMs: number } | null {
  const length = block.end - block.start;
  if (block.allDay || length > TASK_ESTIMATE_MAX_MS) return null;
  return {
    title: clampTitle(block.title) || 'Calendar event',
    estimateMs: Math.max(60_000, length),
  };
}

/** An unchecked Task with this title already exists (so "+ task" shows "added"). */
export const hasOpenTaskTitled = (tasks: Task[], title: string) =>
  tasks.some((t) => !t.done && t.title.toLowerCase() === clampTitle(title).toLowerCase());
