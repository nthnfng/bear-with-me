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

export function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}
