import { describe, expect, it } from 'vitest';
import { windowsEmptiedBy } from './windowsEmptiedBy';

describe('windowsEmptiedBy', () => {
  it('flags a window whose every tab is being closed', () => {
    const tabs = [
      { id: 1, windowId: 10 },
      { id: 2, windowId: 10 },
      { id: 3, windowId: 20 },
      { id: 4, windowId: 20 },
    ];
    expect(windowsEmptiedBy(tabs, [1, 2, 3])).toEqual([10]);
  });

  it('flags nothing when every window keeps a tab', () => {
    const tabs = [
      { id: 1, windowId: 10 },
      { id: 2, windowId: 10 },
    ];
    expect(windowsEmptiedBy(tabs, [1])).toEqual([]);
  });

  it('flags several windows at once', () => {
    const tabs = [
      { id: 1, windowId: 10 },
      { id: 2, windowId: 20 },
      { id: 3, windowId: 30 },
    ];
    expect(windowsEmptiedBy(tabs, [1, 2])).toEqual([10, 20]);
  });
});
