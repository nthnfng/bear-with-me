/* ============================================================
   triggers.js: one function per trigger in ANIMATIONS.md
   ------------------------------------------------------------
   This is the reference behaviour from the demo. In the extension, the
   Barry Brain (service worker) decides WHEN each trigger fires and sends a
   command to the content script, which calls these functions.

   Demo-only bits, replace in the extension:
     closeTab()  → chrome.runtime.sendMessage({ type: "closeTab" })  (worker calls chrome.tabs.remove)
     #video text → actually pause <video>/<audio> elements on the page
     the cave popup lives in the extension popup, not on the page
   Needs src/sprites.js and src/engine.js loaded first.
   ============================================================ */

function stopEverything() {
  clearInterval(slackTimer); clearTimeout(snoozeTimer);
  arm.style.display = "none"; arm.style.transition = "none"; arm.style.width = "0";
  document.querySelectorAll(".spin").forEach(e => e.remove());
}

// chill-idle: barry-chill-mug (13 frames: holds mug, slides it up 1px at a time to sip, back down)
function chillIdle() {
  stopEverything(); state.mode = "chill";
  setSprite(body, "barry-chill-mug", { frameMs: 220 }); say(""); corner();
}

// free-gap: barry-thinking + bubble
function freeGap() {
  stopEverything();
  setSprite(body, "barry-thinking", { anim: "pop" }); corner();   // paw on chin, thinking
  setTimeout(() => playAnim(body, "breathe"), 450);
  say("You've got 40 free minutes. Lab report?");
  setTimeout(() => { if (state.mode === "chill") { say(""); chillIdle(); } }, 4000);   // shows once, then back to chill
}

// lock-in on task: barry-studious (14-frame strip: read, paw slides up, page flips, paw slides down)
function lockInOnTask() {
  stopEverything(); state.mode = "lockin";
  setSprite(body, "barry-studious", { frameMs: 180 });
  say(""); corner();
}

// burst in: pause media, pop up in their face, frown + "Back to it?"
function burstIn() {
  stopEverything(); state.mode = "burst"; reopenTab();
  $("video").textContent = "⏸ paused by Barry";
  barry.classList.remove("hidden");               // even if he's in his cave
  moveTo(browser.clientWidth / 2 - 40); sfx("pop");
  setSprite(body, state.size === "chud" ? "barry-chud" : state.size === "fat" ? "barry-fat-" + state.chomps : "barry-suspicious", { anim: "pop" });
  say(`You planned ETF prep ,':/ <button onclick="backToIt()">Back to it?</button>`);
}

// chomp: any click / scroll / key on the page while Barry is in your face
let lastWheel = 0;
function chomp(e) {
  if (state.mode !== "burst") return;
  if (e.type === "wheel") { if (Date.now() - lastWheel < 300) return; lastWheel = Date.now(); }  // 1 chomp per scroll gesture
  e.preventDefault();
  state.chomps++; sfx("chomp"); floatText("chomp!");
  // each chomp swaps to the next fatter drawing: fat-1 … fat-4, then chud on the 5th
  if (state.chomps < 5) {
    state.size = "fat";
    setSprite(body, "barry-fat-" + state.chomps, { anim: "chomp" });
  } else {
    state.size = "chud";
    setSprite(body, "barry-chud", { anim: state.chomps === 5 ? "pop" : "chomp" });
  }
  moveTo(browser.clientWidth / 2 - body.offsetWidth / 2);   // stay centred as he widens
  say(bubble.innerHTML);                           // re-place bubble above the new size
}
$("page").addEventListener("click", chomp);
$("page").addEventListener("wheel", chomp, { passive: false });
window.addEventListener("keydown", e => { if (state.mode === "burst" && [" ", "ArrowDown", "ArrowUp", "j", "k"].includes(e.key)) chomp(e); });

function chompButton() {
  if (state.mode !== "burst") { burstIn(); setTimeout(() => chomp({ type: "click", preventDefault() {} }), 500); }
  else chomp({ type: "click", preventDefault() {} });
}

// arm: stretch from Barry's paw to the tab's ✕
function aimArm() {
  const name = body.dataset.name, paw = PAW[name] || [2, 14];
  const r = body.getBoundingClientRect(), b = browser.getBoundingClientRect(), x = $("tabX").getBoundingClientRect();
  const scale = r.width / (ASSETS[name].w * S);
  const sx = r.left - b.left + paw[0] * S * scale, sy = r.top - b.top + paw[1] * S * scale;
  const tx = x.left - b.left + x.width / 2, ty = x.top - b.top + x.height / 2;
  arm.style.left = sx + "px"; arm.style.top = sy - 8 + "px";
  arm.style.rotate = Math.atan2(ty - sy, tx - sx) + "rad";
  return Math.hypot(tx - sx, ty - sy);             // distance the arm must reach (shorter if chud: he's bigger)
}
function stretchArm(ms, onReach) {
  const dist = aimArm();
  arm.style.display = "block"; arm.style.transition = "none"; arm.style.width = "0";
  void arm.offsetWidth;
  arm.style.transition = `width ${ms}ms linear`;
  arm.style.width = dist + "px";
  arm.ontransitionend = onReach;
}

// back to it: reach fast, explode, close tab, leave
async function backToIt() {
  state.mode = "leaving"; say("");
  // he's only fat while eating clicks: shrink back to default size, then reach
  state.size = "slim"; state.chomps = 0;
  setSprite(body, "barry-close-tab", { anim: "pop" });
  await wait(450);                                 // let the pop finish so the arm starts at his paw
  stretchArm(350, async () => { await explode(); closeTab(); leave(); });
}

// leave: shrink back to slim, walk to corner studious
async function leave() {
  arm.style.display = "none";
  state.size = "slim"; state.chomps = 0; state.grow = 1; body.style.transform = "";
  setSprite(body, "barry-studious", { frameMs: 180 }); say("");
  corner(); await wait(900);
  if (state.cave) barry.classList.add("hidden");
  state.mode = "lockin";
}

// slack pass: if he was in your face, "Okay... -_-" first
async function slackStart() {
  const wasBurst = state.mode === "burst";
  stopEverything(); state.mode = "slack"; state.punches = 0; reopenTab();
  if (wasBurst) {
    setSprite(body, "barry-suspicious"); say("Okay... -_-");
    await wait(1200);
    state.size = "slim"; state.chomps = 0; state.grow = 1; body.style.transform = "";
  }
  setSprite(body, "barry-chill", { anim: "breathe" }); corner();   // slack pass = lounging barry-chill
  setChud(state.chud);                              // bar appears, doesn't fill yet
  let left = 15;                                    // demo: 15 s (real: 15 min)
  const tick = () => {
    say(`<img src="${ASSETS["icon-clock"].src}"> ${left}s left`);
    if (left === 5) slackWarning();
    if (left === 0) { clearInterval(slackTimer); armReach(); }
    left--;
  };
  tick(); slackTimer = setInterval(tick, 1000);
}
function slackWarning() {
  if (state.mode !== "slack") { stopEverything(); state.mode = "slack"; corner(); }
  setSprite(body, "barry-suspicious-tap", { frameMs: 130 });   // impatient foot tapping
  say("Wrap it up! 30s");                           // demo shortens the wait
}

// slack over: slow arm reach; you can punch it
function armReach(manual) {
  if (manual) stopEverything();
  state.mode = "reaching"; reopenTab();
  state.size = "slim"; state.chomps = 0;
  setSprite(body, "barry-close-tab");
  say("Closing restricted tabs 💣");
  stretchArm(7000, async () => { await explode(); closeTab(); state.mode = "lockin"; arm.style.display = "none"; lockInOnTask(); });
}

// punch: click the arm while reaching
async function punch() {
  if (state.mode !== "reaching") return;
  state.punches++; sfx("punch"); floatText("POW");
  playAnim(body, "hit");
  if (state.punches < 5) { stretchArm(7000, arm.ontransitionend); return; }   // arm snaps back, reaches again
  gotOwned();
}
arm.addEventListener("click", punch);   // only the arm can be punched
body.addEventListener("click", getUp);   // clicking tired Barry also tells him to get up

// after 5th punch
async function gotOwned() {
  state.mode = "owned"; arm.style.display = "none"; say("");
  setSprite(body, "barry-got-owned");
  const stars = document.createElement("div"); stars.className = "spin"; stars.textContent = "✦";
  const r = body.getBoundingClientRect(), b = browser.getBoundingClientRect();
  stars.style.left = r.left - b.left + r.width / 2 + "px"; stars.style.top = r.top - b.top - 20 + "px";
  browser.appendChild(stars);
  await wait(5000); stars.remove();                 // 5 s on the ground
  // get up: got-owned → get-up → get-up-2 → default (2 s) → suspicious (1 s) → grieved
  setSprite(body, "barry-get-up");   await wait(300);
  setSprite(body, "barry-get-up-2"); await wait(300);   // in-between: sitting up, head turned
  // each swap below bounces (squash → stretch) so the pose changes feel smooth
  setSprite(body, "barry-default",    { anim: "unsquash" }); await wait(2000);  // stands there for 2 s
  setSprite(body, "barry-suspicious", { anim: "unsquash" }); say("ow"); await wait(1000);  // suspicious for 1 s
  setSprite(body, "barry-grieved",    { anim: "unsquash" });
  say("my arm hurts i guess ill leave u alone"); await wait(2200);
  say("");
  // squash & stretch into the tired, seated pose (swap the sprite while he's squashed flat)
  playAnim(body, "squash"); await wait(150);
  setSprite(body, "barry-tired", { anim: "unsquash" });
  corner();                                         // sits in the bottom-right
  state.mode = "tired";
  // he stays seated until the user tells him to get up. chud bar fills while he sits
  // (demo: +10% every 2 s, real: pick something like every 30 s)
  snoozeTimer = setInterval(() => {
    if (state.mode !== "tired") return clearInterval(snoozeTimer);
    setChud(state.chud + 1);
  }, 2000);
}

// "get up": user tells tired Barry to get up → happy slow jump → default Barry standing (Lock In)
async function getUp() {
  if (state.mode !== "tired") return;
  clearInterval(snoozeTimer); state.punches = 0;
  playAnim(body, "squash"); await wait(150);
  setSprite(body, "barry-happy", { anim: "slowjump" });   // happy, arms up, one slow jump
  await wait(900);
  setSprite(body, "barry-default");                       // then just default Barry standing there
  state.mode = "lockin";
}

// explosion: pixel squares fly out from the tab's ✕
function explode() {
  sfx("boom");
  const x = $("tabX").getBoundingClientRect(), b = browser.getBoundingClientRect();
  const cx = x.left - b.left, cy = x.top - b.top;
  const colors = ["#f6d04d", "#e8742f", "#c43c2c", "#1e1a16", "#fff"];
  // translucent blast tint that thickens into a solid fill, held until the tab closes
  const tint = document.createElement("div"); tint.className = "boomtint";
  browser.appendChild(tint);
  // flipbook blast (public/assets/sprites/explosion-sheet.png: 17 frames of 97x143, origin 43,79)
  const blast = document.createElement("div"); blast.className = "blast";
  blast.style.left = cx - 43 * S + "px"; blast.style.top = cy - 79 * S + "px";
  blast.style.width = 97 * S + "px"; blast.style.height = 143 * S + "px";
  blast.style.backgroundImage = `url("${SPRITE_DIR}explosion-sheet.png")`;
  blast.style.backgroundSize = `${97 * S * 17}px ${143 * S}px`;
  blast.style.setProperty("--blast-end", `-${97 * S * 17}px`);
  browser.appendChild(blast);
  setTimeout(() => blast.remove(), 700);
  for (let i = 0; i < 45; i++) {
    const p = document.createElement("div"); p.className = "boom";
    p.style.left = cx + "px"; p.style.top = cy + "px"; p.style.background = colors[i % colors.length];
    browser.appendChild(p);
    const ang = Math.random() * Math.PI * 2, d = 100 + Math.random() * 180;
    const sz = i % 5 === 0 ? 28 : i % 3 === 0 ? 20 : 12; p.style.width = p.style.height = sz + "px";
    requestAnimationFrame(() => { p.style.transform = `translate(${Math.cos(ang) * d}px, ${Math.sin(ang) * d}px)`; p.style.opacity = 0; });
    setTimeout(() => p.remove(), 650);
  }
  return wait(700).then(() => tint.remove());   // closeTab() runs right after
}
function closeTab() { $("closedMsg").style.display = "grid"; $("tabTitle").textContent = "New Tab"; }   // extension: chrome.tabs.remove(tabId)
function reopenTab() { $("closedMsg").style.display = "none"; $("tabTitle").textContent = "YouTube"; }

// max chud: barry-chud-point bounces left/right around the middle, singing
function maxChud() {
  stopEverything(); clearInterval(snoozeTimer); state.mode = "maxchud"; state.size = "chud";
  barry.classList.remove("hidden");
  setSprite(body, "barry-chud-point", { anim: "bounce" });   // pointing hand drawn on, right U removed
  say("♪ I'm a chud ♪");
  bubble.style.translate = "-50% 0"; bubble.style.setProperty("--tail", "0px");   // he's mid-screen, no edge clamp needed
  // bounce left ↔ right around the middle of the screen
  const mid = browser.clientWidth / 2 - body.offsetWidth / 2;
  let right = false; moveTo(mid);
  const sway = setInterval(() => {
    if (state.mode !== "maxchud") return clearInterval(sway);
    right = !right; moveTo(mid + (right ? 90 : -90));
  }, 900);
  const notes = setInterval(() => { if (state.mode !== "maxchud") return clearInterval(notes); floatText(Math.random() > .5 ? "♪" : "♫", (Math.random() - .5) * 120); }, 400);
}

// cave lives in the extension popup (the 🐻 toolbar button)
function togglePopup() {
  const p = $("popup"); p.style.display = p.style.display === "block" ? "none" : "block";
  drawCave();
}
function drawCave() {        // what the popup shows when it opens
  const cb = $("caveBarry"), z = document.querySelector(".caveScene .zzz");
  setSprite(cb, "barry-default");
  cb.style.transition = "none";
  cb.style.left = state.cave ? "150px" : "10px";
  cb.style.opacity = state.cave ? 0 : 1; cb.style.scale = state.cave ? ".5" : "1";
  z.style.display = state.cave ? "block" : "none";
  $("caveBtn").textContent = state.cave ? "let barry out" : "send barry back";
}
async function caveButton() { state.cave ? letBarryOut() : sendBarryBack(); }

// "send barry back": page Barry hops off, popup Barry hops into the cave
async function sendBarryBack() {
  stopEverything(); say(""); state.cave = true; state.mode = "lockin";
  $("caveBtn").disabled = true;
  // on the page: hop off the right edge
  setSprite(body, "barry-default"); body.classList.add("hop");
  moveTo(browser.clientWidth + 40);
  // in the popup: hop from the left into the cave mouth, then shrink into the dark
  const cb = $("caveBarry"), z = document.querySelector(".caveScene .zzz");
  setSprite(cb, "barry-default", { anim: "hop" });
  cb.style.transition = ""; cb.style.left = "10px"; cb.style.opacity = 1; cb.style.scale = "1";
  void cb.offsetWidth;
  cb.style.left = "150px";
  await wait(1400);
  cb.classList.remove("hop"); cb.style.opacity = 0; cb.style.scale = ".5";
  await wait(400);
  barry.classList.add("hidden"); z.style.display = "block";
  $("caveBtn").textContent = "let barry out"; $("caveBtn").disabled = false;
}
// "let barry out": happy Barry bursts out of the cave and hops to the bottom-right
async function letBarryOut() {
  state.cave = false; $("caveBtn").disabled = true;
  const cb = $("caveBarry"); document.querySelector(".caveScene .zzz").style.display = "none";
  cb.style.transition = ""; cb.style.opacity = 1; cb.style.scale = "1";
  setSprite(cb, "barry-happy", { anim: "hop" });          // happy, arms up, bursting out
  cb.style.left = "10px";
  // on the page: happy Barry hops in from the right edge to the bottom-right corner
  barry.style.transition = "none"; moveTo(browser.clientWidth + 40);
  barry.classList.remove("hidden"); say("");
  setSprite(body, "barry-happy", { anim: "hop" });
  void barry.offsetWidth; barry.style.transition = "";
  corner(); await wait(1000);
  body.classList.remove("hop"); await wait(400);
  chillIdle(); drawCave(); $("caveBtn").disabled = false;
}

function reset() {
  stopEverything(); clearInterval(snoozeTimer);
  state = { mode: "chill", size: "slim", chomps: 0, punches: 0, chud: 0, cave: false, grow: 1 };
  barry.classList.remove("hidden"); $("popup").style.display = "none"; $("chudBar").style.display = "none";
  $("caveBtn").disabled = false;
  body.style.transform = ""; reopenTab(); $("video").textContent = '▶ playing: "1 hour of cat videos"';
  chillIdle();
}

setSprite($("chudBarImg"), "chud-bar");
reset();