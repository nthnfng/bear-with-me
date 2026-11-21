import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { POSES, SOUNDS, type AssetManifest } from '../contracts';
import manifestJson from '../assets/manifest.json';

const manifest = manifestJson as unknown as AssetManifest;
const file = (p: string) => existsSync(`public/assets/${p}`);
const pngWidth = (p: string) => readFileSync(`public/assets/${p}`).readUInt32BE(16);
const pngHeight = (p: string) => readFileSync(`public/assets/${p}`).readUInt32BE(20);

describe('asset manifest', () => {
  it('has exactly the contract poses, each with an existing sheet', () => {
    expect(Object.keys(manifest.poses).sort()).toEqual([...POSES].sort());
    for (const p of POSES) expect(file(manifest.poses[p].file), p).toBe(true);
  });
  it('strip width is w*frames, or a whole multiple (chud-point is saved at 4x)', () => {
    for (const p of POSES) {
      const { file: f, w, h, frames } = manifest.poses[p];
      const pw = pngWidth(f);
      const ph = pngHeight(f);
      expect(pw % (w * frames), `${p} width ${pw} vs ${w}x${frames}`).toBe(0);
      const k = pw / (w * frames);
      expect(ph, `${p} height`).toBe(h * k);
      if (p !== 'chud-point') expect(k, p).toBe(1);
    }
    expect(pngWidth(manifest.poses['chud-point'].file)).toBe(200);
  });
  it('animated strips have a frame time; stills do not need one', () => {
    for (const p of POSES) {
      const s = manifest.poses[p];
      if (s.frames > 1) expect(s.frameMs, p).toBeGreaterThan(0);
    }
  });
  it('Arm bodies have a paw anchor inside the frame', () => {
    for (const p of ['close-tab', 'chud', 'fat-1', 'fat-2', 'fat-3', 'fat-4'] as const) {
      const s = manifest.poses[p];
      expect(s.paw, p).toBeDefined();
      expect(s.paw![0]).toBeLessThan(s.w);
      expect(s.paw![1]).toBeLessThan(s.h);
    }
  });
  it('uses integer scales, face larger than corner', () => {
    expect(Number.isInteger(manifest.scale.corner)).toBe(true);
    expect(Number.isInteger(manifest.scale.face)).toBe(true);
    expect(manifest.scale.face).toBeGreaterThan(manifest.scale.corner);
  });
  it('has every sound with existing files', () => {
    for (const s of SOUNDS) {
      expect(manifest.sounds[s].length, s).toBeGreaterThan(0);
      for (const f of manifest.sounds[s]) expect(file(f), f).toBe(true);
    }
  });
  it('has chud bar, clock and cave files, and an explosion that fits the close window', () => {
    for (const f of [manifest.chudBar.file, manifest.clockIcon.file, manifest.cave])
      expect(file(f), f).toBe(true);
    expect(pngWidth(manifest.chudBar.file)).toBe(manifest.chudBar.w);
    expect(manifest.explosion.durationMs).toBeGreaterThan(0);
    expect(manifest.explosion.durationMs).toBeLessThanOrEqual(1300);
  });
});
