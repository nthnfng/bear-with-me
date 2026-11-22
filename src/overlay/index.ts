// Page overlay. Draws the TabView it's given and reports user input. No behaviour here:
// see docs/adr/0001-pure-brain-dumb-renderers.md. What IS here is how Barry looks: sprite strips,
// CSS animation classes, sub-second in-between frames, floating text and particles.
//
// View-driven: pose, placement, line, buttons, Chud bar, countdown, Arm progress.
// Local and cosmetic (never changes what the user can do): the chomp squash and "chomp!", the
// thinking pose while a suggestion is up, the get-up in-between frames, the Back to it reach
// before the explosion, POW, stars, the max-chud sway and notes, particles.

import { browser } from 'wxt/browser';
import type {
  AssetManifest,
  BarryEffect,
  ContentMessage,
  PoseId,
  SoundId,
  TabView,
} from '../contracts';
import manifestJson from '../assets/manifest.json';
import { anchorToViewport, armVector, createLandingGate, reachProgress, reachTarget } from './arm';
import {
  SUGGESTION_MS,
  formatCountdown,
  parseMinutes,
  planLines,
  suggestionText,
  taskCheckText,
} from './hud';
import { createInputEater } from './input-eater';
import { createMediaPauser } from './media-pauser';
import {
  GET_UP_STEP_MS,
  SWAY_MS,
  fitScale,
  frameIndex,
  frameOffset,
  getUpFrame,
  poseLook,
  spriteBox,
  swayOffset,
  type EntranceAnim,
} from './sprite';
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
  /** Events this returns true for are never eaten (the harness keeps its own panel usable). */
  exempt?(e: Event): boolean;
}

// Display text only, for when sound is blocked by autoplay policy.
const SOUND_FLASH: Record<SoundId, string> = {
  chomp: 'CHOMP!',
  punch: 'POW!',
  ow: 'OW!',
  chudSong: '♪',
  burst: 'RAAAH!',
  explosion: 'BOOM!',
};

/** An entrance animation only plays if the pose began this recently (not on a tab switch). */
const FRESH_MS = 1500;
/** The runtime closes the tabs this long after explodeAndClose; the explosion must end inside it. */
const CLOSE_WINDOW_MS = 1300;
const BACK_TO_IT_POP_MS = 250;
const BACK_TO_IT_ARM_MS = 350;
/** After the Back to it explosion, the tab should close within this; if not, Barry comes back. */
const CLOSE_GRACE_MS = 1500;
const EXPLOSION_COLORS = ['#f6d04d', '#e8742f', '#c43c2c', '#1e1a16', '#ffffff'];
/** The explosion fades the whole screen to this and holds it until the tab closes. */
const EXPLOSION_FILL = '232, 116, 47';

export function mountOverlay(opts: OverlayOptions): Overlay {
  const manifest = opts.manifest ?? (manifestJson as unknown as AssetManifest);
  const assetUrl =
    opts.assetUrl ?? ((p: string) => browser.runtime.getURL(`/assets/${p}` as never));
  const { send } = opts;
  const S_CORNER = manifest.scale.corner;

  const host = document.createElement('div');
  host.setAttribute('data-barry', '');
  const shadow = host.attachShadow({ mode: 'closed' });
  shadow.innerHTML = `<style>${CSS}
    .fx { position: fixed; inset: 0; z-index: 2147483647; pointer-events: none; }</style>
    <div class="root" hidden>
      <div class="arm" hidden><div class="armbar"></div><div class="armfist"></div></div>
      <div class="barry corner right">
        <div class="suggest" hidden><span class="suggesttext"></span><button class="x" aria-label="Dismiss">×</button></div>
        <div class="check" hidden><span class="checktext"></span><div class="checkbtns"><button data-answer="done">Done ✓</button><button data-answer="extend">+15 min</button></div><form class="checkmore"><input type="number" min="1" max="510" placeholder="min" aria-label="More minutes (up to 510)"><button type="submit">+ min</button></form></div>
        <div class="bubble" hidden></div>
        <div class="stage"><div class="sprite"></div><div class="stars" hidden>✦</div></div>
        <button class="btn" hidden>Back to it?</button>
      </div>
    </div>
    <div class="fx"></div>`;
  const q = <T extends HTMLElement>(sel: string) => shadow.querySelector(sel) as T;
  const root = q('.root');
  const fx = q('.fx');
  const barry = q('.barry');
  const bubble = q('.bubble');
  const stage = q('.stage');
  const sprite = q('.sprite');
  const stars = q('.stars');
  const button = q<HTMLButtonElement>('.btn');
  const arm = q('.arm');
  const armBar = q('.armbar');
  const armFist = q('.armfist');
  const suggestEl = q('.suggest');
  const suggestText = q('.suggesttext');
  const checkEl = q('.check');
  const checkText = q('.checktext');
  // "Done?": hide right after an answer; the next view (without taskCheck) confirms it.
  let answeredCheck: string | null = null;
  const checkMore = q<HTMLFormElement>('.checkmore');
  const checkMinutes = q<HTMLInputElement>('.checkmore input');
  function answer(ans: 'done' | 'extend', extendMs?: number) {
    const id = current?.taskCheck?.id;
    if (!id) return;
    answeredCheck = id;
    checkEl.hidden = true;
    checkMinutes.value = '';
    send({ type: 'answerTask', id, answer: ans, ...(extendMs ? { extendMs } : {}) });
  }
  checkEl.querySelectorAll<HTMLButtonElement>('.checkbtns button').forEach((b) =>
    b.addEventListener('click', (e) => {
      e.stopPropagation();
      answer(b.dataset.answer as 'done' | 'extend');
    }),
  );
  checkMore.addEventListener('submit', (e) => {
    e.preventDefault();
    e.stopPropagation();
    const ms = parseMinutes(checkMinutes.value);
    if (ms === null) {
      checkMinutes.focus();
      return;
    }
    answer('extend', ms);
  });
  // Typing minutes must not trigger the page's own key shortcuts (YouTube etc.).
  for (const type of ['keydown', 'keyup', 'keypress'] as const)
    checkMinutes.addEventListener(type, (e) => e.stopPropagation());
  function renderCheck(view: TabView) {
    const tc = view.taskCheck;
    if (!tc) answeredCheck = null;
    const show = !!tc && view.visible && !locked && answeredCheck !== tc.id;
    if (show && checkEl.hidden && !reducedMotion()) {
      checkEl.classList.remove('popin');
      void checkEl.offsetWidth;
      checkEl.classList.add('popin');
    }
    checkEl.hidden = !show;
    if (show) {
      checkText.textContent = taskCheckText(tc!.title);
      hideSuggestion();
    }
  }
  // One Back to it per Confrontation: the brain takes both of a double click, so hide after the first.
  let backSentSince: number | null = null;
  button.addEventListener('click', () => {
    if (backSentSince !== null) return;
    backSentSince = current?.poseSince ?? 0;
    button.hidden = true;
    send({ type: 'backToIt' });
  });
  document.documentElement.appendChild(host);

  // Events from our own UI (the button) must never be eaten. The shadow root is closed, so
  // from outside the path only shows the host; the host itself has pointer-events: none and
  // only the button, the suggestion and the explosion backdrop can be hit.
  const isOwn = (e: Event) => e.composedPath().includes(host) || (opts.exempt?.(e) ?? false);

  const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

  let current: TabView | null = null;
  let prev: TabView | null = null;

  // ---- timers for local sequences ------------------------------------------------------------
  const timers = new Set<ReturnType<typeof setTimeout>>();
  function later(fn: () => void, ms: number) {
    const t = setTimeout(() => {
      timers.delete(t);
      fn();
    }, ms);
    timers.add(t);
  }
  function cancelSeq() {
    for (const t of timers) clearTimeout(t);
    timers.clear();
  }
  /** True while the Back to it sequence owns the sprite (the view may keep updating underneath). */
  let locked = false;

  // ---- the sprite ----------------------------------------------------------------------------
  let displayPose: PoseId | null = null;
  let displaySince = 0;
  let shownS = S_CORNER;
  let flipTimer: ReturnType<typeof setInterval> | undefined;
  let baseClass = '';
  let lastChompAt = -Infinity;

  const scaleFor = (placement: 'corner' | 'face', poseId: PoseId) =>
    fitScale(manifest.scale[placement], manifest.poses[poseId].h, window.innerHeight);

  function paintSprite(poseId: PoseId, since: number, placement: 'corner' | 'face') {
    const pose = manifest.poses[poseId];
    const s = scaleFor(placement, poseId);
    const box = spriteBox(pose, s);
    sprite.style.width = `${box.width}px`;
    sprite.style.height = `${box.height}px`;
    sprite.style.backgroundImage = `url("${assetUrl(pose.file)}")`;
    sprite.style.backgroundSize = `${box.bgWidth}px ${box.bgHeight}px`;
    arm.style.setProperty('--th', `${2 * s}px`);
    arm.style.setProperty('--bw', `${s}px`);
    shownS = s;
    if (flipTimer) clearInterval(flipTimer);
    flipTimer = undefined;
    // Frame = floor((now - poseSince) / frameMs) % frames, so every tab shows the same frame.
    const update = () => {
      const f = frameIndex(Date.now(), since, pose.frames, pose.frameMs);
      sprite.style.backgroundPosition = `${frameOffset(pose, s, f)}px 0`;
    };
    update();
    if (pose.frames > 1 && pose.frameMs)
      flipTimer = setInterval(update, Math.max(20, pose.frameMs / 2));
    displayPose = poseId;
    displaySince = since;
  }

  function setBase(cls: string) {
    baseClass = cls;
    sprite.className = `sprite ${cls}`.trim();
  }
  /** Restarts a one-shot animation class (removing and re-adding it replays it). */
  function playAnim(cls: string) {
    sprite.className = 'sprite';
    void sprite.offsetWidth;
    sprite.className = `sprite ${cls}`;
  }
  sprite.addEventListener('animationend', (e) => {
    // squash holds its end state until the next pose swap replaces it.
    if (e.target === sprite && e.animationName !== 'squash')
      sprite.className = `sprite ${baseClass}`.trim();
  });

  function show(poseId: PoseId, since: number, idle: string, entrance: EntranceAnim | 'pop fast') {
    paintSprite(poseId, since, current?.placement ?? 'corner');
    setBase(idle);
    if (entrance && !reducedMotion()) playAnim(entrance);
    syncFx();
  }

  /** Floating text over Barry's head ("chomp!", "POW", notes). */
  function floatText(text: string, dx = 0) {
    const el = document.createElement('div');
    el.className = 'float';
    el.textContent = text;
    el.style.marginLeft = `${dx}px`;
    stage.appendChild(el);
    setTimeout(() => el.remove(), 800);
  }

  // ---- chomp, POW ----------------------------------------------------------------------------
  function chompLocal() {
    if (!current?.visible || locked) return;
    lastChompAt = Date.now();
    playAnim('chomp');
    floatText('chomp!', (Math.random() - 0.5) * 40);
  }

  const eater = createInputEater({
    report: (kind) => {
      send({ type: 'eaten', kind });
      chompLocal();
    },
    isOwn,
  });
  const media = createMediaPauser({
    reportUnpause: () => {
      send({ type: 'eaten', kind: 'unpause' });
      chompLocal();
    },
  });

  function punchLocal() {
    if (!sprite.isConnected) return;
    playAnim('hit');
    floatText('POW');
    armFist.classList.remove('hit');
    void armFist.offsetWidth;
    armFist.classList.add('hit');
  }

  // The Reach: Push = click on the arm, the fist, or Barry himself (only clickable while
  // reaching). Ending a Snooze is controlled from the extension popup.
  const push = (e: Event) => {
    e.stopPropagation();
    if (locked) return;
    send({ type: 'pushed' });
    punchLocal();
  };
  armBar.addEventListener('click', push);
  armFist.addEventListener('click', push);
  sprite.addEventListener('click', (e) => {
    if (current?.reach) push(e);
  });

  // ---- suggestion (chill Barry thinks for 4 s) -----------------------------------------------
  let suggestion = false;
  let suggestTimer: ReturnType<typeof setTimeout> | undefined;
  function hideSuggestion() {
    suggestion = false;
    if (suggestTimer) clearTimeout(suggestTimer);
    suggestTimer = undefined;
    suggestEl.hidden = true;
  }
  (suggestEl.querySelector('.x') as HTMLElement).addEventListener('click', (e) => {
    e.stopPropagation();
    hideSuggestion();
    restoreView();
  });
  function showSuggestion(text: string) {
    const view = current;
    if (!view?.visible || view.pose !== 'chill-mug' || locked || !checkEl.hidden) return;
    suggestion = true;
    suggestText.textContent = text;
    suggestEl.hidden = false;
    suggestEl.classList.remove('popin');
    void suggestEl.offsetWidth;
    suggestEl.classList.add('popin');
    // Thinking pose: pop, then breathe; back to the view's pose when the bubble goes.
    cancelSeq();
    show('thinking', Date.now(), 'breathe', 'pop');
    if (suggestTimer) clearTimeout(suggestTimer);
    suggestTimer = setTimeout(() => {
      hideSuggestion();
      restoreView();
    }, SUGGESTION_MS);
  }
  /** Back to whatever the view says, without replaying its entrance. */
  function restoreView() {
    const view = current;
    if (!view?.visible || locked || suggestion) return;
    if (displayPose === view.pose) return;
    const look = poseLook(view.pose, view.placement, null);
    show(view.pose, view.poseSince, look.idle, '');
  }

  // Chud song: started by a playSound effect once per arrival; it outlives view changes and tab switches.
  let chudAudio: HTMLAudioElement | null = null;

  // ---- fx tied to the displayed pose: stars and the max chud dance ----------------------------
  let danceTimer: ReturnType<typeof setTimeout> | undefined;
  let noteTimer: ReturnType<typeof setInterval> | undefined;
  function stopDance() {
    if (danceTimer) clearTimeout(danceTimer);
    if (noteTimer) clearInterval(noteTimer);
    danceTimer = noteTimer = undefined;
    barry.classList.remove('dancing');
    barry.style.removeProperty('--sway');
  }
  function startDance(since: number) {
    if (danceTimer || reducedMotion()) return;
    const step = () => {
      const elapsed = Date.now() - since;
      barry.style.setProperty('--sway', `${swayOffset(elapsed)}px`);
      void barry.offsetWidth;
      barry.classList.add('dancing');
      danceTimer = setTimeout(step, SWAY_MS - (elapsed % SWAY_MS) + 5);
    };
    step();
    noteTimer = setInterval(
      () => floatText(Math.random() > 0.5 ? '♪' : '♫', (Math.random() - 0.5) * 120),
      400,
    );
  }
  function syncFx() {
    stars.hidden = !(displayPose === 'got-owned' && current?.visible);
    if (displayPose === 'chud-point' && current?.visible) startDance(displaySince);
    else stopDance();
  }

  // ---- speech bubble and countdown -----------------------------------------------------------
  let bubbleKey = '';
  let countEl: HTMLElement | null = null;
  let countdownTimer: ReturnType<typeof setInterval> | undefined;
  let breakEnd: number | null = null;
  let planEl: HTMLElement | null = null;
  let planTimer: ReturnType<typeof setInterval> | undefined;
  function renderBubble(view: TabView) {
    const hasCount = view.breakEndsAt !== null;
    breakEnd = view.breakEndsAt;
    const planKey = view.plan ? JSON.stringify(view.plan) : '';
    const key = `${view.line ?? ''}|${hasCount}|${planKey}`;
    const visibleBubble = view.visible && (view.line !== null || hasCount) && !locked;
    bubble.hidden = !visibleBubble;
    if (key !== bubbleKey) {
      bubbleKey = key;
      bubble.replaceChildren();
      countEl = null;
      planEl = null;
      if (view.line !== null) bubble.append(view.line);
      bubble.classList.toggle('has-plan', !!view.plan);
      if (view.plan) {
        planEl = document.createElement('div');
        planEl.className = 'plan';
        bubble.append(planEl);
      }
      if (hasCount) {
        if (view.line !== null) bubble.append(' ');
        const img = document.createElement('img');
        img.src = assetUrl(manifest.clockIcon.file);
        img.alt = '';
        countEl = document.createElement('span');
        countEl.className = 'count';
        bubble.append(img, countEl);
      }
      if (visibleBubble && !reducedMotion()) {
        bubble.classList.remove('popin');
        void bubble.offsetWidth;
        bubble.classList.add('popin');
      }
    }
    if (countdownTimer) clearInterval(countdownTimer);
    countdownTimer = undefined;
    if (planTimer) clearInterval(planTimer);
    planTimer = undefined;
    if (planEl && visibleBubble) {
      const plan = view.plan;
      const paint = () => {
        if (!planEl) return;
        planEl.replaceChildren(
          ...planLines(plan, Date.now()).map((text) => {
            const line = document.createElement('div');
            line.textContent = text;
            return line;
          }),
        );
      };
      paint();
      // A running Task's "32m left" counts down.
      // Running task and calendar event times count down.
      if (plan?.task?.timing.kind === 'left' || plan?.block) planTimer = setInterval(paint, 15_000);
    }
    if (countEl && visibleBubble) {
      const tick = () => {
        if (countEl && breakEnd !== null)
          countEl.textContent = formatCountdown(breakEnd - Date.now());
      };
      tick();
      countdownTimer = setInterval(tick, 250);
    }
  }

  // ---- the Arm -------------------------------------------------------------------------------
  const landing = createLandingGate();
  let rafId = 0;
  let armProgress = 0;
  /** The Back to it reach: fast, local, then the explosion. Overrides the view's reach. */
  let localReach: { startedAt: number; durationMs: number } | null = null;
  let localLanded = false;
  let lastTarget = { x: 0, y: 0 };
  let explodeStartedAt = 0;

  const activeReach = () => localReach ?? current?.reach ?? null;

  function armGeometry(view: TabView) {
    const poseId = displayPose ?? view.pose;
    const { w: fw, h: fh, paw } = manifest.poses[poseId];
    const rect = sprite.getBoundingClientRect();
    const handAnchor = paw ?? [fw * 0.9, fh * 0.55];
    const hand = anchorToViewport(rect, handAnchor, [fw, fh]);
    const tabX = tabViewportX(view.tabSlot, {
      outerWidth: window.outerWidth,
      innerWidth: window.innerWidth,
      isMac: isMacPlatform(navigator as never),
    });
    return { hand, target: reachTarget(window.innerWidth, hand, tabX) };
  }

  function drawArm() {
    const view = current;
    const reach = activeReach();
    if (!view || !view.visible || !reach) return;
    const progress = reachProgress(Date.now(), reach);
    armProgress = progress;
    const { hand, target } = armGeometry(view);
    lastTarget = target;
    const { length, angleDeg } = armVector(hand, target);
    const len = length * progress;
    const th = 2 * shownS;
    arm.style.left = `${hand.x}px`;
    arm.style.top = `${hand.y}px`;
    arm.style.transform = `rotate(${angleDeg}deg)`;
    armBar.style.width = `${Math.max(0, len - th)}px`;
    armFist.style.left = `${len}px`;
    if (localReach) {
      if (progress >= 1 && !localLanded) {
        localLanded = true;
        explodeAt(target.x, Math.max(target.y, 0) + 24, explosionMs());
      }
    } else if (view.reach && landing.check(progress, view.reach.startedAt)) {
      send({ type: 'reachLanded', reachStartedAt: view.reach.startedAt });
    }
  }
  function frame() {
    rafId = 0;
    drawArm();
    // Stop once landed; a hidden tab pauses rAF by itself and resumes at the right progress.
    if (activeReach() && armProgress < 1) rafId = requestAnimationFrame(frame);
  }
  function syncArm(view: TabView) {
    const active = view.visible && activeReach() !== null;
    arm.hidden = !active;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = 0;
    if (!active) return;
    drawArm();
    if (armProgress < 1) rafId = requestAnimationFrame(frame);
  }
  const onResize = () => drawArm();
  window.addEventListener('resize', onResize);

  // ---- explosion -----------------------------------------------------------------------------
  /** Particle time, so the whole thing ends inside the runtime's close delay. */
  function explosionMs() {
    const left = CLOSE_WINDOW_MS - (Date.now() - explodeStartedAt) - 50;
    return Math.max(300, Math.min(manifest.explosion.durationMs, left));
  }
  function explodeAt(x: number, y: number, ms: number) {
    const backdrop = document.createElement('div');
    backdrop.className = 'explosion';
    fx.appendChild(backdrop);
    const calm = reducedMotion();
    const unit = S_CORNER;
    // translucent blast tint over the page, a hot flash that then thickens into a solid fill
    // and holds there until the tab closes
    backdrop.animate(
      [
        { background: 'rgba(255, 246, 176, 0.55)' },
        { background: 'rgba(246, 208, 77, 0.45)', offset: 0.15 },
        { background: `rgba(${EXPLOSION_FILL}, 0.3)`, offset: 0.4 },
        { background: `rgba(${EXPLOSION_FILL}, 0.45)` },
      ],
      { duration: ms, easing: 'ease-in', fill: 'forwards' },
    );
    // flipbook blast under the particles, origin on the blast point; skipped for reduced motion
    if (!calm) {
      const sh = manifest.explosion.sheet;
      const w = sh.w * sh.scale;
      const h = sh.h * sh.scale;
      const blast = document.createElement('div');
      blast.className = 'blast';
      blast.style.cssText = `left:${x - sh.origin[0] * sh.scale}px;top:${y - sh.origin[1] * sh.scale}px;width:${w}px;height:${h}px;background-image:url("${assetUrl(sh.file)}");background-size:${w * sh.frames}px ${h}px`;
      fx.appendChild(blast);
      blast.animate(
        [{ backgroundPosition: '0 0' }, { backgroundPosition: `-${w * sh.frames}px 0` }],
        { duration: ms, easing: `steps(${sh.frames})`, fill: 'forwards' },
      );
    }
    for (let i = 0; i < 90; i++) {
      const p = document.createElement('div');
      p.className = 'particle';
      const size = (i % 5 === 0 ? 7 : i % 3 === 0 ? 5 : 3) * unit;
      p.style.cssText = `left:${x - size / 2}px;top:${y - size / 2}px;width:${size}px;height:${size}px;background:${EXPLOSION_COLORS[i % EXPLOSION_COLORS.length]}`;
      fx.appendChild(p);
      const ang = Math.random() * Math.PI * 2;
      const dist = 120 + Math.random() * 320;
      const dx = calm ? 0 : Math.cos(ang) * dist;
      const dy = calm ? 0 : Math.sin(ang) * dist + 80;
      const dur = ms * (0.55 + Math.random() * 0.4);
      const delay = Math.random() * ms * 0.15;
      p.animate(
        [
          { transform: 'translate(0,0)', opacity: 1 },
          { transform: `translate(${dx * 0.7}px, ${dy * 0.6}px)`, opacity: 1, offset: 0.6 },
          { transform: `translate(${dx}px, ${dy}px)`, opacity: 0 },
        ],
        { duration: dur, delay, easing: 'ease-out', fill: 'both' },
      );
    }
    setTimeout(() => {
      for (const el of [...fx.children]) if (el !== backdrop) el.remove();
      // The solid fill stays up until the runtime closes the tab. If it doesn't close
      // (harness, or the close failed), lift it. A plain timer so cancelSeq can't strand it.
      setTimeout(() => backdrop.remove(), CLOSE_GRACE_MS);
      // Back to it: hold close-tab Barry until the runtime closes the tab, which lands just
      // after this. Handing back now would flash the Confrontation before the tab goes.
      if (locked) later(unlockIfStillOpen, CLOSE_GRACE_MS);
    }, ms + 60);
  }

  /** Not closed (harness, or the close failed): hand the sprite back to the view. */
  function unlockIfStillOpen() {
    if (!locked) return;
    locked = false;
    localReach = null;
    if (current) render(current, true);
  }

  /** explodeAndClose: Back to it plays pose + fast reach first; a landed Reach just explodes. */
  function explode() {
    explodeStartedAt = Date.now();
    const view = current;
    if (view?.visible && view.showBackToIt && !locked) {
      locked = true;
      localLanded = false;
      cancelSeq();
      hideSuggestion();
      button.hidden = true;
      bubble.hidden = true;
      show('close-tab', Date.now(), '', 'pop fast');
      later(() => {
        localReach = { startedAt: Date.now(), durationMs: BACK_TO_IT_ARM_MS };
        if (current) syncArm(current);
      }, BACK_TO_IT_POP_MS);
      return;
    }
    if (locked) return;
    let x = lastTarget.x;
    if (view?.visible && view.reach) x = armGeometry(view).target.x;
    else {
      const tabX = tabViewportX(view?.tabSlot ?? null, {
        outerWidth: window.outerWidth,
        innerWidth: window.innerWidth,
        isMac: isMacPlatform(navigator as never),
      });
      x = tabX ?? window.innerWidth / 2;
    }
    explodeAt(x, 24, explosionMs());
  }

  // ---- rendering the view --------------------------------------------------------------------
  /** FLIP: the confrontation face shrinks into the corner instead of snapping. */
  function shrinkFrom(first: DOMRect) {
    const last = sprite.getBoundingClientRect();
    if (!last.width || !first.width || reducedMotion()) return;
    const dx = first.left - last.left;
    const dy = first.top - last.top;
    const s = first.width / last.width;
    sprite.animate(
      [
        { transformOrigin: '0 0', translate: `${dx}px ${dy}px`, scale: String(s) },
        { transformOrigin: '0 0', translate: '0 0', scale: '1' },
      ],
      { duration: 600, easing: 'cubic-bezier(.3,.9,.3,1)' },
    );
  }

  function burstFlash() {
    if (reducedMotion()) return;
    const f = document.createElement('div');
    f.className = 'burstflash';
    root.appendChild(f);
    setTimeout(() => f.remove(), 500);
  }

  /** Snooze: get-up, then get-up-2, from the shared poseSince so tabs agree. */
  function startGetUp(view: TabView) {
    const frames: Array<'get-up' | 'get-up-2'> = ['get-up', 'get-up-2'];
    const fresh = Date.now() - view.poseSince < FRESH_MS;
    const play = (f: (typeof frames)[number]) =>
      show(f, view.poseSince, '', f === 'get-up' || !fresh ? '' : 'unsquash');
    const elapsed = Math.max(0, Date.now() - view.poseSince);
    const start = getUpFrame(elapsed);
    play(start);
    for (let i = frames.indexOf(start) + 1; i < frames.length; i++)
      later(() => play(frames[i]!), i * GET_UP_STEP_MS - elapsed);
  }

  let poseKey = '';

  function render(view: TabView, force = false) {
    const wasFace = prev?.visible === true && prev.placement === 'face';
    const shrinking =
      prev !== null &&
      view.visible &&
      wasFace &&
      view.placement === 'corner' &&
      view.pose === 'suspicious';
    const firstRect = shrinking ? sprite.getBoundingClientRect() : null;
    const prevPose = prev?.visible ? prev.pose : null;
    prev = current = view;
    root.hidden = !view.visible;
    if (!view.visible) {
      stopDance();
      cancelSeq();
      hideSuggestion();
      checkEl.hidden = true;
      locked = false;
      localReach = null;
      syncArm(view);
      if (countdownTimer) clearInterval(countdownTimer);
      countdownTimer = undefined;
      if (planTimer) clearInterval(planTimer);
      planTimer = undefined;
      bubbleKey = '';
      poseKey = '';
      if (flipTimer) clearInterval(flipTimer);
      flipTimer = undefined;
      displayPose = null;
      backSentSince = null;
      eater.set(false);
      media.set(false);
      return;
    }

    barry.className = `barry ${view.placement} ${view.position}${view.reach ? ' fighting' : ''}${barry.classList.contains('dancing') ? ' dancing' : ''}`;

    if (!locked) {
      const newPoseKey = `${view.pose}|${view.poseSince}`;
      if (force || newPoseKey !== poseKey) {
        poseKey = newPoseKey;
        cancelSeq();
        hideSuggestion();
        stopDance();
        const fresh = Date.now() - view.poseSince < FRESH_MS;
        if (view.pose === 'get-up') startGetUp(view);
        else {
          const look = poseLook(view.pose, view.placement, prevPose);
          let entrance: EntranceAnim = fresh ? look.entrance : '';
          // The local chomp already squashed him a moment ago; don't squash twice.
          // Already showing this pose locally: no second bounce.
          if (displayPose === view.pose && prevPose !== view.pose) entrance = '';
          if (entrance === 'chomp' && Date.now() - lastChompAt < 400) entrance = '';
          if (view.pose === 'tired' && fresh && prevPose === 'grieved') {
            // Squash flat, then spring into the seated pose.
            playAnim('squash');
            later(() => show('tired', view.poseSince, '', 'unsquash'), 150);
          } else show(view.pose, view.poseSince, look.idle, entrance);
          if (fresh && view.placement === 'face' && view.pose === 'suspicious' && !wasFace)
            burstFlash();
        }
      } else if (displayPose) {
        // Same pose: placement or viewport size may still have changed.
        paintSprite(displayPose, displaySince, view.placement);
      }
      if (firstRect) shrinkFrom(firstRect);
      if (!view.showBackToIt || (backSentSince !== null && view.poseSince !== backSentSince))
        backSentSince = null;
      button.hidden = !view.showBackToIt || backSentSince !== null;
    }
    syncFx();
    renderBubble(view);
    renderCheck(view);

    syncArm(view);
    // A suggestion belongs to chill Barry; any other pose drops it.
    if (view.pose !== 'chill-mug') hideSuggestion();

    eater.set(view.eatInput);
    media.set(view.pauseMedia);
  }

  // ---- sounds --------------------------------------------------------------------------------
  function flash(text: string) {
    const el = document.createElement('div');
    el.className = 'flash';
    el.textContent = text;
    fx.appendChild(el);
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

  return {
    render: (view) => render(view),
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
          showSuggestion(suggestionText(effect.freeMinutes, effect.task.title));
          break;
        case 'setBadge':
          break; // background-only
      }
    },
    destroy() {
      if (rafId) cancelAnimationFrame(rafId);
      if (countdownTimer) clearInterval(countdownTimer);
      if (planTimer) clearInterval(planTimer);
      if (suggestTimer) clearTimeout(suggestTimer);
      if (flipTimer) clearInterval(flipTimer);
      stopDance();
      cancelSeq();
      chudAudio?.pause();
      window.removeEventListener('resize', onResize);
      eater.destroy();
      media.set(false);
      host.remove();
    },
  };
}
