// Pure text helpers for the small widgets near Barry. DOM-free.

export function formatCountdown(remainingMs: number): string {
  const total = Math.max(0, Math.ceil(remainingMs / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function pushesLabel(n: number): string {
  return n === 1 ? '1 push left' : `${n} pushes left`;
}

export const SUGGESTION_MS = 4_000;

export function suggestionText(freeMinutes: number | null, todo: string): string {
  if (freeMinutes === null) return `You're free right now. How about: ${todo}?`;
  const n = Math.max(1, Math.round(freeMinutes));
  if (n >= 120) {
    const h = Math.round(n / 60);
    return `You've got ${h} free hours. How about: ${todo}?`;
  }
  return `You've got ${n} free minute${n === 1 ? '' : 's'}. How about: ${todo}?`;
}
