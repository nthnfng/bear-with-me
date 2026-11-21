import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { POSES, SOUNDS, type AssetManifest } from '../contracts';
import manifestJson from '../../public/assets/manifest.json';

const manifest = manifestJson as unknown as AssetManifest;
const file = (p: string) => existsSync(`public/assets/${p}`);

describe('asset manifest', () => {
  it('has every pose with an existing sheet', () => {
    for (const p of POSES) {
      expect(manifest.poses[p], p).toBeDefined();
      expect(file(manifest.poses[p].file), p).toBe(true);
    }
    expect(manifest.poses.studious.anchors.hand).toBeDefined();
  });
  it('has every sound with existing files', () => {
    for (const s of SOUNDS) {
      expect(manifest.sounds[s].length, s).toBeGreaterThan(0);
      for (const f of manifest.sounds[s]) expect(file(f), f).toBe(true);
    }
  });
  it('has arm, explosion and cave files', () => {
    for (const f of [
      manifest.arm.segment,
      manifest.arm.fist,
      manifest.explosion.file,
      manifest.cave,
    ])
      expect(file(f), f).toBe(true);
    expect(manifest.explosion.durationMs).toBeGreaterThan(0);
  });
});
