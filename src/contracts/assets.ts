// Asset ids and the sprite manifest shape.
// Real files live in public/assets/ and are described by public/assets/manifest.json.
// Pose → situation map: docs/implementation-plan.md (Phase 5, "Pose map"). Pure: no browser imports.

export const POSES = [
  'chill-mug', // Chill, corner: sipping (animated strip)
  'chill', // Slack pass: lounging
  'thinking', // free-gap suggestion
  'studious', // Lock In, on task: reading (animated strip)
  'suspicious', // Confrontation with 0 eats; "Okay... -_-"; Snooze "ow"
  'suspicious-tap', // warning: foot tapping (animated strip)
  'fat-1', // Confrontation, 1 eat
  'fat-2',
  'fat-3',
  'fat-4', // Confrontation, 4 eats
  'chud', // Confrontation, 5+ eats; the Reach body when the Chud meter is full
  'chud-point', // Confrontation with a full Chud meter: the "I'm a chud" dance
  'close-tab', // the Reach body; Back to it
  'got-owned', // Snooze: knocked down
  'get-up', // Snooze: getting up (the overlay adds get-up-2 and default as in-betweens)
  'get-up-2',
  'default', // standing
  'grieved', // Snooze: "my arm hurts i guess ill leave u alone"
  'tired', // Snooze: resting in the corner, clickable (Get up)
  'happy', // Get up: one happy jump before the Snooze ends
] as const;
export type PoseId = (typeof POSES)[number];

export const SOUNDS = [
  'chomp', // each eaten interaction
  'punch', // each Push
  'ow', // the 5th Push: Barry is beaten and a Snooze starts
  'chudSong', // "I'm a chud", when chud Barry arrives
  'burst', // Barry bursting onto the page for a Confrontation
  'explosion', // Restricted tabs exploding (explodeAndClose)
] as const;
export type SoundId = (typeof SOUNDS)[number];

export type Point = [x: number, y: number];

/** A single image, sizes in art pixels (1 art pixel = `scale` screen pixels). */
export interface ImageAsset {
  /** Path relative to public/assets/. */
  file: string;
  w: number;
  h: number;
}

/**
 * One pose: a horizontal PNG strip of `frames` frames, each `w` × `h` art pixels.
 * Render with background-size = (w * frames * S) × (h * S), so a strip saved at a larger
 * multiple (chud-point is saved at 4×) still lines up.
 */
export interface PoseSprite extends ImageAsset {
  frames: number;
  /** Ms per frame for animated strips; absent = still image. */
  frameMs?: number;
  /** Where the Arm starts, in art pixels from the frame's top-left. */
  paw?: Point;
}

export interface AssetManifest {
  poses: Record<PoseId, PoseSprite>;
  /** Integer screen scale (screen px per art px) for each placement, so pixels stay crisp. */
  scale: { corner: number; face: number };
  /** Chud meter outline; the fill is drawn in code. */
  chudBar: ImageAsset;
  /** Shown next to the Slack pass countdown. */
  clockIcon: ImageAsset;
  /** One variant is picked at random per play (e.g. several chomps). */
  sounds: Record<SoundId, string[]>;
  /** Pixel-particle explosion drawn in code; must finish inside the runtime's close delay. */
  explosion: { durationMs: number };
  /** Shown in the popup. */
  cave: string;
}
