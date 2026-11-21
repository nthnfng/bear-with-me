// Pixel-art pieces of the popup. Draws only; what to show comes from src/popup/view.ts.

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { AssetManifest, PoseSprite } from '@/src/contracts';
import manifestJson from '../../src/assets/manifest.json';
import { chudSignSegments, frameAt, spriteBox } from '@/src/popup/view';
import { PAPER_COLORS, paperPaths } from '@/src/popup/paper';
import type { PaperPaths } from '@/src/popup/paper';

export const manifest = manifestJson as unknown as AssetManifest;
export const assetUrl = (file: string) => browser.runtime.getURL(`/assets/${file}` as any);

const CAVE_SCENE_SCALE = 3;
/** One art pixel of the paper and UI chrome, in CSS px. */
const PX = 3;

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

export function HeaderPose({
  pose,
  poseSince,
  scale,
}: {
  pose: keyof AssetManifest['poses'];
  poseSince: number;
  scale: number;
}) {
  return <Sprite sprite={manifest.poses[pose]} scale={scale} since={poseSince} />;
}

/** A card of tattered pixel paper that sizes its torn edges to whatever it holds. */
export function Paper({
  seed,
  label,
  className,
  children,
}: {
  seed: number;
  label: string;
  className?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setSize({ w: el.offsetWidth, h: el.offsetHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const W = Math.floor(size.w / PX);
  const H = Math.floor(size.h / PX);
  const paths = useMemo(() => (W > 10 && H > 10 ? paperPaths(W, H, seed) : null), [W, H, seed]);
  return (
    <section ref={ref} aria-label={label} className={`paper ${className ?? ''}`}>
      {paths && (
        <svg
          className="paper-bg"
          width={(W + 1) * PX}
          height={(H + 1) * PX}
          viewBox={`0 0 ${W + 1} ${H + 1}`}
          fill="none"
          shapeRendering="crispEdges"
          aria-hidden="true"
        >
          {(Object.keys(PAPER_COLORS) as (keyof PaperPaths)[]).map(
            (k) =>
              paths[k] && (
                <path
                  key={k}
                  stroke={PAPER_COLORS[k]}
                  strokeOpacity={k === 'shadow' ? 0.45 : undefined}
                  d={paths[k]}
                />
              ),
          )}
        </svg>
      )}
      <div className="paper-body">{children}</div>
    </section>
  );
}

/** A pixel icon: `d` is run-length path data in a `w` x `h` grid, drawn `scale` px per pixel. */
export function PixelIcon({
  w,
  h,
  scale = 2,
  paths,
}: {
  w: number;
  h: number;
  scale?: number;
  paths: [color: string, d: string][];
}) {
  return (
    <svg
      width={w * scale}
      height={h * scale}
      viewBox={`0 0 ${w} ${h}`}
      fill="none"
      shapeRendering="crispEdges"
      aria-hidden="true"
    >
      {paths.map(([c, d]) => (
        <path key={c + d} stroke={c} d={d} />
      ))}
    </svg>
  );
}

const INK = '#2a1a14';

export const Icons = {
  gear: (
    <PixelIcon
      w={8}
      h={8}
      paths={[
        [
          INK,
          'M2 0.5h1M5 0.5h1M1 1.5h6M0 2.5h3M5 2.5h3M1 3.5h1M6 3.5h1M1 4.5h1M6 4.5h1M0 5.5h3M5 5.5h3M1 6.5h6M2 7.5h1M5 7.5h1',
        ],
      ]}
    />
  ),
  back: <PixelIcon w={6} h={5} paths={[[INK, 'M2 0.5h1M1 1.5h1M0 2.5h6M1 3.5h1M2 4.5h1']]} />,
  plus: (
    <PixelIcon w={5} h={5} scale={3} paths={[['#ffffff', 'M2 0.5h1M2 1.5h1M0 2.5h5M2 3.5h1M2 4.5h1']]} />
  ),
  check: <PixelIcon w={6} h={5} paths={[['#ffffff', 'M5 0.5h1M4 1.5h1M0 2.5h1M3 2.5h1M1 3.5h2']]} />,
  trash: (
    <PixelIcon
      w={7}
      h={8}
      paths={[
        [
          '#7d818b',
          'M2 0.5h3M0 1.5h7M1 2.5h5M1 3.5h1M3 3.5h1M5 3.5h1M1 4.5h1M3 4.5h1M5 4.5h1M1 5.5h1M3 5.5h1M5 5.5h1M1 6.5h1M3 6.5h1M5 6.5h1M2 7.5h3',
        ],
      ]}
    />
  ),
  clipboard: (
    <PixelIcon
      w={10}
      h={10}
      paths={[
        [
          INK,
          'M3 0.5h4M1 1.5h3M6 1.5h3M1 2.5h1M8 2.5h1M1 3.5h1M8 3.5h1M1 4.5h1M8 4.5h1M1 5.5h1M8 5.5h1M1 6.5h1M8 6.5h1M1 7.5h1M8 7.5h1M1 8.5h1M8 8.5h1M1 9.5h8M7 5.5h1M3 6.5h1M6 6.5h1M4 7.5h2',
        ],
        ['#f2c14e', 'M4 1.5h2'],
        ['#fff7ea', 'M2 2.5h6M2 3.5h6M2 4.5h6M2 5.5h5M2 6.5h1M4 6.5h2M7 6.5h1M2 7.5h2M6 7.5h2M2 8.5h6'],
      ]}
    />
  ),
};

const POSITION_DOT = { left: 'M1 5.5h2M1 6.5h2', middle: 'M5 5.5h2M5 6.5h2', right: 'M9 5.5h2M9 6.5h2' };

/** A tiny browser window with Barry's dot in one bottom corner. */
export function PositionIcon({ position }: { position: keyof typeof POSITION_DOT }) {
  return (
    <PixelIcon
      w={12}
      h={8}
      paths={[
        ['#fbf3df', 'M1 1.5h10M1 2.5h10M1 3.5h10M1 4.5h10M1 5.5h10M1 6.5h10'],
        [
          INK,
          'M0 0.5h12M0 1.5h1M11 1.5h1M0 2.5h1M11 2.5h1M0 3.5h1M11 3.5h1M0 4.5h1M11 4.5h1M0 5.5h1M11 5.5h1M0 6.5h1M11 6.5h1M0 7.5h12',
        ],
        ['#8d5a3b', POSITION_DOT[position]],
      ]}
    />
  );
}

export function Cloud({ left, top, scale }: { left: number; top: number; scale: number }) {
  return (
    <span className="cloud" style={{ left, top }}>
      <PixelIcon
        w={16}
        h={5}
        scale={scale}
        paths={[
          ['#ffffff', 'M6 0.5h4M4 1.5h8M13 1.5h2M2 2.5h14M0 3.5h16'],
          ['#cfe3f3', 'M1 4.5h14'],
        ]}
      />
    </span>
  );
}

export function SpeechTail() {
  return (
    <PixelIcon
      w={8}
      h={6}
      scale={3}
      paths={[
        ['#fff7ea', 'M5 0.5h3M4 1.5h3M3 2.5h2M2 3.5h1'],
        ['#1f1410', 'M4 0.5h1M3 1.5h1M7 1.5h1M2 2.5h1M5 2.5h2M1 3.5h1M3 3.5h2M0 4.5h2'],
      ]}
    />
  );
}

export function Heart({ full }: { full: boolean }) {
  return (
    <PixelIcon
      w={7}
      h={6}
      paths={[[full ? '#d9443c' : '#ddc9a3', 'M1 0.5h2M4 0.5h2M0 1.5h7M0 2.5h7M1 3.5h5M2 4.5h3M3 5.5h1']]}
    />
  );
}

/** The wooden signpost in the grass that shows the Chud meter. */
export function ChudSign({ meter }: { meter: number }) {
  const segs = chudSignSegments(meter);
  return (
    <div className="chud-sign" title="Fills while Barry is snoozed; resets after 10 minutes of studying">
      <div className="board">
        <span>Chud Meter</span>
        <div
          className="segs"
          role="meter"
          aria-label="Chud meter"
          aria-valuemin={0}
          aria-valuemax={1}
          aria-valuenow={meter}
        >
          {segs.map((on, i) => (
            <i key={i} className={on ? 'on' : ''} />
          ))}
        </div>
      </div>
      <div className="post" />
    </div>
  );
}

/** A pixel on/off switch (a real button with role=switch). */
export function Switch({
  on,
  label,
  disabled,
  onChange,
}: {
  on: boolean;
  label: string;
  disabled?: boolean;
  onChange: (on: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      className={`switch ${on ? 'on' : ''}`}
      onClick={() => onChange(!on)}
    >
      <span />
    </button>
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
            <Sprite sprite={pose} scale={CAVE_SCENE_SCALE} />
          </div>
        </div>
        {rest === 'in' && <span className="zzz">z z Z</span>}
      </div>
      <button className="stone wide" disabled={disabled || anim !== null} onClick={click}>
        {cave ? 'Let Barry out' : 'Send Barry back'}
      </button>
    </div>
  );
}
