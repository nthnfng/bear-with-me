# Implementation Plan: Barry the Bear

Companion to [prd-barry.md](./prd-barry.md). This plan splits the build into workstreams that can run in parallel once a short shared foundation (Workstream 0) is in place.

## How parallel work stays unblocked

Everything hangs off **one set of shared contracts**, written first and changed only by agreement:

1. **Brain types:** `BarryState`, `BarryEvent` (union), `BarryEffect` (union), `TabView` (render model).
2. **Message protocol:** messages between the service worker, content script, and popup.
3. **Asset manifest:** pose ids, sound ids, sprite frame and anchor conventions.
4. **Storage keys and settings shape.**

Each workstream builds against these contracts with **fakes** for everything else. For example, the overlay is built against a hand-fed `TabView`, the popup against a mocked state, and the brain against tests. Integration then mostly means deleting fakes.

### Key architectural choice: content scripts are dumb renderers

The brain doesn't send imperative "show this pose" commands to pages. Instead:

- The brain module exports a pure `viewFor(state, tabId, now) → TabView` that describes everything a tab should show: visible or not, corner or in-your-face, pose, tier, speech line, buttons, chud meter, slack time left, arm reach `{startedAt, durationMs}`, whether to eat input, and whether to pause media.
- After every event, the service worker pushes a fresh `TabView` to each affected tab. The overlay just renders whatever it's given.
- One-shot side effects (play sound, explode, close tabs) are separate `BarryEffect`s that the service worker executes.

This keeps all behavior in the testable brain. It also means the overlay and popup can be built and demoed entirely from hand-written `TabView` fixtures.

## Tech stack

- **WXT** (MV3 extension framework, Vite-based): handles manifest generation, multiple entrypoints, HMR, and zipping for the store.
- **TypeScript** everywhere. **Vitest** for the two pure seams.
- **React** for the popup only. The overlay is vanilla TS plus DOM inside a shadow root, to keep it light and isolated from host pages.
- **ical.js** (or `node-ical`'s browser-safe expander) under the ICS Parser.
- **Assets:** PNG sprite sheets, an explosion GIF, MP3/OGG sounds, all listed as web-accessible resources.

## Repo layout

```
entrypoints/
  background.ts            # service worker: runtime host (WS-C)
  content.ts               # overlay + picker entry (WS-D, WS-F)
  popup/                   # React popup (WS-E)
src/
  contracts/               # WS-0: types, messages, storage keys, asset ids
  brain/                   # WS-A: reducer, viewFor, nextDeadline + tests
  schedule/                # WS-B: ICS parser + fetcher + tests + fixtures
  runtime/                 # WS-C: tab tracker, storage, effect executor
  overlay/                 # WS-D: renderer, input eater, media, arm, sounds
  picker/                  # WS-F: element picker + todo reader
  dev/                     # fixtures + harness page for overlay/popup dev
public/assets/             # WS-G: sprites, explosion.gif, sounds, manifest.json
docs/
```

---

## Workstream 0: Foundation (everyone, first ~2 hours)

This is the only serial step. Do it together, ideally mob-style on one screen.

- [ ] Scaffold the WXT + TS project, Vitest, ESLint/Prettier, and the React popup. Confirm it loads unpacked in Chrome.
- [ ] Write `src/contracts/`:
  - `BarryState`: mode override, blocklist `{domain, enabled}[]`, blocks, todos, open restricted tab ids, active tab, phase (`focused | confronting | slacking | warning | reaching | beaten`), fatness, slack pass `{kind: 'chosen' | 'extended', endsAt}`, `reachStartedAt`, pushes, chud meter, last gap suggested, position, cave, and the tuning config.
  - `BarryEvent` union, matching the PRD's events list, with time carried on every event (`now`).
  - `BarryEffect` union: `playSound`, `explodeAndClose {tabIds}`, `showSuggestion`, `setBadge`.
  - `TabView` render model (see above).
  - Messages: content→SW `hello{url}`, `eaten{kind}`, `backToIt`, `pushed`, `armReached{startedAt}`, `pickerSaved`, `todosCaptured`. SW→content `view{TabView}`, `effect{BarryEffect}`, `startPicker`. Popup→SW one message per control, plus `dev:*`. SW→popup: popup reads storage and subscribes to `storage.onChanged`.
  - Storage keys: `state`, `settings`, `schedule`, `todos`.
  - Asset ids: the pose enum and sound enum.
- [ ] Write `src/dev/fixtures.ts`: about 10 hand-written `TabView`s, one per pose/phase, so WS-D and WS-E can start right away.
- [ ] Write the placeholder asset set (WS-G owner): coloured rectangles labelled with the pose name at the agreed frame size, so nothing waits on art.
- [ ] Agree on the branch flow: one branch per workstream, small PRs to `main` often, and any contract change goes through a PR the whole team is told about.

**Done when:** `main` builds, the extension loads, and the contracts compile with no `any`.

---

## Workstream A: Barry Brain (pure logic, test-first)

**Owner:** 1 person. **Depends on:** WS-0 only. **Seam:** test seam #1.

Build `reduce(state, event) → {state, effects}`, `viewFor(state, tabId, now) → TabView`, and `nextDeadline(state) → timestamp | null`. The last one tells the runtime when to wake up next (slack expiry, warning end, reach end).

Write the test first for each item, in this order. The order matches the demo critical path.

1. [ ] Mode resolution: auto vs. override, block coverage, all-day blocks ignored.
2. [ ] Restricted-site matching: subdomains, toggled-off entries.
3. [ ] **Confronting:** entering a restricted tab during Lock In gives an in-your-face view with "You planned {title} ,':/", `pauseMedia`, and `eatInput`.
4. [ ] "Back to it?" gives `explodeAndClose [thisTab]`, resets fatness, and moves to focused/studious.
5. [ ] Eaten interactions: fatness goes up, the tier is derived from it, and each one emits a chomp. Switching restricted tabs keeps fatness. Closing the tab resets it.
6. [ ] Slack pass (chosen): starting it while confronting gives the "Okay... -_-" line and resets fatness. The view is the corner with the chud meter and time left. The chud meter doesn't grow.
7. [ ] Expiry goes to warning, then reaching, with `reachStartedAt` set and every restricted tab getting the same arm data.
8. [ ] A push gives a punch and restarts the reach. A stale `armReached` is ignored. A valid `armReached` gives `explodeAndClose [all restricted tabs]` and resets.
9. [ ] The 5th push gives beaten, the "Ow... T-T" line, an extended 5-minute pass, and resets pushes. When the pass ends, reaching starts again with no warning.
10. [ ] Chud meter: it grows from timestamps during extended passes. At max it gives the chud pose and song.
11. [ ] Lock In ending mid-phase resets to focused and clears the slack pass and chud meter.
12. [ ] Cave: idle Barry is hidden, Lock In still shows him, and the cave toggle is ignored on a restricted tab in Lock In.
13. [ ] Free-gap suggestion: once per gap, with a threshold.
14. [ ] Dev events: fake block, set tier, set chud meter, set durations, reset.
15. [ ] `nextDeadline` is correct for every timed phase.

**Done when:** all PRD brain scenarios pass in Vitest, and the brain has no imports from `chrome` or the DOM.

---

## Workstream B: Schedule (ICS Parser + Fetcher)

**Owner:** 1 person (can share with WS-C or WS-F). **Depends on:** WS-0. **Seam:** test seam #2.

- [ ] Collect fixture `.ics` files. Export a real Google Calendar with recurring events, an exception, a moved occurrence, an all-day event, and an event in another time zone, then scrub the personal data.
- [ ] Write `parseIcs(text, windowStart, windowEnd, tz) → CalendarBlock[]` on top of ical.js, test-first against the fixtures.
- [ ] Write the fetcher: store the URL in settings, fetch on a 5-minute alarm and whenever the popup opens, keep the last good result, and store `{blocks, fetchedAt, error}`. Emit a `scheduleUpdated` event to the runtime.
- [ ] **Check the CORS/permission risk early (first hour):** confirm the service worker can `fetch` Google's secret ICS URL with host permissions. If it can't, work out a fallback.
- [ ] Write the popup onboarding copy for finding the secret ICS address (hand it to WS-E).

**Done when:** a real calendar's blocks show correctly in the popup, and the parser tests pass.

---

## Workstream C: Background runtime (service worker host)

**Owner:** 1 person. **Depends on:** WS-0. Use a stub brain at first (e.g. "any restricted tab gives a confronting view") until WS-A lands.

- [ ] **State persistence:** load state from `storage.local` on wake, save after every event, and process events in order through a serial queue so they never overlap.
- [ ] **Tab tracker:** `tabs.onActivated`, `onUpdated` (URL changes), `onRemoved`, and `windows.onFocusChanged` all feed `activeTabChanged`, `tabNavigated`, and `tabClosed` events. On install or startup, enumerate existing tabs and inject the content script into tabs that were already open.
- [ ] **Clock:** a 30-second `chrome.alarms` tick as a safety net, plus a precise `setTimeout` to `nextDeadline` while the worker is alive.
- [ ] **View push:** after each event, compute `viewFor` for the active tab (and any restricted tabs) and send it to each. When a content script sends `hello`, reply with that tab's current view.
- [ ] **Effect executor:** `explodeAndClose` sends an explode effect to each tab, waits for the GIF to finish (~1s), then calls `chrome.tabs.remove(ids)`. It also handles `playSound` (forwarded to the active tab), the badge/icon, and suggestions.
- [ ] **Message router:** routes content and popup messages into brain events.
- [ ] **Edge cases:** the worker being killed mid-reach (resume from `reachStartedAt`), tabs on `chrome://` pages (no content script), multiple windows, and the active tab being in an unfocused window.

**Done when:** with the real brain, the full fight loop runs across two restricted tabs and survives `chrome://serviceworker-internals` → Stop.

---

## Workstream D: Page Overlay (content script renderer)

**Owner:** 1 person. **Depends on:** WS-0 fixtures and placeholder assets. Build against `src/dev/harness.html`, a test page with a `<video>`, scrollable content, and buttons, plus a dropdown that feeds fixture `TabView`s.

- [ ] Shadow-DOM host attached once per page. The idle corner sprite has `pointer-events: none` and can sit bottom-left, middle, or right.
- [ ] Sprite renderer: plays sheet frames per pose and swaps tiers. Speech bubble and "Back to it?" button.
- [ ] **Input eater** (when `eatInput` is on): a full-viewport layer captures click, pointer, wheel, and touch events, plus `keydown` at window capture (space, arrows, j/k/l, PageDown). It reports `eaten{kind}`, and the Barry UI itself stays clickable.
- [ ] **Media pause:** pause every `video` and `audio` element, including ones added later (MutationObserver), and catch `play` events to re-pause them and report `eaten{unpause}`. Test on YouTube, Shorts, Reddit, and Twitch.
- [ ] **Arm reach:** a separate arm sprite segment that stretches from Barry's hand anchor (which depends on his size) to the top-right of the viewport (we can't draw over the browser's own tab bar). Progress is `(now − startedAt) / durationMs` on each animation frame. Clicking the arm or body reports `pushed`, and reaching 100% reports `armReached{startedAt}`.
- [ ] Effects: explosion GIF overlay, and sound playback through `Audio(chrome.runtime.getURL(...))`, with a fallback in case autoplay is blocked.
- [ ] Chud meter widget, slack countdown, and free-gap suggestion card.
- [ ] Animations: burst-in, shrink back to the corner ("Okay... -_-"), and the beaten wobble.

**Done when:** every fixture renders correctly on the harness page and on the real YouTube, Reddit, and X sites, and eaten inputs never reach the page.

---

## Workstream E: Popup

**Owner:** 1 person (can share with WS-G if the artist codes). **Depends on:** WS-0. Build against mocked storage first.

- [ ] Status header: Barry hibernating in the cave or showing his current pose, the current and next block, the slack countdown, and the chud meter.
- [ ] Mode control: Auto, Chill, Lock In.
- [ ] Slack pass: choose a duration and start it.
- [ ] Barry settings: cave toggle (disabled with a tooltip while he's on a restricted site in Lock In) and position picker (L / M / R).
- [ ] Calendar: ICS URL field, setup instructions, last-fetched time or error, refresh button.
- [ ] Blocklist: add/remove, per-site on/off toggle, defaults pre-seeded.
- [ ] Todos: "Point Barry at my task list" button (sends `startPicker` to the active tab), captured todo list, source list with re-pick/remove.
- [ ] Hidden dev panel, opened by clicking the bear 5 times: fake block, slack and extended durations in seconds, tier selector, chud meter slider, trigger free gap, reset all.
- [ ] Mute toggle (open question in the PRD; cheap to add).

**Done when:** every control round-trips through the real service worker and is reflected in storage.

---

## Workstream F: Todo Picker + free-gap

**Owner:** 1 person (shares with WS-B, or with WS-D after the overlay core is done). **Depends on:** WS-0.

- [ ] Picker mode: hovering highlights elements (inside the shadow root, so the page's styles don't interfere), clicking saves the element and Esc cancels.
- [ ] Selector generation that survives re-renders: prefer stable attributes (`data-*`, `role`, `aria-*`) and fall back to a structural path. Store it keyed by origin and path.
- [ ] Todo reader: on visiting a saved source (and on DOM mutation, debounced), read the item-like children (`li`, `[role=listitem]`, checkbox rows, Notion block divs), skip checked items where detectable, and send `todosCaptured`.
- [ ] Test on Notion (a todo-list page and a database list view), Todoist, and a Google Docs checklist. Record which ones work in the README.

**Done when:** a Notion list is captured and shows in the popup, and a free-gap suggestion (triggered from the dev panel) names its top item.

---

## Workstream G: Art and sound

**Owner:** 1 person (the artist). **Depends on:** only the asset conventions from WS-0.

- [ ] **Conventions (fix these in WS-0):** frame size (e.g. 256×256), horizontal strip sheets, fps per pose, and anchor points per pose and tier (`hand`, `mouth`, `bubble`), all described in `public/assets/manifest.json`.
- [ ] Sprites, in demo priority order:
  1. In-your-face (3 tiers)
  2. Eating (3 tiers)
  3. Arm-reaching body + stretchable arm segment + hand/fist
  4. Beaten
  5. Studious with glasses
  6. "Okay... -_-" shrink
  7. Very-fat chud singing and pointing
  8. Popcorn
  9. Sign/suggestion
  10. Cave with hibernating Barry
  11. Toolbar icons (16/32/48/128) per state
- [ ] Explosion GIF (~1s, transparent background).
- [ ] Sounds: chomp (a few variants), punch, the "I'm a chud" jingle (~5s, loopable), and optionally a burst-in sting.
- [ ] Swap placeholders for real assets as each one is finished. No code changes should be needed if the manifest is followed.

**Done when:** no placeholder rectangles are left on the demo path.

---

## Workstream H: Demo and pitch (whoever finishes first, from about the halfway point)

- [ ] Demo script, following the beats: calendar block → open YouTube → Barry bursts in → eaten clicks fatten him → "Back to it?" explosion → slack pass with 10s dev duration → arm fight → 5 punches → beaten → chud meter max → "I'm a chud" song.
- [ ] Demo browser profile: extension preloaded, dev panel configured, tabs staged, notifications off.
- [ ] Backup screen recording of the full demo.
- [ ] Pitch slides, with the softened wording: "Chill by default. Lock In when you mean it."
- [ ] README: install, how to set up ICS, permissions explanation, privacy (everything local).

---

## Dependency graph

```
            ┌─────────── WS-0 Foundation (contracts, scaffold, fixtures, placeholder assets) ──────────┐
            │                │                 │                │               │                   │
          WS-A            WS-B              WS-C             WS-D            WS-E               WS-G
          Brain         Schedule          Runtime           Overlay          Popup              Art/Sound
       (tests only)   (tests + fetch)   (stub brain)    (fixture views)  (mock storage)    (manifest only)
            │                │                 │                │               │                   │
            └───────┬────────┴────────┬────────┘                │               │                   │
                    ▼                 ▼                         │               │                   │
            Integration 1: real brain + runtime + schedule ◄────┴───────────────┘                   │
                    │                                    WS-F Picker (after D core) ──► Integration 2
                    ▼                                                                               │
            Integration 2: picker, sounds, real art ◄────────────────────────────────────────────────┘
                    │
                    ▼
                 WS-H demo
```

## Timeline (36-hour hackathon, team of 4)

| Hours | Person 1 | Person 2 | Person 3 | Person 4 |
|---|---|---|---|---|
| 0–2 | WS-0 (all together) | WS-0 | WS-0 | WS-0 (placeholders + asset conventions) |
| 2–10 | **A**: items 1–5 | **C**: persistence, tabs, view push (stub brain) · **B**: CORS check | **D**: shadow host, renderer, eater, media pause | **G**: in-your-face + eating sprites |
| 10–12 | **Integration 1: the demo core works end to end** (fake block → YouTube → burst in → eat → Back to it → explode) | | | |
| 12–20 | **A**: items 6–9 (slack, reach, beaten) | **B**: parser + fetcher · **C**: deadlines, explodeAndClose | **D**: arm reach, explosion, sounds, chud meter widget | **G**: arm, beaten, studious · **E**: popup core |
| 20–28 | **A**: items 10–15 | **F**: picker + reader | **D**: animations, polish on real sites | **E**: dev panel, blocklist, ICS UI · **G**: chud, popcorn, cave, sounds |
| 28–30 | **Integration 2: everything** | | | |
| 30–34 | Bug bash on real sites | **H**: demo profile, recording | Polish | **H**: slides, README |
| 34–36 | Feature freeze, rehearse the demo twice | | | |

The table assumes 4 people. With 3, merge the Person 2 and Person 4 code work and let the artist focus on assets. With 5, split WS-B/WS-F off from Person 2.

## Integration checkpoints

1. **Integration 1 (about hour 10–12):** real brain plus runtime plus overlay. With a dev-injected block, YouTube confrontation → eating → "Back to it?" → explosion works. This is the demo safety net, so protect it from then on.
2. **Integration 2 (about hour 28–30):** real ICS, the picker, the popup, sounds, and art. Run the full fight loop across 2–3 restricted tabs, including killing the service worker mid-reach.

## Risks to check in the first hours

| Risk | Check | Fallback |
|---|---|---|
| Service worker can't fetch the Google secret ICS URL | Fetch it in the first hour (WS-B) | Fetch from a popup or offscreen document; the dev panel's fake block covers the demo |
| Eaten inputs leak through (keyboard shortcuts, YouTube's own handlers) | Test the eater on YouTube early (WS-D) | Capture keydown at window capture and stop propagation; worst case, cover the page fully with Barry |
| Media restarts itself (autoplay, Shorts swipe) | Test on Shorts and Twitch | Re-pause on `play` and `timeupdate`; mute as a backup |
| MV3 worker killed mid-fight | Stop it from `chrome://serviceworker-internals` | All timing is timestamp-based, so the next event or alarm recomputes the phase |
| Audio blocked by autoplay policy | First chomp on a fresh tab | Show a visual "CHOMP" text; sound starts after the first eaten click |
| Notion's DOM resists stable selectors | Try the picker on Notion by hour 22 | Fall back to "paste your todos" in the popup |
| Art bottleneck | Placeholders from hour 0 | Prioritise sprites in demo order; the rest stay as simple shapes |
