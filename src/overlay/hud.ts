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
 * The lines under the Confrontation line: the Task first ("★ Lab report · 32m left"), then the
 * calendar block ("📅 ETF prep · until 6:00 PM"). `clock` formats a time of day.
 */
export function planLines(
  plan: PlanView | null,
  now: number,
  clock: (ms: number) => string = (ms) =>
    new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
): string[] {
  if (!plan) return [];
  const out: string[] = [];
  if (plan.task) {
    const t = plan.task.timing;
    const when =
      t.kind === 'left'
        ? `${formatMinutes(t.endsAt - now)} left`
        : t.kind === 'estimate'
          ? `~${formatMinutes(t.ms)}`
          : "time's up";
    out.push(`★ ${truncate(plan.task.title)} · ${when}`);
  }
  if (plan.block) out.push(`📅 ${truncate(plan.block.title)} · until ${clock(plan.block.endsAt)}`);
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
