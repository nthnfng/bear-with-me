// The Settings screen: calendar, restricted sites, Barry (position, cave, sounds), todo
// sources and, once unlocked, the dev panel. Draws src/popup/view.ts only.

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
  skyBands,
  speedPreset,
  toggleDomain,
  tuningSeconds,
} from '@/src/popup/view';
import type { Send } from './hooks';
import { useStored } from './hooks';
import { CaveScene, Cloud, Icons, Paper, PositionIcon, Switch, assetUrl } from './Pixel';

const POSITIONS: { value: Position; label: string }[] = [
  { value: 'left', label: 'Left' },
  { value: 'middle', label: 'Middle' },
  { value: 'right', label: 'Right' },
];

function sourceStatus(
  s: { id: string; origin: string; selector: string },
  todos: { sourceId: string }[],
): string {
  const n = todos.filter((t) => t.sourceId === s.id).length;
  const docs = s.selector === '@gdocs';
  if (n > 0)
    return `${n} item${n === 1 ? '' : 's'} read${docs ? " (reads the doc's checklist; checked items are skipped)" : ''}`;
  if (docs || s.origin === 'https://docs.google.com')
    return "Reads the doc's checklist (checked items are skipped). Saved, but no items found yet. Make sure the doc has a bulleted or checklist and you are signed in.";
  return 'Saved, but no items found yet. Open that page and make sure the list is visible.';
}

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
  // Refresh the calendar whenever Settings opens.
  useEffect(() => send({ type: 'refreshSchedule' }), []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <main className="popup settings">
      <header className="sky short" style={{ background: skyBands('clear', 24) }}>
        <div className="clouds">
          <Cloud left={214} top={10} scale={5} />
          <Cloud left={150} top={44} scale={3} />
        </div>
        <div className="settings-title">
          <button className="stone icon" aria-label="Back" onClick={onBack}>
            {Icons.back}
          </button>
          <h1>Settings</h1>
        </div>
      </header>
      <img className="grass" src={assetUrl('ui/grass.svg')} alt="" />
      <div className="dirt scroll">
        <CalendarCard now={now} send={send} />
        <SitesCard state={state} send={send} />
        <BarryCard state={state} now={now} send={send} />
        <TodoSourcesCard state={state} send={send} />
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

function BarryCard({ state, now, send }: { state: BarryState; now: number; send: Send }) {
  const cave = caveStatus(state, now);
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
      <CaveScene
        cave={state.cave}
        disabled={cave.disabled}
        onToggle={(c) => send({ type: 'setCave', cave: c })}
      />
      {cave.reason && <p className="note">{cave.reason}</p>}
    </Paper>
  );
}

function TodoSourcesCard({ state, send }: { state: BarryState; send: Send }) {
  const settings = useStored<SettingsData>(STORAGE_KEYS.settings, DEFAULT_SETTINGS);
  return (
    <Paper seed={31} label="Copy todos from a page">
      <div className="card-head">
        <h2>Copy todos from a page</h2>
      </div>
      <button
        className="blue wide"
        onClick={() =>
          // Close the popup so the page gets the mouse and the Up/Down keys for the picker.
          browser.runtime
            .sendMessage({ type: 'startPicker' } satisfies PopupMessage)
            .catch(() => {})
            .finally(() => window.close())
        }
      >
        Point Barry at my list
      </button>
      <p className="note">
        The popup closes. Hover your list on the page, Up/Down to grow or shrink the box, click to
        save.
      </p>
      {settings.todoSources.length > 0 && (
        <ul className="source-list">
          {settings.todoSources.map((s) => (
            <li key={s.id}>
              <span className="text" title={s.selector}>
                {s.origin.replace(/^https?:\/\//, '')}
                {s.path}
                <small>{sourceStatus(s, state.todos)}</small>
              </span>
              <button
                className="trash"
                aria-label="Remove source"
                onClick={() => send({ type: 'removeTodoSource', sourceId: s.id })}
              >
                {Icons.trash}
              </button>
            </li>
          ))}
        </ul>
      )}
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
