import { describe, expect, it } from 'vitest';
import { isMacPlatform, tabCentreFraction, tabViewportX } from './tabstrip';

const win = { outerWidth: 1500, innerWidth: 1500, isMac: false };
const mac = { ...win, isMac: true };
const slot = (index: number, count: number, pinned = 0) => ({ index, count, pinned });

describe('tabViewportX', () => {
  it('first unpinned tab is at the left inset plus half a capped tab (few tabs)', () => {
    expect(tabViewportX(slot(0, 3), win)).toBeCloseTo(8 + 120);
    expect(tabViewportX(slot(2, 3), win)).toBeCloseTo(8 + 2.5 * 240);
  });
  it('mac has a bigger left inset', () => {
    expect(tabViewportX(slot(0, 3), mac)).toBeCloseTo(78 + 120);
  });
  it('pinned tabs are 40px, unpinned follow them', () => {
    expect(tabViewportX(slot(1, 5, 2), win)).toBeCloseTo(8 + 60);
    expect(tabViewportX(slot(2, 5, 2), win)).toBeCloseTo(8 + 80 + 120);
  });
  it('tabs share the strip equally before the cap', () => {
    // strip = 1500-148 = 1352; 10 tabs -> 135.2 each
    expect(tabViewportX(slot(9, 10), win)).toBeCloseTo(8 + 9.5 * 135.2);
  });
  it('many tabs hit the minimum width and stay on the strip', () => {
    // 100 tabs at 40px would overflow: last centre clamps to the strip end.
    const x = tabViewportX(slot(99, 100), win)!;
    expect(x).toBeCloseTo(1500 - 140);
    expect(tabViewportX(slot(0, 100), win)).toBeCloseTo(8 + 20);
  });
  it('is zoom independent: maps by fraction of width', () => {
    const zoomed = { ...win, innerWidth: 750 }; // 200% zoom
    expect(tabViewportX(slot(2, 5), zoomed)).toBeCloseTo(tabViewportX(slot(2, 5), win)! / 2);
  });
  it('returns null without a slot or with a bad one', () => {
    expect(tabViewportX(null, win)).toBeNull();
    expect(tabViewportX(slot(5, 3), win)).toBeNull();
    expect(tabViewportX(slot(0, 3), { ...win, outerWidth: 0 })).toBeNull();
    expect(tabViewportX(slot(0, 3), { ...win, outerWidth: 100 })).toBeNull();
  });
  it('treats pinned > count safely', () => {
    expect(tabCentreFraction(slot(0, 2, 9), win)).not.toBeNull();
  });
});

describe('isMacPlatform', () => {
  it('prefers userAgentData', () => {
    expect(isMacPlatform({ userAgentData: { platform: 'macOS' }, platform: 'Win32' })).toBe(true);
    expect(isMacPlatform({ platform: 'MacIntel' })).toBe(true);
    expect(isMacPlatform({ platform: 'Linux x86_64' })).toBe(false);
    expect(isMacPlatform({})).toBe(false);
  });
});
