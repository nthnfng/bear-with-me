# bear-with-me

Barry the bear lives in your browser. He reads your Google Calendar, notices when your tabs drift from your plan, and nudges you back.

- Product spec: [docs/prd-barry.md](docs/prd-barry.md)
- Who builds what: [docs/implementation-plan.md](docs/implementation-plan.md)
- Glossary (use these words in code and chat): [CONTEXT.md](CONTEXT.md)
- Architecture decisions: [docs/adr/](docs/adr/)

## What Barry does

Outside Calendar blocks Barry stays out of the way (Chill). During a Calendar block, or when you force Lock In from the popup, opening a Restricted site (YouTube, Reddit, X, ...) gets you a Confrontation: Barry fills the tab, names the task you planned, eats your clicks, blocks keys, and asks "Back to it?". Take a Slack pass if you really need a break; when it ends Barry's arm reaches for your Restricted tabs, and you can Push it back five times to win a Snooze (which fills the Chud meter).

## Install

```sh
npm install
npm run build    # production build into .output/chrome-mv3
```

Open `chrome://extensions`, turn on Developer mode, click **Load unpacked**, pick `.output/chrome-mv3`, then pin Barry from the puzzle-piece menu.

For development, `npm run dev` opens Chrome with the extension loaded and hot reload.

## Calendar (ICS) setup

1. In Google Calendar, open Settings, pick your calendar under "Settings for my calendars", then Integrate calendar.
2. Copy **Secret address in iCal format** (a long `.ics` URL).
3. Open Barry's popup, expand **Calendar**, paste the URL and save.

Barry refreshes it every 5 minutes and keeps the last good result if a fetch fails. Only timed events become Calendar blocks. Treat the URL like a password: anyone holding it can read your calendar. To revoke it, reset the secret address in Google Calendar.

## Todos

In the popup open **Todos** and press **Point Barry at my task list**, then click your todo list on the page. Google Docs checklists and the Brightspace Work To Do widget are supported; Notion is best-effort (selectors may break; if so, the list won't be captured). Barry suggests a todo when there is a free gap, and names the first one during a Confrontation.

## Permissions

| Permission | Why |
|---|---|
| `tabs` | See every open tab's URL to find Restricted tabs, and close them when a Reach lands. |
| `storage` | Keep Barry's state, settings and the calendar in `chrome.storage.local`. |
| `alarms` | A 30 s safety-net tick (the service worker is killed when idle) and the 5 minute calendar refresh. |
| `scripting` | Inject Barry into tabs that were already open when the extension was installed or reloaded. |
| `idle` | Stop counting Studying when you are away, your screen is locked or the computer sleeps. |
| `offscreen` | Play Barry's sounds from a hidden extension page, because Chrome blocks sound on a page you haven't clicked yet (a tab you just opened). |
| host access `<all_urls>` | Barry must appear on whichever site you put on the Blocklist, and the background fetches your calendar feed. |

## Privacy

Everything stays on your machine in `chrome.storage.local`. There are no servers and no analytics. The only network request is fetching your own ICS URL. That URL is a secret and is never logged.

## Dev panel and console hooks

### The popup

The header shows pixel-art Barry in whatever pose he has right now (sipping, studying, fat, tired...) next to his picture. While a Snooze has Barry sitting tired, a **Get up** button appears; it ends the Snooze early (one happy jump, then the Arm comes back). The Chud meter is a pixel bar that fills orange in 10 steps. In **Barry**, the cave is a small scene: **Send Barry back** hops him into the cave and hides him while he's calm, **Let Barry out** hops him back. Restricted tabs exploding now play an explosion sound (silent when muted).

Click Barry's picture in the popup 5 times to unlock the Dev panel (stays unlocked): inject a fake calendar block, **Demo speed** / **Normal speed** buttons, tuning fields, set Fatness and the Chud meter, reset Barry.

In the service worker console (`chrome://extensions` > Barry > "service worker"):

| Hook | Does |
|---|---|
| `barry.injectBlock(title?, minutes?)` | Add a fake Calendar block starting now (default "ETF prep", 60 min) |
| `barry.lockIn()` / `barry.chill()` / `barry.auto()` | Set the mode override |
| `barry.todos(['Lab report', ...])` | Fake captured todos |
| `barry.dev({ kind: 'setTuning', tuning: {...} })` | Send any DevCommand (`injectBlock`, `setTuning`, `setFatness`, `setChudMeter`, `triggerFreeGap`, `reset`) |
| `await barry.state()` | Read the stored BarryState |

Setting up the stage demo: [docs/demo-profile.md](docs/demo-profile.md).

## Limits

Barry cannot appear on `chrome://` pages, the Chrome Web Store, `file://` pages (unless you allow file access), the built-in PDF viewer or `view-source:`. After a long sleep Barry skips sounds and explosions for things that ended while you were away.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Dev build with hot reload |
| `npm run build` | Production build into `.output/chrome-mv3` |
| `npm run zip` | Zip for the Chrome Web Store |
| `npm test` | Run the Vitest suite once (`npm run test:watch` to keep watching) |
| `npm run compile` | Type-check |
| `npm run format` | Prettier |

## Layout

| Path | Workstream | What lives there |
|---|---|---|
| `src/contracts/` | 0 | Shared types: domain, brain events/effects/TabView, messages, storage keys, defaults, asset ids. Change only via a PR the whole team knows about. |
| `src/brain/` | A | Barry's rules. Pure, no browser APIs, test-first. |
| `src/schedule/` | B | ICS parser (pure, tested) and fetcher. |
| `src/runtime/` | C | Background service worker host: state, tabs, timers, effects. |
| `src/overlay/` | D | Content-script renderer for Barry on pages. |
| `entrypoints/popup/` | E | React popup. |
| `src/picker/` | F | Todo list element picker. |
| `public/assets/` | G | Sprites, explosion GIF, sounds. (`manifest.json` lives in `src/assets/` so JS can import it.) |
| `src/dev/` | all | Fixture TabViews for building the overlay and popup without the brain. |
| `entrypoints/` | | WXT entrypoints; keep them thin and delegate to `src/`. |

## Pixel-art Animations

- **Docs and map:** [ANIMATIONS.md](ANIMATIONS.md)
- **Try it:** open `demo/index.html` in Chrome