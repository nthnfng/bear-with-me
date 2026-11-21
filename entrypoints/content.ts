import type { BackgroundMessage, ContentMessage } from '@/src/contracts';
import { mountOverlay } from '@/src/overlay';
import { startPicker } from '@/src/picker';

export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_idle',
  main() {
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
    document.addEventListener(TAKEOVER, () => overlay.destroy(), { once: true });

    browser.runtime.onMessage.addListener((msg: BackgroundMessage) => {
      if (msg.type === 'view') overlay.render(msg.view);
      if (msg.type === 'effect') overlay.playEffect(msg.effect);
      if (msg.type === 'startPicker') startPicker();
    });

    send({ type: 'hello' });
  },
});
