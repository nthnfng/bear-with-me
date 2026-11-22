// Dev harness: chrome-extension://<id>/harness.html. Feeds fixture views into the overlay
// and logs every ContentMessage it would send. Not part of Barry's behaviour.

import { browser } from 'wxt/browser';
import type { ContentMessage, TabView } from '@/src/contracts';

import { POSE_ROWS, fixtureViews } from '@/src/dev/fixtures';
import { mountOverlay } from '@/src/overlay';
import { TASK_DEFAULT_ESTIMATE_MS } from '@/src/contracts';
import type { Task } from '@/src/contracts';

const DEMO_TASK: Task = {
  id: 'demo',
  title: 'Write lab report',
  description: '',
  estimateMs: TASK_DEFAULT_ESTIMATE_MS,
  done: false,
  doneAt: null,
};

const log = document.getElementById('log')!;
const send = (msg: ContentMessage) => {
  harnessReacts(msg);
  const line = document.createElement('div');
  line.textContent = `${new Date().toLocaleTimeString()} ${JSON.stringify(msg)}`;
  log.appendChild(line);
  log.scrollTop = log.scrollHeight;
};
document.getElementById('clear')!.onclick = (e) => {
  e.preventDefault();
  log.textContent = '';
};

const overlay = mountOverlay({
  send,
  exempt: (e) => !!(e.target as Element | null)?.closest?.('#panel'),
});

const views = fixtureViews(Date.now());
const select = document.getElementById('views') as HTMLSelectElement;
for (const name of Object.keys(views)) select.add(new Option(name, name));
let currentName = 'hidden';
const show = () => {
  currentName = select.value;
  eats = Math.max(0, TIERS.indexOf(currentName));
  overlay.render(fixtureViews(Date.now())[select.value]!);
};
select.onchange = show;
select.value = 'hidden';

// One button per row of the pose map, grouped like the demo's panel.
const posesEl = document.getElementById('poses')!;
let group = '';
for (const row of POSE_ROWS) {
  if (row.group !== group) {
    group = row.group;
    const h = document.createElement('div');
    h.className = 'grp';
    h.textContent = group;
    posesEl.appendChild(h);
  }
  const b = document.createElement('button');
  b.textContent = row.label;
  b.onclick = () => {
    timers.splice(0).forEach(clearTimeout);
    eats = Math.max(0, TIERS.indexOf(row.view));
    select.value = currentName = row.view;
    overlay.render(fixtureViews(Date.now())[row.view]!);
    if (row.effect === 'explodeAndClose') overlay.playEffect({ type: 'explodeAndClose', tabIds: [0] });
    if (row.effect === 'showSuggestion')
      overlay.playEffect({
        type: 'showSuggestion',
        tabId: 0,
        freeMinutes: 40,
        task: DEMO_TASK,
      });
  };
  posesEl.appendChild(b);
}

// The harness plays the brain's part for a few messages, so clicking the real UI works.
let eats = 0;
const TIERS = ['confrontation', 'confrontation1', 'confrontation2', 'confrontation3', 'confrontation4', 'confrontation5'];
function harnessReacts(msg: ContentMessage) {
  if (msg.type === 'eaten' && TIERS.includes(currentName)) {
    eats = Math.min(eats + 1, 5);
    const name = TIERS[eats]!;
    currentName = select.value = name;
    setTimeout(() => overlay.render(fixtureViews(Date.now())[name]!), 30);
  }
  if (msg.type === 'backToIt') overlay.playEffect({ type: 'explodeAndClose', tabIds: [0] });
  if (msg.type === 'gotUp') {
    setTimeout(() => renderNow('happy'), 0);
  }
  if (msg.type === 'pushed') setTimeout(() => doPush(), 0);
}

// Arm fight controls. Harness-only state; the real brain owns this in the extension.
let fightPushes = 5;
const timers: number[] = [];
const num = (id: string) => Number((document.getElementById(id) as HTMLInputElement).value);
const tabSlot = () =>
  (document.getElementById('tabnull') as HTMLInputElement).checked
    ? null
    : { index: num('tabindex'), count: num('tabcount'), pinned: num('tabpinned') };
const renderNow = (name: string, patch: Partial<TabView> = {}) => {
  currentName = name;
  overlay.render({ ...fixtureViews(Date.now())[name]!, ...(name.startsWith('reach') || name === 'reaching' ? { tabSlot: tabSlot() } : {}), ...patch });
};
function doPush() {
  // The brain restarts the Reach with a new shared start time on each Push.
  fightPushes = Math.max(0, fightPushes - 1);
  overlay.playEffect({ type: 'playSound', tabId: 0, sound: 'punch' });
  if (fightPushes === 0) {
    overlay.playEffect({ type: 'playSound', tabId: 0, sound: 'ow' });
    renderNow('knockedDown');
    // The brain's Snooze stages: down, getting up, ow, hurts, tired.
    const at = (ms: number, name: string) => timers.push(window.setTimeout(() => renderNow(name), ms));
    at(5000, 'gettingUp');
    at(5600, 'ow');
    at(6600, 'armHurts');
    at(8800, 'tired');
  } else renderNow(currentName === 'reachingChud' ? 'reachingChud' : 'reaching', { pushesLeft: fightPushes });
}
document.querySelectorAll<HTMLElement>('[data-fight]').forEach((b) => {
  b.onclick = () => {
    timers.splice(0).forEach(clearTimeout);
    const f = b.dataset.fight;
    if (f === 'reach') {
      fightPushes = 5;
      renderNow('reaching', { pushesLeft: fightPushes });
    }
    if (f === 'push') doPush();
    if (f === 'snooze') renderNow('knockedDown');
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

// Tasks: suggestion bubble, "Done?" bubble, chud arrival.
document.getElementById('suggest')!.onclick = () => {
  renderNow('chill');
  overlay.playEffect({ type: 'showSuggestion', tabId: 0, freeMinutes: 40, task: DEMO_TASK });
};
document.getElementById('taskcheck')!.onclick = () => {
  overlay.render({
    ...fixtureViews(Date.now()).chill!,
    taskCheck: { id: DEMO_TASK.id, title: DEMO_TASK.title },
  });
};
// The song starts once per arrival; pressing again while it plays must not restart it.
document.getElementById('chudsong')!.onclick = () => {
  renderNow('chudPoint');
  overlay.playEffect({ type: 'playSound', tabId: 0, sound: 'chudSong' });
};
