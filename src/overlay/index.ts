// Page overlay. Draws the TabView it's given and reports user input. No behaviour here:
// see docs/adr/0001-pure-brain-dumb-renderers.md.

import { browser } from 'wxt/browser';
import type { AssetManifest, BarryEffect, ContentMessage, SoundId, TabView } from '../contracts';
import manifestJson from '../../public/assets/manifest.json';
import { createInputEater } from './input-eater';
import { createMediaPauser } from './media-pauser';
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
      <div class="barry corner right">
        <div class="bubble" hidden></div>
        <div class="sprite"></div>
        <button class="btn" hidden>Back to it?</button>
      </div>
    </div>`;
  const root = shadow.querySelector('.root') as HTMLElement;
  const barry = shadow.querySelector('.barry') as HTMLElement;
  const bubble = shadow.querySelector('.bubble') as HTMLElement;
  const sprite = shadow.querySelector('.sprite') as HTMLElement;
  const button = shadow.querySelector('.btn') as HTMLButtonElement;
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

  let spriteKey = '';

  function render(view: TabView) {
    root.hidden = !view.visible;

    barry.className = `barry ${view.placement} ${view.position}`;
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

    // TODO(Phase 2): view.reach (arm + 'reachLanded'), pushesLeft, breakEndsAt countdown.
    // TODO(Phase 3): view.chudMeter widget, view.singChud song.

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

  function explode() {
    root.hidden = false;
    const el = document.createElement('div');
    el.className = 'explosion';
    el.style.setProperty('--ms', `${manifest.explosion.durationMs}ms`);
    const img = document.createElement('img');
    img.src = assetUrl(manifest.explosion.file);
    el.appendChild(img);
    root.appendChild(el);
    // Left in place: the background closes the tab shortly after.
  }

  return {
    render,
    playEffect(effect) {
      switch (effect.type) {
        case 'playSound':
          playSound(effect.sound);
          break;
        case 'explodeAndClose':
          explode();
          break;
        case 'showSuggestion':
          // TODO(Phase 3): speech bubble from chill Barry.
          break;
        case 'setBadge':
          break; // background-only
      }
    },
    destroy() {
      eater.set(false);
      media.set(false);
      host.remove();
    },
  };
}
