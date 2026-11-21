// Asset ids and the sprite manifest shape (Workstream G conventions).
// Real files live in public/assets/ and are described by public/assets/manifest.json.
// Pure: no browser imports.

import type { FatTier } from './domain';

export const POSES = [
  'popcorn', // Chill
  'studious', // Lock In, no Restricted tab active (glasses)
  'face', // Confrontation (3 tiers)
  'eating', // chomping an eaten interaction (3 tiers)
  'okay', // "Okay... -_-": shrinking back to the corner when a Slack pass starts
  'reaching', // body during a Reach
  'beaten', // after the 5th Push, during the Snooze
  'chud', // Chud meter full: very fat, singing, pointing
  'sign', // holding a free-gap suggestion
  'hibernating', // in the cave (popup)
] as const;
export type PoseId = (typeof POSES)[number];

export const SOUNDS = ['chomp', 'punch', 'chudSong', 'burst'] as const;
export type SoundId = (typeof SOUNDS)[number];

export type Point = [x: number, y: number];

export interface PoseSprite {
  /** Horizontal strip sheet, path relative to public/assets/. */
  file: string;
  frames: number;
  fps: number;
  /** Anchor points in frame pixels. `hand` is where the Reach arm attaches. */
  anchors: { hand?: Point; mouth?: Point; bubble?: Point };
}

export interface AssetManifest {
  /** Every sheet uses this frame size. */
  frameSize: [w: number, h: number];
  /** Poses drawn per tier give all three tiers; single-size poses give only `slim`. */
  poses: Record<PoseId, Partial<Record<FatTier, PoseSprite>>>;
  /** Stretchable arm segment (tiled along its length) and the fist at its end. */
  arm: { segment: string; fist: string };
  /** One variant is picked at random per play (e.g. several chomps). */
  sounds: Record<SoundId, string[]>;
  explosion: { file: string; durationMs: number };
  cave: string;
}
