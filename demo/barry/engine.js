/* ============================================================
   engine.js: the small animation "engine" every trigger uses
   ------------------------------------------------------------
   setSprite(el, name, {anim})  swap the picture (flips through strips)
   playAnim(el, "pop")          replay a CSS animation from barry.css
   say(html)                    speech bubble above Barry ("" hides it)
   moveTo(x) / corner()         slide Barry (CSS transition does the in-betweens)
   wait(ms)                     await-able pause for sequencing
   floatText(text)              "chomp!", "POW", music notes
   sfx(type)                    placeholder beeps (swap for real sound files)
   setChud(0-10)                chud meter, 10 = full orange → maxChud()

   Expects this markup (see demo/index.html):
     #browser            the area Barry lives in (in the extension: a full-page
                         fixed overlay inside a shadow DOM)
       #barry > #bubble + #body.sprite
       #arm, #chudBar > .track + .fill + #chudBarImg
   Needs src/sprites.js loaded first.
   ============================================================ */

const $ = id => document.getElementById(id);
const barry = $("barry"), body = $("body"), bubble = $("bubble"), arm = $("arm"), browser = $("browser");

let state = { mode: "chill", size: "slim", chomps: 0, punches: 0, chud: 0, cave: false };
let flipTimer, slackTimer, snoozeTimer;

/* ============================================================
   2. SPRITE HELPERS: the only "engine" you need
   ============================================================ */
// show a sprite; if it's a strip with several frames, flip through them
function setSprite(el, name, { frameMs, anim = "" } = {}) {
  const a = ASSETS[name];
  frameMs = frameMs || a.frameMs || 500;
  el.style.backgroundImage = `url(${a.src})`;
  el.style.width = a.w * S + "px";
  el.style.height = a.h * S + "px";
  el.style.backgroundSize = `${a.w * a.frames * S}px ${a.h * S}px`;
  el.style.backgroundPosition = "0 0";
  el.dataset.name = name;
  if (el === body) { clearInterval(flipTimer); }
  if (a.frames > 1) {                       // flipbook
    let i = 0;
    const t = setInterval(() => { i = (i + 1) % a.frames; el.style.backgroundPosition = `${-i * a.w * S}px 0`; }, frameMs);
    if (el === body) flipTimer = t;
  }
  playAnim(el, anim);
}
// restart a CSS animation class (removing + re-adding replays it)
function playAnim(el, cls) {
  el.className = "sprite";
  void el.offsetWidth;                      // forces the browser to notice the change
  if (cls) el.classList.add(...cls.split(" "));
}
// speech bubble above Barry
function say(html) {
  if (!html) { bubble.style.display = "none"; return; }
  bubble.innerHTML = html;
  bubble.style.display = "block";
  bubble.style.bottom = body.offsetHeight * (state.grow || 1) + 18 + "px";   // offsetHeight ignores animations, so it's the real size
  // keep the bubble inside the window when Barry is near an edge
  bubble.style.translate = "-50% 0"; bubble.style.setProperty("--tail", "0px");
  const br = bubble.getBoundingClientRect(), wr = browser.getBoundingClientRect();
  const over = br.right - wr.right + 8, under = wr.left - br.left + 8;
  if (over > 0) { bubble.style.translate = `calc(-50% - ${over}px) 0`; bubble.style.setProperty("--tail", over + "px"); }
  else if (under > 0) { bubble.style.translate = `calc(-50% + ${under}px) 0`; bubble.style.setProperty("--tail", -under + "px"); }
}
// slide Barry to an x position (CSS transition does the in-betweens)
const moveTo = x => barry.style.left = x + "px";
const corner = () => moveTo(browser.clientWidth - body.offsetWidth - 20);
const wait = ms => new Promise(r => setTimeout(r, ms));

// floating text like "chomp!" or "♪"
function floatText(text, dx = 0) {
  const r = body.getBoundingClientRect(), b = browser.getBoundingClientRect();
  const f = document.createElement("div");
  f.className = "float"; f.textContent = text;
  f.style.left = r.left - b.left + r.width / 2 + dx + "px";
  f.style.top = r.top - b.top - 10 + "px";
  browser.appendChild(f); setTimeout(() => f.remove(), 800);
}

// tiny sound effects (in the extension: new Audio(chrome.runtime.getURL("sounds/chomp.ogg")).play())
const ctx = new (window.AudioContext || window.webkitAudioContext)();
function sfx(type) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  const p = { chomp: [220, 90, .08], punch: [140, 60, .12], boom: [90, 30, .4], pop: [400, 800, .1] }[type];
  o.type = type === "boom" ? "sawtooth" : "square";
  o.frequency.setValueAtTime(p[0], ctx.currentTime);
  o.frequency.exponentialRampToValueAtTime(p[1], ctx.currentTime + p[2]);
  g.gain.setValueAtTime(.12, ctx.currentTime); g.gain.exponentialRampToValueAtTime(.001, ctx.currentTime + p[2]);
  o.connect(g).connect(ctx.destination); o.start(); o.stop(ctx.currentTime + p[2]);
}

/* ============================================================
   3. CHUD BAR: outline PNG, fill drawn by code (0–10 = 0–100%)
   ============================================================ */
function setChud(level) {
  state.chud = Math.max(0, Math.min(10, level));
  $("chudBar").style.display = "block";
  // inner track is 33 art px wide; orange covers level/10 of it
  $("chudBar").querySelector(".fill").style.width = Math.round(state.chud / 10 * 33) * S + "px";
  if (state.chud === 10) maxChud();
}

