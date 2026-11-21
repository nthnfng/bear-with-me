import { describe, expect, it, vi } from 'vitest';

vi.mock('wxt/browser', () => ({ browser: {} }));
const { isOffscreenSound, isOffscreenStop } = await import('./offscreen');

describe('offscreen messages', () => {
  it('recognises a chud song stop, and only that', () => {
    expect(isOffscreenStop({ target: 'barry-offscreen', stop: 'chudSong' })).toBe(true);
    expect(isOffscreenStop({ target: 'barry-offscreen', stop: 'chomp' })).toBe(false);
    expect(isOffscreenStop({ target: 'other', stop: 'chudSong' })).toBe(false);
    expect(isOffscreenStop(null)).toBe(false);
  });
  it('does not mistake a stop for a sound', () => {
    expect(isOffscreenSound({ target: 'barry-offscreen', stop: 'chudSong' })).toBe(false);
    expect(isOffscreenSound({ target: 'barry-offscreen', sound: 'chudSong' })).toBe(true);
  });
});
