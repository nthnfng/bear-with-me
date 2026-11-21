import type { BackgroundMessage, ContentMessage } from '@/src/contracts';
import { mountOverlay } from '@/src/overlay';
import { startPicker } from '@/src/picker';

export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_idle',
  main() {
    const overlay = mountOverlay();

    browser.runtime.onMessage.addListener((msg: BackgroundMessage) => {
      if (msg.type === 'view') overlay.render(msg.view);
      if (msg.type === 'startPicker') startPicker();
      // TODO(WS-D): msg.type === 'effect' (explosion, sounds, suggestions)
    });

    const hello: ContentMessage = { type: 'hello' };
    browser.runtime.sendMessage(hello).catch(() => {
      // Background not ready yet; it re-sends views on its own after waking.
    });
  },
});
