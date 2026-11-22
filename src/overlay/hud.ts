// Pure text helpers for the small widgets near Barry. DOM-free.

import type { PlanView } from '../contracts';

export function formatCountdown(remainingMs: number): string {
  const total = Math.max(0, Math.ceil(remainingMs / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export const SUGGESTION_MS = 4_000;

export function suggestionText(freeMinutes: number | null, task: string): string {
  if (freeMinutes === null) return `You're free right now. How about: ${task}?`;
  const n = Math.max(1, Math.round(freeMinutes));
  if (n >= 120) {
    const h = Math.round(n / 60);
    return `You've got ${h} free hours. How about: ${task}?`;
  }
  return `You've got ${n} free minute${n === 1 ? '' : 's'}. How about: ${task}?`;
}

/** "15m", "1h", "1h 30m": a Task's estimate or time left, rounded up to whole minutes. */
export function formatMinutes(ms: number): string {
  const total = Math.max(1, Math.ceil(ms / 60_000));
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export const PLAN_TITLE_MAX = 32;

/** Cuts a long title to `max` characters with "…". */
export function truncate(text: string, max = PLAN_TITLE_MAX): string {
  const t = text.trim();
  return t.length <= max ? t : `${t.slice(0, max - 1).trimEnd()}…`;
}

/**
 * A readable length, rounded up to the minute, in at most two units: "25 minutes",
 * "5 hours 30 minutes", "2 hours", "1 day 16 hours".
 */
export function humanDuration(ms: number): string {
  const total = Math.max(1, Math.ceil(ms / 60_000));
  const d = Math.floor(total / 1440);
  const h = Math.floor((total % 1440) / 60);
  const m = total % 60;
  const unit = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
  if (d > 0) return h > 0 ? `${unit(d, 'day')} ${unit(h, 'hour')}` : unit(d, 'day');
  if (h > 0) return m > 0 ? `${unit(h, 'hour')} ${unit(m, 'minute')}` : unit(h, 'hour');
  return unit(m, 'minute');
}

/**
 * The lines under the Confrontation line, task first:
 *   "Task Write essay: ~5 hours 30 minutes left"   (running)
 *   "Task Write essay: ~30 minutes"                 (not started: its estimate)
 *   "Task Write essay: time's up"
 *   "Event Hack Western: ~1 day 16 hours left"
 */
export function planLines(plan: PlanView | null, now: number): string[] {
  if (!plan) return [];
  const out: string[] = [];
  if (plan.task) {
    const t = plan.task.timing;
    const when =
      t.kind === 'left'
        ? `~${humanDuration(t.endsAt - now)} left`
        : t.kind === 'estimate'
          ? `~${humanDuration(t.ms)}`
          : "time's up";
    out.push(`Task ${truncate(plan.task.title)}: ${when}`);
  }
  if (plan.block) {
    out.push(
      `Event ${truncate(plan.block.title)}: ~${humanDuration(plan.block.endsAt - now)} left`,
    );
  }
  return out;
}

export function taskCheckText(title: string): string {
  return `Time's up for ${truncate(title)}. Done?`;
}

/** Minutes typed into the "Done?" box, as ms; null for junk, zero or over 8h 30m (510 min). */
export function parseMinutes(input: string): number | null {
  const n = Number(input.trim());
  if (input.trim() === '' || !Number.isFinite(n) || n <= 0 || n > 510) return null;
  return Math.round(n) * 60_000 || null;
}
