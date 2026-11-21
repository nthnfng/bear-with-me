import { afterEach, describe, expect, it, vi } from 'vitest';
import { brain, initialState } from '../brain';
import { HIDDEN_VIEW, type TabView } from '../contracts';
import { CHUD_FILL, chudFillWidth, chudSteps, frameAt, headerBarry, spriteBox } from './view';

const withTabs = (urls: Record<number, string>) => ({ ...initialState(), openTabs: urls });
const view = (over: Partial<TabView>): TabView => ({ ...HIDDEN_VIEW, visible: true, ...over });

afterEach(() => vi.restoreAllMocks());

describe('headerBarry', () => {
  it("shows the active tab's pose and poseSince", () => {
    const state = withTabs({ 1: 'https://a.test', 2: 'https://b.test' });
    vi.spyOn(brain, 'viewFor').mockImplementation((_s, id) =>
      id === 2 ? view({ pose: 'fat-2', poseSince: 50 }) : view({ pose: 'studious' }),
    );
    expect(headerBarry(state, 100, 2)).toEqual({ pose: 'fat-2', poseSince: 50, canGetUp: false });
  });

  it('falls back to another visible tab when the active one hides Barry', () => {
    const state = withTabs({ 1: 'https://a.test', 2: 'https://b.test' });
    vi.spyOn(brain, 'viewFor').mockImplementation((_s, id) =>
      id === 1 ? HIDDEN_VIEW : view({ pose: 'tired', poseSince: 9, canGetUp: true }),
    );
    expect(headerBarry(state, 100, 1)).toEqual({ pose: 'tired', poseSince: 9, canGetUp: true });
  });

  it('offers Get up even when the shown view is another tab', () => {
    const state = withTabs({ 1: 'https://a.test', 2: 'https://b.test' });
    vi.spyOn(brain, 'viewFor').mockImplementation((_s, id) =>
      id === 1 ? view({ pose: 'chill-mug' }) : view({ pose: 'tired', canGetUp: true }),
    );
    const h = headerBarry(state, 100, 1);
    expect(h.pose).toBe('chill-mug');
    expect(h.canGetUp).toBe(true);
  });

  it('is calm when nobody shows Barry (Chill sips)', () => {
    const state = { ...withTabs({ 1: 'https://a.test' }), modeOverride: 'chill' as const };
    vi.spyOn(brain, 'viewFor').mockReturnValue(HIDDEN_VIEW);
    expect(headerBarry(state, 100, 1)).toEqual({ pose: 'chill-mug', poseSince: 0, canGetUp: false });
  });

  it('is calm with no tabs (Lock In studies)', () => {
    const state = { ...initialState(), modeOverride: 'lockIn' as const };
    expect(headerBarry(state, 100, null).pose).toBe('studious');
  });
});

describe('sprites and chud bar', () => {
  it('flips frames per frameMs, loops, and keeps stills on 0', () => {
    expect(frameAt({ frames: 4, frameMs: 100 }, 0)).toBe(0);
    expect(frameAt({ frames: 4, frameMs: 100 }, 250)).toBe(2);
    expect(frameAt({ frames: 4, frameMs: 100 }, 400)).toBe(0);
    expect(frameAt({ frames: 1 }, 999)).toBe(0);
    expect(frameAt({ frames: 4 }, 999)).toBe(0);
  });

  it('sizes the strip at an integer scale', () => {
    expect(spriteBox({ w: 17, h: 20, frames: 13 }, 3, 2)).toEqual({
      width: 51,
      height: 60,
      backgroundSize: '663px 60px',
      backgroundPosition: '-102px 0px',
    });
  });

  it('fills the chud bar in 10 steps', () => {
    expect(chudSteps(0)).toBe(0);
    expect(chudSteps(0.34)).toBe(3);
    expect(chudSteps(1.5)).toBe(10);
    expect(chudSteps(NaN)).toBe(0);
    expect(chudFillWidth(1)).toBe(CHUD_FILL.w);
    expect(chudFillWidth(0)).toBe(0);
  });
});
