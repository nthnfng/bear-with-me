import { storage } from 'wxt/utils/storage';
import { STORAGE_KEYS, type BackgroundMessage, type ContentMessage } from '@/src/contracts';
import { mountOverlay } from '@/src/overlay';
import { startPicker, stopActivePicker } from '@/src/picker';
import { startTodoReader } from '@/src/picker/reader';

export default defineContentScript({
  matches: ['<all_urls>'],
  // Todo lists often live in iframes (Brightspace); the reader and picker run in every frame.
  allFrames: true,
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
    const isTop = window === window.top;
    // Only the top frame draws Barry; subframes just read lists and run the picker.
    const overlay = isTop ? mountOverlay({ send }) : null;
    const reader = startTodoReader(send);
    document.addEventListener(
      TAKEOVER,
      () => {
        overlay?.destroy();
        reader.destroy();
      },
      { once: true },
    );

    browser.runtime.onMessage.addListener((msg: BackgroundMessage) => {
      if (msg.type === 'view') overlay?.render(msg.view);
      if (msg.type === 'effect') overlay?.playEffect(msg.effect);
      if (msg.type === 'startPicker')
        startPicker({ send, onSaved: (source) => reader.captureNow(source) });
    });

    // A source saved in another frame ends this frame's picker too.
    const unwatch = storage.watch(STORAGE_KEYS.settings, () => stopActivePicker());
    document.addEventListener(TAKEOVER, unwatch, { once: true });

    if (isTop) send({ type: 'hello' });
  },
});
