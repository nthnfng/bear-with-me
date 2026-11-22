// Pure text helpers for the small widgets near Barry. DOM-free.


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

export function taskCheckText(title: string): string {
  return `Time's up for ${truncate(title)}. Done?`;
}

/** Minutes typed into the "Done?" box, as ms; null for junk, zero or over 8h 30m (510 min). */
export function parseMinutes(input: string): number | null {
  const n = Number(input.trim());
  if (input.trim() === '' || !Number.isFinite(n) || n <= 0 || n > 510) return null;
  return Math.round(n) * 60_000 || null;
}
