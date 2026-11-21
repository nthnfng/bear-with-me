// Media pause: pauses every video/audio (incl. ones added later and ones in open shadow
// roots) and re-pauses on any restart, reporting each restart. Never resumes media.

export interface MediaPauserOptions {
  reportUnpause(): void;
}

const EVENTS = ['play', 'playing'] as const;
// loadstart/emptied: the element got a new source (next video, autoplay playlist).
const LOAD_EVENTS = ['loadstart', 'emptied'] as const;

/** A play within this long of a new source is autoplay/next-video, never the user. */
export const FRESH_SOURCE_MS = 1500;
export const MUTE_AFTER_REPAUSES = 3;
export const MUTE_WINDOW_MS = 2000;

/**
 * Only a play the user plausibly caused counts as an eaten unpause. Autoplay has no user
 * activation, and a next video starts right after a source change. Media keys also count as
 * not user-caused here: they are re-paused but not reported (fewer false Fatness gains).
 */
export function isUserCausedPlay(p: { userActive: boolean; sinceSourceMs: number }): boolean {
  return p.userActive && p.sinceSourceMs > FRESH_SOURCE_MS;
}

/** True when a video keeps playing despite re-pauses: `count` of them within `windowMs`. */
export function createRepauseCounter(count = MUTE_AFTER_REPAUSES, windowMs = MUTE_WINDOW_MS) {
  let times: number[] = [];
  return {
    record(now: number): boolean {
      times = times.filter((t) => now - t <= windowMs);
      times.push(now);
      return times.length >= count;
    },
    reset() {
      times = [];
    },
  };
}

export function createMediaPauser(opts: MediaPauserOptions) {
  let active = false;
  let observer: MutationObserver | null = null;
  let scanQueued = false;
  const roots = new Set<Document | ShadowRoot>();
  const sourceAt = new WeakMap<HTMLMediaElement, number>();
  const counters = new WeakMap<HTMLMediaElement, ReturnType<typeof createRepauseCounter>>();
  /** Elements we muted as a fallback, with the user's own muted state to restore. */
  const mutedByUs = new Map<HTMLMediaElement, boolean>();

  const onLoad = (e: Event) => {
    if (e.target instanceof HTMLMediaElement) sourceAt.set(e.target, Date.now());
  };

  const onPlay = (e: Event) => {
    const el = e.target;
    if (!(el instanceof HTMLMediaElement) || el.paused) return;
    el.pause();
    const now = Date.now();
    if (
      isUserCausedPlay({
        userActive: navigator.userActivation?.isActive ?? true,
        sinceSourceMs: now - (sourceAt.get(el) ?? 0),
      })
    )
      opts.reportUnpause();
    // Backup: a video that fights the pause gets muted until pauseMedia ends.
    let c = counters.get(el);
    if (!c) counters.set(el, (c = createRepauseCounter()));
    if (c.record(now) && !mutedByUs.has(el)) {
      mutedByUs.set(el, el.muted);
      el.muted = true;
    }
  };

  function watchRoot(root: Document | ShadowRoot) {
    if (roots.has(root)) return;
    roots.add(root);
    for (const ev of EVENTS) root.addEventListener(ev, onPlay, true);
    for (const ev of LOAD_EVENTS) root.addEventListener(ev, onLoad, true);
    observer?.observe(root, { childList: true, subtree: true });
  }

  function scan(root: Document | ShadowRoot = document) {
    watchRoot(root);
    root.querySelectorAll('video, audio').forEach((el) => {
      const m = el as HTMLMediaElement;
      if (!m.paused) m.pause();
    });
    // Open shadow roots (closed ones are unreachable).
    root.querySelectorAll('*').forEach((el) => {
      if (el.shadowRoot) scan(el.shadowRoot);
    });
  }

  function queueScan() {
    if (scanQueued) return;
    scanQueued = true;
    // Batched: YouTube mutates the DOM constantly and a full scan walks every element.
    setTimeout(() => {
      scanQueued = false;
      if (active) scan();
    }, 400);
  }

  function set(on: boolean) {
    if (on === active) return;
    active = on;
    if (on) {
      observer = new MutationObserver(queueScan);
      scan();
    } else {
      observer?.disconnect();
      observer = null;
      for (const root of roots) {
        for (const ev of EVENTS) root.removeEventListener(ev, onPlay, true);
        for (const ev of LOAD_EVENTS) root.removeEventListener(ev, onLoad, true);
      }
      roots.clear();
      for (const [el, wasMuted] of mutedByUs) el.muted = wasMuted;
      mutedByUs.clear();
      // Deliberately no auto-resume.
    }
  }

  return { set };
}
