# PRD: Barry the Bear: a priority-tracking Chrome extension

## Problem Statement

I plan my day carefully. I block 4–6pm in Google Calendar for "ETF prep" and keep a todo list in Notion. Then I open YouTube "for one video" and look up an hour later. Every todo app knows what I *should* be doing. None of them notice what I'm *actually* doing, so nothing catches me when I drift off. Site blockers are too blunt: they're either off, or they lock me out of things I sometimes legitimately need, so I end up turning them off. I want something that notices the gap between my plan and my browser at the moment it happens, and nudges me back in a way that's fun rather than punishing.

## Solution

Barry is a bear who lives in the browser. He reads the user's schedule from their Google Calendar's secret ICS link, with no login. He can also read an untimed todo list from any web app (Notion, Todoist, …) after the user points him at it once.

Barry has two modes:

- **Chill mode** (outside scheduled blocks): Barry sits in a bottom corner eating popcorn and never steps in. When a free gap in the calendar opens up, he suggests an untimed todo to fill it.
- **Lock In mode** (during a scheduled calendar block, or forced on from the popup): opening a blocklisted site makes Barry burst onto the page, right in the user's face, naming the planned task ("You planned ETF prep. Back to it?"). He pauses any playing media. Every interaction with the page other than closing it gets *eaten*, and Barry gets fatter and more annoying with each one. One click on "Back to it" makes Barry stretch his arm, close the tab, and the tab explodes.

When the user wants a guilt-free break, they turn on a **slack pass** in the popup (e.g. 15 minutes). When it runs out, Barry warns them and then slowly reaches his arm across the screen to close the tab. The user can push the arm back up to 5 times. After the 5th push Barry is beaten up and sad, and Lock In pauses for 5 minutes. If the arm reaches the tab, it closes and explodes.

Barry's weight carries over between sessions. He gets fatter from eaten interactions and slims down by working out while the user stays on task. Users who don't want him on screen can send him to his **cave** (the extension popup), but Lock In still brings him out.

## User Stories

### Setup and schedule

1. As a new user, I want to paste my Google Calendar secret ICS address into the extension, so that Barry knows my schedule without me logging in with my Google account.
2. As a new user, I want clear instructions for finding my Google Calendar secret ICS address, so that setup takes under a minute.
3. As a user, I want Barry to refresh my calendar periodically in the background, so that newly added blocks show up without me reopening anything.
4. As a user with recurring calendar blocks (e.g. "Study" every weekday), I want Barry to understand recurring events, so that I don't have to create each block individually.
5. As a user who deleted one occurrence of a recurring block, I want Barry to respect that exception, so that he doesn't lock me in during a block I cancelled.
6. As a user travelling or with events in other time zones, I want block times interpreted correctly, so that Lock In starts and ends at the right local time.
7. As a user with all-day events (birthdays, holidays), I want those ignored for Lock In, so that Barry doesn't lock me in all day.
8. As a user, I want to see which calendar block Barry thinks is current (and the next one), so that I can trust what he's acting on.
9. As a user whose calendar feed is stale, I want to force Lock In manually from the popup, so that a block I just added still works right away.

### Untimed todos (element picker)

10. As a Notion user, I want to click "Point Barry at my task list" and then click the list on the page, so that Barry learns where my todos are without a Notion login.
11. As a user of any todo app (Todoist, TickTick, a Google Doc checklist), I want the same picker to work there, so that I'm not limited to supported apps.
12. As a user, I want Barry to re-read my picked list whenever I visit that page, so that his copy of my todos stays reasonably current.
13. As a user, I want to see the todos Barry has captured in the popup, so that I can confirm the picker grabbed the right thing.
14. As a user, I want to re-pick or remove a todo source, so that I can fix it when the app's layout changes.
15. As a user, I want Barry to suggest one of my untimed todos when a free gap opens up in my calendar ("You've got 40 free minutes. Lab report?"), so that free time doesn't quietly disappear.
16. As a user, I want a free-gap suggestion only once per gap, so that it's a reminder, not nagging.

### Blocklist

17. As a new user, I want a sensible default blocklist (YouTube, Reddit, X, Instagram, TikTok, Netflix, Twitch, Facebook), so that Barry works immediately.
18. As a user, I want to add and remove sites from the blocklist in the popup, so that it matches my own distractions.
19. As a user, I want subdomains matched (e.g. m.youtube.com, old.reddit.com), so that I can't dodge Barry with an alternate URL.

### Modes

20. As a user, I want Barry to switch to Lock In automatically when a calendar block starts, so that I don't have to remember to turn him on.
21. As a user, I want Barry to return to Chill automatically when the block ends, so that my free time is actually free.
22. As a user, I want to force Chill or Lock In from the popup, overriding the calendar, so that I'm in control when my calendar is wrong.
23. As a user, I want to return the override to "Auto (follow calendar)", so that the calendar takes over again.
24. As a user in Chill mode, I want Barry to sit in his corner with popcorn and never get in my way, so that Chill really is chill.

### Lock In intervention

25. As a user in Lock In, I want Barry to burst onto the page the moment I land on a blocklisted site, so that I notice immediately, not an hour later.
26. As a user in Lock In, I want Barry to name my planned task and how long I've been off it, so that the nudge is specific and meaningful.
27. As a user in Lock In, I want any playing video or audio paused when Barry appears, so that passive watching doesn't continue behind him.
28. As a user in Lock In, I want a "Back to it" button on Barry, so that one click closes the distracting tab.
29. As a user, I want Barry to stretch his arm, close the tab, and show an explosion when I click "Back to it", so that giving up the distraction feels satisfying.
30. As a user in Lock In, I want my clicks on the page eaten while Barry is there, so that I can't keep browsing around him.
31. As a user in Lock In, I want scrolling on the page eaten too, so that scroll-only feeds (Reddit, X, Shorts) don't slip past Barry.
32. As a user in Lock In, I want unpausing media to count as an eaten click, so that resuming a video has a visible cost.
33. As a user, I want Barry to visibly get fatter and more annoying with each eaten interaction, so that ignoring him has a funny, escalating consequence.
34. As a user, I want Barry's fatness shown in three sizes (slim, chubby, chud), so that changes are obvious at a glance.
35. As a user who opens a second distracting tab, I want the same (already fat) Barry there, so that switching tabs doesn't reset him.
36. As a user, I want Barry to leave once I've closed the distracting tab, so that he doesn't follow me onto my work.

### Slack pass

37. As a user, I want to start a slack pass from the popup with a duration (default 15 minutes), so that I can take a deliberate break without fighting Barry.
38. As a user on a slack pass, I want Barry to leave me alone on blocklisted sites until it runs out, so that the break is actually a break.
39. As a user on a slack pass, I want to see how much time is left, so that the end doesn't surprise me.
40. As a user whose slack pass has ended, I want Barry to warn me first, so that I can wrap up what I'm watching.
41. As a user after the warning, I want Barry to slowly stretch his arm across the screen toward the tab, so that I can see the close coming.
42. As a user, I want to click Barry's arm to push it back and delay the close, so that I get a playful last-second fight.
43. As a user, I want to see how many pushes I've used out of 5, so that I know where I stand.
44. As a user, I want the tab closed with an explosion if Barry's arm reaches it, so that the pass ends decisively.
45. As a user who pushes the arm back a 5th time, I want Barry to become beaten up and sad and pause Lock In for 5 minutes, so that I can escape at the cost of feeling guilty.
46. As a user, I want Barry back to normal and Lock In active again after the 5-minute snooze, so that the escape is temporary.

### Barry's body and home

47. As a user staying on task in Lock In, I want Barry to work out and slim down, so that focus is visibly rewarded.
48. As a user, I want Barry's weight to carry over across blocks and days, so that he feels like a pet whose condition reflects my habits.
49. As a user, I want Barry to sit in a bottom corner of my pages, so that he's present without being in the way.
50. As a user, I want to choose bottom-left, bottom-middle, or bottom-right, so that he doesn't cover page UI I use.
51. As a user who doesn't want Barry on screen, I want to send him to his cave in the extension popup, so that my pages are clean.
52. As a user with Barry in his cave, I want him to still burst out in Lock In on a blocklisted site, so that hiding him isn't a loophole.
53. As a user, I want to open the popup and see Barry in his cave or working out, so that I can check on him whenever I like.
54. As a user, I want Barry's corner sprite to never block clicks on my work pages, so that he doesn't interfere with real work.

### Demo / dev

55. As a presenter, I want a hidden dev panel in the popup, so that the demo doesn't depend on venue Wi-Fi or the real clock.
56. As a presenter, I want to inject a fake "ETF prep, now → +2h" calendar block, so that Lock In is active at judging time.
57. As a presenter, I want to set the slack pass to a few seconds, so that I can show the warning, arm fight, and explosion live.
58. As a presenter, I want to jump Barry directly to any fatness tier, so that I can show all sizes quickly.
59. As a presenter, I want to trigger a free-gap suggestion on demand, so that I can show the Notion integration without waiting for a real gap.
60. As a presenter, I want to reset all of Barry's state, so that I can run the demo again from a clean start.

## Implementation Decisions

### Platform
- Chrome extension, Manifest V3. Components: a background service worker, a content script injected on all pages, and a popup.
- Permissions: tabs, storage, alarms, scripting, plus host access to all sites. Barry has to appear on any blocklisted site and fetch the ICS feed. Chrome will show a broad-permission warning at install; the store listing must explain why.
- The service worker can be terminated at any time, so all of Barry's state is persisted in extension local storage. Nothing important lives only in memory. Periodic work (ICS refresh, schedule re-evaluation, workout slimming) runs on alarms. Fine-grained timing (the arm animation) runs in the content script and reports results back as events.

### Module: Barry Brain (core, pure, test seam #1)
All behavior rules live in one pure module with no Chrome APIs, DOM, or real clock. It takes the current **state** and an **event**, and returns the **new state** and a list of **commands**. The service worker feeds it events and executes the returned commands. Every other module is a thin adapter around it.

- **Events in:** clock tick (current time), schedule updated (calendar blocks), todos updated (untimed items), active tab changed (URL, title, tab id), interaction eaten (click / scroll / unpause), "Back to it" clicked, distracting tab closed, slack pass started (duration), arm pushed, arm reached tab, mode override set (auto / chill / lockIn), position set, cave toggled, dev commands.
- **State:** mode override; effective mode; fatness (a number) and the fatness tier derived from it; Barry's pose; slack pass (end time and phase: active → warning → arm reaching); arm pushes used; beaten-snooze end time; last free gap suggested; corner position; cave flag; blocklist; cached blocks and todos.
- **Commands out:** show Barry on tab (pose, tier, message), return Barry to corner or cave, pause media on tab, close tab with explosion, start arm reach on tab, show free-gap suggestion, update toolbar icon/badge.
- **Mode resolution, highest priority first:** beaten snooze active → not locked in; slack pass active → not locked in on distracting sites; override chill/lockIn → that mode; auto → Lock In if a non-all-day calendar block covers now, otherwise Chill. (Dev-injected fake blocks are treated as normal blocks.)
- **"Distracting"** means the active tab's host matches a blocklist entry, including subdomains. LLM-based on-task classification is deliberately deferred, and the "is this distracting?" decision is a single function so it can be swapped in later.
- **Fatness:** each eaten interaction adds a fixed amount. While in Lock In on a non-distracting tab, each tick removes a small amount (the workout), with a floor of 0. It's a single global number shared across tabs that persists across blocks and days. It maps to 3 tiers (slim / chubby / chud) through configurable thresholds.
- **Lock In intervention:** when the effective mode is Lock In and the active tab is distracting, emit "pause media" plus "show Barry in-your-face" with the block title and time spent off-task. "Back to it" emits "close tab with explosion" and is not counted as an eaten interaction.
- **Slack pass:** passes are unlimited and turned on from the popup. Phases: active (Barry is idle on distracting sites) → warning (short, configurable, default ~30s) → arm reaching. Each arm push resets the arm and uses one of 5 pushes. The 5th push sets pose to beaten and starts a 5-minute snooze, then the pass ends. "Arm reached tab" emits close-with-explosion and ends the pass.
- **Beaten snooze:** Lock In is suspended for 5 minutes and Barry shows the beaten pose. Afterwards he's healed and normal mode resolution resumes.
- **Free-gap suggestion:** when the user is in Chill, no block covers now, and the time until the next block is at least a threshold (default 20 min), suggest the top captured todo. Only once per gap.
- **Cave:** when set, no idle sprite is shown on pages. It doesn't suppress the Lock In intervention, which still brings Barry out.

### Module: ICS Parser (pure, test seam #2)
- Input: raw ICS text, a time window, and the local time zone. Output: a list of calendar blocks (title, start, end, all-day flag) that overlap the window.
- Must handle recurring rules, exception dates, modified occurrences, time-zone-qualified times, and all-day events. Use an established ICS library under the hood rather than a hand-written parser. The module exists to pin down *our* expected output shape and edge cases.

### Module: Schedule Fetcher (adapter)
- Stores the user's secret ICS URL. Fetches it on an alarm (e.g. every 5 minutes) and on popup open, runs the ICS Parser, and sends "schedule updated" to the brain.
- On fetch failure it keeps the last good schedule and shows the error in the popup.

### Module: Todo Picker (adapter, content script)
- A picker mode highlights elements on hover; clicking one saves a selector for that site's origin and path.
- Whenever the user visits a saved source, it reads the text of the item-like children under the selector and sends "todos updated". It keeps the last captured list when the page isn't open.
- There are no per-site scrapers. Any todo app works through the picker.

### Module: Page Overlay (adapter, content script)
- Renders Barry in an isolated shadow DOM container so page CSS can't affect him and his CSS can't leak out.
- The idle corner sprite ignores pointer input, so it never blocks the page.
- The in-your-face overlay captures pointer and wheel events over the page and reports each one as an eaten interaction. It pauses all media elements and intercepts attempts to play, reporting them as eaten "unpause" interactions.
- Plays the arm-reach animation and reports "arm pushed" and "arm reached tab". Plays the explosion GIF before the tab is closed.

### Module: Popup
- Shows Barry in his cave or working out, the current block, the next block, and captured todos.
- Controls: mode override (Auto / Chill / Lock In), slack pass toggle with duration, cave toggle, corner position, ICS URL, blocklist editor, todo picker launcher and source management.
- Hidden dev panel (unlocked by a secret gesture): inject a fake block, set the slack pass duration in seconds, set the fatness tier, trigger a free-gap suggestion, reset all state.

### Art
- Barry and the cave are sprites. The tab explosion is a GIF.
- Three fatness tiers are drawn only for poses where size shows: idle, in-your-face, and eating. Popcorn, workout, beaten, sign/suggestion, and arm-stretch poses are single-size.
- The arm stretch needs a separate arm piece that can extend across the screen, independent of Barry's body.

## Testing Decisions

- **What makes a good test:** tests only exercise external behavior through the two seams. Feed events in, then assert on resulting state and emitted commands, or feed ICS text in and assert on blocks out. No assertions on internal helpers, private fields, or how a rule is implemented. Time is always passed in through events or arguments, never read from a real clock.
- **Seam #1, Barry Brain:** scenario tests written as event sequences. Examples:
  - In a calendar block, the active tab is youtube.com, so the commands include pause media and show Barry in-your-face with the block title.
  - The same scenario outside any block, so Barry stays in Chill and there's no intervention.
  - N eaten clicks raise the tier slim → chubby → chud. Ticks on a work tab in Lock In slim him back down, never below 0.
  - Override Chill during a block means no intervention. Override back to Auto means the intervention resumes.
  - Slack pass: during the pass there's no intervention. At expiry, warning then arm reaching. Arm reaches tab, so close with explosion.
  - Five arm pushes give the beaten pose and a 5-minute snooze, with no intervention during it. After 5 minutes the intervention resumes.
  - Cave on, distracting tab in Lock In, so Barry still shows.
  - A free gap of at least 20 minutes suggests the top todo exactly once. A gap shorter than the threshold suggests nothing.
  - Subdomain matching on the blocklist. "Back to it" doesn't add fatness.
- **Seam #2, ICS Parser:** fixture ICS strings covering a single event, a weekly recurrence, a recurrence with an exception date, a moved occurrence, events in another time zone, all-day events, and events outside the window.
- **Not tested automatically:** the Chrome adapters (overlay, picker, fetcher, popup). These are covered by manual runs with the dev panel.
- **Prior art:** none. This is a greenfield project. Suggested runner: Vitest, run headless with no browser needed, since both seams are pure.

## Out of Scope

- LLM / AI judgment of whether a tab is on-task (deferred; blocklist only for now).
- Google, Notion, or any other OAuth or direct-login integration.
- Per-site scraping adapters for specific todo apps (the generic element picker replaces them).
- Hard blocking that can't be dismissed: Barry persuades, eats interactions, and can be beaten off, but never permanently locks a site.
- Tracking task completion or writing anything back to the calendar or todo app.
- Accounts, cloud sync across devices, analytics, or streaks.
- Browsers other than Chrome, and mobile.

## Further Notes

- **Pitch wording:** "It doesn't block sites or shame you" needs softening. Lock In eats clicks and pauses video, which is close to blocking. Suggested framing: "Chill by default. Lock In when you mean it."
- **ICS lag:** Google's secret ICS feed can lag by minutes to hours. A block added just before it starts may not trigger Lock In. The popup override is the workaround, and onboarding should mention it.
- **Permissions:** the all-sites permission warning at install is unavoidable for this design. Explain it in the store listing and onboarding.
- **Privacy:** schedule, todos, and browsing data stay local to the extension. Nothing is sent to a server.
- **Open questions:**
  - When the slack pass arm reaches its target, does Barry close only the active distracting tab or every open blocklisted tab? Default assumed: the active tab only.
  - Scroll-eating was assumed to behave like click-eating and hasn't been explicitly confirmed by the team.
  - Tuning values (fatness per eaten interaction, workout rate, tier thresholds, warning duration, free-gap threshold, ICS refresh interval) are placeholders to tune during playtesting.
  - Whether starting a slack pass during a beaten snooze, or vice versa, needs special handling.
