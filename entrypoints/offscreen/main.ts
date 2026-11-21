// Offscreen document that plays Barry's sounds. A web page Barry just burst onto usually has no
// user gesture yet, so Chrome's autoplay policy blocks audio there; an extension's offscreen
// document (reason AUDIO_PLAYBACK) isn't blocked. The brain has already applied Muted.
import type { AssetManifest } from '@/src/contracts';
import manifestJson from '@/public/assets/manifest.json';
import { isOffscreenSound } from '@/src/runtime/offscreen';

const manifest = manifestJson as unknown as AssetManifest;
let chudAudio: HTMLAudioElement | null = null;

const url = (file: string) => browser.runtime.getURL(`/assets/${file}` as never);

browser.runtime.onMessage.addListener((msg: unknown) => {
  if (!isOffscreenSound(msg)) return;
  const variants = manifest.sounds[msg.sound];
  const file = variants[Math.floor(Math.random() * variants.length)]!;
  if (msg.sound === 'chudSong') {
    // Already singing: keep it going, never restart.
    if (chudAudio && !chudAudio.ended) return;
    chudAudio = new Audio(url(file));
    void chudAudio.play().catch(() => {});
    return;
  }
  void new Audio(url(file)).play().catch(() => {});
});
