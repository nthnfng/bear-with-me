// Pure rate limiter: rendering-side only (so one scroll gesture is one chomp, not fifty).

/** Returns a gate: call it per event; true = let this one through, false = drop it. */
export function createThrottle(ms: number, now: () => number = Date.now): () => boolean {
  let last = -Infinity;
  return () => {
    const t = now();
    if (t - last < ms) return false;
    last = t;
    return true;
  };
}
