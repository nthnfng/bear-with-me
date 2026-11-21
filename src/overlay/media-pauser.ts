// Media pause: pauses every video/audio (incl. ones added later and ones in open shadow
// roots) and re-pauses on any restart, reporting each restart. Never resumes media.

export interface MediaPauserOptions {
  reportUnpause(): void;
}

const EVENTS = ['play', 'playing'] as const;

export function createMediaPauser(opts: MediaPauserOptions) {
  let active = false;
  let observer: MutationObserver | null = null;
  let scanQueued = false;
  const roots = new Set<Document | ShadowRoot>();

  const onPlay = (e: Event) => {
    const el = e.target;
    if (!(el instanceof HTMLMediaElement) || el.paused) return;
    el.pause();
    opts.reportUnpause();
  };

  function watchRoot(root: Document | ShadowRoot) {
    if (roots.has(root)) return;
    roots.add(root);
    for (const ev of EVENTS) root.addEventListener(ev, onPlay, true);
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
      for (const root of roots) for (const ev of EVENTS) root.removeEventListener(ev, onPlay, true);
      roots.clear();
      // Deliberately no auto-resume.
    }
  }

  return { set };
}
