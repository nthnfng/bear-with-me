// Compact collapsible settings under the main popup screen. Draws src/popup/view.ts only.

import { useEffect, useState } from 'react';
import { storage } from 'wxt/utils/storage';
import { DEFAULT_SETTINGS, STORAGE_KEYS } from '@/src/contracts';
import type {
  BarryState,
  PopupMessage,
  Position,
  ScheduleStatus,
  Settings as SettingsData,
} from '@/src/contracts';
import {
  addDomain,
  caveStatus,
  chudPercent,
  removeDomain,
  scheduleStatusLine,
  toggleDomain,
} from '@/src/popup/view';

type Send = (msg: PopupMessage) => void;

function useStored<T>(key: `local:${string}`, fallback: T): T {
  const [value, setValue] = useState<T>(fallback);
  useEffect(() => {
    let alive = true;
    storage.getItem<T>(key).then((v) => alive && v != null && setValue(v));
    const unwatch = storage.watch<T>(key, (v) => setValue(v ?? fallback));
    return () => {
      alive = false;
      unwatch();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return value;
}

const POSITIONS: Position[] = ['left', 'middle', 'right'];

export function ChudMeter({ meter }: { meter: number }) {
  const pct = chudPercent(meter);
  return (
    <div className="chud" title="Fills while Barry is snoozed; resets after 10 minutes of studying">
      <span className="label">Chud meter</span>
      <div className="bar" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
        <div className="fill" style={{ width: `${pct}%` }} />
      </div>
      <span className="pct">{pct}%</span>
    </div>
  );
}

export function SettingsSections({
  state,
  now,
  send,
}: {
  state: BarryState;
  now: number;
  send: Send;
}) {
  const settings = useStored<SettingsData>(STORAGE_KEYS.settings, DEFAULT_SETTINGS);
  const schedule = useStored<ScheduleStatus | null>(STORAGE_KEYS.schedule, null);
  const [url, setUrl] = useState('');
  const [urlTouched, setUrlTouched] = useState(false);
  const [domain, setDomain] = useState('');
  const [domainError, setDomainError] = useState<string | null>(null);

  // Refresh the calendar whenever the popup opens.
  useEffect(() => send({ type: 'refreshSchedule' }), []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!urlTouched) setUrl(settings.icsUrl ?? '');
  }, [settings.icsUrl, urlTouched]);

  const status = scheduleStatusLine(schedule, !!settings.icsUrl, now);
  const cave = caveStatus(state, now);

  const submitDomain = () => {
    const r = addDomain(state.blocklist, domain);
    if (!r.ok) return setDomainError(r.error);
    setDomainError(null);
    setDomain('');
    send({ type: 'setBlocklist', blocklist: r.blocklist });
  };

  return (
    <div className="settings">
      <details>
        <summary>Calendar</summary>
        <ol className="steps">
          <li>Open Google Calendar, Settings, then your calendar.</li>
          <li>Copy "Secret address in iCal format".</li>
          <li>Paste it here and save.</li>
        </ol>
        <div className="row">
          <input
            type="password"
            value={url}
            placeholder="https://calendar.google.com/.../basic.ics"
            aria-label="Calendar ICS URL"
            autoComplete="off"
            onChange={(e) => {
              setUrl(e.target.value);
              setUrlTouched(true);
            }}
          />
          <button
            onClick={() => {
              send({ type: 'setIcsUrl', url });
              setUrlTouched(false);
            }}
          >
            Save
          </button>
        </div>
        <p className={status.isError ? 'hint error' : 'hint'}>
          {status.text}{' '}
          {settings.icsUrl && (
            <button className="link" onClick={() => send({ type: 'refreshSchedule' })}>
              Refresh
            </button>
          )}
        </p>
      </details>

      <details>
        <summary>Restricted sites</summary>
        <ul className="list">
          {state.blocklist.map((e) => (
            <li key={e.domain}>
              <label>
                <input
                  type="checkbox"
                  checked={e.enabled}
                  onChange={() =>
                    send({
                      type: 'setBlocklist',
                      blocklist: toggleDomain(state.blocklist, e.domain),
                    })
                  }
                />
                <span className={e.enabled ? '' : 'dim'}>{e.domain}</span>
              </label>
              <button
                className="x"
                aria-label={`Remove ${e.domain}`}
                onClick={() =>
                  send({ type: 'setBlocklist', blocklist: removeDomain(state.blocklist, e.domain) })
                }
              >
                x
              </button>
            </li>
          ))}
        </ul>
        <form
          className="row"
          onSubmit={(ev) => {
            ev.preventDefault();
            submitDomain();
          }}
        >
          <input
            value={domain}
            placeholder="add a site, e.g. youtube.com"
            aria-label="Add a restricted site"
            onChange={(e) => setDomain(e.target.value)}
          />
          <button type="submit">Add</button>
        </form>
        {domainError && <p className="hint error">{domainError}</p>}
      </details>

      <details>
        <summary>Barry</summary>
        <div className="field">
          <span className="label">Position</span>
          <div className="seg" role="radiogroup" aria-label="Barry's position">
            {POSITIONS.map((p) => (
              <button
                key={p}
                role="radio"
                aria-checked={state.position === p}
                className={state.position === p ? 'on' : ''}
                onClick={() => send({ type: 'setPosition', position: p })}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
        <label className="check">
          <input
            type="checkbox"
            checked={state.cave}
            disabled={cave.disabled}
            onChange={(e) => send({ type: 'setCave', cave: e.target.checked })}
          />
          Cave (hide Barry when he's calm)
        </label>
        {cave.reason && <p className="hint">{cave.reason}</p>}
        <label className="check">
          <input
            type="checkbox"
            checked={state.muted}
            onChange={(e) => send({ type: 'setMuted', muted: e.target.checked })}
          />
          Mute
        </label>
      </details>

      <details>
        <summary>Todos</summary>
        <button className="wide" onClick={() => send({ type: 'startPicker' })}>
          Point Barry at my task list
        </button>
        <p className="hint">Opens a picker on the tab you were just on.</p>
        {state.todos.length > 0 ? (
          <ul className="list">
            {state.todos.map((t, i) => (
              <li key={`${t.sourceId}-${i}`}>
                <span>{t.text}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="hint">No todos captured yet.</p>
        )}
        {settings.todoSources.length > 0 && (
          <>
            <span className="label">Sources</span>
            <ul className="list">
              {settings.todoSources.map((s) => (
                <li key={s.id}>
                  <span title={s.selector}>
                    {s.origin.replace(/^https?:\/\//, '')}
                    {s.path}
                  </span>
                  <button
                    className="x"
                    aria-label="Remove source"
                    onClick={() => send({ type: 'removeTodoSource', sourceId: s.id })}
                  >
                    x
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </details>
    </div>
  );
}
