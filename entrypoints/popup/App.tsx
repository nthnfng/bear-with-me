// Popup: draws src/popup/view.ts and sends PopupMessages. No behaviour here (ADR 0001).
// Two screens: home (sky, cave, Current Block, todos, mode and Slack pass) and Settings.

import { useEffect, useState } from 'react';
import { DEFAULT_SETTINGS, POPUP_TODO_SOURCE_ID, STORAGE_KEYS } from '@/src/contracts';
import type {
  BarryState,
  ModeOverride,
  PopupTodo,
  Settings as SettingsData,
} from '@/src/contracts';
import {
  BUBBLE,
  SLACK_PRESETS_MIN,
  addPopupTodo,
  blockCardTimer,
  formatClock,
  formatCountdown,
  headerBarry,
  popupView,
  removePopupTodo,
  sceneKey,
  skyBands,
  togglePopupTodo,
  todosLeft,
} from '@/src/popup/view';
import type { PopupView } from '@/src/popup/view';
import { send, useActiveTabId, useBarryState, useNow, useStored } from './hooks';
import { ChudSign, Cloud, HeaderPose, Heart, Icons, Paper, SpeechTail, assetUrl } from './Pixel';
import { SettingsScreen } from './Settings';

const UNLOCK_KEY = 'barry:devUnlocked';
const readUnlocked = () => {
  try {
    return localStorage.getItem(UNLOCK_KEY) === '1';
  } catch {
    return false;
  }
};

const NO_TODOS: PopupTodo[] = [];

const MODES: { value: ModeOverride; label: string }[] = [
  { value: 'auto', label: 'Auto' },
  { value: 'chill', label: 'Chill' },
  { value: 'lockIn', label: 'Lock In' },
];

function App() {
  const state = useBarryState();
  const now = useNow();
  const [screen, setScreen] = useState<'home' | 'settings'>('home');
  const [clicks, setClicks] = useState(0);
  const [devOpen, setDevOpen] = useState(readUnlocked);

  // Five clicks on Barry unlock the dev panel (it lives at the bottom of Settings).
  const onBarry = () => {
    if (devOpen) return;
    if (clicks + 1 >= 5) {
      setDevOpen(true);
      setScreen('settings');
      try {
        localStorage.setItem(UNLOCK_KEY, '1');
      } catch {
        /* popup convenience only */
      }
    }
    setClicks(clicks + 1);
  };

  if (!state) return <main className="popup loading">Barry is waking up...</main>;
  if (screen === 'settings')
    return (
      <SettingsScreen
        state={state}
        now={now}
        send={send}
        onBack={() => setScreen('home')}
        devOpen={devOpen}
        onHideDev={() => setDevOpen(false)}
      />
    );
  return <Home state={state} now={now} onBarry={onBarry} onSettings={() => setScreen('settings')} />;
}

function Home({
  state,
  now,
  onBarry,
  onSettings,
}: {
  state: BarryState;
  now: number;
  onBarry: () => void;
  onSettings: () => void;
}) {
  const activeTabId = useActiveTabId();
  const v = popupView(state, now);
  const hb = headerBarry(state, now, activeTabId);
  const key = sceneKey(v.mode, state.phase);
  const night = key === 'snoozing';

  return (
    <main className="popup home">
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

        <div className="topbar">
          <span className={`badge ${v.mode}`}>{v.modeLabel.toUpperCase()}</span>
          <button className="stone icon" aria-label="Settings" onClick={onSettings}>
            {Icons.gear}
          </button>
        </div>

        <img
          className="cave"
          src={assetUrl('barry-home.png')}
          alt="Barry's cave"
          draggable={false}
          onClick={onBarry}
        />
        <span className="cave-barry" onClick={onBarry}>
          <HeaderPose pose={hb.pose} poseSince={hb.poseSince} scale={2} />
        </span>

        <div className="bubble" role="status">
          <span>{BUBBLE[key]}</span>
          {v.pushesLeft !== null && (
            <span className="pushes">
              <span className="hearts">
                {Array.from({ length: state.tuning.maxPushes }, (_, i) => (
                  <Heart key={i} full={i < v.pushesLeft!} />
                ))}
              </span>
              {v.pushesLeft} left
            </span>
          )}
        </div>
        <span className="bubble-tail">
          <SpeechTail />
        </span>

        {hb.canGetUp && (
          <button className="stone getup" onClick={() => send({ type: 'gotUp' })}>
            Get up
          </button>
        )}

        <ChudSign meter={state.chudMeter} />
      </header>
      <img className="grass" src={assetUrl('ui/grass.svg')} alt="" />

      <div className="dirt">
        <div className="modes" role="radiogroup" aria-label="Mode">
          {MODES.map((m) => (
            <button
              key={m.value}
              role="radio"
              aria-checked={v.override === m.value}
              className={v.override === m.value ? 'stone on' : 'stone'}
              onClick={() => send({ type: 'setModeOverride', override: m.value })}
            >
              {m.label}
            </button>
          ))}
        </div>

        <BlockCard v={v} now={now} />
        <TodoCard state={state} />

        <div className="slack-row">
          <span className="dirt-label">Slack:</span>
          {v.slackAllowed ? (
            <div className="chips">
              {SLACK_PRESETS_MIN.map((min) => (
                <button
                  key={min}
                  className="stone"
                  onClick={() => send({ type: 'startSlackPass', durationMs: min * 60_000 })}
                >
                  {min}m
                </button>
              ))}
            </div>
          ) : (
            <span className="dirt-hint">{v.slackHint}</span>
          )}
        </div>
      </div>
    </main>
  );
}

function BlockCard({ v, now }: { v: PopupView; now: number }) {
  const timer = blockCardTimer(v);
  const cur = v.currentBlock;
  const next = v.nextBlock;
  const nextText = next ? `Next: ${next.title} ${formatClock(next.start)}` : 'Nothing coming up';
  return (
    <Paper seed={11} label="Current block" className="block-card">
      <div className="card-head">
        <h2>Current Block</h2>
        {timer && <span className="dim">{timer.label}</span>}
      </div>
      <div className="block-row">
        <div className="block-text">
          <p className="title">{cur ? cur.title : 'Nothing scheduled'}</p>
          <p className="sub">{cur ? `until ${formatClock(cur.end)} · ${nextText}` : nextText}</p>
        </div>
        {timer && <span className="time">{formatCountdown(timer.target - now)}</span>}
      </div>
    </Paper>
  );
}

function TodoCard({ state }: { state: BarryState }) {
  const settings = useStored<SettingsData>(STORAGE_KEYS.settings, DEFAULT_SETTINGS);
  const stored = settings.popupTodos ?? NO_TODOS;
  // Shown right away while the background saves; storage then catches up.
  const [todos, setTodos] = useState<PopupTodo[]>(stored);
  useEffect(() => setTodos(stored), [stored]);
  const [draft, setDraft] = useState('');

  const commit = (next: PopupTodo[]) => {
    setTodos(next);
    send({ type: 'setPopupTodos', todos: next });
  };
  const add = () => {
    const next = addPopupTodo(todos, draft, crypto.randomUUID());
    if (next !== todos) commit(next);
    setDraft('');
  };

  const hostOf = new Map(
    settings.todoSources.map((s) => [s.id, s.origin.replace(/^https?:\/\//, '')]),
  );
  const copied = state.todos.filter((t) => t.sourceId !== POPUP_TODO_SOURCE_ID);
  const left = todosLeft(todos, copied);

  return (
    <Paper seed={29} label="Todo list" className="todo-card">
      <div className="card-head rule">
        {Icons.clipboard}
        <h2>Todo List</h2>
        <span className="dim">{left} left</span>
      </div>
      <form
        className="todo-add"
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
      >
        <label className="sr-only" htmlFor="new-todo">
          New task
        </label>
        <input
          id="new-todo"
          className="field"
          value={draft}
          placeholder="Add a new task..."
          autoComplete="off"
          onChange={(e) => setDraft(e.target.value)}
        />
        <button type="submit" className="blue icon" aria-label="Add task">
          {Icons.plus}
        </button>
      </form>
      <ul className="todo-list">
        {todos.map((t) => (
          <li key={t.id}>
            <button
              className={t.done ? 'check on' : 'check'}
              aria-pressed={t.done}
              aria-label={`${t.done ? 'Mark not done' : 'Mark done'}: ${t.text}`}
              onClick={() => commit(togglePopupTodo(todos, t.id))}
            >
              {t.done && Icons.check}
            </button>
            <span className={t.done ? 'text done' : 'text'}>{t.text}</span>
            <button
              className="trash"
              aria-label={`Delete ${t.text}`}
              onClick={() => commit(removePopupTodo(todos, t.id))}
            >
              {Icons.trash}
            </button>
          </li>
        ))}
        {copied.map((t, i) => (
          <li key={`${t.sourceId}-${i}`} className="copied">
            <span className="bullet" aria-hidden="true" />
            <span className="text">{t.text}</span>
            <span className="from">{hostOf.get(t.sourceId) ?? 'copied'}</span>
          </li>
        ))}
        {todos.length === 0 && copied.length === 0 && (
          <li className="empty">Nothing yet. Add a task above.</li>
        )}
      </ul>
    </Paper>
  );
}

export default App;
