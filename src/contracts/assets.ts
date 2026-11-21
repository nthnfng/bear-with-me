// Asset ids and the sprite manifest shape (Workstream G conventions).
// Real files live in public/assets/ and are described by public/assets/manifest.json.
// Pure: no browser imports.

export const POSES = [
  'chill', // Chill: relaxing in the corner
  'studious', // Lock In, no Restricted tab active (glasses). Also the body the Reach arm comes out of.
  'confrontation', // in your face; already drawn fat, scaled up further as Fatness grows
  'okay', // "Okay... -_-": shrinking back to the corner when a Slack pass starts
  'beaten', // after the 5th Push, during the Snooze
  'chud', // Chud meter full: the fattest Barry, pointing at the user
] as const;
export type PoseId = (typeof POSES)[number];

export const SOUNDS = [
  'chomp', // each eaten interaction
  'punch', // each Push
  'ow', // the 5th Push: Barry is beaten and a Snooze starts
  'chudSong', // "I'm a chud", when chud Barry arrives
  'burst', // Barry bursting onto the page for a Confrontation
] as const;
export type SoundId = (typeof SOUNDS)[number];

export type Point = [x: number, y: number];

export interface PoseSprite {
  /** Horizontal strip sheet, path relative to public/assets/. */
  file: string;
  frames: number;
  fps: number;
  /** Anchor points in frame pixels. `hand` is where the Reach arm attaches (studious pose). */
  anchors: { hand?: Point; bubble?: Point };
}

export interface AssetManifest {
  /** Every sheet uses this frame size. */
  frameSize: [w: number, h: number];
  poses: Record<PoseId, PoseSprite>;
  /** The Reach is just the arm: a segment tiled along its length, and the fist at its end. */
  arm: { segment: string; fist: string };
  /** One variant is picked at random per play (e.g. several chomps). */
  sounds: Record<SoundId, string[]>;
  explosion: { file: string; durationMs: number };
  /** Shown in the popup. Barry walks in and disappears; there's no Barry-in-cave sprite. */
  cave: string;
}
