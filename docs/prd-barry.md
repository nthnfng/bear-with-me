# PRD: Barry the Bear: a priority-tracking Chrome extension

> **Decisions made after this draft (2026-11-21).** These override anything below that disagrees. Canonical terms are in [CONTEXT.md](../CONTEXT.md); the code-level shapes are in `src/contracts/`.
>
> - **Terms:** "restricted site/tab" (not distracting/blocklisted). The automatic 5-minute break after the 5th Push is a **Snooze** (not an "extended slack pass"). **Reach / Push / Arm fight** name the end-of-break sequence.
> - **Slack passes only exist in Lock In.** The popup button is disabled in Chill.
> - **During an Arm fight the page works normally.** Only Barry's arm and body take clicks; nothing is eaten.
> - **Fatness** lasts until *no* restricted tab is open anywhere (or a Slack pass starts). Closing one of several doesn't reset it.
> - **The Chud meter is long-lived.** It fills only during Snoozes, never drains gradually, and carries across blocks and days. It resets to 0 only when the user **Locks back in**: 10 unbroken minutes of Studying (Lock In, no break running, no restricted tab active, user not idle). Idle time (away, screen locked, asleep) doesn't count, using Chrome's idle detection.
> - **While the Chud meter is full,** every Confrontation and Arm fight uses chud Barry and plays "I'm a chud" on arrival, until the user Locks back in.
> - Lock In ending mid-fight drops any Slack pass or Snooze, but leaves the Chud meter alone.
> - **Poses** (Phase 5: real sprite art; supersedes the earlier "one sprite, scaled in code"): Fatness is **sprite tiers**, not scaling: 0 eats `suspicious`, 1 to 4 `fat-1` to `fat-4`, 5 or more `chud`; a full Chud meter makes the Confrontation the `chud-point` dance ("♪ You're a chud ♪"). Also chill (`chill-mug` in Chill, lounging `chill` on a Slack pass), `studious`, `thinking` (free-time suggestion), `suspicious-tap` (warning, "Wrap it up!"), `close-tab` (Reach and Back to it, `chud` as the Reach body when the meter is full), and the Snooze sequence below. Eating has no animation of its own beyond the overlay's chomp squash and sound. No hibernating sprite (Barry goes into the cave and disappears). **Sounds:** chomp, punch, ow, chud song, burst, explosion.
> - **The Snooze is a timed sequence, and Barry can be told to get up (Phase 5).** After the 5th Push: knocked down `got-owned` 5 s, `get-up` 0.6 s, standing `default` 2 s, `suspicious` "ow" 1 s, `grieved` "my arm hurts i guess ill leave u alone" 2.2 s, then `tired` until the Snooze ends. Clicking tired Barry (or the popup button) is **Get up**: one `happy` jump (1 s), then the Snooze ends like a normal Snooze end and the Arm comes back. The Chud meter only counts the Snooze time actually used. A Snooze shorter than the sequence just ends early.
> - So the "Long-term progression" out-of-scope item no longer covers the Chud meter, and the open questions about when the Chud meter resets and what happens once it's full are answered.

## Problem Statement

I plan my day carefully. I block 4–6pm in Google Calendar for "ETF prep" and keep a todo list in Notion. Then I open YouTube "for one video" and look up an hour later. Every todo app knows what I *should* be doing. None of them notice what I'm *actually* doing, so nothing catches me when I drift off. Site blockers are too blunt: they're either off, or they lock me out of things I sometimes legitimately need, so I end up turning them off. I want something that notices the gap between my plan and my browser at the moment it happens, and nudges me back in a way that's fun rather than punishing.

## Solution

Barry is a bear who lives in the browser. He reads the user's schedule from their Google Calendar's secret ICS link, with no login. He can also read an untimed todo list from any web app (Notion, Todoist, …) after the user points him at it once.

Barry has two modes:

- **Chill mode** (outside scheduled blocks): Barry sits in a bottom corner eating popcorn and never steps in. When a free gap in the calendar opens up, he suggests an untimed todo to fill it.
- **Lock In mode** (during a scheduled calendar block, or forced on from the popup): while the user is on task, Barry sits in his corner looking studious, with glasses. Opening a blocklisted site makes him burst onto the page, right in the user's face: "You planned ETF prep ,':/" with a **Back to it?** button. He pauses any playing media. Every interaction with the page other than closing it gets *eaten* (with a chomp), and Barry gets fatter and more annoying with each one. Clicking "Back to it?" makes Barry stretch his arm, close the tab, and the tab explodes.

When the user wants a guilt-free break, they turn on a **slack pass** in the popup (e.g. 15 minutes). When it runs out, Barry warns them and then slowly reaches his arm across the screen: "Closing restricted tabs 💣". The user can punch his arm or body to push it back, up to 5 times. If the arm gets there, every open restricted tab closes, each with its own explosion. After the 5th push Barry is knocked down, gets up, says "ow" and "my arm hurts i guess ill leave u alone", and sits tired while an automatic 5-minute **extended slack pass** (the Snooze) runs; the user can click tired Barry to end it early (Get up). Afterwards his arm comes back, and the fight can repeat.

Two separate measures:

- **Fatness** is Barry's size during a confrontation. It goes up with every eaten interaction and drops back to normal when the restricted tab is closed or a slack pass begins.
- The **chud meter** measures the *user's* chud-ness: how much extended slacking (snoozing via beaten Barry) they've done. It rises only during extended slack passes. When it maxes out, Barry gets very fat and sings "I'm a chud" while pointing at the user.

Users who don't want Barry on screen can send him to his **cave** (the extension popup), where he hibernates. Lock In still brings him out, and while he's on a restricted site in Lock In he can't be sent back to the cave.

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
19. As a user, I want to toggle a blocklisted site off without removing it (e.g. allow YouTube to watch an educational video), and have it stay off until I toggle it back on, so that I can make deliberate exceptions without rebuilding my list.
20. As a user, I want subdomains matched (e.g. m.youtube.com, old.reddit.com), so that I can't dodge Barry with an alternate URL.

### Modes

21. As a user, I want Barry to switch to Lock In automatically when a calendar block starts, so that I don't have to remember to turn him on.
22. As a user, I want Barry to return to Chill automatically when the block ends, so that my free time is actually free.
23. As a user, I want to force Chill or Lock In from the popup, overriding the calendar, so that I'm in control when my calendar is wrong.
24. As a user, I want to return the override to "Auto (follow calendar)", so that the calendar takes over again.
25. As a user in Chill mode, I want Barry to sit in his corner with popcorn and never get in my way, so that Chill really is chill.

### Lock In intervention

26. As a user in Lock In, I want Barry to burst onto the page the moment I land on a blocklisted site, so that I notice immediately, not an hour later.
27. As a user in Lock In, I want any playing video or audio paused when Barry appears, so that passive watching doesn't continue behind him.
28. As a user in Lock In, I want Barry to name my planned task ("You planned ETF prep ,':/") with a "Back to it?" button, so that the nudge is specific and meaningful.
29. As a user, I want one click on "Back to it?" to close the distracting tab, so that getting back on track is effortless.
30. As a user, I want Barry to stretch his arm to the tab's close button, close the tab, and show an explosion when I click "Back to it?", so that giving up the distraction feels satisfying.
31. As a user, I want the length of Barry's arm stretch to depend on his current size (a bigger Barry is closer to the close button, so his arm reaches less far), so that the animation looks physically right.
32. As a user in Lock In, I want my clicks on the page eaten, with a chomp sound for each, while Barry is there, so that I can't keep browsing around him.
33. As a user in Lock In, I want scrolling on the page eaten too, so that scroll-only feeds (Reddit, X, Shorts) don't slip past Barry.
34. As a user in Lock In, I want unpausing media to count as an eaten click, so that resuming a video has a visible cost.
35. As a user, I want Barry to visibly get fatter and more annoying with each eaten interaction, so that ignoring him has a funny, escalating consequence.
36. As a user, I want Barry's fatness shown as sprite tiers (suspicious, fat-1 to fat-4, chud), so that changes are obvious at a glance.
37. As a user who switches to a second distracting tab, I want the same (already fat) Barry there, so that switching tabs doesn't reset him.
38. As a user, I want Barry to leave once I've closed the distracting tab and return to his corner (or chosen position) as studious Barry with glasses, back to normal size, so that he doesn't follow me onto my work.
39. As a user, I want the cave option unavailable while Barry is on a restricted site in Lock In, so that hiding him can't be used to dodge him.

### Slack pass

40. As a user, I want to start a slack pass from the popup with a duration (default 15 minutes), so that I can take a deliberate break without fighting Barry.
41. As a user who starts a slack pass while Barry is in my face, I want him to say "Okay... -_-", shrink back to normal size, and return to his corner, so that the break starts cleanly.
42. As a user on a slack pass, I want Barry to leave me alone on blocklisted sites until it runs out, staying in his corner with the chud meter visible, so that the break is actually a break but I remember it's being tracked.
43. As a user on a slack pass, I want to see how much time is left, so that the end doesn't surprise me.
44. As a user whose slack pass has ended, I want Barry to warn me first, so that I can wrap up what I'm watching.
45. As a user after the warning, I want Barry to slowly stretch his arm across the screen saying "Closing restricted tabs 💣", so that I can see the close coming.
46. As a user with several restricted tabs open, I want Barry's arm to stay at the same point when I switch between them, so that switching tabs doesn't restart or dodge the reach.
47. As a user, I want to click Barry's arm or body to push the arm back, with a punch sound, so that I get a playful last-second fight.
48. As a user, I want every open restricted tab to close at once, each with its own explosion, if Barry's arm reaches its target, so that the pass ends decisively.
49. As a user who pushes the arm back a 5th time, I want Barry to be knocked down, get up, say "ow" and "my arm hurts i guess ill leave u alone", and sit tired while an automatic 5-minute extended slack pass runs, and to be able to click him to get up early (one happy jump, then the Arm comes back), and start an automatic 5-minute extended slack pass, so that I can escape at the cost of feeling guilty.
50. As a user, I want Barry to recover after the extended slack pass and start stretching his arm again, so that the escape is temporary.
51. As a user, I want to be able to keep fighting Barry off as many times as I like, so that I'm never fully locked out.

### Chud meter

52. As a user, I want a chud meter that rises over time during extended slack passes, so that repeatedly snoozing Barry has a visible, growing cost.
53. As a user, I want the chud meter to stay flat during slack passes I chose deliberately from the popup, so that planned breaks aren't punished.
54. As a user whose chud meter maxes out, I want Barry to get very fat and sing "I'm a chud" while pointing at me, so that extended slacking ends in a memorable roast.

### Barry's body and home

55. As a user staying on task in Lock In, I want Barry to sit in his corner looking studious, with glasses, so that he feels like a study buddy.
56. As a user, I want Barry to sit in a bottom corner of my pages, so that he's present without being in the way.
57. As a user, I want to choose bottom-left, bottom-middle, or bottom-right, so that he doesn't cover page UI I use.
58. As a user who doesn't want Barry on screen, I want to send him to his cave in the extension popup, so that my pages are clean.
59. As a user with Barry in his cave, I want him to still burst out in Lock In on a blocklisted site, so that hiding him isn't a loophole.
60. As a user, I want to open the popup and see Barry hibernating in his cave, so that I can check on him whenever I like.
61. As a user, I want Barry's corner sprite to never block clicks on my work pages, so that he doesn't interfere with real work.

### Demo / dev

62. As a presenter, I want a hidden dev panel in the popup, so that the demo doesn't depend on venue Wi-Fi or the real clock.
63. As a presenter, I want to inject a fake "ETF prep, now → +2h" calendar block, so that Lock In is active at judging time.
64. As a presenter, I want to set the slack pass and extended slack pass durations to a few seconds, so that I can show the warning, arm fight, beaten Barry, and explosions live.
65. As a presenter, I want to jump Barry directly to any fatness tier, so that I can show all sizes quickly.
66. As a presenter, I want to set the chud meter to any level, including max, so that I can show the "I'm a chud" song on demand.
67. As a presenter, I want to trigger a free-gap suggestion on demand, so that I can show the Notion integration without waiting for a real gap.
68. As a presenter, I want to reset all of Barry's state, so that I can run the demo again from a clean start.

## Implementation Decisions

### Platform
- Chrome extension, Manifest V3. Components: a background service worker, a content script injected on all pages, and a popup.
- Permissions: tabs, storage, alarms, scripting, plus host access to all sites. Barry has to appear on any blocklisted site, close restricted tabs, and fetch the ICS feed. Chrome will show a broad-permission warning at install; the store listing must explain why.
- The service worker can be terminated at any time, so all of Barry's state is persisted in extension local storage. Nothing important lives only in memory. Periodic work (ICS refresh, schedule re-evaluation, slack pass expiry, chud meter growth) runs on alarms and is computed from stored timestamps, so a missed or late tick never loses time.
- Animations play in the content script, but anything that has to stay in sync across tabs (the arm reach) is anchored to a timestamp held in the brain. See the Page Overlay section below.

### Module: Barry Brain (core, pure, test seam #1)
All behavior rules live in one pure module with no Chrome APIs, DOM, or real clock. It takes the current **state** and an **event**, and returns the **new state** and a list of **commands**. The service worker feeds it events and executes the returned commands. Every other module is a thin adapter around it.

- **Events in:** clock tick (current time); schedule updated (calendar blocks); todos updated (untimed items); active tab changed (URL, title, tab id); tab opened / navigated / closed (so the brain knows every open restricted tab); interaction eaten (click / scroll / unpause); "Back to it?" clicked; slack pass started (duration); Barry pushed (arm or body); arm reached target; mode override set (auto / chill / lockIn); blocklist entry added / removed / toggled; position set; cave toggled; dev commands.
- **State:** mode override; effective mode; blocklist entries (domain plus an enabled flag); cached blocks and todos; the set of open restricted tab ids; Lock In phase (below); fatness (a number) and its derived tier; slack pass (kind: chosen or extended, and end time); arm reach start time; pushes used in the current fight; chud meter (a number) and whether it's maxed; last free gap suggested; corner position; cave flag.
- **Commands out:** show Barry on a tab (pose, fatness tier, speech line, slack time left; the chud meter shows only in the popup); return Barry to corner or cave; pause media on a tab; play sound (chomp / punch / chud song); sync arm reach on a tab (start time, duration); close a set of tabs, each with an explosion; show free-gap suggestion; update toolbar icon/badge.
- **Mode resolution:** override chill/lockIn → that mode; auto → Lock In if a non-all-day calendar block covers now, otherwise Chill. Dev-injected fake blocks count as normal blocks. Slack passes don't change the mode; they change the Lock In phase.
- **"Distracting" / "restricted"** means a tab's host matches an *enabled* blocklist entry, including subdomains. A toggled-off entry stays off until the user turns it back on. LLM-based on-task classification is deliberately deferred, and the "is this restricted?" decision is a single function so it can be swapped in later.

#### Lock In phases
- **Focused:** the active tab isn't restricted and there's no slack pass. Barry is studious in his corner (or hibernating in the cave).
- **Confronting:** the active tab is restricted and there's no slack pass. Pause media, show Barry in-your-face with "You planned {block title} ,':/" and the "Back to it?" button. Each eaten interaction adds fatness and plays a chomp. Switching between restricted tabs keeps the same fatness.
  - "Back to it?" closes the current tab with an explosion and isn't counted as an eaten interaction.
  - Closing the restricted tab, by Barry or by hand, resets fatness to normal and returns to Focused.
- **Slacking:** a chosen slack pass is running. Starting one while Confronting shows "Okay... -_-", resets fatness, and sends Barry to his corner. On restricted tabs Barry stays in the corner showing the chud meter and time left, and no interactions are eaten.
- **Warning:** a slack pass has expired. This is a short heads-up (configurable, default 15s).
- **Reaching:** the arm reach start time is set, and every restricted tab renders the same arm progress from it. The speech line is "Closing restricted tabs 💣".
  - Each push (on the arm or body) plays a punch and restarts the reach.
  - When the arm reaches its target, every open restricted tab closes with an explosion each. Fatness and pushes reset, and the phase returns to Focused.
- **Beaten (Snooze):** the 5th push starts the timed Snooze sequence (knocked down, get-up, standing, "ow", "my arm hurts i guess ill leave u alone", tired) inside a 5-minute *extended* slack pass. Get up in the tired stage ends it after a short happy jump. Pushes reset to 0. When it ends, the phase goes straight back to Reaching with no second warning, and the fight can repeat indefinitely.
- If no restricted tab is open when a slack pass ends, the pass simply ends and the phase is Focused.
- If Lock In ends (the block ends or the override changes to Chill) during any phase, the phase resets to Focused and the slack pass is cleared.

#### Fatness
- Each eaten interaction adds a fixed amount. Fatness maps to sprite tiers by whole eats: 0 suspicious, 1 to 4 fat-1 to fat-4, 5 or more chud (no scaling).
- It's shared across restricted tabs within a confrontation and resets to normal when the restricted tab is closed or a slack pass starts. It doesn't carry across confrontations, blocks, or days.

#### Chud meter
- Separate from fatness. It measures the user's chud-ness from extended slacking.
- It's visible from the moment any slack pass starts, and it grows with time spent in *extended* slack passes (computed from timestamps on each tick). It doesn't grow during a chosen slack pass.
- At the configurable max, Barry switches to the chud pose (very fat) and plays the "I'm a chud" song, pointing at the user, whenever he's shown on a restricted tab, until the chud meter resets.
- It resets when Lock In ends (assumed; see Open questions).

#### Cave
- When the cave is set, no idle sprite is shown on pages and the popup shows Barry hibernating.
- Lock In still brings him out on restricted tabs. While the active tab is restricted and the mode is Lock In, the cave toggle is ignored and disabled in the popup.

#### Free-gap suggestion
- When the user is in Chill, no block covers now, and the time until the next block is at least a threshold (default 20 min), suggest the top captured todo. Only once per gap.

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
- The idle corner sprite (studious, popcorn, slacking) ignores pointer input, so it never blocks the page.
- The in-your-face overlay captures pointer and wheel events over the page and reports each one as an eaten interaction. It pauses all media elements and intercepts attempts to play, reporting them as eaten "unpause" interactions.
- **Arm reach:** renders arm progress as (now − reach start) ÷ reach duration, using the start time from the brain, so every restricted tab shows the same progress. The arm's length is the distance from Barry's body, at his current size, to the target near the tab's close button. Clicks on the arm or body report "Barry pushed". When progress hits 100% it reports "arm reached target" with the start time it used, and the brain ignores stale reports from an earlier reach. The brain also checks expiry on its own ticks in case no restricted tab is in view.
- Plays sounds (chomp, punch, chud song) and the explosion GIF before tabs are closed.

### Module: Popup
- Shows Barry hibernating in his cave, the current block, the next block, captured todos, slack time left, and the chud meter.
- Controls: mode override (Auto / Chill / Lock In), slack pass toggle with duration, cave toggle (disabled while Barry is on a restricted site in Lock In), corner position, ICS URL, blocklist editor with a per-site on/off toggle, todo picker launcher and source management.
- Hidden dev panel (unlocked by a secret gesture): inject a fake block, set slack pass and extended slack pass durations in seconds, set the fatness tier, set the chud meter, trigger a free-gap suggestion, reset all state.

### Art and sound
- Barry and the cave are sprites. The tab explosion is a GIF.
- Poses: popcorn (Chill), studious with glasses (Lock In, focused), in-your-face at 3 fatness tiers, eating at 3 tiers, "Okay... -_-" (shrinking), arm-reaching, beaten, very fat chud (singing and pointing), sign/suggestion, hibernating in cave.
- The arm stretch needs a separate arm piece that can extend across the screen, independent of Barry's body.
- Sounds: chomp (eaten interaction), punch (push), "I'm a chud" song.

## Testing Decisions

- **What makes a good test:** tests only exercise external behavior through the two seams. Feed events in, then assert on resulting state and emitted commands, or feed ICS text in and assert on blocks out. No assertions on internal helpers, private fields, or how a rule is implemented. Time is always passed in through events or arguments, never read from a real clock.
- **Seam #1, Barry Brain:** scenario tests written as event sequences. Examples:
  - In a calendar block, the active tab is youtube.com, so the commands include pause media and show Barry in-your-face with the block title.
  - The same scenario outside any block, so Barry stays in Chill and there's no intervention.
  - A toggled-off blocklist entry means no intervention, and it stays off across blocks until toggled on.
  - Subdomains on the blocklist are matched.
  - N eaten clicks raise the fatness tier and each one emits a chomp. "Back to it?" doesn't add fatness.
  - Switching between two restricted tabs keeps fatness. Closing the restricted tab resets fatness and returns Barry to the studious corner.
  - Override Chill during a block means no intervention. Override back to Auto means the intervention resumes.
  - Starting a slack pass while Confronting gives "Okay... -_-", resets fatness, and sends Barry to the corner. There's no intervention during the pass, and the chud meter doesn't grow.
  - Slack pass expiry gives the Warning phase, then Reaching. The arm reaching its target closes *all* open restricted tabs, each with an explosion.
  - A push restarts the reach. A stale "arm reached" report from before the push is ignored.
  - The 5th push gives the beaten pose and a 5-minute extended slack pass. The chud meter grows during it. Afterwards, Reaching starts again without a warning.
  - Repeated beaten cycles push the chud meter to max, which gives the chud pose and the "I'm a chud" song.
  - Lock In ending mid-fight resets to Focused and clears the slack pass.
  - Cave on, restricted tab in Lock In, so Barry still shows, and toggling the cave is ignored.
  - A free gap of at least 20 minutes suggests the top todo exactly once. A gap shorter than the threshold suggests nothing.
- **Seam #2, ICS Parser:** fixture ICS strings covering a single event, a weekly recurrence, a recurrence with an exception date, a moved occurrence, events in another time zone, all-day events, and events outside the window.
- **Not tested automatically:** the Chrome adapters (overlay, picker, fetcher, popup), the art, and the sounds. These are covered by manual runs with the dev panel.
- **Prior art:** none. This is a greenfield project. Suggested runner: Vitest, run headless with no browser needed, since both seams are pure.

## Out of Scope

- LLM / AI judgment of whether a tab is on-task (deferred; blocklist only for now).
- Google, Notion, or any other OAuth or direct-login integration.
- Per-site scraping adapters for specific todo apps (the generic element picker replaces them).
- Hard blocking that can't be dismissed: Barry persuades, eats interactions, and can be beaten off, but never permanently locks a site.
- Tracking task completion or writing anything back to the calendar or todo app.
- Long-term progression (Barry's weight or the chud meter carrying across days).
- Accounts, cloud sync across devices, analytics, or streaks.
- Browsers other than Chrome, and mobile.

## Further Notes

- **Pitch wording:** "It doesn't block sites or shame you" needs softening. Lock In eats clicks, pauses video, and closes tabs, which is close to blocking, and the chud song is gentle shaming. Suggested framing: "Chill by default. Lock In when you mean it."
- **ICS lag:** Google's secret ICS feed can lag by minutes to hours. A block added just before it starts may not trigger Lock In. The popup override is the workaround, and onboarding should mention it.
- **Permissions:** the all-sites permission warning at install is unavoidable for this design. Explain it in the store listing and onboarding.
- **Privacy:** schedule, todos, and browsing data stay local to the extension. Nothing is sent to a server.
- **Sound:** browsers may block audio until the user has interacted with the page. Eaten clicks count as interaction, so chomps should work, but the first sound on a fresh tab may be silent.
- **Open questions:**
  - When does the chud meter reset? Assumed: when Lock In ends (block end or override to Chill).
  - Once the chud meter is maxed, does the fight loop continue as normal with Barry in chud pose, or does the song replace the arm reach? Assumed: the loop continues, with the chud pose and song on top.
  - Does the cave lock also apply in Chill on a restricted site? Assumed: no, since Barry never intervenes in Chill.
  - Is there a mute toggle for sounds? Not decided; probably worth adding to the popup.
  - Scroll-eating was assumed to behave like click-eating and hasn't been explicitly confirmed by the team.
  - Tuning values (fatness per eaten interaction, tier thresholds, warning duration, reach duration, chud meter rate and max, free-gap threshold, ICS refresh interval) are placeholders to tune during playtesting.
