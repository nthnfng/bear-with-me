import { storage } from 'wxt/utils/storage';
import {
  STORAGE_KEYS,
  type BackgroundMessage,
  type ContentMessage,
  type Settings,
} from '@/src/contracts';
import { mountOverlay } from '@/src/overlay';
import { startPicker, stopActivePicker } from '@/src/picker';
import { startTodoReader } from '@/src/picker/reader';

export default defineContentScript({
  matches: ['<all_urls>'],
  // Todo lists often live in iframes (Brightspace); the reader and picker run in every frame.
  allFrames: true,
  // document_start so the input eater's capture listeners are registered before the page's own
  // (YouTube's key handlers); same-target capture listeners fire in registration order. The
  // reader waits for the DOM below. One script (not a tiny early one + the overlay) keeps the
  // runtime's inject-into-existing-tabs path a single file.
  runAt: 'document_start',
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
    let reader: ReturnType<typeof startTodoReader> | null = null;
    let torndown = false;
    const startReader = () => {
      if (!torndown) reader = startTodoReader(send);
    };
    if (document.readyState === 'loading')
      document.addEventListener('DOMContentLoaded', startReader, { once: true });
    else startReader();
    document.addEventListener(
      TAKEOVER,
      () => {
        overlay?.destroy();
        torndown = true;
        reader?.destroy();
      },
      { once: true },
    );

    browser.runtime.onMessage.addListener((msg: BackgroundMessage) => {
      if (msg.type === 'view') overlay?.render(msg.view);
      if (msg.type === 'effect') overlay?.playEffect(msg.effect);
      if (msg.type === 'startPicker')
        startPicker({ send, onSaved: (source) => reader?.captureNow(source) });
    });

    // A source saved in another frame ends this frame's picker too. Only a NEW source counts:
    // other settings writes (e.g. removing an old source just before re-picking) must not
    // cancel the picker the user is about to click with.
    const unwatch = storage.watch<Settings>(STORAGE_KEYS.settings, (next, prev) => {
      const before = new Set((prev?.todoSources ?? []).map((s) => s.id));
      if ((next?.todoSources ?? []).some((s) => !before.has(s.id))) stopActivePicker();
    });
    document.addEventListener(TAKEOVER, unwatch, { once: true });

    if (isTop) send({ type: 'hello' });
  },
});
