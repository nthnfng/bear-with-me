// Workstream A: Barry Brain. Pure: imports only from src/contracts.
// Build test-first in the order listed in docs/implementation-plan.md (Workstream A).

import {
  DEFAULT_BLOCKLIST,
  DEFAULT_TUNING,
  HIDDEN_VIEW,
  type BarryState,
  type Brain,
} from '../contracts';

export function initialState(): BarryState {
  return {
    modeOverride: 'auto',
    blocklist: DEFAULT_BLOCKLIST,
    blocks: [],
    todos: [],
    openTabs: {},
    activeTabId: null,
    userIdle: false,
    phase: 'clear',
    fatness: 0,
    slackPassEndsAt: null,
    snoozeEndsAt: null,
    warningEndsAt: null,
    reachStartedAt: null,
    pushes: 0,
    chudMeter: 0,
    studyingSince: null,
    lastGapSuggested: null,
    lastNow: null,
    position: 'right',
    cave: false,
    muted: false,
    tuning: DEFAULT_TUNING,
  };
}

// TODO(WS-A): everything below is a stub so other workstreams can integrate.
export const brain: Brain = {
  initialState,
  reduce: (state, event) => ({ state: { ...state, lastNow: event.now }, effects: [] }),
  viewFor: () => HIDDEN_VIEW,
  nextDeadline: () => null,
};
