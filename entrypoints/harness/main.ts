// Dev harness: chrome-extension://<id>/harness.html. Feeds fixture views into the overlay
// and logs every ContentMessage it would send. Not part of Barry's behaviour.

import { browser } from 'wxt/browser';
import type { ContentMessage } from '@/src/contracts';
import { fixtureViews } from '@/src/dev/fixtures';
import { mountOverlay } from '@/src/overlay';

const log = document.getElementById('log')!;
const send = (msg: ContentMessage) => {
  const line = document.createElement('div');
  line.textContent = `${new Date().toLocaleTimeString()} ${JSON.stringify(msg)}`;
  log.appendChild(line);
  log.scrollTop = log.scrollHeight;
};
document.getElementById('clear')!.onclick = (e) => {
  e.preventDefault();
  log.textContent = '';
};

const overlay = mountOverlay({ send });

const views = fixtureViews(Date.now());
const select = document.getElementById('views') as HTMLSelectElement;
for (const name of Object.keys(views)) select.add(new Option(name, name));
const show = () => overlay.render(fixtureViews(Date.now())[select.value]!);
select.onchange = show;
select.value = 'hidden';

document.querySelectorAll<HTMLElement>('[data-effect]').forEach((b) => {
  b.onclick = () => {
    const e = b.dataset.effect;
    if (e === 'chomp') overlay.playEffect({ type: 'playSound', tabId: 0, sound: 'chomp' });
    if (e === 'burst') overlay.playEffect({ type: 'playSound', tabId: 0, sound: 'burst' });
    if (e === 'explosion') overlay.playEffect({ type: 'explodeAndClose', tabIds: [0] });
  };
});

// Page content to exercise the eater and media pause.
document.querySelectorAll('.logbtn').forEach((b) =>
  b.addEventListener('click', (e) => {
    e.preventDefault();
    send({ type: 'hello' }); // placeholder: shows the PAGE received the click
    log.lastElementChild!.textContent += '  <- PAGE got a click (Barry did not eat it)';
  }),
);
const filler = document.getElementById('filler')!;
for (let i = 0; i < 80; i++)
  filler.insertAdjacentHTML('beforeend', `<p>Scrolling filler paragraph ${i + 1}.</p>`);

// Playable media with no external files: a canvas stream recorded would be heavy, so use a
// 1s silent WAV for <audio> and a MediaStream-free <video> pointing at the same loop source.
function silentWav(): string {
  const sr = 8000,
    n = sr,
    buf = new ArrayBuffer(44 + n),
    v = new DataView(buf);
  const w = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  w(0, 'RIFF');
  v.setUint32(4, 36 + n, true);
  w(8, 'WAVEfmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, sr, true);
  v.setUint32(28, sr, true);
  v.setUint16(32, 1, true);
  v.setUint16(34, 8, true);
  w(36, 'data');
  v.setUint32(40, n, true);
  new Uint8Array(buf, 44).fill(128);
  return URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
}
const audio = document.getElementById('audio') as HTMLAudioElement;
audio.src = browser.runtime.getURL('/assets/sounds/im-a-chud.mp3' as never);
const video = document.getElementById('video') as HTMLVideoElement;
video.src = silentWav(); // an audio-only source still exercises play/pause on a <video>
video.autoplay = true;
document.getElementById('addvideo')!.onclick = () => {
  const v = document.createElement('video');
  v.controls = true;
  v.loop = true;
  v.width = 200;
  v.src = silentWav();
  document.querySelector('main')!.insertBefore(v, filler);
  v.play().catch(() => {});
};
