# Implementation Plan: Barry the Bear

Companion to [prd-barry.md](./prd-barry.md). Terms follow [CONTEXT.md](../CONTEXT.md).

The build is split into **5 phases**. Each phase has **3 workstreams, one per person**, that run at the same time, and ends with an **integration checkpoint** where the three pieces are joined and checked together before anyone starts the next phase.

## How three people work at once without blocking

- **Shared contracts.** Everything builds against `src/contracts/` (already written). Change them only through a PR the whole team knows about.
- **Fakes until the real thing lands.** Each workstream builds against stand-ins, so nobody waits within a phase:
  - The brain is built against its own tests.
  - The runtime is built against a temporary stub brain.
  - The overlay is built against the example screens in `src/dev/fixtures.ts`.
- **Each person owns the same folders in every phase.** That keeps merge conflicts rare, and each person builds up deep knowledge of one area.
- **Pages only draw what they're told** ([ADR 0001](./adr/0001-pure-brain-dumb-renderers.md)). Any behaviour goes in the brain, never in the overlay or popup.

| Person | Lane | Owns |
|---|---|---|
| **A** | Brain | `src/brain/` and its tests |
| **B** | Runtime, calendar & popup | `src/runtime/`, `src/schedule/`, `entrypoints/background.ts`, `entrypoints/popup/` |
| **C** | Overlay, picker & art | `src/overlay/`, `src/picker/`, `entrypoints/content.ts`, `public/assets/` |

**Git:** each person works on short-lived branches and merges to `main` often, and always before a checkpoint. Edits outside your own folders, and any change to `src/contracts/`, go through a PR that the owner reviews.

## Tech stack

- **WXT** (Manifest V3 extension framework, built on Vite) with **TypeScript**.
- **Vitest** for the two pure, testable pieces: the brain and the ICS parser.
- **React** for the popup only. The overlay is plain TypeScript inside a shadow root, so it stays light and isolated from the page.
- **ical.js** under the ICS parser.
- **Assets:** PNG sprite sheets, an explosion GIF, and sounds, all in `public/assets/` so web pages can load them.

## Phase 0: Foundation ✅ (done)

- WXT + React + TypeScript + Vitest + Prettier skeleton. It builds and loads in Chrome.
- `src/contracts/`: domain types, the brain's inputs, outputs and per-tab view, messages, storage keys, defaults, and pose and sound ids.
- `src/dev/fixtures.ts`: example screens for every situation.
- `CONTEXT.md` glossary, ADR 0001, and stub folders for each lane.

---

## Phase 1: The demo core

**Goal:** with a fake Calendar block, opening YouTube makes Barry burst in. He eats clicks with a chomp and grows each time. "Take it away, Barry" makes the tab explode and close.

### A: Brain, Confrontation

Write the test first for each item:

- [ ] `initialState`; mode resolution (auto vs. override, whether a Calendar block covers now, all-day events ignored).
- [ ] Restricted-site matching: subdomains, and entries that are toggled off.
- [ ] Clear → Confronting when a Restricted tab becomes active in Lock In. Its view shows Barry in your face with "You planned {title} ,':/", "Take it away, Barry", eaten input, and paused media. Arriving plays the `burst` sound.
- [ ] `eaten`: Fatness goes up, the view's scale grows (capped), and a `chomp` plays.
- [ ] Fatness is kept when switching between Restricted tabs, and resets only when no Restricted tab is open anywhere.
- [ ] `backToIt`: `explodeAndClose` on that tab, with no Fatness added.
- [ ] Clear view: studious Barry in Lock In, chill Barry in Chill, hidden when the cave is on.
- [ ] Dev commands: `injectBlock`, `setFatness`, `reset`.

### B: Runtime

Use a stub brain at first (any Restricted tab shows the `confrontation` fixture) and swap in A's brain once it lands.

- [ ] Load and save state in `storage.local`, and process events one at a time through a queue.
- [ ] Tab tracking: `onActivated`, `onUpdated` (URL changes), `onRemoved`, and window focus. Inject the content script into tabs that were open before install.
- [ ] Message router: content messages become brain events, with `now` stamped here.
- [ ] After each event, push `viewFor` to the affected tabs, and reply to a page's `hello` with its view.
- [ ] Carry out effects: `explodeAndClose` (send the explosion to each tab, wait ~1s, then close the tabs) and `playSound` (forward to the tab).
- [ ] Clock: a 30-second alarm, plus a precise timer to `nextDeadline` while the background is running.
- [ ] Temporary dev hook: a `dev` message that can be sent from the background's console, so the demo can inject a fake block before the popup exists.
- [ ] **30-minute check:** can the background `fetch` a Google secret ICS URL? Note the result for Phase 3.

### C: Overlay and placeholder art

Build against `src/dev/harness.html`: a test page with a `<video>`, scrolling content and buttons, plus a picker that feeds it the example screens.

- [ ] Placeholder sprites (labelled boxes) for every pose, and `public/assets/manifest.json` following `src/contracts/assets.ts`. Move `assets/barry-home.png` into `public/assets/`.
- [ ] Shadow-root host and sprite renderer: pose, scale, corner position (left/middle/right), speech bubble, and the "Take it away, Barry" button. The corner sprite never blocks clicks.
- [ ] Input eater, used when the view says to eat input: clicks, pointer, wheel and touch events, plus keys like space and arrows caught before the page sees them. Report each one, while Barry's own button stays clickable.
- [ ] Media pause: every `video` and `audio` element, including ones added later, re-paused if they start playing, each restart reported as an eaten unpause.
- [ ] Effects: explosion GIF, `chomp` and `burst` sounds.
- [ ] **Early check on real sites:** eater and media pause on YouTube and Shorts.

### ✅ Checkpoint 1

The demo core works end to end with no fakes:

1. Inject a block from the console.
2. Open YouTube: Barry bursts in and the video pauses.
3. Clicks chomp and Barry grows.
4. "Take it away, Barry" makes the tab explode and close.
5. Barry is studious in the corner.

From here on, keep this path working.

---

## Phase 2: Breaks and the Arm fight

**Goal:** the full Slack pass → warning → Reach → Push → Snooze loop works across several Restricted tabs, and the popup controls it.

### A: Brain, breaks and the Arm fight

- [ ] `slackPassStarted`: ignored in Chill. While Confronting it shows "Okay... -_-", resets Fatness, and moves Barry to the corner. On Restricted tabs during the pass, Barry stays in the corner with a countdown and nothing is eaten.
- [ ] Slack pass ends → warning → Reaching. The Reach start time is shared so every Restricted tab shows the same arm progress. The page works normally during the Arm fight.
- [ ] `pushed`: plays `punch` and restarts the Reach. A stale `reachLanded` (one from before a Push) is ignored.
- [ ] `reachLanded`: `explodeAndClose` on every Restricted tab, then back to Clear.
- [ ] 5th Push: beaten pose, `ow`, the "Ow... T-T" line, and a Snooze starts with Pushes reset. When the Snooze ends, the Reach restarts with no warning.
- [ ] Lock In ending mid-fight goes back to Clear and drops any Slack pass or Snooze.
- [ ] `nextDeadline` for the end of a Slack pass, the warning, the Reach, and a Snooze.
- [ ] Dev: `setTuning` (durations in seconds).

### B: Popup v1 and runtime hardening

- [ ] Popup reads state from storage and stays live via `storage.onChanged`, and sends popup messages.
- [ ] Status: mode, current and next block, break countdown.
- [ ] Controls: Auto / Chill / Lock In, and starting a Slack pass with a duration (disabled in Chill).
- [ ] Hidden dev panel (click the bear 5 times): inject a block, set durations, set Fatness, set the Chud meter, reset.
- [ ] Runtime: precise wake-ups at each deadline; `explodeAndClose` across many tabs and windows; picking up mid-Reach after the background is killed (test from `chrome://serviceworker-internals`).

### C: Overlay, Arm fight, and first real art

- [ ] Reach arm: stretches from studious Barry's hand anchor toward the top-right of the viewport, with progress worked out from the shared start time every frame. Clicking the arm or Barry reports a Push. Reaching the end reports `reachLanded` with the start time it used.
- [ ] Sounds: `punch` and `ow`. The okay shrink animation, the beaten pose, and the break countdown widget.
- [ ] Real sprites, replacing placeholders: confrontation, the Reach arm (tiling segment plus fist), beaten, studious, okay.

### ✅ Checkpoint 2

1. Start a Slack pass with a 10-second dev duration on YouTube.
2. Open Reddit too.
3. Warning, then the Reach. Switching tabs keeps the arm in the same place.
4. Push 4 times, then let it land: both tabs explode.
5. Repeat, push 5 times: beaten Barry and a Snooze, then the Reach comes back.
6. Kill the background mid-Reach; it resumes.

---

## Phase 3: Chud meter, calendar and todos

**Goal:** everything in the spec is real. Real calendar, Chud meter, todo picker, free-time suggestions, all settings.

### A: Brain, Chud meter and the rest

- [ ] Chud meter fills from timestamps during a Snooze only, and carries across blocks and days.
- [ ] Studying and Locking back in: Studying requires Lock In, no break, no Restricted tab active, and the user not idle. `idleChanged` pauses it. 10 unbroken minutes resets the Chud meter to 0.
- [ ] Full Chud meter: Confrontations and the Arm fight use chud Barry and play `chudSong` once on arrival, until the user Locks back in.
- [ ] Free-time suggestion: in Chill, when the gap to the next block is at least 20 minutes, a `showSuggestion` for the top todo, once per gap.
- [ ] Cave rules (can't hide Barry on a Restricted tab in Lock In), `blocklistSet`, `positionSet`, `mutedSet`, `todosUpdated`, `scheduleUpdated`.

### B: Calendar, idle, and popup settings

- [ ] ICS parser, test-first against sample `.ics` files in `src/schedule/fixtures/`: recurring events, a cancelled occurrence, a moved occurrence, time zones, all-day events, events outside the window.
- [ ] Fetcher: refresh every 5 minutes and when the popup opens, keep the last good result, and save the fetch status.
- [ ] Idle: `chrome.idle` (5-minute threshold, plus screen locked) sends `idleChanged`.
- [ ] Popup settings: ICS URL with setup instructions and last-fetch status or error; blocklist editor with an on/off toggle per site; cave toggle (disabled when Barry can't hide); position; mute; Chud meter display.

### C: Todo picker, Chud visuals, and remaining art

- [ ] Picker: highlight on hover, click to save, Esc to cancel. Selectors use stable attributes where possible. Saved per page.
- [ ] Todo reader: re-read the list when visiting a saved page, and send `todosCaptured`. Test on Notion, Todoist, and a Google Docs checklist.
- [ ] Popup todo section: "Point Barry at my task list" button, captured todos, list of sources with remove. Coordinate with B, who owns the popup.
- [ ] Overlay: Chud meter widget, chud song playback, and the suggestion as a speech bubble from chill Barry.
- [ ] Real sprites: chud, chill, cave, toolbar icons. All five sounds finished.

### ✅ Checkpoint 3

1. A real Google Calendar block triggers Lock In.
2. Three Snoozes fill the Chud meter, and chud Barry sings.
3. 10 minutes of Studying resets it, and walking away doesn't.
4. A Notion list is captured, and a free-time suggestion names its top item.
5. Every popup setting works.

---

## Phase 4: Polish and demo

**Goal:** the demo works on stage every time.

### A: Tuning and demo script

- [ ] Playtest and tune the numbers in `src/contracts/config.ts`: Fatness growth, Reach length, warning length, Chud fill rate.
- [ ] Brain edge cases found in the bug bash, each with a test.
- [ ] Demo script: calendar block → YouTube burst → chomps and growth → "Take it away, Barry" explosion → Slack pass → Arm fight → 5 Pushes → Snooze → chud song.

### B: Real-world hardening and docs

- [ ] Test on real sites: YouTube, Shorts, Reddit, X, Twitch, Netflix. Also multiple windows, `chrome://` tabs, and laptop sleep.
- [ ] Demo browser profile: extension preloaded, dev panel ready, tabs staged, notifications off.
- [ ] README: install, ICS setup, why each permission is needed, privacy (everything stays local).

### C: Visual polish and pitch

- [ ] Animation polish: burst-in, shrink, beaten wobble, explosion timing.
- [ ] Pitch slides, with the softened wording: "Chill by default. Lock In when you mean it."
- [ ] Backup screen recording of the full demo.

### ✅ Checkpoint 4 (feature freeze)

Run the demo script twice in the demo profile without touching code. After this, fix bugs only.

---

## Phase 5: Real art, animations and sounds

**Goal:** on real pages Barry looks, moves and sounds like the team's animation demo (`demo/index.html`, mapped in [animations.md](./animations.md)), still driven entirely by the brain.

**Port, don't copy.** The demo is plain JS that decides *and* draws. In the extension the split from [ADR 0001](./adr/0001-pure-brain-dumb-renderers.md) stays:

- **The brain** owns anything that changes what Barry says, how long something lasts, or what the user can do (poses, lines, the Snooze sequence's stages, Get up).
- **The overlay** owns how it looks: sprite strips, CSS animation classes, sub-second in-between frames, floating "chomp!"/"POW"/♪ text, particles.

### Decisions (2026-11-21)

- **Fatness is sprite tiers, not scaling.** Eats 0 → `suspicious`, 1–4 → `fat-1`…`fat-4`, 5+ → `chud`. `TabView.scale`, `scalePerFat` and `maxScale` retire.
- **The Snooze stays timed, and Barry can be told to get up.** After the 5th Push: knocked down (5 s, spinning ✦) → get-up frames → "ow" → "my arm hurts i guess ill leave u alone" → sits tired in the corner. Clicking tired Barry ends the Snooze early (**Get up**: one happy jump, then the Arm comes back like a normal Snooze end). The Chud meter only counts the Snooze time actually used.
- **Max chud is a Confrontation.** With a full Chud meter, the Confrontation is the chud-point dance (sway ±90 px around the middle every 0.9 s, ♪ notes, "♪ I'm a chud ♪") plus the chud song. A Reach with a full meter uses `chud` as the Arm's body.
- **The team's demo code moves to `demo/`.** `src/barry/*` → `demo/barry/`, so `src/` is only extension code. The demo keeps working as the art reference. The "Animations" rules in `CONTEXT.md` move to `docs/animations.md` (the glossary stays terms only), with paths fixed.

### Pose map

One `PoseId` per sprite. Sizes are art pixels; `S` is the integer screen scale.

| Situation | Pose / sprite | Frames | Overlay animation |
|---|---|---|---|
| Chill, corner | `chill-mug` | 13 × 220 ms | — |
| Free-gap suggestion | `thinking` | 1 | pop, then breathe; bubble 4 s |
| Lock In, on task | `studious` | 14 × 180 ms | — |
| Confrontation, 0 eats | `suspicious` | 1 | pop (burst-in) + flash |
| Confrontation, 1–4 eats | `fat-1` … `fat-4` | 1 | chomp squash + "chomp!" |
| Confrontation, 5+ eats | `chud` | 1 | pop on the 5th, chomp after |
| Confrontation, Chud meter full | `chud-point` | 1 (PNG at 4×) | bounce + sway + ♪ |
| Back to it | `close-tab` | 1 | pop, fast Arm (350 ms) to the tab, explosion |
| Slack pass from a Confrontation | `suspicious` + "Okay... -_-" | 1 | — |
| Slack pass | `chill` (lounging) | 1 | breathe; bubble: clock icon + time left; chud bar |
| Warning | `suspicious-tap` + "Wrap it up!" | 6 × 130 ms | — |
| Reach | `close-tab` (`chud` if meter full) | 1 | Arm from the pose's paw anchor to the tab |
| Push | same | — | hit flash/shake + "POW" |
| Snooze: knocked down | `got-owned` | 1 | spinning ✦ |
| Snooze: getting up | `get-up`, `get-up-2`, `default` | 1 each | squash/unsquash between poses |
| Snooze: "ow" | `suspicious` | 1 | unsquash |
| Snooze: "my arm hurts…" | `grieved` | 1 | unsquash |
| Snooze: resting | `tired` (clickable) | 1 | squash into it |
| Get up | `happy` | 1 | slow jump, then the Snooze ends |

**Size on screen.** At `S = 4` the corner sprites are ~70 px and `fat-4` is 168 px. In-your-face placement should be larger: use `S = 8` for `face`, still an integer so pixels stay crisp. Lane C confirms in the harness. `chud-point` is saved at 4×, so it gets a little soft at 8×; that's acceptable, or the team re-exports it at 8×.

### Contract changes (orchestrator, before the lanes start)

- `PoseId`: the sprite list above (`chill-mug`, `chill`, `thinking`, `studious`, `suspicious`, `suspicious-tap`, `fat-1`…`fat-4`, `chud`, `chud-point`, `close-tab`, `got-owned`, `get-up`, `get-up-2`, `default`, `grieved`, `tired`, `happy`).
- `AssetManifest`: per-pose `{ file, w, h, frames, frameMs?, paw? }` (paw = the Arm's start, from the demo's `PAW`), plus `scale: { corner, face }`, `chudBar`, `clockIcon`. `public/assets/manifest.json` is rewritten to match.
- `SoundId` gains `explosion` (`sounds/explosion.mp3`).
- `TabView`: drop `scale`. Add `poseSince: Millis`, so every tab restarts a pose's strip and entrance animation from the same moment. Add `canGetUp: boolean` (tired Barry is clickable).
- `BarryState`: add `snoozeStartedAt: Millis | null` (the Snooze stages are timed from it).
- Event `gotUp` (`ContentMessage { type: 'gotUp' }` and the popup's Get up button).

### A: Brain

- [ ] Fatness tiers → pose; remove scale. Tests per tier, including switching Restricted tabs keeping the tier.
- [ ] Snooze stages from `snoozeStartedAt` (knocked down 5 s → get-up 0.6 s → standing 2 s → "ow" 1 s → "my arm hurts…" 2.2 s → tired). `nextDeadline` includes stage boundaries, so views re-push on time. `canGetUp` only in the tired stage.
- [ ] `gotUp` ends the Snooze early, with a short `happy` stage first. The Chud meter integrates only the time used. Tests: get up at each stage (ignored before tired), muted, mode flips, laptop-sleep jumps.
- [ ] Max chud: `chud-point` for a full-meter Confrontation, `chud` as the Reach body; the chud song keeps its once-per-arrival rule.
- [ ] Lines aligned with the art: warning "Wrap it up!" (countdown in the bubble), "ow", "my arm hurts i guess ill leave u alone", "♪ I'm a chud ♪". The full PRD lines stay where the art has none.
- [ ] Update `docs/demo-script.md` beats to the new sequence.

### B: Runtime and popup

- [ ] `explosion` sound via the offscreen player when `explodeAndClose` runs (once per batch, timed with the overlay's explosion).
- [ ] Route `gotUp` from the content script and the popup.
- [ ] Popup: pixel-art Barry (current pose sprite) in the header next to `barry-home.png`; a Get up button while `canGetUp`; chud bar drawn from `chud-bar.png` in 10 steps.
- [ ] Popup cave: "send Barry back" / "let Barry out" hop animation from the demo (`barry-default` hops in, `barry-happy` hops out), still one screen, still a toggle.

### C: Overlay and art

- [ ] Move `src/barry/` → `demo/barry/` and fix `demo/index.html`; move the animation rules out of `CONTEXT.md` into `docs/animations.md` and fix its paths (`assets/sprites/` → `public/assets/sprites/`; note that `source/` and `tools/build_sprites.py` live with the art team).
- [ ] Rewrite `public/assets/manifest.json` for the new contract. Delete the placeholder SVGs and `scripts/gen-placeholders.mjs` (keep `cave.svg` until the popup cave lands).
- [ ] Sprite renderer: a `div` with the PNG strip as its background, integer `S`, `image-rendering: pixelated`, a flipbook timer per `frameMs`, feet on the bottom edge, restarted when `poseSince` changes.
- [ ] Port `barry.css` animation classes into the shadow-root styles: breathe, pop, chomp, hit, squash/unsquash, slowjump, bounce; the bubble style; float text; the ✦ spin. Keep `prefers-reduced-motion`.
- [ ] Chomp feedback: when the overlay reports an eaten click, play the chomp squash and "chomp!" locally (cosmetic, same throttle). Pose tiers come from the view.
- [ ] Arm drawn in code (the demo's style) from the pose's `paw` anchor to the Phase 4 tab-strip target; punchable; Push plays hit + "POW". Back to it plays the 350 ms reach before the explosion.
- [ ] Explosion: the demo's pixel particles at the Arm's target, finishing inside the runtime's 1300 ms window.
- [ ] Chud bar: `chud-bar.png` outline with the orange fill drawn in 10 steps. Slack pass bubble: clock icon + time left.
- [ ] Snooze visuals: ✦ while knocked down, in-between get-up frames, tired Barry clickable → `gotUp`.
- [ ] Max chud dance: sway and ♪ notes.
- [ ] Harness: one button per row of the pose map, like the demo's panel.

### ✅ Checkpoint 5

In real Chrome, with Demo speed: run `docs/demo-script.md` and see every row of the pose map at least once, and hear burst, chomp, punch, ow, chud song and explosion. The demo page (`demo/index.html`) still opens and plays.

---

## Rough timeline (36-hour hackathon)

| Hours | Phase | A | B | C |
|---|---|---|---|---|
| 0–10 | 1 Demo core | Confrontation logic | Runtime | Overlay + placeholders |
| 10–11 | **Checkpoint 1** | together | together | together |
| 11–20 | 2 Arm fight | Breaks + Arm fight logic | Popup v1 + hardening | Arm, sounds, first art |
| 20–21 | **Checkpoint 2** | together | together | together |
| 21–29 | 3 Everything real | Chud meter, Studying, suggestions | ICS, idle, settings | Picker, chud visuals, art |
| 29–30 | **Checkpoint 3** | together | together | together |
| 30–36 | 4 Polish | Tuning, script | Real sites, docs | Polish, slides, recording |

If someone finishes early, they help the lane that's furthest behind, without editing that lane's files unless the owner agrees.

## Risks to check early

| Risk | When to check | Fallback |
|---|---|---|
| Background can't fetch Google's secret ICS URL | Phase 1, B (30 min) | Fetch from the popup or an offscreen document; the dev panel's fake block covers the demo |
| Eaten input leaks through (YouTube's own keyboard shortcuts) | Phase 1, C | Catch keys before the page does and stop them; worst case, cover the page fully with Barry |
| Video restarts itself (autoplay, Shorts swipe) | Phase 1, C | Re-pause on play and on time updates; mute as a backup |
| Background killed mid-fight | Phase 2, B | All timing is stored as timestamps, so the next event recalculates the phase |
| Browser blocks sound until the user interacts | Phase 1, C | Show "CHOMP" as text; sound works after the first eaten click |
| Notion's page structure resists stable selectors | Phase 3, C | Fall back to pasting todos into the popup |
| Art falls behind | Every phase | Placeholders stay until the real sprite lands; the demo path's sprites come first |
