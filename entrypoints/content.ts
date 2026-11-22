import type { BackgroundMessage, ContentMessage } from '@/src/contracts';
import { mountOverlay } from '@/src/overlay';

export default defineContentScript({
  matches: ['<all_urls>'],
  // Barry draws only in the top frame.
  allFrames: false,
  // document_start so the input eater's capture listeners are registered before the page's own
  // (YouTube's key handlers); same-target capture listeners fire in registration order. One
  // script (not a tiny early one + the overlay) keeps the runtime's inject-into-existing-tabs
  // path a single file.
  runAt: 'document_start',
  main() {
    if (window !== window.top) return; // only the top frame draws Barry
    const send = (msg: ContentMessage) => {
      browser.runtime.sendMessage(msg).catch(() => {
        // Background not ready yet; it re-sends views on its own after waking.
      });
    };
    // After an extension reload, the previous content script is orphaned but its listeners
    // (input eater, media pause) keep running. Tell it to tear down, then claim the page.
    const TAKEOVER = 'barry:takeover';
    document.dispatchEvent(new CustomEvent(TAKEOVER));
    const overlay = mountOverlay({ send });
    document.addEventListener(
      TAKEOVER,
      () => {
        overlay.destroy();
      },
      { once: true },
    );

    browser.runtime.onMessage.addListener((msg: BackgroundMessage) => {
      if (msg.type === 'view') overlay.render(msg.view);
      if (msg.type === 'effect') overlay.playEffect(msg.effect);
    });

    send({ type: 'hello' });
  },
});
