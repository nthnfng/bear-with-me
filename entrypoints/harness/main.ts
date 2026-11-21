// Dev harness: chrome-extension://<id>/harness.html. Feeds fixture views into the overlay
// and logs every ContentMessage it would send. Not part of Barry's behaviour.

import { browser } from 'wxt/browser';
import type { ContentMessage, TabView } from '@/src/contracts';
import { fixtureViews } from '@/src/dev/fixtures';
import { mountOverlay } from '@/src/overlay';
import { startPicker } from '@/src/picker';
import { readSource } from '@/src/picker/reader';

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

// Arm fight controls. Harness-only state; the real brain owns this in the extension.
let fightPushes = 5;
const timers: number[] = [];
const num = (id: string) => Number((document.getElementById(id) as HTMLInputElement).value);
const tabSlot = () =>
  (document.getElementById('tabnull') as HTMLInputElement).checked
    ? null
    : { index: num('tabindex'), count: num('tabcount'), pinned: num('tabpinned') };
const renderNow = (name: string, patch: Partial<TabView> = {}) =>
  overlay.render({ ...fixtureViews(Date.now())[name]!, ...(name.startsWith('reach') || name === 'reaching' ? { tabSlot: tabSlot() } : {}), ...patch });
document.querySelectorAll<HTMLElement>('[data-fight]').forEach((b) => {
  b.onclick = () => {
    timers.splice(0).forEach(clearTimeout);
    const f = b.dataset.fight;
    if (f === 'reach') {
      fightPushes = 5;
      renderNow('reaching', { pushesLeft: fightPushes });
    }
    if (f === 'push') {
      // The brain restarts the Reach with a new shared start time on each Push.
      fightPushes = Math.max(0, fightPushes - 1);
      overlay.playEffect({ type: 'playSound', tabId: 0, sound: 'punch' });
      if (fightPushes === 0) {
        overlay.playEffect({ type: 'playSound', tabId: 0, sound: 'ow' });
        renderNow('snoozing');
      } else renderNow('reaching', { pushesLeft: fightPushes });
    }
    if (f === 'snooze') renderNow('snoozing');
    if (f === 'okay') {
      renderNow('confrontation');
      timers.push(window.setTimeout(() => renderNow('slackPassStarting'), 1200));
    }
  };
});

document.querySelectorAll<HTMLElement>('[data-effect]').forEach((b) => {
  b.onclick = () => {
    const e = b.dataset.effect;
    if (e === 'chomp') overlay.playEffect({ type: 'playSound', tabId: 0, sound: 'chomp' });
    if (e === 'punch') overlay.playEffect({ type: 'playSound', tabId: 0, sound: 'punch' });
    if (e === 'ow') overlay.playEffect({ type: 'playSound', tabId: 0, sound: 'ow' });
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

// Todos: suggestion bubble, picker (on the demo list in the panel or the page), chud arrival.
document.getElementById('suggest')!.onclick = () => {
  renderNow('chill');
  overlay.playEffect({
    type: 'showSuggestion',
    tabId: 0,
    freeMinutes: 40,
    todo: { text: 'Write lab report', sourceId: 'demo' },
  });
};
document.getElementById('picker')!.onclick = () =>
  startPicker({
    send,
    onSaved: (source) =>
      send({ type: 'todosCaptured', sourceId: source.id, items: readSource(source) }),
  });
// The song starts once per arrival; pressing again while it plays must not restart it.
document.getElementById('chudsong')!.onclick = () => {
  renderNow('chudFull');
  overlay.playEffect({ type: 'playSound', tabId: 0, sound: 'chudSong' });
};
