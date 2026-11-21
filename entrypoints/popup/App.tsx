// Popup: draws src/popup/view.ts and sends PopupMessages. No behaviour here (ADR 0001).

import { useEffect, useState } from 'react';
import { storage } from 'wxt/utils/storage';
import { DEFAULT_TUNING, DEMO_TUNING, STORAGE_KEYS } from '@/src/contracts';
import type { BarryState, DevCommand, ModeOverride, PopupMessage } from '@/src/contracts';
import {
  SLACK_PRESETS_MIN,
  formatClock,
  headerBarry,
  formatCountdown,
  popupView,
  speedPreset,
  secondsToMs,
  tuningSeconds,
} from '@/src/popup/view';
import { ChudMeter, SettingsSections } from './Settings';
import { HeaderPose } from './Pixel';

const send = (msg: PopupMessage) => {
  browser.runtime.sendMessage(msg).catch(() => {});
};
const dev = (command: DevCommand) => send({ type: 'dev', command });

function useBarryState() {
  const [state, setState] = useState<BarryState | null>(null);
  useEffect(() => {
    let alive = true;
    storage.getItem<BarryState>(STORAGE_KEYS.state).then((s) => alive && setState(s));
    const unwatch = storage.watch<BarryState>(STORAGE_KEYS.state, (s) => setState(s));
    return () => {
      alive = false;
      unwatch();
    };
  }, []);
  return state;
}

function useActiveTabId() {
  const [id, setId] = useState<number | null>(null);
  useEffect(() => {
    browser.tabs
      .query({ active: true, currentWindow: true })
      .then((t) => setId(t[0]?.id ?? null))
      .catch(() => {});
  }, []);
  return id;
}

function useNow() {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

const UNLOCK_KEY = 'barry:devUnlocked';
const read = () => {
  try {
    return localStorage.getItem(UNLOCK_KEY) === '1';
  } catch {
    return false;
  }
};

const MODES: { value: ModeOverride; label: string }[] = [
  { value: 'auto', label: 'Auto' },
  { value: 'chill', label: 'Chill' },
  { value: 'lockIn', label: 'Lock In' },
];

function App() {
  const state = useBarryState();
  const now = useNow();
  const activeTabId = useActiveTabId();
  const [clicks, setClicks] = useState(0);
  const [devOpen, setDevOpen] = useState(read);

  const onBarry = () => {
    if (devOpen) return;
    if (clicks + 1 >= 5) {
      setDevOpen(true);
      try {
        localStorage.setItem(UNLOCK_KEY, '1');
      } catch {
        /* popup convenience only */
      }
    }
    setClicks(clicks + 1);
  };

  const v = state ? popupView(state, now) : null;
  const hb = state ? headerBarry(state, now, activeTabId) : null;

  return (
    <main>
      <div className="hero">
        <img
          className="barry"
          src={browser.runtime.getURL('/assets/barry-home.png' as any)}
          alt="Barry"
          draggable={false}
          onClick={onBarry}
        />
        {hb && <HeaderPose pose={hb.pose} poseSince={hb.poseSince} />}
      </div>
      {hb?.canGetUp && (
        <button className="getup" onClick={() => send({ type: 'gotUp' })}>
          Get up
        </button>
      )}
      {!v || !state ? (
        <p className="headline">Barry is waking up...</p>
      ) : (
        <>
          <h1 className={`headline ${v.mode}`}>{v.headline}</h1>
          <p className="sub">
            {v.modeLabel} <span className="dim">({v.sourceLabel})</span>
          </p>

          {v.countdown && (
            <div className="countdown">
              <span className="time">{formatCountdown(v.countdown.target - now)}</span>
              <span className="dim">{v.countdown.label}</span>
            </div>
          )}
          {v.pushesLeft !== null && (
            <p className="pushes">
              {v.pushesLeft} {v.pushesLeft === 1 ? 'Push' : 'Pushes'} left
            </p>
          )}

          <dl className="blocks">
            <dt>Now</dt>
            <dd>
              {v.currentBlock
                ? `${v.currentBlock.title} (until ${formatClock(v.currentBlock.end)})`
                : 'Nothing scheduled'}
            </dd>
            <dt>Next</dt>
            <dd>
              {v.nextBlock
                ? `${v.nextBlock.title} (${formatClock(v.nextBlock.start)})`
                : 'Nothing coming up'}
            </dd>
          </dl>

          <div className="seg" role="radiogroup" aria-label="Mode">
            {MODES.map((m) => (
              <button
                key={m.value}
                role="radio"
                aria-checked={v.override === m.value}
                className={v.override === m.value ? 'on' : ''}
                onClick={() => send({ type: 'setModeOverride', override: m.value })}
              >
                {m.label}
              </button>
            ))}
          </div>

          <div className="slack">
            <span className="label">Slack pass</span>
            <div className="chips">
              {SLACK_PRESETS_MIN.map((min) => (
                <button
                  key={min}
                  disabled={!v.slackAllowed}
                  onClick={() => send({ type: 'startSlackPass', durationMs: min * 60_000 })}
                >
                  {min} min
                </button>
              ))}
            </div>
            {v.slackHint && <p className="hint">{v.slackHint}</p>}
          </div>

          <ChudMeter meter={state.chudMeter} />

          <SettingsSections state={state} now={now} send={send} />

          {devOpen && <DevPanel state={state} onClose={() => setDevOpen(false)} />}
        </>
      )}
    </main>
  );
}

function DevPanel({ state, onClose }: { state: BarryState; onClose: () => void }) {
  const [title, setTitle] = useState('Dev block');
  const [minutes, setMinutes] = useState('30');
  const secs = tuningSeconds(state.tuning);
  const preset = speedPreset(state.tuning);
  const [fat, setFat] = useState(String(state.fatness));
  const [chud, setChud] = useState(String(state.chudMeter));

  const setSeconds = (key: keyof typeof secs, value: string) => {
    const ms = secondsToMs(value);
    if (ms !== null) dev({ kind: 'setTuning', tuning: { [key]: ms } });
  };

  const tuningFields: [keyof typeof secs, string][] = [
    ['defaultSlackPassMs', 'Slack pass (s)'],
    ['warningMs', 'Warning (s)'],
    ['reachMs', 'Reach (s)'],
    ['snoozeMs', 'Snooze (s)'],
  ];

  return (
    <section className="dev">
      <h2>
        Dev <button onClick={onClose}>hide</button>
      </h2>
      <div className="row">
        <input value={title} onChange={(e) => setTitle(e.target.value)} aria-label="Block title" />
        <input
          className="num"
          value={minutes}
          onChange={(e) => setMinutes(e.target.value)}
          aria-label="Minutes"
        />
        <button
          onClick={() => {
            const m = Number(minutes);
            if (Number.isFinite(m) && m > 0)
              dev({ kind: 'injectBlock', title, durationMs: m * 60_000 });
          }}
        >
          Inject
        </button>
      </div>
      <div className="row">
        <span>Speed: {preset}</span>
        <button
          aria-pressed={preset === 'demo'}
          onClick={() => dev({ kind: 'setTuning', tuning: DEMO_TUNING })}
        >
          Demo speed
        </button>
        <button
          aria-pressed={preset === 'normal'}
          onClick={() => dev({ kind: 'setTuning', tuning: DEFAULT_TUNING })}
        >
          Normal speed
        </button>
      </div>
      {tuningFields.map(([key, label]) => (
        <label className="row" key={key}>
          <span>{label}</span>
          <input
            className="num"
            key={secs[key]}
            defaultValue={secs[key]}
            onBlur={(e) => setSeconds(key, e.target.value)}
          />
        </label>
      ))}
      <label className="row">
        <span>Fatness</span>
        <input className="num" value={fat} onChange={(e) => setFat(e.target.value)} />
        <button
          onClick={() =>
            Number.isFinite(Number(fat)) && dev({ kind: 'setFatness', fatness: Number(fat) })
          }
        >
          Set
        </button>
      </label>
      <label className="row">
        <span>Chud (0-1)</span>
        <input className="num" value={chud} onChange={(e) => setChud(e.target.value)} />
        <button
          onClick={() => {
            const n = Number(chud);
            if (Number.isFinite(n))
              dev({ kind: 'setChudMeter', value: Math.min(1, Math.max(0, n)) });
          }}
        >
          Set
        </button>
      </label>
      <button className="danger" onClick={() => dev({ kind: 'reset' })}>
        Reset Barry
      </button>
    </section>
  );
}

export default App;
