# bear-with-me

Barry the bear lives in your browser. He reads your Google Calendar, notices when your tabs drift from your plan, and nudges you back.

- Product spec: [docs/prd-barry.md](docs/prd-barry.md)
- Who builds what: [docs/implementation-plan.md](docs/implementation-plan.md)
- Glossary (use these words in code and chat): [CONTEXT.md](CONTEXT.md)
- Architecture decisions: [docs/adr/](docs/adr/)

## Setup

```sh
npm install
npm run dev      # opens Chrome with the extension loaded and hot reload
```

To load it into your normal Chrome instead: `npm run build`, then go to `chrome://extensions`, turn on Developer mode, click **Load unpacked**, and pick `.output/chrome-mv3`.

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
| `public/assets/` | G | Sprites, explosion GIF, sounds, `manifest.json`. |
| `src/dev/` | all | Fixture TabViews for building the overlay and popup without the brain. |
| `entrypoints/` | | WXT entrypoints; keep them thin and delegate to `src/`. |

## Pixel-art Animations

- **Docs and map:** [ANIMATIONS.md](ANIMATIONS.md)
- **Try it:** open `demo/index.html` in Chrome