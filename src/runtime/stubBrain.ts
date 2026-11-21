// TEMPORARY stand-in for the real brain (Workstream A), so the runtime can be built and demoed.
// Restricted tab => confrontation fixture, otherwise studious corner. Delete once A lands.

import { fixtureViews } from '../dev/fixtures';
import { initialState } from '../brain';
import type { BarryEvent, BarryState, Brain, ReduceResult } from '../contracts';

function isRestricted(state: BarryState, url: string | undefined): boolean {
  if (!url) return false;
  let host: string;
  try {
    host = new URL(url).hostname;
  } catch {
    return false;
  }
  return state.blocklist.some(
    (e) => e.enabled && (host === e.domain || host.endsWith('.' + e.domain)),
  );
}

function reduce(state: BarryState, event: BarryEvent): ReduceResult {
  const next: BarryState = { ...state, lastNow: event.now };
  switch (event.type) {
    case 'tabNavigated':
      next.openTabs = { ...state.openTabs, [event.tabId]: event.url };
      return { state: next, effects: [] };
    case 'tabActivated':
      next.activeTabId = event.tabId;
      return { state: next, effects: [] };
    case 'tabClosed': {
      const { [event.tabId]: _gone, ...rest } = state.openTabs;
      next.openTabs = rest;
      if (state.activeTabId === event.tabId) next.activeTabId = null;
      return { state: next, effects: [] };
    }
    case 'backToIt':
      return { state: next, effects: [{ type: 'explodeAndClose', tabIds: [event.tabId] }] };
    case 'eaten':
      return {
        state: next,
        effects: [{ type: 'playSound', tabId: event.tabId, sound: 'chomp' }],
      };
    default:
      return { state: next, effects: [] };
  }
}

export const stubBrain: Brain = {
  initialState,
  reduce,
  viewFor(state, tabId, now) {
    const views = fixtureViews(now);
    return isRestricted(state, state.openTabs[tabId]) ? views.confrontation! : views.studious!;
  },
  nextDeadline: () => null,
};
