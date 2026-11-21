// Hand-written TabViews, one per situation, so the overlay and popup can be built before the
// brain exists. Times are relative to `now` passed in. The harness has one button per row of the
// pose map (docs/implementation-plan.md, Phase 5).

import { HIDDEN_VIEW, type Millis, type TabView } from '../contracts';

const SEC = 1000;
const MIN = 60 * SEC;

export function fixtureViews(now: Millis): Record<string, TabView> {
  const corner: TabView = { ...HIDDEN_VIEW, visible: true, poseSince: now };
  const confrontation: TabView = {
    ...corner,
    placement: 'face',
    pose: 'suspicious',
    line: "You planned ETF prep ,':/",
    showBackToIt: true,
    eatInput: true,
    pauseMedia: true,
  };
  const fat = (n: 1 | 2 | 3 | 4): TabView => ({ ...confrontation, pose: `fat-${n}` });
  const reaching: TabView = {
    ...corner,
    pose: 'close-tab',
    line: 'Closing restricted tabs 💣',
    chudMeter: 0.2,
    reach: { startedAt: now, durationMs: 8 * SEC },
    pushesLeft: 5,
  };
  const snooze: TabView = { ...corner, chudMeter: 0.5 };
  return {
    hidden: HIDDEN_VIEW,
    // Chill
    chill: { ...corner, pose: 'chill-mug' },
    chillMeter: { ...corner, pose: 'chill-mug', chudMeter: 0.65 },
    // Lock In
    studious: { ...corner, pose: 'studious' },
    confrontation,
    confrontation1: fat(1),
    confrontation2: fat(2),
    confrontation3: fat(3),
    confrontation4: fat(4),
    confrontation5: { ...confrontation, pose: 'chud' },
    chudPoint: {
      ...confrontation,
      pose: 'chud-point',
      line: "♪ You're a chud ♪",
      chudMeter: 1,
    },
    backToIt: { ...confrontation, pose: 'close-tab', showBackToIt: false, line: null },
    // Slack pass
    slackPassStarting: {
      ...corner,
      pose: 'suspicious',
      line: 'Okay... -_-',
      chudMeter: 0.2,
      breakEndsAt: now + 15 * MIN,
    },
    slackPass: { ...corner, pose: 'chill', chudMeter: 0.2, breakEndsAt: now + 12 * MIN },
    warning: {
      ...corner,
      pose: 'suspicious-tap',
      line: 'Wrap it up!',
      chudMeter: 0.2,
      breakEndsAt: now + 30 * SEC,
    },
    // Arm fight
    reaching,
    reachingChud: { ...reaching, pose: 'chud', chudMeter: 1 },
    reachingLastPush: {
      ...reaching,
      reach: { startedAt: now - 4 * SEC, durationMs: 8 * SEC },
      pushesLeft: 1,
    },
    // Snooze
    knockedDown: { ...snooze, pose: 'got-owned' },
    gettingUp: { ...snooze, pose: 'get-up' },
    standing: { ...snooze, pose: 'default' },
    ow: { ...snooze, pose: 'suspicious', line: 'ow' },
    armHurts: { ...snooze, pose: 'grieved', line: 'my arm hurts i guess ill leave u alone' },
    tired: { ...snooze, pose: 'tired', canGetUp: true },
    happy: { ...snooze, pose: 'happy' },
  };
}

export interface PoseRow {
  group: string;
  label: string;
  /** Key into fixtureViews. */
  view: string;
  /** Harness-only extra: an effect to fire after the view is shown. */
  effect?: 'explodeAndClose' | 'showSuggestion';
}

/** One row per line of the pose map, in the demo panel's order. */
export const POSE_ROWS: PoseRow[] = [
  { group: 'Chill', label: 'chill-mug (corner)', view: 'chill' },
  { group: 'Chill', label: 'thinking: free-gap suggestion', view: 'chill', effect: 'showSuggestion' },
  { group: 'Lock In', label: 'studious (on task)', view: 'studious' },
  { group: 'Lock In', label: 'suspicious: burst in', view: 'confrontation' },
  { group: 'Lock In', label: 'fat-1', view: 'confrontation1' },
  { group: 'Lock In', label: 'fat-2', view: 'confrontation2' },
  { group: 'Lock In', label: 'fat-3', view: 'confrontation3' },
  { group: 'Lock In', label: 'fat-4', view: 'confrontation4' },
  { group: 'Lock In', label: 'chud (5th eat)', view: 'confrontation5' },
  { group: 'Lock In', label: 'chud-point: max chud dance', view: 'chudPoint' },
  { group: 'Lock In', label: 'close-tab: Back to it (explosion)', view: 'confrontation', effect: 'explodeAndClose' },
  { group: 'Slack pass', label: 'suspicious: Okay... -_-', view: 'slackPassStarting' },
  { group: 'Slack pass', label: 'chill (lounging) + clock + chud bar', view: 'slackPass' },
  { group: 'Slack pass', label: 'suspicious-tap: warning', view: 'warning' },
  { group: 'Arm fight', label: 'close-tab: Reach', view: 'reaching' },
  { group: 'Arm fight', label: 'chud: Reach, full meter', view: 'reachingChud' },
  { group: 'Snooze', label: 'got-owned (spinning stars)', view: 'knockedDown' },
  { group: 'Snooze', label: 'get-up, get-up-2, default', view: 'gettingUp' },
  { group: 'Snooze', label: 'suspicious: ow', view: 'ow' },
  { group: 'Snooze', label: 'grieved: my arm hurts', view: 'armHurts' },
  { group: 'Snooze', label: 'tired (click to get up)', view: 'tired' },
  { group: 'Snooze', label: 'happy: Get up jump', view: 'happy' },
];
