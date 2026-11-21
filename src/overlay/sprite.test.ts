import { describe, expect, it } from 'vitest';
import {
  fitScale,
  frameIndex,
  frameOffset,
  getUpFrame,
  poseLook,
  spriteBox,
  swayOffset,
} from './sprite';

describe('frameIndex', () => {
  it('is derived from the shared start time, so tabs stay in sync', () => {
    expect(frameIndex(1000, 1000, 13, 220)).toBe(0);
    expect(frameIndex(1000 + 220, 1000, 13, 220)).toBe(1);
    expect(frameIndex(1000 + 220 * 13, 1000, 13, 220)).toBe(0);
    expect(frameIndex(1000 + 220 * 14 + 5, 1000, 13, 220)).toBe(1);
  });
  it('stills and clock skew stay on frame 0', () => {
    expect(frameIndex(5000, 0, 1, undefined)).toBe(0);
    expect(frameIndex(500, 1000, 6, 130)).toBe(0);
  });
});

describe('spriteBox', () => {
  it('scales the whole strip by an integer', () => {
    expect(spriteBox({ w: 17, h: 20, frames: 13 }, 4)).toEqual({
      width: 68,
      height: 80,
      bgWidth: 17 * 13 * 4,
      bgHeight: 80,
    });
    expect(frameOffset({ w: 17 }, 4, 3)).toBe(-204);
  });
});

describe('fitScale', () => {
  it('keeps the manifest scale on normal screens', () => {
    expect(fitScale(8, 50, 1000)).toBe(8);
  });
  it('steps down on short viewports but never below 2', () => {
    expect(fitScale(8, 50, 600)).toBe(6);
    expect(fitScale(8, 50, 100)).toBe(2);
  });
});

describe('get-up and dance timing', () => {
  it('plays get-up, get-up-2, default', () => {
    expect(getUpFrame(0)).toBe('get-up');
    expect(getUpFrame(299)).toBe('get-up');
    expect(getUpFrame(300)).toBe('get-up-2');
    expect(getUpFrame(600)).toBe('default');
  });
  it('sways around the middle every 0.9 s', () => {
    expect([0, 900, 1800, 2700].map(swayOffset)).toEqual([0, 90, -90, 90]);
  });
});

describe('poseLook', () => {
  it('pops burst-in and the 5th eat, chomps after', () => {
    expect(poseLook('suspicious', 'face', null).entrance).toBe('pop');
    expect(poseLook('chud', 'face', 'fat-4').entrance).toBe('pop');
    expect(poseLook('chud', 'face', 'chud').entrance).toBe('chomp');
    expect(poseLook('fat-2', 'face', 'fat-1').entrance).toBe('chomp');
  });
  it('thinking pops then breathes; max chud bounces', () => {
    expect(poseLook('thinking', 'corner', null)).toEqual({ idle: 'breathe', entrance: 'pop' });
    expect(poseLook('chud-point', 'face', null).idle).toBe('bounce');
  });
});
