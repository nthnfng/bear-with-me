# Demo browser profile

A clean Chrome profile for the stage demo. Do this once, then run the demo script twice before the day.

## 1. Fresh profile and extension

1. Chrome profile menu > Add > continue without an account. Name it "Barry demo".
2. `npm run build`, then `chrome://extensions` > Developer mode > Load unpacked > `.output/chrome-mv3`.
3. Pin Barry from the puzzle-piece menu.
4. Tabs open before the extension loaded get Barry injected on install; if anything looks off, reload the extension and reload the tabs.

## 2. Unlock the Dev panel and set Demo speed

1. Open the popup and click Barry's picture 5 times. The Dev panel appears at the bottom and stays unlocked.
2. Press **Demo speed** (Snooze 20 s, Chud fills in 60 s, Lock back in 60 s, idle after 15 s). The line above it should read "Speed: demo". **Normal speed** restores the defaults.
3. Check the Reach and warning seconds in the Dev panel are what the demo script wants.

## 3. Sound and notifications

- Sound on: in the popup's **Barry** section make sure Barry is not muted. Click once in any page first (Chrome blocks audio before a user gesture). Turn the system volume up.
- OS notifications off: Do Not Disturb (Windows Focus Assist, macOS Focus, Linux DND).
- Chrome notifications off: `chrome://settings/content/notifications` > "Don't allow sites to send notifications".
- Close chat apps and anything else that can pop over the browser.

## 4. Stage the tabs

Keep it to 3 or 4 tabs in one window (the Arm aims at a tab in the tab strip; few wide tabs make it land on the right one). Suggested, left to right:

1. A Google Doc with your todo list (a checklist). In the popup, **Todos** > **Point Barry at my task list**, click the list. Confirm the todos show up.
2. A work tab (the doc or lecture notes).
3. A YouTube video, ready to open as the "distraction". Keep it unpinned and in the same window.

Then inject the Calendar block: in the Dev panel enter a title (e.g. "ETF prep") and 60 minutes, press **Inject**. Or set an ICS URL (see README) so a real block is running.

## 5. Browser chrome

- Hide the bookmarks bar (Ctrl+Shift+B / Cmd+Shift+B).
- Zoom 100% (Ctrl+0) on every demo page, and in the OS display scaling if you can.
- Window maximized, one window only, no extension icons that cause popups.
- Do not run DevTools on the YouTube tab; it changes the viewport.

## 6. Before going on stage

- Reload the YouTube tab so Barry's content script is fresh.
- Open the popup: headline should say Lock In with your block.
- Run the demo script (`docs/demo-script.md`) once. Use **Reset Barry** in the Dev panel to start again.
- Keep the service worker console open on a second screen if you want `barry.*` hooks (see README).
