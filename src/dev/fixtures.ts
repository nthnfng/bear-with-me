// Hand-written TabViews, one per situation, so the overlay (WS-D) and popup (WS-E)
// can be built before the brain exists. Times are relative to `now` passed in.

import { HIDDEN_VIEW, type Millis, type TabView } from '../contracts';

const SEC = 1000;
const MIN = 60 * SEC;

export function fixtureViews(now: Millis): Record<string, TabView> {
  const corner: TabView = { ...HIDDEN_VIEW, visible: true };
  const confrontation: TabView = {
    ...corner,
    placement: 'face',
    pose: 'confrontation',
    line: "You planned ETF prep ,':/",
    showBackToIt: true,
    eatInput: true,
    pauseMedia: true,
  };
  return {
    hidden: HIDDEN_VIEW,
    chill: { ...corner, pose: 'chill' },
    chillSuggestion: { ...corner, pose: 'chill', line: "You've got 40 free minutes. Lab report?" },
    studious: { ...corner, pose: 'studious' },
    confrontation,
    confrontationFatter: { ...confrontation, scale: 1.4 },
    confrontationFattest: { ...confrontation, scale: 2 },
    slackPassStarting: {
      ...corner,
      pose: 'okay',
      line: 'Okay... -_-',
      chudMeter: 0.2,
      breakEndsAt: now + 15 * MIN,
    },
    slackPass: { ...corner, pose: 'studious', chudMeter: 0.2, breakEndsAt: now + 12 * MIN },
    warning: {
      ...corner,
      pose: 'studious',
      line: 'Wrapping up?',
      chudMeter: 0.2,
      breakEndsAt: now + 30 * SEC,
    },
    reaching: {
      ...corner,
      pose: 'studious',
      line: 'Closing restricted tabs 💣',
      chudMeter: 0.2,
      reach: { startedAt: now, durationMs: 8 * SEC },
      pushesLeft: 5,
    },
    reachingLastPush: {
      ...corner,
      pose: 'studious',
      line: 'Closing restricted tabs 💣',
      chudMeter: 0.2,
      reach: { startedAt: now - 4 * SEC, durationMs: 8 * SEC },
      pushesLeft: 1,
    },
    snoozing: {
      ...corner,
      pose: 'beaten',
      line: "Ow... T-T my hand hurts so I'll leave you alone for 5 minutes...",
      chudMeter: 0.5,
      breakEndsAt: now + 5 * MIN,
    },
    chudFull: {
      ...confrontation,
      pose: 'chud',
      line: "I'm a chud 🎵",
      chudMeter: 1,
      singChud: true,
    },
  };
}
