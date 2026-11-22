# Bear With Me

A Chrome extension where Barry the bear compares what the user planned (Tasks, calendar) with what they're doing in the browser, and nudges them back when the two don't match.

## Language

### Sites

**Restricted site**:
A site whose host matches an enabled entry on the Blocklist, including subdomains.
_Avoid_: Distracting site, blocked site, blocklisted site

**Restricted tab**:
A browser tab currently showing a Restricted site.
_Avoid_: Distracting tab, blocked tab

**Blocklist**:
The user's list of sites that can be Restricted sites. Each entry can be toggled off, which stops it being restricted until it's toggled back on.
_Avoid_: Blacklist, deny list

### Tasks

**Task**:
Something the user plans to do, typed into the popup with a title, an optional description and an estimated time. The list is in priority order; at most 15 are unchecked at once, and adding past 8 hours of unchecked estimates asks "Are you sure?".
_Avoid_: Todo, item, to-do

**Top Task**:
The first unchecked Task in the list. Barry names it when nothing is started, and suggests it in a free gap.
_Avoid_: Current todo, next task

**Start**:
The user saying "I'm working on this now" by pressing ▶ on a Task. The mode switches to Lock In for the Task's estimate, and back to Auto when its time is up or it's checked off. Picking Auto or Chill mid-Task asks to pause it; a paused Task keeps its time left and ▶ resumes it. A break (Slack pass or Snooze) pauses the Task timer the same way, and it resumes when the break ends.
_Avoid_: Begin, timer, focus session

**Done check**:
Barry asking "Time's up for X. Done?" when a started Task's estimate runs out. Done checks it off (it stays where it is); +15 min, or minutes the user types, runs it longer. Barry never checks a Task off by himself.
_Avoid_: Auto-complete, reminder

### Modes and the Confrontation

**Chill**:
The mode when no Task is started and no Calendar block is running, in which Barry never steps in.
_Avoid_: Chill mode, idle mode, off

**Lock In**:
The mode while a started Task runs, during a Calendar block, or when the user forces it on, in which Barry confronts the user on Restricted tabs.
_Avoid_: Focus mode, lock mode, strict mode

**Calendar block**:
A timed event from the user's calendar. Only Calendar blocks (not all-day events) put Barry in Lock In.
_Avoid_: Event, time block, session

**Confrontation**:
Barry in the user's face on a Restricted tab during Lock In, showing the plan (the Task first, then the Calendar block) and offering "Take it away, Barry".
_Avoid_: Intervention, popup, nudge

**Eat**:
What Barry does to the user's clicks and unpauses during a Confrontation. An eaten interaction never reaches the page and makes Barry fatter. Key presses are blocked without being eaten (no chomp, no Fatness); scrolling passes through.
_Avoid_: Block, swallow, intercept

**Fatness**:
How big Barry has grown from eaten interactions, shown as sprite tiers rather than scaling: no eats is suspicious Barry, 1–4 eats are fat-1 to fat-4, and 5 or more is chud Barry. It lasts until no Restricted tab is open anywhere, or until a Slack pass starts, and then returns to slim.
_Avoid_: Weight, size, chudness

**Studying**:
Being in Lock In with no Slack pass or Snooze running, no Restricted tab active, and the user not idle (away, screen locked, or computer asleep). Time in Chill never counts as Studying.
_Avoid_: Focused, on-task, working

**Chud meter**:
A long-lived measure of the user's chud-ness. It fills only during Snoozes, never drains gradually, and carries across Calendar blocks and days until the user Locks back in, when it returns to zero. When it's full, Barry sings "I'm a chud".
_Avoid_: Chudness, shame meter, fatness

**Lock back in**:
To Study for an unbroken stretch long enough (default 10 minutes) to reset the Chud meter. A brief switch to a work tab doesn't count. Not to be confused with the Lock In mode.
_Avoid_: Recover, redeem

### Breaks

**Slack pass**:
A break the user deliberately starts from the popup, during which Barry leaves Restricted tabs alone.
_Avoid_: Slack time, chosen slack pass, break

**Snooze**:
The 5-minute break the user earns by beating Barry in an Arm fight. Unlike a Slack pass, it fills the Chud meter. Barry is knocked down, gets up, says "ow" and "my arm hurts", then sits tired in the corner.
_Avoid_: Extended slack pass, beaten snooze, extended slacking

**Get up**:
Clicking tired Barry during a Snooze (or the popup's button) to end the Snooze early. He does one happy jump and the Arm fight resumes. The Chud meter only counts the Snooze time actually used.
_Avoid_: Skip snooze, wake up

### The Arm fight

**Reach**:
Barry's arm stretching toward the Restricted tabs to close them.
_Avoid_: Arm stretch, swipe

**Push**:
The user clicking Barry's arm or body during a Reach, which sends the arm back and starts the Reach over.
_Avoid_: Punch (that's only the sound), block

**Arm fight**:
The whole sequence of Reaches and Pushes after a Slack pass or Snooze ends. It ends when a Reach lands, closing every Restricted tab, or when the 5th Push wins a Snooze.
_Avoid_: Fight, showdown
