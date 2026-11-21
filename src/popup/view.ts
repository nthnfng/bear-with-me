// Derived display logic for the popup (ADR 0001: the React components only draw this).
// Pure: no browser imports.

import type { BarryState, CalendarBlock, Millis, Mode, ModeOverride, Tuning } from '../contracts';
import { currentBlock, resolveMode } from '../brain/helpers';

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

export const SLACK_PRESETS_MIN = [5, 10, 15] as const;
