import { describe, expect, it } from 'vitest';
import { anchorToViewport, armVector, createLandingGate, reachProgress, reachTarget } from './arm';
import { clamp01, formatCountdown, pushesLabel } from './hud';

describe('reachProgress', () => {
  const r = { startedAt: 1000, durationMs: 8000 };
  it('clamps and interpolates', () => {
    expect(reachProgress(0, r)).toBe(0);
    expect(reachProgress(5000, r)).toBe(0.5);
    expect(reachProgress(99999, r)).toBe(1);
    expect(reachProgress(1, { startedAt: 0, durationMs: 0 })).toBe(1);
  });
});

describe('geometry', () => {
  it('maps anchors through the rect', () => {
    const p = anchorToViewport(
      { left: 100, top: 200, width: 128, height: 128 },
      [236, 150],
      [256, 256],
    );
    expect(p.x).toBeCloseTo(100 + 118);
    expect(p.y).toBeCloseTo(200 + 75);
  });
  it('points up for a hand directly below the target', () => {
    const v = armVector({ x: 100, y: 500 }, { x: 100, y: 100 });
    expect(v.length).toBe(400);
    expect(v.angleDeg).toBeCloseTo(-90);
  });
  it('points right for a hand level with the target', () => {
    expect(armVector({ x: 0, y: 10 }, { x: 30, y: 10 }).angleDeg).toBeCloseTo(0);
  });
  it('targets the top-right', () => {
    expect(reachTarget(1000, 800, 20)).toEqual({ x: 980, y: 20 });
  });
});

describe('landing gate', () => {
  it('fires once per startedAt', () => {
    const g = createLandingGate();
    expect(g.check(0.5, 1)).toBe(false);
    expect(g.check(1, 1)).toBe(true);
    expect(g.check(1, 1)).toBe(false);
    expect(g.check(1, 2)).toBe(true);
  });
});

describe('hud text', () => {
  it('formats countdowns', () => {
    expect(formatCountdown(754_000)).toBe('12:34');
    expect(formatCountdown(4_100)).toBe('0:05');
    expect(formatCountdown(-5)).toBe('0:00');
  });
  it('labels pushes', () => {
    expect(pushesLabel(1)).toBe('1 push left');
    expect(pushesLabel(5)).toBe('5 pushes left');
  });
  it('clamps', () => {
    expect(clamp01(2)).toBe(1);
    expect(clamp01(-1)).toBe(0);
  });
});
