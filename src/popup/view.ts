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
  Tuning,
} from '../contracts';
import { DEFAULT_TUNING, DEMO_TUNING } from '../contracts';
import { currentBlock, resolveMode } from '../brain/helpers';
import { brain, caveAllowed } from '../brain';

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
  countdown: Countdown | null;
  pushesLeft: number | null;
  slackAllowed: boolean;
  slackHint: string | null;
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

export function countdownFor(state: BarryState): Countdown | null {
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
      return state.snoozeEndsAt === null
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
  if (phase === 'slackPass') return { allowed: false, hint: 'Already on a break.' };
  return { allowed: true, hint: null };
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
    countdown: countdownFor(state),
    pushesLeft:
      mode === 'lockIn' && state.phase === 'reaching'
        ? Math.max(0, state.tuning.maxPushes - state.pushes)
        : null,
    slackAllowed: slack.allowed,
    slackHint: slack.hint,
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
}

/**
 * Which pose the popup shows and whether Get up is offered. Asks the brain what the active
 * tab shows; if that tab hides Barry (or is unknown), uses the first other open tab that shows
 * him, so a Confrontation or Snooze in another tab still appears. With nobody visible, Barry
 * is calm: Chill sips, Lock In studies. Get up shows if any tab's view offers it.
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
  if (shown) return { pose: shown.pose, poseSince: shown.poseSince, canGetUp };
  const calm = resolveMode(state, now) === 'chill' ? 'chill-mug' : 'studious';
  return { pose: calm, poseSince: 0, canGetUp };
}

/** Which frame of a strip shows `elapsed` ms after the pose began (still images stay on 0). */
export function frameAt(sprite: Pick<PoseSprite, 'frames' | 'frameMs'>, elapsed: number): number {
  if (sprite.frames <= 1 || !sprite.frameMs) return 0;
  return Math.floor(Math.max(0, elapsed) / sprite.frameMs) % sprite.frames;
}

/** Pixel-crisp CSS box for one frame of a strip at an integer scale. */
export function spriteBox(sprite: Pick<PoseSprite, 'w' | 'h' | 'frames'>, scale: number, frame = 0) {
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
