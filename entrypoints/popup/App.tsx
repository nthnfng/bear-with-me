// Popup: draws src/popup/view.ts and sends PopupMessages. No behaviour here (ADR 0001).
// Two screens: home (sky, cave, Current Block, Tasks, mode and Slack pass) and Settings.

import { Fragment, useEffect, useState } from 'react';
import {
  DEFAULT_SETTINGS,
  STORAGE_KEYS,
  TASK_DEFAULT_ESTIMATE_MS,
  TASK_ESTIMATE_PRESETS_MIN,
  TASK_ESTIMATE_MAX_MS,
  TASK_MAX,
  TASK_TITLE_MAX,
} from '@/src/contracts';
import type { BarryState, ModeOverride, Settings as SettingsData, Task } from '@/src/contracts';
import {
  SLACK_PRESETS_MIN,
  addTask,
  atTaskLimit,
  dropStaleDone,
  formatCountdown,
  formatEstimate,
  hasOpenTaskTitled,
  moveTask,
  moveTaskTo,
  openTasks,
  hoursField,
  hoursMinutesMs,
  minutesField,
  popupView,
  removeTask,
  renameTask,
  taskFromEvent,
  todayEvents,
  slackChangePreview,
  toggleTask,
  totalEstimateMs,
  wouldExceedTotal,
} from '@/src/popup/view';
import { send, useBarryState, useNow, useStored } from './hooks';
import { Icons, Paper, assetUrl } from './Pixel';
import { SettingsScreen } from './Settings';
import { SkyHeader } from './Sky';

const UNLOCK_KEY = 'barry:devUnlocked';
const readUnlocked = () => {
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
  return (
    <Home state={state} now={now} onBarry={onBarry} onSettings={() => setScreen('settings')} />
  );
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
  const v = popupView(state, now);

  // Chip waiting on "Are you sure?". Dropped when the Slack pass ends on its own.
  const [pendingMin, setPendingMin] = useState<number | null>(null);
  // Auto/Chill picked while a Task's timer runs: ask before pausing it.
  const [pendingMode, setPendingMode] = useState<ModeOverride | null>(null);
  const runningTitle = v.currentTask?.task.title ?? null;
  useEffect(() => {
    if (!runningTitle) setPendingMode(null);
  }, [runningTitle]);
  const onMode = (m: ModeOverride) => {
    if (m === v.override) return;
    if (runningTitle && m !== 'lockIn') return setPendingMode(m);
    setPendingMode(null);
    send({ type: 'setModeOverride', override: m });
  };
  const onSlackPass = v?.onSlackPass ?? false;
  useEffect(() => {
    if (!onSlackPass) setPendingMin(null);
  }, [onSlackPass]);
  const onChip = (min: number) => {
    if (!v) return;
    if (!v.onSlackPass) send({ type: 'startSlackPass', durationMs: min * 60_000 });
    else if (min !== v.slackCurrentMin) setPendingMin(min);
  };

  return (
    <main className="popup home">
      <SkyHeader
        state={state}
        now={now}
        onBarry={onBarry}
        topbar={
          <>
            <span className={`badge ${v.mode}`}>{v.modeLabel.toUpperCase()}</span>
            <button className="stone icon" aria-label="Settings" onClick={onSettings}>
              {Icons.gear}
            </button>
          </>
        }
      />
      <img className="grass" src={assetUrl('ui/grass.svg')} alt="" />

      <div className="dirt">
        <div className="modes" role="radiogroup" aria-label="Mode">
          {MODES.map((m) => (
            <button
              key={m.value}
              role="radio"
              aria-checked={v.override === m.value}
              className={
                v.override === m.value
                  ? 'stone on'
                  : pendingMode === m.value
                    ? 'stone pending'
                    : 'stone'
              }
              onClick={() => onMode(m.value)}
            >
              {m.label}
            </button>
          ))}
        </div>
        {pendingMode && runningTitle && (
          <div className="slack-confirm" role="alertdialog" aria-label="Pause the running task">
            <p>You're doing {runningTitle}. Want to pause it?</p>
            <div className="chips two">
              <button
                className="stone on"
                onClick={() => {
                  // The brain pauses the running Task when the override leaves Lock In.
                  send({ type: 'setModeOverride', override: pendingMode });
                  setPendingMode(null);
                }}
              >
                Yes, pause
              </button>
              <button className="stone" onClick={() => setPendingMode(null)}>
                No
              </button>
            </div>
          </div>
        )}

        <EventsCard state={state} now={now} />
        <TaskCard state={state} now={now} />

        {v.countdown && !v.onSlackPass && (
          <p className="break-timer">
            {v.countdown.label} <b>{formatCountdown(v.countdown.target - now)}</b>
          </p>
        )}
        <div className="slack-row">
          <span className="dirt-label">Slack:</span>
          {v.slackAllowed ? (
            <div className="chips">
              {SLACK_PRESETS_MIN.map((min) => {
                const current = v.slackCurrentMin === min;
                return (
                  <button
                    key={min}
                    className={
                      current ? 'stone on' : pendingMin === min ? 'stone pending' : 'stone'
                    }
                    aria-pressed={current}
                    onClick={() => onChip(min)}
                  >
                    {min}m
                  </button>
                );
              })}
            </div>
          ) : (
            <span className="dirt-hint">{v.slackHint}</span>
          )}
        </div>
        {v.onSlackPass && pendingMin !== null && (
          <div className="slack-confirm" role="alertdialog" aria-label="Change slack time">
            <p>Are you sure you want to change your slack time?</p>
            <p className="dirt-hint">{slackChangePreview(state, pendingMin, now)}</p>
            <div className="chips two">
              <button
                className="stone on"
                onClick={() => {
                  send({ type: 'changeSlackPass', durationMs: pendingMin * 60_000 });
                  setPendingMin(null);
                }}
              >
                Yes, {pendingMin}m
              </button>
              <button className="stone" onClick={() => setPendingMin(null)}>
                Cancel
              </button>
            </div>
          </div>
        )}
        {v.onSlackPass && (
          <button
            className="stone danger wide"
            onClick={() => {
              setPendingMin(null);
              send({ type: 'stopSlackPass' });
            }}
          >
            Stop Slacking
            {v.countdown && ` · ${formatCountdown(v.countdown.target - now)} left`}
          </button>
        )}
      </div>
    </main>
  );
}

/**
 * Today's Events: only what's on today's calendar. Fixed height, scrolls when there's a lot.
 * "+ task" copies a short event (8h 30m or less, not over yet) into the task list.
 */
function EventsCard({ state, now }: { state: BarryState; now: number }) {
  const settings = useStored<SettingsData>(STORAGE_KEYS.settings, DEFAULT_SETTINGS);
  // "+ task" that would take the unchecked total past 8 hours waits on "Are you sure?".
  const [pending, setPending] = useState<{ title: string; estimateMs: number } | null>(null);
  const events = todayEvents(state.blocks, now);
  const full = atTaskLimit(state.tasks);
  const addFromEvent = (t: { title: string; estimateMs: number }, force = false) => {
    if (full) return;
    if (!force && wouldExceedTotal(state.tasks, t.estimateMs)) return setPending(t);
    send({ type: 'setTasks', tasks: addTask(state.tasks, t, crypto.randomUUID()) });
    setPending(null);
  };

  return (
    <Paper seed={11} label="Today's events" className="events-card">
      <div className="card-head rule">
        {Icons.calendar}
        <h2>Today's Events</h2>
        {events.length > 0 && (
          <span className="dim">
            {events.length} {events.length === 1 ? 'event' : 'events'}
          </span>
        )}
      </div>
      <p className="events-sub">Pulled from your Google Calendar</p>
      <ul className="today">
        {!settings.icsUrl && events.length === 0 ? (
          <li className="empty">No calendar connected. Add one in Settings (⚙).</li>
        ) : events.length === 0 ? (
          <li className="empty">Nothing on your calendar today.</li>
        ) : (
          events.map((e, i) => {
            const asTask = e.status === 'past' ? null : taskFromEvent(e.block);
            const added = hasOpenTaskTitled(state.tasks, e.block.title);
            // A line between groups: multi-day / today's events / all-day.
            const divider = i > 0 && events[i - 1]!.group !== e.group;
            const action = asTask && (
              <button
                className="link"
                disabled={added || full}
                title={added ? 'Already in your tasks' : 'Add to your tasks'}
                onClick={() => addFromEvent(asTask)}
              >
                {added ? 'added' : '+ task'}
              </button>
            );
            return (
              <Fragment key={`${e.block.id}-${e.block.start}`}>
                {divider && <li className="divider" aria-hidden="true" />}
                {e.long ? (
                  <li className={`long ${e.status}`}>
                    <span className="long-text">
                      <span className="ev-title" title={e.block.title}>
                        {e.block.title}
                      </span>
                      <span className="range">{e.range}</span>
                    </span>
                    {e.when && <span className="when">{e.when}</span>}
                    {action}
                  </li>
                ) : (
                  <li className={e.status}>
                    <span className="range">{e.range}</span>
                    <span className="ev-title" title={e.block.title}>
                      {e.block.title}
                    </span>
                    {e.when && <span className="when">{e.when}</span>}
                    {action}
                  </li>
                )}
              </Fragment>
            );
          })
        )}
      </ul>
      {pending && (
        <div className="slack-confirm" role="alertdialog" aria-label="Lots of tasks">
          <p>
            Your tasks add up to {formatEstimate(totalEstimateMs(state.tasks) + pending.estimateMs)}
            . Are you sure you want to add more?
          </p>
          <div className="chips two">
            <button className="stone on" onClick={() => addFromEvent(pending, true)}>
              Add anyway
            </button>
            <button className="stone" onClick={() => setPending(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </Paper>
  );
}

function TaskCard({ state, now }: { state: BarryState; now: number }) {
  // Shown right away while the background saves; the stored state then catches up.
  const [tasks, setTasks] = useState<Task[]>(state.tasks);
  useEffect(() => setTasks(state.tasks), [state.tasks]);
  const [draft, setDraft] = useState('');
  const [details, setDetails] = useState('');
  const [showDetails, setShowDetails] = useState(false);
  const [estimateMs, setEstimateMs] = useState(TASK_DEFAULT_ESTIMATE_MS);
  // Custom time: hours (0-8) and minutes (0-59) boxes.
  const [customH, setCustomH] = useState('');
  const [customM, setCustomM] = useState('');
  const [confirmOver, setConfirmOver] = useState(false);
  // "Keep going" time on the Done? check.
  const [moreH, setMoreH] = useState('');
  const [moreM, setMoreM] = useState('');
  // Drag to reorder: the row being dragged, and where it would land.
  const [dragId, setDragId] = useState<string | null>(null);
  const [over, setOver] = useState<{ id: string; place: 'before' | 'after' } | null>(null);
  // Rename: double-click a title to edit it (and its details) in place.
  const [editing, setEditing] = useState<{ id: string; title: string; description: string } | null>(
    null,
  );
  const saveEdit = () => {
    if (editing) commit(renameTask(tasks, editing.id, editing.title, editing.description));
    setEditing(null);
  };
  const endDrag = () => {
    setDragId(null);
    setOver(null);
  };

  const commit = (next: Task[]) => {
    if (next === tasks) return;
    setTasks(next);
    send({ type: 'setTasks', tasks: next });
  };
  // Finished Tasks clear overnight: drop yesterday's when the popup opens.
  useEffect(() => {
    const fresh = dropStaleDone(state.tasks, Date.now());
    if (fresh !== state.tasks) commit(fresh);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const full = atTaskLimit(tasks);
  const reset = () => {
    setDraft('');
    setDetails('');
    setShowDetails(false);
    setEstimateMs(TASK_DEFAULT_ESTIMATE_MS);
    setCustomH('');
    setCustomM('');
    setConfirmOver(false);
  };
  const custom = hoursMinutesMs(customH, customM);
  const usingCustom = customH !== '' || customM !== '';
  const more = hoursMinutesMs(moreH, moreM);
  const add = (force = false) => {
    if (!draft.trim() || full || (usingCustom && custom.ms === null)) return;
    const ms = usingCustom ? custom.ms! : estimateMs;
    if (!force && wouldExceedTotal(tasks, ms)) return setConfirmOver(true);
    commit(
      addTask(tasks, { title: draft, description: details, estimateMs: ms }, crypto.randomUUID()),
    );
    reset();
  };

  const open = openTasks(tasks);
  const top = open[0];
  const running = state.activeTask;
  // While a Task runs the order is locked (it stays on top as the one being worked on).
  const reorderLocked = !!running && now < running.endsAt;
  const check = state.taskCheck
    ? tasks.find((t) => t.id === state.taskCheck!.id && !t.done)
    : undefined;
  const total = totalEstimateMs(tasks);

  return (
    <Paper seed={29} label="Tasks" className="todo-card">
      <div className="card-head rule">
        {Icons.clipboard}
        <h2>Tasks</h2>
        <span className="dim">
          {open.length}/{TASK_MAX} tasks{open.length > 0 && ` · ${formatEstimate(total)}`}
        </span>
      </div>
      {state.taskOnBreak && (
        <p className="note lock-note">On a break: task paused. ▶ to resume now.</p>
      )}
      {reorderLocked && (
        <p className="note lock-note">Order locked while a task runs. ❚❚ to reorder.</p>
      )}

      {check && (
        <div className="slack-confirm" role="alertdialog" aria-label="Task time is up">
          <p>Time's up for {check.title}. Done?</p>
          <div className="chips two">
            <button
              className="stone on"
              onClick={() => send({ type: 'answerTask', id: check.id, answer: 'done' })}
            >
              Done ✓
            </button>
            <button
              className="stone"
              onClick={() => send({ type: 'answerTask', id: check.id, answer: 'extend' })}
            >
              +15 min
            </button>
          </div>
          <form
            className="hm-row"
            onSubmit={(e) => {
              e.preventDefault();
              if (more.ms === null) return;
              send({ type: 'answerTask', id: check.id, answer: 'extend', extendMs: more.ms });
              setMoreH('');
              setMoreM('');
            }}
          >
            <span className="hm-label">Or keep going</span>
            <HoursMinutes h={moreH} m={moreM} onH={setMoreH} onM={setMoreM} label="More time" />
            <button type="submit" className="stone" disabled={more.ms === null}>
              +
            </button>
          </form>
          {more.error && <p className="note error">{more.error}</p>}
        </div>
      )}

      <form
        className="todo-add"
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
      >
        <label className="sr-only" htmlFor="new-task">
          New task
        </label>
        <input
          id="new-task"
          className="field"
          value={draft}
          disabled={full}
          placeholder={full ? `${TASK_MAX} tasks max` : 'Add a task...'}
          maxLength={TASK_TITLE_MAX}
          autoComplete="off"
          onChange={(e) => {
            setDraft(e.target.value);
            setConfirmOver(false);
          }}
        />
        <button type="submit" className="blue icon" aria-label="Add task" disabled={full}>
          {Icons.plus}
        </button>
      </form>
      {full && <p className="note">{TASK_MAX} tasks max. Finish or delete one first.</p>}

      {draft.trim() !== '' && !full && (
        <div className="task-extra">
          <div className="estimate-row" role="radiogroup" aria-label="Estimated time">
            {TASK_ESTIMATE_PRESETS_MIN.map((min) => (
              <button
                key={min}
                type="button"
                role="radio"
                aria-checked={!usingCustom && estimateMs === min * 60_000}
                className={!usingCustom && estimateMs === min * 60_000 ? 'stone on' : 'stone'}
                onClick={() => {
                  setCustomH('');
                  setCustomM('');
                  setEstimateMs(min * 60_000);
                  setConfirmOver(false);
                }}
              >
                {formatEstimate(min * 60_000)}
              </button>
            ))}
          </div>
          <div className="hm-row">
            <span className="hm-label">Custom</span>
            <HoursMinutes
              h={customH}
              m={customM}
              onH={(h) => {
                setCustomH(h);
                setConfirmOver(false);
              }}
              onM={(m) => {
                setCustomM(m);
                setConfirmOver(false);
              }}
              label="Custom time"
            />
          </div>
          {usingCustom ? (
            <p className={custom.error ? 'note error' : 'note'}>
              {custom.error ??
                `Max ${formatEstimate(TASK_ESTIMATE_MAX_MS)} per task · total would be ${formatEstimate(
                  total + (custom.ms ?? 0),
                )}`}
            </p>
          ) : null}
          {draft.length >= TASK_TITLE_MAX - 10 && (
            <p className="note">
              {draft.length}/{TASK_TITLE_MAX} characters
            </p>
          )}
          {showDetails ? (
            <input
              className="field"
              aria-label="Details"
              placeholder="Details (optional)"
              value={details}
              onChange={(e) => setDetails(e.target.value)}
            />
          ) : (
            <button type="button" className="link" onClick={() => setShowDetails(true)}>
              + details
            </button>
          )}
        </div>
      )}

      {confirmOver && (
        <div className="slack-confirm" role="alertdialog" aria-label="Lots of tasks">
          <p>
            Your tasks add up to{' '}
            {formatEstimate(total + (usingCustom ? (custom.ms ?? 0) : estimateMs))}. Are you sure
            you want to add more?
          </p>
          <div className="chips two">
            <button className="stone on" onClick={() => add(true)}>
              Add anyway
            </button>
            <button className="stone" onClick={() => setConfirmOver(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      <ul className="todo-list">
        {tasks.map((t) => {
          const isRunning = running?.id === t.id && now < running.endsAt;
          const isTop = top?.id === t.id;
          const drop = dragId && over?.id === t.id && dragId !== t.id ? over.place : null;
          return (
            <li
              key={t.id}
              className={
                [isRunning && 'running', dragId === t.id && 'dragging', drop && `drop-${drop}`]
                  .filter(Boolean)
                  .join(' ') || undefined
              }
              draggable={!t.done && !reorderLocked && editing?.id !== t.id}
              onDragStart={(e) => {
                if (reorderLocked) return e.preventDefault();
                setDragId(t.id);
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', t.id);
              }}
              onDragOver={(e) => {
                if (!dragId || reorderLocked) return;
                e.preventDefault();
                const r = e.currentTarget.getBoundingClientRect();
                const place = e.clientY < r.top + r.height / 2 ? 'before' : 'after';
                if (over?.id !== t.id || over.place !== place) setOver({ id: t.id, place });
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (dragId && over) commit(moveTaskTo(tasks, dragId, over.id, over.place));
                endDrag();
              }}
              onDragEnd={endDrag}
            >
              {!t.done && !reorderLocked ? (
                <span
                  className="grip"
                  role="button"
                  tabIndex={0}
                  title="Drag to reorder"
                  aria-label={`Reorder ${t.title} (drag, or use the up and down arrow keys)`}
                  onKeyDown={(e) => {
                    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
                    e.preventDefault();
                    commit(moveTask(tasks, t.id, e.key === 'ArrowUp' ? -1 : 1));
                  }}
                >
                  ⋮⋮
                </span>
              ) : (
                <span
                  className="grip off"
                  aria-hidden="true"
                  title={reorderLocked && !t.done ? 'Locked while a task is running' : undefined}
                >
                  {reorderLocked && !t.done ? '⋮⋮' : ''}
                </span>
              )}
              <button
                className={t.done ? 'check on' : 'check'}
                aria-pressed={t.done}
                aria-label={`${t.done ? 'Mark not done' : 'Mark done'}: ${t.title}`}
                onClick={() => commit(toggleTask(tasks, t.id, Date.now()))}
              >
                {t.done && Icons.check}
              </button>
              {editing?.id === t.id ? (
                <span
                  className="text editing"
                  onBlur={(e) => {
                    // Save when focus leaves both inputs.
                    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) saveEdit();
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') saveEdit();
                    if (e.key === 'Escape') {
                      e.stopPropagation();
                      setEditing(null);
                    }
                  }}
                >
                  <input
                    className="field"
                    aria-label="Task title"
                    maxLength={TASK_TITLE_MAX}
                    autoFocus
                    value={editing.title}
                    onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                  />
                  <input
                    className="field small"
                    aria-label="Task details"
                    placeholder="Details (optional)"
                    value={editing.description}
                    onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                  />
                </span>
              ) : (
                <span
                  className={t.done ? 'text done' : 'text'}
                  title="Double-click to rename"
                  onDoubleClick={() =>
                    setEditing({ id: t.id, title: t.title, description: t.description })
                  }
                >
                  {t.title}
                  {t.description && <small>{t.description}</small>}
                </span>
              )}
              <span className="est">
                {isRunning
                  ? formatCountdown(running!.endsAt - now)
                  : t.leftMs
                    ? `${state.taskOnBreak === t.id ? '☕' : '❚❚'} ${formatCountdown(t.leftMs)}`
                    : formatEstimate(t.estimateMs)}
              </span>
              {isRunning ? (
                <button
                  className="mini"
                  aria-label={`Pause ${t.title}`}
                  onClick={() => send({ type: 'stopTask' })}
                >
                  ❚❚
                </button>
              ) : isTop ? (
                <button
                  className="mini go"
                  aria-label={`${t.leftMs ? 'Resume' : 'Start'} ${t.title}`}
                  onClick={() => send({ type: 'startTask', id: t.id })}
                >
                  ▶
                </button>
              ) : null}
              <button
                className="trash"
                aria-label={`Delete ${t.title}`}
                onClick={() => commit(removeTask(tasks, t.id))}
              >
                {Icons.trash}
              </button>
            </li>
          );
        })}
        {tasks.length === 0 && (
          <li className="empty">No tasks yet. Add one, then press ▶ when you start.</li>
        )}
      </ul>
    </Paper>
  );
}

/** Two small boxes: hours (0-8) and minutes (0-59). */
function HoursMinutes({
  h,
  m,
  onH,
  onM,
  label,
}: {
  h: string;
  m: string;
  onH: (h: string) => void;
  onM: (m: string) => void;
  label: string;
}) {
  return (
    <span className="hm" role="group" aria-label={label}>
      <input
        className="field hm-box"
        aria-label={`${label}: hours (0 to 8)`}
        inputMode="numeric"
        placeholder="0"
        value={h}
        onChange={(e) => onH(hoursField(e.target.value))}
      />
      <span className="hm-unit">h</span>
      <input
        className="field hm-box"
        aria-label={`${label}: minutes (0 to 59)`}
        inputMode="numeric"
        placeholder="00"
        value={m}
        onChange={(e) => onM(minutesField(e.target.value))}
      />
      <span className="hm-unit">m</span>
    </span>
  );
}

export default App;
