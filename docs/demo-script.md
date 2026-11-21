# Stage demo script (about 3 to 4 minutes)

Flow: calendar block, YouTube burst, chomps and growth through the sprite tiers, "Back to it?" explosion, Slack pass, Arm fight, 5 Pushes, the Snooze sequence (knocked down, getting up, "ow", tired), Get up, max chud dance and song.

Timings assume the demo tuning (popup Dev panel "Demo speed" button, or `barry.dev({kind:'setTuning', tuning:{snoozeMs:20000, chudFullMs:60000, lockBackInMs:60000, idleAfterSec:15}})`). Warning is 15 s and a Reach 8 s at normal speed, unless you shorten them (see "Optional stage tuning").

## Before going on stage

1. Reload the extension in `chrome://extensions`, then reload every tab you will use (so the content script is present).
2. Open the popup, click the Barry picture 5 times to unlock the Dev panel (it stays unlocked).
3. Click **Demo speed** (Lane B's button; it applies `DEMO_TUNING`). If it is missing, paste the setTuning line above into the service worker console (`chrome://extensions` -> Barry -> "service worker").
4. Optional but recommended: also shorten the stage timings in the Dev panel fields: Warning 10 s, Reach 8 s (leave), Slack pass irrelevant (the popup presets are 1/5/10/15 min, so the 1 min preset is the shortest; talk over it, or see the 1 minute note in beat 5).
5. Staged tabs: window 1 has a docs/work tab (for example a Google Doc) active, plus a YouTube tab with a video loaded and paused. Optionally a second Restricted tab (reddit.com) in the same window to show the Reach closing more than one.
6. Pre-set the Chud meter so the song lands on time: in the service worker console, `barry.dev({kind:'setChudMeter', value: 0.9})`. A 20 s Snooze at 60 s full adds 0.33, so it reaches 1 about 3 s into the Snooze. (Setting the meter also makes Barry forget arrivals, so the song can play again.) The meter shows in the Confrontation as soon as it is above 0; if you do not want the audience to see 0.9 early, set it right before beat 6 instead (you cannot while a Reach is running without it showing; the popup Dev panel "Chud (0-1)" works too).
7. Todos for the free-gap line (only if you show it): `barry.todos(['Lab report'])`.
8. Sound: unmute the laptop and the Barry mute toggle (popup). Click once on each demo tab so Chrome allows audio. Turn OS notifications and Do Not Disturb on so nothing pops over the demo.
9. Start from a clean state: `barry.dev({kind:'reset'})` then `barry.chill()` (or `barry.auto()` with no calendar block). Reset keeps open tabs, your real calendar blocks and todos; it drops injected blocks, Fatness, the Chud meter and tuning (so apply Demo speed after the reset, then set the Chud meter).
10. Confirm Barry sits calm in the corner on the docs tab (chill-mug pose, sipping from his mug).

Note: an injected block survives the 5 minute calendar refresh. Inject it with at least 10 minutes so it outlasts the demo.

## Beats

### 1. Calendar block starts (about 15 s)
- Presenter: "I have ETF prep on my calendar." Inject the block: popup Dev panel, title "ETF prep", 15 minutes, Inject (or `barry.injectBlock('ETF prep', 15)` in the service worker console). Stay on the docs tab.
- Barry: switches from chill-mug to studious (glasses) in the corner. No line.
- Sound: none.

### 2. YouTube burst (about 5 s)
- Presenter: switch to the YouTube tab.
- Barry: bursts onto the page in your face (`suspicious` pose, 0 eats), line `You planned ETF prep ,':/`, a "Back to it?" button, media paused, Chud meter bar only if it is above 0.
- Sound: `burst` once. (If the Chud meter is already full, the chud song starts here too, so keep it under 1 until beat 8.)

### 3. Chomps and growth (about 20 s)
- Presenter: click the video and the page 8 to 10 times, and try to unpause. Only clicks chomp; keys do nothing and scrolling still scrolls.
- Barry: eats each one and fattens by sprite tier: `suspicious` (0), `fat-1` to `fat-4` (1 to 4 eats), `chud` (5 or more). The floating "chomp!" and squash are the overlay's. Same line. Switching to another Restricted tab keeps the tier.
- Sound: `chomp` on each eaten interaction.
- Say: "Nothing reaches the page."

### 4. "Back to it?" explosion (about 5 s)
- Presenter: click **Back to it?**.
- Barry: explosion on the YouTube tab, tab closes. Barry returns to studious in the corner on the next tab.
- Barry: reaches for the tab (`close-tab` pose, fast Arm), the tab explodes and closes.
- Sound: `explosion` (runtime plays it with the explosion).
- Then reopen YouTube (Ctrl+Shift+T or a fresh tab) and switch to it: you get the burst again and Fatness is back to slim (it reset when no Restricted tab was open).

### 5. Slack pass (about 60 s on the shortest preset)
- Presenter: on the YouTube tab, open the popup, click **1 min** Slack pass.
- Barry: shrinks to the corner, `suspicious` pose, line `Okay... -_-` for 4 seconds, then lounging `chill` Barry with the clock icon, time left and the Chud bar. YouTube works normally and plays; Fatness is reset to slim.
- Sound: none.
- Say: "I earned a break on purpose." To save stage time, talk through it and keep using the page; the countdown is visible. (Total Slack pass 60 s, then the warning.)

### 6. Warning then the Arm fight starts (15 s warning, then 8 s per Reach)
- Barry: when the Slack pass ends, `suspicious-tap` pose, line `Wrap it up!` with a countdown for the 15 s warning (10 s at Demo speed). Then the `close-tab` pose, line `Closing restricted tabs 💣`, and the arm stretches from the corner toward the Restricted tab(s) at the top of the window. The popup shows "Pushes left".
- Presenter: starts clicking Barry's arm or body.
- Sound: nothing until the first Push.
- If the Chud meter is full at this point, the Arm's body is `chud` and the song starts (arrival sound) - do not let this happen early.
- Before the first Push, set the meter for the finale if you want: Dev panel Chud 0.9 (or leave it from the setup).

### 7. Five Pushes (about 8 s, each Push restarts the Reach)
- Presenter: click the arm/Barry 5 times, quickly. Each Push must land inside the 8 s Reach.
- Barry: each Push sends the arm back and restarts the Reach; "Pushes left" counts 5, 4, 3, 2, 1.
- Sound: `punch` on Pushes 1 to 4, then `ow` only on the 5th.
- On the 5th: Barry is knocked down (`got-owned`, spinning stars) and the Snooze begins (see beat 8).
- If the Reach lands first (too slow), both Restricted tabs explode and close and the fight ends: see recovery.

### 8. The Snooze sequence, Get up and the chud dance (about 25 s at demo tuning)
- Barry, from the 5th Push (timed from the Snooze start): knocked down `got-owned` (5 s), `get-up` (0.6 s), standing `default` (2 s), `suspicious` with `ow` (1 s), `grieved` with `my arm hurts i guess ill leave u alone` (2.2 s), then `tired` in the corner until the Snooze ends. The Chud meter fills the whole time.
- Presenter: click tired Barry (**Get up**). He does one `happy` jump (1 s), then the Snooze ends and the Arm comes back like a normal Snooze end. Clicking him before he is tired does nothing. The Chud meter only counts the Snooze time actually used (Get up stops it).
- Max chud: with the meter pre-set to 0.9 it fills about 3 s in. The next Confrontation (visit a Restricted tab) is the `chud-point` dance with the line `♪ You're a chud ♪`; in an Arm fight the Arm's body is `chud`.
- Sound: `ow` on the 5th Push, `chudSong` ("I'm a chud") on arrival while the meter is full, once per arrival; it outlives tab switches.
- Presenter: "The longer I slack, the bigger the chud." Point at the meter.
- When the Snooze ends (or after Get up) the Reach comes straight back (no warning). Either Push 5 more times, or let it land to close the tabs. Landing: explosion on every Restricted tab and close.

### 9. Lock back in (optional, about 60 s at demo tuning)
- Presenter: stay on the docs tab for 60 s. The Chud meter resets to 0.
- Skip this on stage; mention it.

Rough total: 15 + 5 + 20 + 5 + 60 + 30 + 8 + 25 = about 2.7 minutes of beats plus talking, 3 to 4 minutes.

## Optional stage tuning

If 60 s plus 30 s of waiting is too long, apply before the demo (Dev panel fields or console):
`barry.dev({kind:'setTuning', tuning:{warningMs: 10000}})`. The Slack pass minimum from the popup is 1 minute; the Slack pass length cannot be shortened from the popup without a smaller preset. Ask Lane B if a 15 s demo preset is wanted.

## If something goes wrong

All in the service worker console (`chrome://extensions` -> Barry -> "service worker"):

- Barry stuck or confused: `barry.dev({kind:'reset'})`. This clears the phase, Fatness, Chud meter, injected blocks and tuning, and keeps tabs/calendar/todos. Then re-apply Demo speed and re-inject the block.
- Barry confronting when he should be calm: `barry.chill()`.
- Barry calm when he should be confronting: `barry.lockIn()` (forced Lock In with no block says `You said you'd lock in ,':/`).
- Back to normal calendar control: `barry.auto()`.
- Chud song did not play (arrival already used): `barry.dev({kind:'setChudMeter', value: 0.9})` (forgets arrivals) then re-visit the Restricted tab.
- Too many Restricted tabs closed in an Arm fight: reopen them with Ctrl+Shift+T.
- Check the brain state: `await barry.state()`.
- Page shows nothing at all: reload the tab (content scripts are only injected on load), or reload the extension then every tab.
- Last resort: `chrome://extensions` -> reload Barry, reload the demo tabs, `barry.dev({kind:'reset'})`, apply Demo speed, inject the block.
