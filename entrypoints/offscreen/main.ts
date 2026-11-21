// Offscreen document that plays Barry's sounds. A web page Barry just burst onto usually has no
// user gesture yet, so Chrome's autoplay policy blocks audio there; an extension's offscreen
// document (reason AUDIO_PLAYBACK) isn't blocked. The brain has already applied Muted.
//
// Short sounds are fetched and decoded once when the document opens and played through Web
// Audio, so a click's chomp starts at once instead of after loading an <audio> element.
import type { AssetManifest, SoundId } from '@/src/contracts';
import manifestJson from '@/public/assets/manifest.json';
import { isOffscreenSound, isOffscreenStop } from '@/src/runtime/offscreen';

const manifest = manifestJson as unknown as AssetManifest;
let chudAudio: HTMLAudioElement | null = null;

const url = (file: string) => browser.runtime.getURL(`/assets/${file}` as never);

const ctx = new AudioContext({ latencyHint: 'interactive' });
const buffers = new Map<string, Promise<AudioBuffer | null>>();

function decode(file: string): Promise<AudioBuffer | null> {
  let p = buffers.get(file);
  if (!p) {
    p = fetch(url(file))
      .then((r) => r.arrayBuffer())
      .then((b) => ctx.decodeAudioData(b))
      .catch(() => null);
    buffers.set(file, p);
  }
  return p;
}

// Decode every short sound up front; the chud song is long and streams from an <audio>.
for (const [id, files] of Object.entries(manifest.sounds) as [SoundId, string[]][]) {
  if (id !== 'chudSong') files.forEach((f) => void decode(f));
}

async function play(file: string) {
  const buffer = await decode(file);
  if (!buffer) {
    void new Audio(url(file)).play().catch(() => {});
    return;
  }
  if (ctx.state === 'suspended') await ctx.resume().catch(() => {});
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.connect(ctx.destination);
  src.start();
}

browser.runtime.onMessage.addListener((msg: unknown) => {
  if (isOffscreenStop(msg)) {
    chudAudio?.pause();
    chudAudio = null;
    return;
  }
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
  void play(file);
});
