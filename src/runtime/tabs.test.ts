import { describe, expect, it } from 'vitest';
import type { BarryEffect, BarryEvent } from '../contracts';
import { STALE_GAP_MS, dropStaleEffects, isScriptableUrl, planTabSync, tabSlotFor } from './tabs';

describe('tabSlotFor', () => {
  const tabs = [
    { id: 1, windowId: 1, index: 0, pinned: true },
    { id: 2, windowId: 1, index: 1, pinned: false },
    { id: 3, windowId: 1, index: 2, pinned: false },
    { id: 4, windowId: 2, index: 0, pinned: false },
  ];
  it('counts only the tab window', () => {
    expect(tabSlotFor(tabs, 3)).toEqual({ index: 2, count: 3, pinned: 1 });
    expect(tabSlotFor(tabs, 4)).toEqual({ index: 0, count: 1, pinned: 0 });
  });
  it('is null for an unknown tab', () => {
    expect(tabSlotFor(tabs, 99)).toBeNull();
  });
});

describe('isScriptableUrl', () => {
  it('accepts web pages', () => {
    expect(isScriptableUrl('https://www.youtube.com/watch?v=1')).toBe(true);
    expect(isScriptableUrl('http://example.com')).toBe(true);
  });
  it('rejects pages content scripts cannot run on', () => {
    for (const u of [
      'chrome://extensions',
      'chrome-extension://abc/popup.html',
      'file:///tmp/a.pdf',
      'view-source:https://youtube.com',
      'about:blank',
      'https://chromewebstore.google.com/detail/x',
      'https://chrome.google.com/webstore/detail/x',
      '',
      undefined,
    ])
      expect(isScriptableUrl(u)).toBe(false);
  });
});

describe('planTabSync', () => {
  it('closes vanished tabs and navigates new or changed ones', () => {
    const plan = planTabSync({ 1: 'https://a.com', 2: 'https://b.com', 3: 'https://c.com' }, [
      { id: 1, url: 'https://a.com' },
      { id: 2, url: 'https://b2.com' },
      { id: 4, pendingUrl: 'https://d.com' },
      { id: 5 },
    ]);
    expect(plan.close).toEqual([3]);
    expect(plan.navigate).toEqual([
      { tabId: 2, url: 'https://b2.com' },
      { tabId: 4, url: 'https://d.com' },
    ]);
  });
  it('does nothing when in sync', () => {
    expect(planTabSync({ 1: 'https://a.com' }, [{ id: 1, url: 'https://a.com' }])).toEqual({
      close: [],
      navigate: [],
    });
  });
});

describe('dropStaleEffects', () => {
  const effects: BarryEffect[] = [
    { type: 'explodeAndClose', tabIds: [1] },
    { type: 'playSound', tabId: 1, sound: 'chomp' as any },
    { type: 'setBadge', pose: 'studious' as any, text: '' },
  ];
  const tick: BarryEvent = { type: 'tick', now: 10_000_000 };
  it('keeps effects after a normal gap', () => {
    expect(dropStaleEffects(tick, tick.now - STALE_GAP_MS, effects)).toEqual(effects);
    expect(dropStaleEffects(tick, null, effects)).toEqual(effects);
  });
  it('drops one-shot effects after sleep, keeping the badge', () => {
    expect(dropStaleEffects(tick, tick.now - STALE_GAP_MS - 1, effects)).toEqual([effects[2]]);
  });
  it('never drops effects of a user action', () => {
    const back: BarryEvent = { type: 'backToIt', now: 10_000_000, tabId: 1 };
    expect(dropStaleEffects(back, 0, effects)).toEqual(effects);
  });
});
