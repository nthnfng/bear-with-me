// Which windows would be left with no tabs if `closing` were removed. Chrome closes a window
// when its last tab goes, so the runtime opens a fresh tab in each of these first.

export interface TabRef {
  id?: number;
  windowId: number;
}

export function windowsEmptiedBy(tabs: TabRef[], closing: number[]): number[] {
  const doomed = new Set(closing);
  const survivors = new Map<number, boolean>();
  for (const tab of tabs) {
    const survives = tab.id === undefined || !doomed.has(tab.id);
    survivors.set(tab.windowId, (survivors.get(tab.windowId) ?? false) || survives);
  }
  return [...survivors].filter(([, anySurvivor]) => !anySurvivor).map(([windowId]) => windowId);
}
