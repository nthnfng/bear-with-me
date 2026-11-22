// The sky header both screens share: clouds, cave, Barry, speech bubble and the Chud sign.
// Draws src/popup/view.ts only.

import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { BarryState } from '@/src/contracts';
import { BUBBLE, headerBarry, popupView, sceneKey, skyBands } from '@/src/popup/view';
import { useActiveTabId } from './hooks';
import { ChudSign, Cloud, HeaderPose, SpeechTail, Sprite, assetUrl, manifest } from './Pixel';

/** Barry walking into the Cave, or out of it and off to the page. */
export type CaveWalk = 'entering' | 'leaving';
/** Keep in step with the cave-walk animations in style.css. */
export const CAVE_WALK_MS: Record<CaveWalk, number> = { entering: 2000, leaving: 1800 };

/** Plays one cave walk at a time; `start` is ignored while one is playing. */
export function useCaveWalk() {
  const [walk, setWalk] = useState<CaveWalk | null>(null);
  useEffect(() => {
    if (!walk) return;
    const id = setTimeout(() => setWalk(null), CAVE_WALK_MS[walk]);
    return () => clearTimeout(id);
  }, [walk]);
  return { walk, start: (w: CaveWalk) => setWalk((cur) => cur ?? w) };
}

export function SkyHeader({
  state,
  now,
  topbar,
  walk = null,
  onBarry,
}: {
  state: BarryState;
  now: number;
  /** Contents of the bar along the top (badge and gear, or back and title). */
  topbar: ReactNode;
  walk?: CaveWalk | null;
  onBarry?: () => void;
}) {
  const activeTabId = useActiveTabId();
  const v = popupView(state, now);
  const hb = headerBarry(state, now, activeTabId);
  const key = sceneKey(v.mode, state.phase);
  const night = key === 'snoozing';
  const showBubble = key !== 'confronting' && key !== 'slackPass' && key !== 'snoozing' && (state.cave || (key !== 'clear' && key !== 'chill'));

  return (
    <header className="sky" style={{ background: skyBands(key, 36) }}>
      <div className={night ? 'clouds dim' : 'clouds'}>
        <Cloud left={196} top={4} scale={6} />
        <Cloud left={24} top={40} scale={4} />
        <Cloud left={266} top={48} scale={5} />
      </div>
      {night && (
        <div className="stars" aria-hidden="true">
          <i style={{ left: 120, top: 22 }} />
          <i style={{ left: 172, top: 52 }} className="sm" />
          <i style={{ left: 310, top: 28 }} />
          <i style={{ left: 236, top: 64 }} className="sm" />
        </div>
      )}

      <div className="topbar">{topbar}</div>

      <img
        className="cave"
        src={assetUrl('barry-home.png')}
        alt="Barry's cave"
        draggable={false}
        onClick={onBarry}
      />
      {walk ? (
        <span className={`cave-walk ${walk}`} aria-hidden="true">
          <span className="hop">
            <Sprite sprite={manifest.poses[walk === 'leaving' ? 'happy' : 'default']} scale={2} />
          </span>
        </span>
      ) : hb.inPopup ? (
        <span className="cave-barry" onClick={onBarry}>
          <HeaderPose pose={hb.pose} poseSince={hb.poseSince} scale={2} />
        </span>
      ) : (
        state.cave && v.mode === 'chill' && (
          <span className="zzz" aria-label="Barry is asleep in his cave">
            z z Z
          </span>
        )
      )}

      {showBubble && (
        <>
          <div className="bubble" role="status">
            <span>{BUBBLE[key]}</span>
            {v.countdownHint && <span className="pushes">{v.countdownHint}</span>}
          </div>
          <span className="bubble-tail">
            <SpeechTail />
          </span>
        </>
      )}

      <ChudSign meter={state.chudMeter} />
    </header>
  );
}
