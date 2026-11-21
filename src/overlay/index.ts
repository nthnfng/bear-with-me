// Page overlay. Draws the TabView it's given and reports user input. No behaviour here:
// see docs/adr/0001-pure-brain-dumb-renderers.md.

import { browser } from 'wxt/browser';
import type { AssetManifest, BarryEffect, ContentMessage, SoundId, TabView } from '../contracts';
import manifestJson from '../../public/assets/manifest.json';
import { anchorToViewport, armVector, createLandingGate, reachProgress, reachTarget } from './arm';
import { SUGGESTION_MS, clamp01, formatCountdown, pushesLabel, suggestionText } from './hud';
import { createInputEater } from './input-eater';
import { createMediaPauser } from './media-pauser';
import { isMacPlatform, tabViewportX } from './tabstrip';
import { CSS } from './styles';

export interface Overlay {
  render(view: TabView): void;
  playEffect(effect: BarryEffect): void;
  destroy(): void;
}

export interface OverlayOptions {
  /** Sends a message to the background (the harness fakes this). */
  send(msg: ContentMessage): void;
  /** Resolves a path relative to public/assets/ to a URL. */
  assetUrl?(path: string): string;
  manifest?: AssetManifest;
}

// Display text only, for when sound is blocked by autoplay policy.
const SOUND_FLASH: Record<SoundId, string> = {
  chomp: 'CHOMP!',
  punch: 'POW!',
  ow: 'OW!',
  chudSong: '♪',
  burst: 'RAAAH!',
};

const CORNER_PX = 150;
const FACE_PX = 360;

export function mountOverlay(opts: OverlayOptions): Overlay {
  const manifest = opts.manifest ?? (manifestJson as unknown as AssetManifest);
  const assetUrl =
    opts.assetUrl ?? ((p: string) => browser.runtime.getURL(`/assets/${p}` as never));
  const { send } = opts;

  const host = document.createElement('div');
  host.setAttribute('data-barry', '');
  const shadow = host.attachShadow({ mode: 'closed' });
  shadow.innerHTML = `<style>${CSS}</style>
    <div class="root" hidden>
      <div class="arm" hidden><div class="armbody"></div><div class="fist"></div></div>
      <div class="barry corner right">
        <div class="suggest" hidden><span class="suggesttext"></span><button class="x" aria-label="Dismiss">×</button></div>
        <div class="bubble" hidden></div>
        <div class="hud">
          <div class="pill pushes" hidden></div>
          <div class="pill countdown" hidden></div>
          <div class="meter" hidden><div class="meterfill"></div></div>
        </div>
        <div class="sprite"></div>
        <button class="btn" hidden>Back to it?</button>
      </div>
    </div>`;
  const root = shadow.querySelector('.root') as HTMLElement;
  const barry = shadow.querySelector('.barry') as HTMLElement;
  const bubble = shadow.querySelector('.bubble') as HTMLElement;
  const sprite = shadow.querySelector('.sprite') as HTMLElement;
  const button = shadow.querySelector('.btn') as HTMLButtonElement;
  const arm = shadow.querySelector('.arm') as HTMLElement;
  const armBody = shadow.querySelector('.armbody') as HTMLElement;
  const fist = shadow.querySelector('.fist') as HTMLElement;
  const pushesEl = shadow.querySelector('.pushes') as HTMLElement;
  const countdownEl = shadow.querySelector('.countdown') as HTMLElement;
  const meterEl = shadow.querySelector('.meter') as HTMLElement;
  const meterFill = shadow.querySelector('.meterfill') as HTMLElement;
  const suggestEl = shadow.querySelector('.suggest') as HTMLElement;
  const suggestText = shadow.querySelector('.suggesttext') as HTMLElement;
  button.addEventListener('click', () => send({ type: 'backToIt' }));
  document.documentElement.appendChild(host);

  // Events from our own UI (the button) must never be eaten. The shadow root is closed, so
  // from outside the path only shows the host; the host itself has pointer-events: none and
  // only the button and the explosion backdrop can be hit.
  const isOwn = (e: Event) => e.composedPath().includes(host);

  const eater = createInputEater({
    report: (kind) => send({ type: 'eaten', kind }),
    isOwn,
  });
  const media = createMediaPauser({
    reportUnpause: () => send({ type: 'eaten', kind: 'unpause' }),
  });

  // Suggestion bubble (chill Barry). Dismissible, auto-hides.
  let suggestion: string | null = null;
  let suggestTimer: ReturnType<typeof setTimeout> | undefined;
  function hideSuggestion() {
    suggestion = null;
    if (suggestTimer) clearTimeout(suggestTimer);
    suggestTimer = undefined;
    suggestEl.hidden = true;
  }
  (suggestEl.querySelector('.x') as HTMLElement).addEventListener('click', (e) => {
    e.stopPropagation();
    hideSuggestion();
  });
  function showSuggestion(text: string) {
    suggestion = text;
    suggestText.textContent = text;
    suggestEl.hidden = !(current?.visible ?? false);
    if (suggestTimer) clearTimeout(suggestTimer);
    suggestTimer = setTimeout(hideSuggestion, SUGGESTION_MS);
  }

  // Chud song: started by a playSound effect once per arrival; it outlives view changes and tab switches.
  let chudAudio: HTMLAudioElement | null = null;

  let spriteKey = '';
  let prev: TabView | null = null;
  let current: TabView | null = null;

  // The Reach: Push = click on the arm, the fist, or Barry himself (only clickable while reaching).
  const push = (e: Event) => {
    e.stopPropagation();
    send({ type: 'pushed' });
  };
  arm.addEventListener('click', push);
  sprite.addEventListener('click', push);

  armBody.style.backgroundImage = `url("${assetUrl(manifest.arm.segment)}")`;
  fist.style.backgroundImage = `url("${assetUrl(manifest.arm.fist)}")`;
  const ARM_H = 40;
  const FIST_PX = 80;
  armBody.style.height = `${ARM_H}px`;
  armBody.style.top = `${-ARM_H / 2}px`;
  fist.style.width = fist.style.height = `${FIST_PX}px`;
  fist.style.top = `${-FIST_PX / 2}px`;

  const landing = createLandingGate();
  let rafId = 0;
  let armProgress = 0;

  function drawArm() {
    const view = current;
    if (!view || !view.visible || !view.reach) return;
    const progress = reachProgress(Date.now(), view.reach);
    armProgress = progress;
    const [fw, fh] = manifest.frameSize;
    const rect = sprite.getBoundingClientRect();
    const handAnchor = manifest.poses.studious.anchors.hand ?? [fw * 0.9, fh * 0.55];
    const hand = anchorToViewport(rect, handAnchor, [fw, fh]);
    const tabX = tabViewportX(view.tabSlot, {
      outerWidth: window.outerWidth,
      innerWidth: window.innerWidth,
      isMac: isMacPlatform(navigator as never),
    });
    const { length, angleDeg } = armVector(hand, reachTarget(window.innerWidth, hand, tabX));
    const len = length * progress;
    arm.style.left = `${hand.x}px`;
    arm.style.top = `${hand.y}px`;
    arm.style.transform = `rotate(${angleDeg}deg)`;
    armBody.style.width = `${Math.max(0, len - FIST_PX * 0.4)}px`;
    fist.style.left = `${len - FIST_PX * 0.8}px`;
    if (landing.check(progress, view.reach.startedAt))
      send({ type: 'reachLanded', reachStartedAt: view.reach.startedAt });
  }
  function frame() {
    rafId = 0;
    drawArm();
    // Stop once landed; a hidden tab pauses rAF by itself and resumes at the right progress.
    if (current?.reach && armProgress < 1) rafId = requestAnimationFrame(frame);
  }
  function syncArm(view: TabView) {
    const active = view.visible && view.reach !== null;
    arm.hidden = !active;
    if (!active) {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = 0;
      return;
    }
    if (rafId) cancelAnimationFrame(rafId);
    drawArm();
    if (armProgress < 1) rafId = requestAnimationFrame(frame);
  }
  const onResize = () => drawArm();
  window.addEventListener('resize', onResize);

  let countdownTimer: ReturnType<typeof setInterval> | undefined;
  function syncCountdown(view: TabView) {
    if (countdownTimer) clearInterval(countdownTimer);
    countdownTimer = undefined;
    const end = view.visible ? view.breakEndsAt : null;
    countdownEl.hidden = end === null;
    if (end === null) return;
    const tick = () => (countdownEl.textContent = `⏱ ${formatCountdown(end - Date.now())}`);
    tick();
    countdownTimer = setInterval(tick, 250);
  }

  /** FLIP: the confrontation face shrinks into the corner instead of snapping. */
  function shrinkFrom(first: DOMRect) {
    const last = sprite.getBoundingClientRect();
    if (!last.width || !first.width) return;
    const dx = first.left - last.left;
    const dy = first.top - last.top;
    const s = first.width / last.width;
    sprite.animate(
      [
        { transformOrigin: '0 0', translate: `${dx}px ${dy}px`, scale: String(s) },
        { transformOrigin: '0 0', translate: '0 0', scale: '1' },
      ],
      { duration: reducedMotion() ? 0 : 600, easing: 'cubic-bezier(.3,.9,.3,1)' },
    );
  }

  const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

  /** Barry bursts onto the page: pops from small with an overshoot. */
  function burstIn() {
    if (reducedMotion()) return;
    sprite.animate(
      [
        { scale: '0.1', rotate: '-12deg', opacity: 0 },
        { scale: '1.25', rotate: '6deg', opacity: 1, offset: 0.55 },
        { scale: '0.95', rotate: '-2deg', opacity: 1, offset: 0.8 },
        { scale: '1', rotate: '0deg', opacity: 1 },
      ],
      { duration: 550, easing: 'cubic-bezier(.2,.8,.3,1)' },
    );
    const f = document.createElement('div');
    f.className = 'burstflash';
    root.appendChild(f);
    setTimeout(() => f.remove(), 500);
  }

  /** Beaten Snooze pose: a flop, then a slow dizzy wobble until the pose changes. */
  let wobbleAnim: Animation | null = null;
  function setWobble(on: boolean) {
    if (!on || reducedMotion()) {
      wobbleAnim?.cancel();
      wobbleAnim = null;
      return;
    }
    if (wobbleAnim) return;
    wobbleAnim = sprite.animate(
      [
        { rotate: '0deg', translate: '0 -14px', offset: 0 },
        { rotate: '-7deg', translate: '0 0', offset: 0.12 },
        { rotate: '5deg', translate: '0 0', offset: 0.5 },
        { rotate: '-5deg', translate: '0 0', offset: 0.8 },
        { rotate: '-7deg', translate: '0 0', offset: 1 },
      ],
      { duration: 1400, iterations: Infinity, direction: 'alternate', easing: 'ease-in-out' },
    );
  }

  function render(view: TabView) {
    const bursting =
      view.visible &&
      view.placement === 'face' &&
      view.pose === 'confrontation' &&
      !(prev?.visible && prev.placement === 'face' && prev.pose === 'confrontation');
    const shrinking =
      prev !== null &&
      view.visible &&
      prev.visible &&
      prev.placement === 'face' &&
      prev.pose === 'confrontation' &&
      view.placement === 'corner' &&
      view.pose === 'okay';
    const firstRect = shrinking ? sprite.getBoundingClientRect() : null;
    prev = current = view;
    root.hidden = !view.visible;

    barry.className = `barry ${view.placement} ${view.position}${view.reach ? ' fighting' : ''}`;
    setWobble(view.visible && view.pose === 'beaten');
    const px = view.placement === 'face' ? FACE_PX : CORNER_PX;
    const pose = manifest.poses[view.pose];
    const [fw, fh] = manifest.frameSize;
    const key = `${view.pose}|${px}`;
    if (key !== spriteKey) {
      spriteKey = key;
      sprite.style.width = `${px}px`;
      sprite.style.height = `${(px * fh) / fw}px`;
      sprite.style.backgroundImage = `url("${assetUrl(pose.file)}")`;
      sprite.style.backgroundSize = `${pose.frames * 100}% 100%`;
      sprite.style.animation =
        pose.frames > 1
          ? `frames ${pose.frames / pose.fps}s steps(${pose.frames - 1}) infinite`
          : '';
    }
    sprite.style.transform = view.scale === 1 ? '' : `scale(${view.scale})`;
    // Keep the bubble clear of a scaled-up face sprite.
    bubble.style.marginBottom =
      view.placement === 'face' ? `${(px * (view.scale - 1)) / 2 + 6}px` : '';
    button.style.marginTop =
      view.placement === 'face' ? `${(px * (view.scale - 1)) / 2 + 10}px` : '';

    bubble.hidden = view.line === null;
    if (view.line !== null) bubble.textContent = view.line;
    button.hidden = !view.showBackToIt;

    if (firstRect) shrinkFrom(firstRect);
    else if (bursting) burstIn();

    const showPushes = view.visible && view.pushesLeft !== null;
    pushesEl.hidden = !showPushes;
    if (showPushes) pushesEl.textContent = pushesLabel(view.pushesLeft!);
    const showMeter = view.visible && view.chudMeter !== null;
    meterEl.hidden = !showMeter;
    if (showMeter) {
      const m = clamp01(view.chudMeter!);
      meterFill.style.width = `${m * 100}%`;
      meterEl.classList.toggle('full', m >= 1);
      meterEl.title = `Chud meter ${Math.round(m * 100)}%`;
    }
    syncCountdown(view);
    syncArm(view);
    // A suggestion belongs to chill Barry; any other pose or a hidden tab drops it.
    if (!view.visible || view.pose !== 'chill') hideSuggestion();
    else if (suggestion !== null) suggestEl.hidden = false;

    eater.set(view.visible && view.eatInput);
    media.set(view.visible && view.pauseMedia);
  }

  function flash(text: string) {
    const el = document.createElement('div');
    el.className = 'flash';
    el.textContent = text;
    root.appendChild(el);
    setTimeout(() => el.remove(), 800);
  }

  function playSound(sound: SoundId) {
    const variants = manifest.sounds[sound];
    const file = variants[Math.floor(Math.random() * variants.length)]!;
    try {
      new Audio(assetUrl(file)).play().catch(() => flash(SOUND_FLASH[sound]));
    } catch {
      flash(SOUND_FLASH[sound]);
    }
  }

  function playChudSong() {
    const variants = manifest.sounds.chudSong;
    const file = variants[Math.floor(Math.random() * variants.length)]!;
    try {
      if (chudAudio && !chudAudio.ended) {
        // Already singing: keep it going, never restart.
        if (chudAudio.paused) chudAudio.play().catch(() => flash(SOUND_FLASH.chudSong));
        return;
      }
      chudAudio = new Audio(assetUrl(file));
      chudAudio.play().catch(() => flash(SOUND_FLASH.chudSong));
    } catch {
      flash(SOUND_FLASH.chudSong);
    }
  }

  function explode() {
    root.hidden = false;
    const el = document.createElement('div');
    el.className = 'explosion';
    el.style.setProperty('--ms', `${manifest.explosion.durationMs}ms`);
    const img = document.createElement('img');
    img.src = assetUrl(manifest.explosion.file);
    el.appendChild(img);
    root.appendChild(el);
    if (!reducedMotion()) sprite.animate(
      [{ translate: '0 0' }, { translate: '-6px 0' }, { translate: '6px 0' }, { translate: '0 0' }],
      { duration: 120, iterations: 3 },
    );
    // Left in place: the background closes the tab shortly after.
  }

  return {
    render,
    playEffect(effect) {
      switch (effect.type) {
        case 'playSound':
          if (effect.sound === 'chudSong') playChudSong();
          else playSound(effect.sound);
          break;
        case 'explodeAndClose':
          explode();
          break;
        case 'showSuggestion':
          showSuggestion(suggestionText(effect.freeMinutes, effect.todo.text));
          break;
        case 'setBadge':
          break; // background-only
      }
    },
    destroy() {
      if (rafId) cancelAnimationFrame(rafId);
      if (countdownTimer) clearInterval(countdownTimer);
      if (suggestTimer) clearTimeout(suggestTimer);
      chudAudio?.pause();
      window.removeEventListener('resize', onResize);
      eater.destroy();
      media.set(false);
      host.remove();
    },
  };
}
