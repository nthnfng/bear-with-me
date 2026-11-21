// Sounds play from an offscreen document, not the page: Chrome blocks autoplay on a page the
// user hasn't clicked yet (a Restricted tab they just opened), but not in an extension's
// offscreen document.
import { browser } from 'wxt/browser';
import { SOUNDS, type SoundId } from '../contracts';

const OFFSCREEN_PATH = '/offscreen.html';
const TARGET = 'barry-offscreen';

export interface OffscreenSound {
  target: typeof TARGET;
  sound: SoundId;
}

export function isOffscreenSound(msg: unknown): msg is OffscreenSound {
  const m = msg as Partial<OffscreenSound> | null;
  return (
    !!m && m.target === TARGET && (SOUNDS as readonly string[]).includes(m.sound as string)
  );
}

let creating: Promise<void> | null = null;

async function ensureOffscreen(): Promise<void> {
  const contexts = await browser.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT' as never],
    documentUrls: [browser.runtime.getURL(OFFSCREEN_PATH as never)],
  });
  if (contexts.length > 0) return;
  creating ??= browser.offscreen
    .createDocument({
      url: OFFSCREEN_PATH,
      reasons: ['AUDIO_PLAYBACK' as never],
      justification: "Play Barry's sounds on pages that haven't been clicked yet",
    })
    .catch(() => {
      // Another call created it first.
    })
    .finally(() => {
      creating = null;
    });
  await creating;
}

export async function playSoundOffscreen(sound: SoundId): Promise<void> {
  try {
    await ensureOffscreen();
    const msg: OffscreenSound = { target: TARGET, sound };
    await browser.runtime.sendMessage(msg);
  } catch {
    // No offscreen support: stay silent rather than break the event loop.
  }
}
