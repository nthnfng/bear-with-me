// The Settings screen: the sky header with the cave toggle under it, then calendar, restricted
// sites, Barry (position, sounds) and, once unlocked, the dev panel.
// Draws src/popup/view.ts only.

import { useEffect, useState } from 'react';
import { DEFAULT_SETTINGS, DEFAULT_TUNING, DEMO_TUNING, STORAGE_KEYS } from '@/src/contracts';
import type {
  BarryState,
  DevCommand,
  PopupMessage,
  Position,
  ScheduleStatus,
  Settings as SettingsData,
} from '@/src/contracts';
import {
  addDomain,
  caveStatus,
  removeDomain,
  scheduleStatusLine,
  secondsToMs,
  speedPreset,
  toggleDomain,
  tuningSeconds,
} from '@/src/popup/view';
import type { Send } from './hooks';
import { useStored } from './hooks';
import { Icons, Paper, PositionIcon, Switch, assetUrl } from './Pixel';
import { SkyHeader, useCaveWalk } from './Sky';

const POSITIONS: { value: Position; label: string }[] = [
  { value: 'left', label: 'Left' },
  { value: 'middle', label: 'Middle' },
  { value: 'right', label: 'Right' },
];

export function SettingsScreen({
  state,
  now,
  send,
  onBack,
  devOpen,
  onHideDev,
}: {
  state: BarryState;
  now: number;
  send: Send;
  onBack: () => void;
  devOpen: boolean;
  onHideDev: () => void;
}) {
  const { walk, start } = useCaveWalk();
  const cave = caveStatus(state, now);
  // Refresh the calendar whenever Settings opens.
  useEffect(() => send({ type: 'refreshSchedule' }), []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <main className="popup settings">
      <SkyHeader
        state={state}
        now={now}
        walk={walk}
        topbar={
          <div className="settings-title">
            <button className="stone icon" aria-label="Back" onClick={onBack}>
              {Icons.back}
            </button>
            <h1>Settings</h1>
          </div>
        }
      />
      <img className="grass" src={assetUrl('ui/grass.svg')} alt="" />
      <div className="dirt scroll">
        <div className="cave-row">
          <button
            className="stone wide"
            disabled={cave.disabled || walk !== null}
            onClick={() => {
              start(state.cave ? 'leaving' : 'entering');
              send({ type: 'setCave', cave: !state.cave });
            }}
          >
            {state.cave ? 'Let Barry out' : 'Send Barry back'}
          </button>
          {cave.reason && <p className="dirt-hint">{cave.reason}</p>}
        </div>
        <CalendarCard now={now} send={send} />
        <SitesCard state={state} send={send} />
        <BarryCard state={state} send={send} />
        {devOpen && <DevPanel state={state} send={send} onClose={onHideDev} />}
      </div>
    </main>
  );
}

function CalendarCard({ now, send }: { now: number; send: Send }) {
  const settings = useStored<SettingsData>(STORAGE_KEYS.settings, DEFAULT_SETTINGS);
  const schedule = useStored<ScheduleStatus | null>(STORAGE_KEYS.schedule, null);
  const [url, setUrl] = useState('');
  const [touched, setTouched] = useState(false);
  useEffect(() => {
    if (!touched) setUrl(settings.icsUrl ?? '');
  }, [settings.icsUrl, touched]);

  const status = scheduleStatusLine(schedule, !!settings.icsUrl, now);
  const connected = !!settings.icsUrl && !status.isError;

  return (
    <Paper seed={5} label="Calendar">
      <div className="card-head">
        <h2>Calendar</h2>
        <span className={connected ? 'pill ok' : 'pill'}>
          {connected ? 'Connected' : settings.icsUrl ? 'Problem' : 'Not connected'}
        </span>
      </div>
      <ol className="steps">
        <li>Google Calendar → Settings → your calendar</li>
        <li>Copy “Secret address in iCal format”</li>
        <li>Paste it here and save</li>
      </ol>
      <form
        className="field-row"
        onSubmit={(e) => {
          e.preventDefault();
          send({ type: 'setIcsUrl', url });
          setTouched(false);
        }}
      >
        <label className="sr-only" htmlFor="ics-url">
          Calendar ICS URL
        </label>
        <input
          id="ics-url"
          className="field"
          type="password"
          value={url}
          placeholder="https://calendar.google.com/.../basic.ics"
          autoComplete="off"
          onChange={(e) => {
            setUrl(e.target.value);
            setTouched(true);
          }}
        />
        <button type="submit" className="blue">
          Save
        </button>
      </form>
      <p className={status.isError ? 'note error' : 'note'}>
        {status.text}{' '}
        {settings.icsUrl && (
          <button className="link" onClick={() => send({ type: 'refreshSchedule' })}>
            Refresh
          </button>
        )}
      </p>
    </Paper>
  );
}

function SitesCard({ state, send }: { state: BarryState; send: Send }) {
  const [domain, setDomain] = useState('');
  const [error, setError] = useState<string | null>(null);
  const on = state.blocklist.filter((e) => e.enabled).length;
  const submit = () => {
    const r = addDomain(state.blocklist, domain);
    if (!r.ok) return setError(r.error);
    setError(null);
    setDomain('');
    send({ type: 'setBlocklist', blocklist: r.blocklist });
  };
  return (
    <Paper seed={17} label="Restricted sites">
      <div className="card-head rule">
        <h2>Restricted sites</h2>
        <span className="dim">{on} on</span>
      </div>
      <ul className="site-list">
        {state.blocklist.map((e) => (
          <li key={e.domain}>
            <button
              className={e.enabled ? 'check on' : 'check'}
              role="switch"
              aria-checked={e.enabled}
              aria-label={`Restrict ${e.domain}`}
              onClick={() =>
                send({ type: 'setBlocklist', blocklist: toggleDomain(state.blocklist, e.domain) })
              }
            >
              {e.enabled && Icons.check}
            </button>
            <span className={e.enabled ? 'text' : 'text off'}>{e.domain}</span>
            {!e.enabled && <span className="dim small">off</span>}
            <button
              className="trash"
              aria-label={`Remove ${e.domain}`}
              onClick={() =>
                send({ type: 'setBlocklist', blocklist: removeDomain(state.blocklist, e.domain) })
              }
            >
              {Icons.trash}
            </button>
          </li>
        ))}
      </ul>
      <form
        className="field-row"
        onSubmit={(ev) => {
          ev.preventDefault();
          submit();
        }}
      >
        <label className="sr-only" htmlFor="add-site">
          Add a restricted site
        </label>
        <input
          id="add-site"
          className="field"
          value={domain}
          placeholder="add a site, e.g. x.com"
          onChange={(e) => setDomain(e.target.value)}
        />
        <button type="submit" className="blue">
          Add
        </button>
      </form>
      {error && <p className="note error">{error}</p>}
    </Paper>
  );
}

function BarryCard({ state, send }: { state: BarryState; send: Send }) {
  return (
    <Paper seed={23} label="Barry">
      <div className="card-head">
        <h2>Barry</h2>
      </div>
      <span className="note">Where Barry sits on the page</span>
      <div className="positions" role="radiogroup" aria-label="Barry's position">
        {POSITIONS.map((p) => (
          <button
            key={p.value}
            role="radio"
            aria-checked={state.position === p.value}
            className={state.position === p.value ? 'stone on' : 'stone'}
            onClick={() => send({ type: 'setPosition', position: p.value })}
          >
            <PositionIcon position={p.value} />
            {p.label}
          </button>
        ))}
      </div>
      <div className="switch-row">
        <span>Barry's sounds</span>
        <Switch
          on={!state.muted}
          label="Barry's sounds"
          onChange={(on) => send({ type: 'setMuted', muted: !on })}
        />
      </div>
    </Paper>
  );
}

function DevPanel({
  state,
  send,
  onClose,
}: {
  state: BarryState;
  send: Send;
  onClose: () => void;
}) {
  const dev = (command: DevCommand) => send({ type: 'dev', command });
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
    <Paper seed={41} label="Dev" className="dev">
      <div className="card-head">
        <h2>Dev</h2>
        <button className="link" onClick={onClose}>
          hide
        </button>
      </div>
      <div className="field-row">
        <input
          className="field"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          aria-label="Block title"
        />
        <input
          className="field num"
          value={minutes}
          onChange={(e) => setMinutes(e.target.value)}
          aria-label="Minutes"
        />
        <button
          className="blue"
          onClick={() => {
            const m = Number(minutes);
            if (Number.isFinite(m) && m > 0)
              dev({ kind: 'injectBlock', title, durationMs: m * 60_000 });
          }}
        >
          Inject
        </button>
      </div>
      <div className="field-row">
        <span className="grow">Speed: {preset}</span>
        <button
          className={preset === 'demo' ? 'stone on' : 'stone'}
          aria-pressed={preset === 'demo'}
          onClick={() => dev({ kind: 'setTuning', tuning: DEMO_TUNING })}
        >
          Demo
        </button>
        <button
          className={preset === 'normal' ? 'stone on' : 'stone'}
          aria-pressed={preset === 'normal'}
          onClick={() => dev({ kind: 'setTuning', tuning: DEFAULT_TUNING })}
        >
          Normal
        </button>
      </div>
      {tuningFields.map(([key, label]) => (
        <label className="field-row" key={key}>
          <span className="grow">{label}</span>
          <input
            className="field num"
            key={secs[key]}
            defaultValue={secs[key]}
            onBlur={(e) => setSeconds(key, e.target.value)}
          />
        </label>
      ))}
      <label className="field-row">
        <span className="grow">Fatness</span>
        <input className="field num" value={fat} onChange={(e) => setFat(e.target.value)} />
        <button
          className="blue"
          onClick={() =>
            Number.isFinite(Number(fat)) && dev({ kind: 'setFatness', fatness: Number(fat) })
          }
        >
          Set
        </button>
      </label>
      <label className="field-row">
        <span className="grow">Chud (0-1)</span>
        <input className="field num" value={chud} onChange={(e) => setChud(e.target.value)} />
        <button
          className="blue"
          onClick={() => {
            const n = Number(chud);
            if (Number.isFinite(n))
              dev({ kind: 'setChudMeter', value: Math.min(1, Math.max(0, n)) });
          }}
        >
          Set
        </button>
      </label>
      <button className="stone wide danger" onClick={() => dev({ kind: 'reset' })}>
        Reset Barry
      </button>
    </Paper>
  );
}
