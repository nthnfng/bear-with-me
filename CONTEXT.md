# Bear With Me

A Chrome extension where Barry the bear compares what the user planned (calendar, todos) with what they're doing in the browser, and nudges them back when the two don't match.

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

### Modes and the Confrontation

**Chill**:
The mode outside Calendar blocks, in which Barry never steps in.
_Avoid_: Chill mode, idle mode, off

**Lock In**:
The mode during a Calendar block, or when the user forces it on, in which Barry confronts the user on Restricted tabs.
_Avoid_: Focus mode, lock mode, strict mode

**Calendar block**:
A timed event from the user's calendar. Only Calendar blocks (not all-day events) put Barry in Lock In.
_Avoid_: Event, time block, session

**Confrontation**:
Barry in the user's face on a Restricted tab during Lock In, naming the planned task and offering "Back to it?".
_Avoid_: Intervention, popup, nudge

**Eat**:
What Barry does to the user's clicks, scrolls, key presses and unpauses during a Confrontation. An eaten interaction never reaches the page and makes Barry fatter.
_Avoid_: Block, swallow, intercept

**Fatness**:
How big Barry has grown from eaten interactions. It lasts until no Restricted tab is open anywhere, or until a Slack pass starts, and then returns to slim.
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
The 5-minute break the user earns by beating Barry in an Arm fight. Unlike a Slack pass, it fills the Chud meter.
_Avoid_: Extended slack pass, beaten snooze, extended slacking

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
