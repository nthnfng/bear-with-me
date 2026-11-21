# Barry the Bear: Animations

Every animation and trigger for **Barry**, the pixel-art bear in the *Bear It* Chrome extension. This file is the map: start here.

**Quick look:** open `demo/index.html` in Chrome (double-click works, no server needed). Use the buttons on the right to play every trigger.

---

## Status: what's built and what isn't

This folder is the **animation layer only**. It is not a working extension yet.

### ✅ Built
- **Sprites:** every PNG in `public/assets/sprites/`, rebuildable from `source/` with `tools/build_sprites.py`. (`source/` and `tools/` live with the art team, outside this repo.)
- **Animation sequences:** each trigger function in `demo/barry/triggers.js` plays its whole sequence. For example, `gotOwned()` runs fall → get up → "ow" → "my arm hurts" → sit tired. `burstIn()` pops Barry in with the bubble + "Back to it?" button.
- **In-page reactions:** eating clicks/scrolls/keys (`chomp`), punching the arm (`punch`), clicking tired Barry to get up (`getUp`), and the chud meter filling (`setChud`) all work, because the page itself detects them.

### ❌ Not built yet
| Missing piece | What it means |
|---|---|
| **The "when" (Barry Brain, service worker)** | Code that decides a trigger should fire: calendar block started (ICS parsing), blocklisted site opened during Lock In (blocklist + subdomain matching), slack pass ran out (`chrome.alarms`), free gap opened. **In the demo, buttons do this job.** This is most of the PRD and the biggest piece of work. |
| **Wiring (messages)** | The content-script listener that maps a message like `{ type: "burstIn" }` to a trigger, and the page reporting results back (`armReachedTab`). See [Connecting to the extension](#connecting-to-the-extension). |
| **Mounting on real pages** | Triggers expect the demo's fake browser (`#browser`, `#video`, `#tabX`). A `mountBarry()` is needed to inject Barry's markup into a full-page overlay in a **shadow DOM** on real sites. |
| **Real actions** | `chrome.tabs.remove` for closing tabs, pausing real `<video>`/`<audio>`, real sound files, and `chrome.storage` for state that carries across tabs (fatness, cave, chud meter, slack end time). |
| **Popup** | The real popup: mode override, slack pass + duration, cave, blocklist editor, ICS URL, dev panel. The demo only fakes the cave part. |
| **Hardcoded text → arguments** | "ETF prep" and "Lab report? / 40 free minutes" are fixed strings. Change them to `burstIn(task)` and `freeGap(todo, minutes)` so the worker can pass real data. |

### Suggested build order
1. **Wiring + `mountBarry()`:** Barry appears on real pages, and any animation can be fired from the service-worker console.
2. **Blocklist + manual Lock In toggle:** opening YouTube makes him burst in (the core demo moment).
3. **Slack pass + alarms:** warning, arm reach, punches and tab closing on real tabs.
4. **Calendar ICS + free gaps:** automatic Lock In from Google Calendar.

---

## Folder structure

```
bear-with-me/
├── demo/                    ← the team's plain-JS animation demo (art reference, not extension code)
│   ├── index.html           ← open this in Chrome (double-click works)
│   ├── demo.css             ← fake browser window + control panel
│   └── barry/
│       ├── sprites.js       ← sprite list: size, frame count, speed, paw positions
│       ├── engine.js        ← helpers: setSprite, playAnim, say, moveTo, wait, setChud…
│       ├── triggers.js      ← one function per trigger (chillIdle, burstIn, gotOwned…)
│       └── barry.css        ← Barry's styles + every animation class (pop, chomp, squash…)
├── public/assets/sprites/   ← final PNGs used by the demo and the extension (generated, don't hand-edit)
├── src/overlay/             ← the extension's TypeScript port of the demo (see implementation-plan.md, Phase 5)
└── (art team, outside this repo)
    ├── source/aseprite/     ← .aseprite files
    ├── source/images/       ← non-Aseprite art (pointing-hand.png photo)
    └── tools/build_sprites.py ← rebuilds public/assets/sprites/ from source/
```

**Load order** (plain `<script>` tags, no build step): `sprites.js` → `engine.js` → `triggers.js`.

---

## Triggers

Each trigger is a function in `demo/barry/triggers.js`. In the demo, a button calls it. In the extension, the service worker ("Barry Brain") decides when it fires.

```markdown
chill-idle (outside a calendar block)                          chillIdle()
- barry-chill-mug in the bottom-right corner, sipping (13 frames, 220 ms)

free-gap suggestion (chill, 20+ free minutes before next block)  freeGap()
- barry-thinking pops in + breathes + bubble: "You've got 40 free minutes. Lab report?"
- back to chill idle after 4 s

lock-in on task (calendar block, normal site)                  lockInOnTask()
- barry-studious in corner (14 frames, 180 ms): reads, paw slides up, page flips, paw slides down

burst in (lock-in + blocklisted site)                          burstIn()
1. pauses media
2. barry-suspicious pops up in the middle + pop sound
3. bubble: "You planned ETF prep ,':/" + "Back to it?" button
4. works even if Barry is in his cave

chomp (during burst in: click / scroll / arrow keys / space / j / k)   chomp(e)
1. "chomp!" floats up + chomp sound + squash
2. clicks 1–4 → barry-fat-1 … barry-fat-4 (fatter each click, stays centred)
3. click 5 → barry-chud (pop)
- Barry is ONLY chud-sized while eating clicks, and during the "I'm a chud" dance

back to it (click the button)                                  backToIt()
1. shrinks back to default size: barry-close-tab (pop, 450 ms)
2. arm (drawn in code) stretches from his paw to the tab's ✕ (350 ms)
3. explosion (pixel squares, code) + tab closes
4. leave(): walks to corner as barry-studious

switch tabs (another blocklisted tab)
- same Barry, same size (store size/chomps in chrome.storage)

slack pass started                                             slackStart()
1. if he was in your face: barry-suspicious + "Okay... -_-" (1.2 s)
2. barry-chill (lounging) in corner, breathing
3. bubble: clock icon + time left; chud-bar appears (doesn't fill yet)

slack pass ending (warning)                                    slackWarning()
- barry-suspicious-tap (6 frames, 130 ms: foot taps) + "Wrap it up! 30s"

slack over (arm reach)                                         armReach()
1. barry-close-tab, arm slowly stretches toward the tab's ✕ (7 s)
2. bubble: "Closing restricted tabs 💣"
3. arm reaches the tab → explosion + tab closes

punch (click the ARM only, not Barry's body; pushes 1–4)       punch()
- "POW" + flash/shake + punch sound; arm snaps back and reaches again

after 5th punch                                                gotOwned()
1. barry-got-owned for 5 s + spinning ✦
2. barry-get-up (0.3 s) → barry-get-up-2 (0.3 s)
3. bounce → barry-default (2 s)
4. bounce → barry-suspicious (1 s) + "ow"
5. bounce → barry-grieved (2.2 s) + "my arm hurts i guess ill leave u alone"
6. squash & stretch → barry-tired, seated in the bottom-right
7. stays seated; chud-bar fills while he sits (demo: +10% / 2 s)

tell tired Barry to get up (click him, or a popup button)      getUp()
1. squash → barry-happy does one slow jump (0.9 s)
2. barry-default standing in the corner (Lock In mode)

chud-bar                                                       setChud(level)
- 0–10 in 10% steps. 0 = all green (studious), 10 = all orange (chud)
- PNG is the outline; code draws the orange fill over the green track

max chud (chud-bar full, level 10 ONLY)                        maxChud()
- barry-chud-point (photo hand) bounces left ↔ right around the middle (90 px, every 0.9 s)
- ♪ notes float up + bubble: "♪ I'm a chud ♪"

cave (extension popup, 🐻 toolbar button)                      sendBarryBack() / letBarryOut()
- "send barry back": page Barry hops off-screen; popup Barry hops into the cave → "z z Z"
- "let barry out": barry-happy hops out of the cave and onto the page to the bottom-right → chill idle
- burst in still pulls him out of the cave
```

---

## Sprites

All in `public/assets/sprites/`. Sizes are **art pixels** (1 frame). The code scales by `S = 4`.

| Sprite | Size | Frames | Used for |
|---|---|---|---|
| `barry-default` | 17×20 | 1 | get-up pause, standing after getting up, cave send-off |
| `barry-chill-mug` | 17×20 | 13 | chill idle (sipping) |
| `barry-chill` | 29×18 | 1 | slack pass active (lounging) |
| `barry-thinking` | 17×20 | 1 | free-gap suggestion |
| `barry-studious` | 18×20 | 14 | lock-in on task (reading + page flip) |
| `barry-suspicious` | 17×20 | 1 | burst in, "Okay... -_-", "ow" |
| `barry-suspicious-tap` | 17×20 | 6 | slack warning (foot tap) |
| `barry-fat-1` … `-4` | 22×25 → 42×38 | 1 | eaten clicks 1–4 |
| `barry-chud` | 50×50 | 1 | eaten click 5 |
| `barry-chud-point` | 50×50 | 1 | "I'm a chud" dance (**PNG saved at 4×**, see below) |
| `barry-close-tab` | 17×20 | 1 | arm reach body |
| `barry-got-owned` | 30×14 | 1 | knocked down after 5th punch |
| `barry-get-up` | 29×17 | 1 | getting up, frame 1 |
| `barry-get-up-2` | 28×19 | 1 | getting up, frame 2 |
| `barry-grieved` | 17×20 | 1 | "my arm hurts…" |
| `barry-tired` | 18×23 | 1 | sitting after getting owned |
| `barry-happy` | 21×21 | 1 | slow jump when getting up, leaving the cave |
| `chud-bar` | 35×5 | 1 | chud meter outline |
| `icon-clock` | 7×7 | 1 | slack countdown |
| `barry-point`, `barry-workout`, `arm`, `bubble` | | | **unused**, kept for later (arm and bubble are drawn in code/CSS) |

**Code instead of art:** the stretchy arm, explosion, speech bubble, cave, stars, music notes, "chomp!"/"POW" text and sounds are all made in code, so no sprites are needed for them.

---

## How the code works

Every trigger is built from a few helpers in `demo/barry/engine.js`:

```js
setSprite(body, "barry-suspicious", { anim: "pop" });  // swap picture (+ flips strips) + play a CSS animation
say("You planned ETF prep ,':/");                      // speech bubble ("" hides it)
moveTo(260); corner();                                 // slide (CSS transition fills the in-betweens)
await wait(1000);                                      // sequence steps
```

- **Two kinds of animation:**
  - **Swap the picture:** `setSprite`. Strips flip automatically using `frameMs`.
  - **Move or stretch the picture:** CSS classes in `demo/barry/barry.css`, played with `playAnim`.
- **Pose changes that bounce:** `playAnim(body, "squash")`, wait 150 ms, then `setSprite(body, next, { anim: "unsquash" })`. The swap happens while he's squashed flat, so it looks smooth.
- **Sprite strips:** each sprite is a `div` with the PNG as its background. Frame *i* is shown with `background-position: -i × w × S px 0`.

### Adding a new animation
1. Draw it in Aseprite and save the `.aseprite` file to `source/aseprite/`.
2. Export it to `public/assets/sprites/<name>.png`. Either add it to `tools/build_sprites.py` and run that, or export a PNG from Aseprite: transparent background, **1× size**, horizontal strip for multiple frames.
3. Add a line to `ASSETS` in `demo/barry/sprites.js`: `w`, `h` (one frame), `frames`, and `frameMs` if it's a strip.
4. Use it in a trigger in `demo/barry/triggers.js` with `setSprite`.
5. Add a line for it to the trigger list in this file.

---

## Art conventions

- **PNG with a transparent background, exported at 1× size.** Code scales with `image-rendering: pixelated` at an integer scale (`S = 4`).
- **Fill Barry's inside white.** Most source layers are outline-only, and `build_sprites.py` fills them. If you export by hand, paint-bucket them white or the page shows through him.
- **Animations are horizontal strips** with the same canvas size for every frame.
- **Feet on the bottom row, horizontally centred**, so swapping sprites doesn't make him jump.
- **Names:** `barry-<pose>.png`, kebab-case. Other art uses plain names (`chud-bar.png`).
- **Exception, `barry-chud-point.png` is saved at 4×** (200×200) so the photo hand stays sharp. `sprites.js` still lists it as 50×50. If you change `S`, rebuild it at the new scale (`scale=` in `build_sprites.py`).
- **Edit art in `source/`, never in `public/assets/sprites/`.** That folder gets overwritten by `tools/build_sprites.py`.

### Rebuild sprites
```bash
pip install pillow numpy
python3 tools/build_sprites.py
```

---

## Connecting to the extension

Every trigger is already its own function. In the extension, nothing calls them from buttons: **other parts of the extension send a message, and the page runs the matching function.**

### Who does what
| Part | What it is | Job for Barry |
|---|---|---|
| **Service worker** (`background.js`) | runs in the background, can't draw | **Decides when**: calendar, blocklist, timers. Sends commands to tabs. |
| **Content script** | runs inside every webpage | **Plays** the animations: `demo/barry/sprites.js` → `engine.js` → `triggers.js` → `listener.js` |
| **Popup** (`popup.html`) | window from the 🐻 toolbar button | User buttons: slack pass, cave, get up, mode override |

Messages: `chrome.tabs.sendMessage(tabId, msg)` (worker → page) · `chrome.runtime.sendMessage(msg)` (page/popup → worker).

### 1. Page: one listener that maps messages to triggers
```js
// content/listener.js (load after triggers.js)
const COMMANDS = {
  chillIdle:    () => chillIdle(),
  freeGap:      (m) => freeGap(m.todo, m.minutes),
  lockInOnTask: () => lockInOnTask(),
  burstIn:      (m) => burstIn(m.task),
  slackStart:   () => slackStart(),
  slackWarning: () => slackWarning(),
  armReach:     () => armReach(),
  setChud:      (m) => setChud(m.level),
  getUp:        () => getUp(),
  goToCave:     () => sendBarryBack(),
  leaveCave:    () => letBarryOut(),
};
chrome.runtime.onMessage.addListener((msg) => {
  const run = COMMANDS[msg.type];
  if (run) run(msg);
});
```

### 2. Worker: decides and sends
```js
// background.js
const send = (tabId, msg) => chrome.tabs.sendMessage(tabId, msg).catch(() => {});

// a tab finished loading → blocked during Lock In?
chrome.tabs.onUpdated.addListener(async (tabId, info, tab) => {
  if (info.status !== "complete") return;
  const { mode, blocklist, currentTask } = await chrome.storage.local.get(["mode", "blocklist", "currentTask"]);
  if (mode === "lockIn" && isBlocked(tab.url, blocklist)) send(tabId, { type: "burstIn", task: currentTask });
});

// timers: use alarms (the worker can be shut down between events, so no setTimeout)
chrome.alarms.onAlarm.addListener(async (alarm) => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (alarm.name === "slackWarning") send(tab.id, { type: "slackWarning" });
  if (alarm.name === "slackOver")    send(tab.id, { type: "armReach" });
});

// messages from the popup and from pages
chrome.runtime.onMessage.addListener(async (msg, sender) => {
  if (msg.type === "startSlack") {
    chrome.alarms.create("slackWarning", { delayInMinutes: msg.minutes - 0.5 });
    chrome.alarms.create("slackOver",    { delayInMinutes: msg.minutes });
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    send(tab.id, { type: "slackStart" });
  }
  if (msg.type === "armReachedTab") chrome.tabs.remove(sender.tab.id);   // only the worker can close tabs
});
```

### 3. Popup: buttons tell the worker
```js
// popup.js
slackBtn.onclick = () => chrome.runtime.sendMessage({ type: "startSlack", minutes: 15 });
getUpBtn.onclick = () => chrome.runtime.sendMessage({ type: "getUp" });
```

### 4. Page reports back
Only the page knows some things: the arm reached the ✕, 5 punches landed, "Back to it?" was clicked. Clicks, chomps and the arm fight stay inside the page; only the **result** goes to the worker.
```js
// in triggers.js, replace the demo's closeTab()
function closeTab() { chrome.runtime.sendMessage({ type: "armReachedTab" }); }
```

### 5. Manifest
```json
"background": { "service_worker": "background.js" },
"action": { "default_popup": "popup.html" },
"permissions": ["tabs", "storage", "alarms"],
"content_scripts": [{
  "matches": ["<all_urls>"],
  "js": ["demo/barry/sprites.js", "demo/barry/engine.js", "demo/barry/triggers.js", "content/listener.js"],
  "css": ["demo/barry/barry.css"]
}],
"web_accessible_resources": [{ "resources": ["assets/sprites/*.png"], "matches": ["<all_urls>"] }]
```
`sprites.js` already switches to `chrome.runtime.getURL("assets/sprites/")` inside the extension.

### 6. Demo-only parts to replace
- **`#browser`, `#video`, `#tabX`:** `mountBarry()` creates a full-page fixed overlay inside a **shadow DOM**, so page CSS can't touch Barry. Inject `demo/barry/barry.css` into the shadow root. The corner sprite uses `pointer-events: none`, so he never blocks the page. Aim the arm at the top-right of the window instead of `#tabX`.
- **`#video` text:** pause real `<video>`/`<audio>` elements, and catch `play` events as eaten "unpause" clicks.
- **`sfx()` beeps:** `new Audio(chrome.runtime.getURL("assets/sounds/chomp.ogg")).play()`.
- **The cave lives in the popup.** The page and the popup are separate windows, so "send barry back" plays two animations: the page hops off and the popup hops into the cave. The popup messages the worker, which saves `cave: true` and sends `goToCave` to the tabs.
- **Demo timings are shortened:** slack pass is 15 s (real: 15 min), chud fill is 2 s per step (real: ~30 s), and the warning comes 5 s before the end (real: 30 s).

### Test one trigger at a time
From the service-worker console (`chrome://extensions` → "service worker"):
```js
chrome.tabs.query({ active: true }, ([t]) => chrome.tabs.sendMessage(t.id, { type: "burstIn", task: "ETF prep" }));
```
The PRD's dev panel works the same way: each dev button sends one of these messages.

---

## Open decisions / TODO

- **Getting up while still on a blocked tab:** `getUp()` puts Barry in Lock In standing. By the PRD rules, Lock In plus a blocklisted tab means he bursts in right away. Decide whether getting up should close the tab first.
- **Sounds:** `sfx()` is placeholder beeps. Real `chomp`, `punch`, `explode`, `pop` and "I'm a chud" files are still needed.
- **Optional art:**
  - `cave.png` to replace the CSS cave.
  - A frowning chud face (chud always smiles).
  - A pixel-art explosion strip to replace the code particles.

---

## Rules

The demo code under `demo/` is the art reference. The extension's overlay (`src/overlay/`) ports its look in TypeScript while the brain decides what to show (see ADR 0001).

- Edit art in `source/`, then run `python3 tools/build_sprites.py` (`source/` and `tools/build_sprites.py` live with the art team, outside this repo). Never hand-edit `public/assets/sprites/` (it gets overwritten).
- Sprite sizes in `demo/barry/sprites.js` are in art pixels for ONE frame. Update `w`/`h`/`frames`/`frameMs` there when art changes.
- Keep pixel art crisp: integer scale (`S`), `image-rendering: pixelated`, move things in whole art-pixel steps.
- One function per trigger in `demo/barry/triggers.js`. When you add or change a trigger, update the trigger list in docs/animations.md too.
- Triggers should be started by messages (`{ type: "burstIn", task }`), not by reaching into the page from elsewhere.
- Barry is only chud-sized while eating clicks and during the max-chud dance (chud meter at 10/10).
- After changes, open `demo/index.html` and click through the affected trigger to check it.
