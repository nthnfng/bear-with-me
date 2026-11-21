// Pixel-art pieces of the popup. Draws only; what to show comes from src/popup/view.ts.

import { useEffect, useState } from 'react';
import type { AssetManifest, PoseSprite } from '@/src/contracts';
import manifestJson from '../../public/assets/manifest.json';
import { CHUD_FILL, chudFillWidth, frameAt, spriteBox } from '@/src/popup/view';

export const manifest = manifestJson as unknown as AssetManifest;
export const assetUrl = (file: string) => browser.runtime.getURL(`/assets/${file}` as any);

const HEADER_SCALE = 3;
const CHUD_SCALE = 4;

/** One strip, flipbooked per frameMs from `since`; a new `since` restarts it. */
export function Sprite({
  sprite,
  scale,
  since = 0,
  className,
}: {
  sprite: PoseSprite;
  scale: number;
  since?: number;
  className?: string;
}) {
  // Ticking only triggers re-renders; the frame is computed from `since` during render,
  // so a new strip never paints with the old frame index.
  const [, setTick] = useState(0);
  useEffect(() => {
    if (sprite.frames <= 1 || !sprite.frameMs) return;
    const id = setInterval(() => setTick((t) => t + 1), sprite.frameMs! / 2);
    return () => clearInterval(id);
  }, [sprite.file, sprite.frames, sprite.frameMs, since]);
  const frame = frameAt(sprite, Date.now() - since);
  return (
    <div
      className={`sprite ${className ?? ''}`}
      style={{ backgroundImage: `url(${assetUrl(sprite.file)})`, ...spriteBox(sprite, scale, frame) }}
    />
  );
}

export function HeaderPose({ pose, poseSince }: { pose: keyof AssetManifest['poses']; poseSince: number }) {
  return <Sprite sprite={manifest.poses[pose]} scale={HEADER_SCALE} since={poseSince} />;
}

/** Outline from chud-bar.png over a green track, orange fill in 10 steps. */
export function ChudBar({ meter }: { meter: number }) {
  const S = CHUD_SCALE;
  const { w, h, file } = manifest.chudBar;
  return (
    <div
      className="chudbar"
      role="meter"
      aria-label="Chud meter"
      aria-valuemin={0}
      aria-valuemax={1}
      aria-valuenow={meter}
      style={{ width: w * S, height: h * S }}>
      <div
        className="track"
        style={{ left: CHUD_FILL.x * S, top: CHUD_FILL.y * S, width: CHUD_FILL.w * S, height: CHUD_FILL.h * S }}
      />
      <div
        className="fill"
        style={{ left: CHUD_FILL.x * S, top: CHUD_FILL.y * S, width: chudFillWidth(meter) * S, height: CHUD_FILL.h * S }}
      />
      <div
        className="sprite outline"
        style={{ backgroundImage: `url(${assetUrl(file)})`, ...spriteBox({ w, h, frames: 1 }, S) }}
      />
    </div>
  );
}

type CaveAnim = 'entering' | 'leaving' | null;
const CAVE_MS = { entering: 1800, leaving: 1400 };

/**
 * The cave toggle: "send Barry back" hops default Barry in and shrinks him into the dark;
 * "let Barry out" has happy Barry hop back out. The setting is sent right away; the hop is
 * only decoration and blocks the button while it plays.
 */
export function CaveScene({
  cave,
  disabled,
  onToggle,
}: {
  cave: boolean;
  disabled: boolean;
  onToggle: (cave: boolean) => void;
}) {
  const [anim, setAnim] = useState<CaveAnim>(null);
  useEffect(() => {
    if (!anim) return;
    const id = setTimeout(() => setAnim(null), CAVE_MS[anim]);
    return () => clearTimeout(id);
  }, [anim]);

  const rest = anim ?? (cave ? 'in' : 'out');
  const pose = manifest.poses[anim === 'leaving' ? 'happy' : 'default'];
  const click = () => {
    setAnim(cave ? 'leaving' : 'entering');
    onToggle(!cave);
  };
  return (
    <div className="cavebox">
      <div className="cavescene" style={{ backgroundImage: `url(${assetUrl(manifest.cave)})` }}>
        <div className={`cavebarry ${rest}`}>
          <div className={anim ? 'hop' : ''}>
            <Sprite sprite={pose} scale={HEADER_SCALE} />
          </div>
        </div>
        {rest === 'in' && <span className="zzz">z z Z</span>}
      </div>
      <button className="wide" disabled={disabled || anim !== null} onClick={click}>
        {cave ? 'Let Barry out' : 'Send Barry back'}
      </button>
    </div>
  );
}
