// MAIN-world twin of the input eater. Chrome does not let an isolated-world capture listener
// run ahead of page listeners reliably (e2e: a page's window capture keydown handler, registered
// later, still ran first). A MAIN-world script at document_start registers before any page
// script, so YouTube's key shortcuts cannot beat it. It decides nothing: it eats only while the
// overlay's flag attribute is on, and reports through a DOM event the overlay listens for.
import { EATEN_EVENT, EAT_FLAG, LISTENERS } from '@/src/overlay/input-eater';
import { shouldEatKey } from '@/src/overlay/keys';

export default defineContentScript({
  matches: ['<all_urls>'],
  allFrames: true,
  runAt: 'document_start',
  world: 'MAIN',
  main() {
    const root = document.documentElement;
    for (const [type, , kind] of LISTENERS) {
      window.addEventListener(
        type,
        (e: Event) => {
          if (!root.hasAttribute(EAT_FLAG)) return;
          if (e.composedPath().some((n) => n instanceof Element && n.hasAttribute('data-barry')))
            return;
          if (e instanceof KeyboardEvent && !shouldEatKey(e)) return;
          e.preventDefault();
          e.stopImmediatePropagation();
          document.dispatchEvent(new CustomEvent(EATEN_EVENT, { detail: kind }));
        },
        { capture: true, passive: false },
      );
    }
  },
});
