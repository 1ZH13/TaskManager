'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { createColumnHelper, tableFeatures, useTable } from '@tanstack/react-table';
import {
  completionPercent,
  expandOccurrences,
  selectWorkItems,
  timelineAlerts,
} from '@task-manager/domain';
import { demoIds, type RepositoryError } from '@task-manager/data';
import type { Board, BoardColumn, Person, WorkItem } from '@task-manager/shared';
import { Button } from '../../../../packages/ui/src/index';
import { demoSeed, useDemo } from './demo-context';
import { FilterSelect } from './filter-select';

type View = 'list' | 'calendar' | 'timeline';
const today = '2026-09-19';
const monthDays = Array.from(
  { length: 30 },
  (_, index) => `2026-09-${String(index + 1).padStart(2, '0')}`,
);
const daysAt = (offset: number, week: boolean) =>
  monthDays
    .map((day) => {
      const value = new Date(`${day}T00:00:00Z`);
      value.setUTCDate(value.getUTCDate() + offset);
      return value.toISOString().slice(0, 10);
    })
    .slice(week ? 14 : 0, week ? 21 : 30);
const label = (date: string) =>
  new Intl.DateTimeFormat('es-PA', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(
    new Date(`${date}T00:00:00Z`),
  );
const weekdayLabel = (date: string) =>
  new Intl.DateTimeFormat('es-PA', { weekday: 'short', day: 'numeric', timeZone: 'UTC' })
    .format(new Date(`${date}T00:00:00Z`))
    .replace('.', '');
const addDays = (date: string, amount: number) => {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + amount);
  return value.toISOString().slice(0, 10);
};
const daysBetween = (from: string, to: string) =>
  Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
const listFeatures = tableFeatures({});
const listColumnHelper = createColumnHelper<typeof listFeatures, WorkItem>();
const listColumns = listColumnHelper.columns([
  listColumnHelper.accessor('key', { header: 'Clave' }),
  listColumnHelper.accessor('title', { header: 'Tarea' }),
  listColumnHelper.accessor('priority', { header: 'Prioridad' }),
  listColumnHelper.accessor('startsOn', { header: 'Inicio' }),
]);

export function SynchronizedViews({
  view,
  projectId = demoIds.opsProject,
}: {
  view: View;
  projectId?: string;
}) {
  const { phId, actor, repository } = useDemo();
  const projectName =
    demoSeed.projects.find((project) => project.id === projectId)?.name ?? 'Proyecto';
  const [items, setItems] = useState<WorkItem[]>([]);
  const [columns, setColumns] = useState<BoardColumn[]>([]);
  const [boards, setBoards] = useState<Board[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [query, setQuery] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [calendarMode, setCalendarMode] = useState<'month' | 'week' | 'agenda'>('week');
  const [zoom, setZoom] = useState<'week' | 'month' | 'quarter'>('month');
  const [error, setError] = useState<RepositoryError | null>(null);
  const load = useCallback(() => {
    void Promise.all([
      repository.listWorkItems({ phId, projectId }),
      repository.listBoards({ phId, projectId }),
      repository.listPeople({ phId }),
    ])
      .then(async ([page, nextBoards, nextPeople]) => {
        const boardColumns = (
          await Promise.all(
            nextBoards.map((board) => repository.listBoardColumns({ phId, boardId: board.id })),
          )
        ).flat();
        setItems(page.items);
        setColumns(boardColumns);
        setBoards(nextBoards);
        setPeople(nextPeople);
      })
      .catch(setError);
  }, [phId, projectId, repository]);
  useEffect(load, [load]);
  const filtered = useMemo(
    () => selectWorkItems(items, columns, { query, assigneeId: assigneeId || undefined }),
    [items, columns, query, assigneeId],
  );
  const updateDate = (item: WorkItem, startsOn: string) =>
    void repository
      .updateWorkItem(item.id, {
        version: item.version,
        startsOn,
        dueOn: item.dueOn && item.dueOn < startsOn ? startsOn : item.dueOn,
      })
      .then(load)
      .catch(setError);
  const update = (item: WorkItem, change: Partial<WorkItem>) =>
    void repository
      .updateWorkItem(item.id, { version: item.version, ...change })
      .then(load)
      .catch(setError);
  const move = (item: WorkItem, columnId: string) =>
    void repository
      .moveWorkItem({
        id: item.id,
        phId,
        columnId,
        position: items.filter((candidate) => candidate.columnId === columnId).length,
        version: item.version,
      })
      .then(load)
      .catch(setError);
  const createForDate = (startsOn: string) => {
    const column = columns[0];
    const board = boards[0];
    if (!column || !board) return;
    void repository
      .createWorkItem({
        phId,
        projectId,
        boardId: board.id,
        columnId: column.id,
        key: `OPS-${items.length + 1}`,
        type: 'TASK',
        title: `Tarea del ${startsOn}`,
        priority: 'MEDIUM',
        reporterId: actor.id,
        assigneeId: actor.id,
        startsOn,
        dueOn: startsOn,
        dependencyIds: [],
        requiresEvidence: false,
        requiresValidation: false,
        validationStatus: 'NOT_REQUIRED',
        position: items.length,
        labels: [],
      })
      .then(load)
      .catch(setError);
  };
  const createRecurring = (form: FormData) => {
    const column = columns[0];
    const board = boards[0];
    if (!column || !board) return;
    const startsOn = String(form.get('startsOn'));
    const endsOn = String(form.get('endsOn')) || undefined;
    const occurrenceCount = Number(form.get('occurrenceCount')) || undefined;
    void repository
      .createWorkItem({
        phId,
        projectId,
        boardId: board.id,
        columnId: column.id,
        key: `OPS-${items.length + 1}`,
        type: 'RECURRING_TASK',
        title: String(form.get('title')),
        priority: 'MEDIUM',
        reporterId: actor.id,
        assigneeId: String(form.get('assigneeId')) || actor.id,
        startsOn,
        dueOn: startsOn,
        recurrence: {
          frequency: String(form.get('frequency')) as 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'CUSTOM',
          interval: Number(form.get('interval')) || 1,
          startsOn,
          ...(endsOn ? { endsOn } : { occurrenceCount: occurrenceCount || 10 }),
          weekdays: [],
        },
        dependencyIds: [],
        requiresEvidence: false,
        requiresValidation: false,
        validationStatus: 'NOT_REQUIRED',
        position: items.length,
        labels: ['recurrente'],
      })
      .then(load)
      .catch(setError);
  };
  if (error)
    return (
      <section className="tm-state tm-state--error" role="alert">
        <p>{error.message}</p>
        <Button onClick={load}>Reintentar</Button>
      </section>
    );
  return (
    <section className="workspace-page synced-view">
      <header className="view-heading">
        <div>
          <p className="eyebrow">{projectName}</p>
          <h1>
            {view === 'list'
              ? 'Lista de tareas'
              : view === 'calendar'
                ? 'Calendario'
                : 'Cronograma'}
          </h1>
          <p>Esta vista lee las mismas tareas, permisos y reglas que el tablero.</p>
        </div>
      </header>
      {view === 'list' && <RecurrenceComposer people={people} onCreate={createRecurring} />}
      {view === 'list' ? (
        <ListView
          items={filtered}
          columns={columns}
          people={people}
          selected={selected}
          setSelected={setSelected}
          updateDate={updateDate}
          update={update}
          move={move}
          query={query}
          setQuery={setQuery}
          assigneeId={assigneeId}
          setAssigneeId={setAssigneeId}
          canSelect={actor.role === 'ADMIN'}
        />
      ) : view === 'calendar' ? (
        <CalendarView
          items={filtered}
          columns={columns}
          updateDate={updateDate}
          createForDate={createForDate}
          mode={calendarMode}
          setMode={setCalendarMode}
        />
      ) : (
        <TimelineView
          items={filtered}
          columns={columns}
          updateDate={updateDate}
          update={update}
          zoom={zoom}
          setZoom={setZoom}
        />
      )}
    </section>
  );
}
function RecurrenceComposer({
  people,
  onCreate,
}: {
  people: Person[];
  onCreate: (form: FormData) => void;
}) {
  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onCreate(new FormData(event.currentTarget));
    event.currentTarget.reset();
  };
  return (
    <details className="recurrence-composer">
      <summary>Crear tarea recurrente</summary>
      <form className="entity-form" onSubmit={submit}>
        <label>
          Título
          <input name="title" required />
        </label>
        <label>
          Frecuencia
          <select name="frequency">
            <option value="DAILY">Diaria</option>
            <option value="WEEKLY">Semanal</option>
            <option value="MONTHLY">Mensual</option>
            <option value="CUSTOM">Personalizada</option>
          </select>
        </label>
        <label>
          Intervalo
          <input name="interval" type="number" min="1" defaultValue="1" required />
        </label>
        <label>
          Inicio
          <input name="startsOn" type="date" defaultValue="2026-09-19" required />
        </label>
        <label>
          Responsable
          <select name="assigneeId" required>
            {people.map((person) => (
              <option key={person.id} value={person.id}>
                {person.displayName}
              </option>
            ))}
          </select>
        </label>
        <label>
          Finaliza el
          <input name="endsOn" type="date" />
        </label>
        <label>
          O repeticiones
          <input name="occurrenceCount" type="number" min="1" placeholder="Si no hay fecha final" />
        </label>
        <Button>Crear recurrencia</Button>
      </form>
    </details>
  );
}
function TanStackList({ items }: { items: WorkItem[] }) {
  const table = useTable({ features: listFeatures, columns: listColumns, data: items });
  return (
    <table className="sr-only" aria-label="Modelo de tabla configurable">
      <thead>
        {table.getHeaderGroups().map((group) => (
          <tr key={group.id}>
            {group.headers.map((header) => (
              <th key={header.id}>
                {header.isPlaceholder ? null : <table.FlexRender header={header} />}
              </th>
            ))}
          </tr>
        ))}
      </thead>
      <tbody>
        {table.getRowModel().rows.map((row) => (
          <tr key={row.id}>
            {row.getAllCells().map((cell) => (
              <td key={cell.id}>
                <table.FlexRender cell={cell} />
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
function State({ item, columns }: { item: WorkItem; columns: BoardColumn[] }) {
  const category = columns.find((column) => column.id === item.columnId)?.category ?? 'TODO';
  return (
    <span className="view-state" data-state={category}>
      {category === 'DONE'
        ? 'Terminada'
        : category === 'BLOCKED'
          ? 'Estancada'
          : category === 'IN_PROGRESS'
            ? 'En progreso'
            : 'Por hacer'}
    </span>
  );
}
function ListView({
  items,
  columns,
  people,
  selected,
  setSelected,
  updateDate,
  update,
  move,
  query,
  setQuery,
  assigneeId,
  setAssigneeId,
  canSelect,
}: {
  items: WorkItem[];
  columns: BoardColumn[];
  people: Person[];
  selected: string[];
  setSelected: (ids: string[]) => void;
  updateDate: (item: WorkItem, date: string) => void;
  update: (item: WorkItem, change: Partial<WorkItem>) => void;
  move: (item: WorkItem, columnId: string) => void;
  query: string;
  setQuery: (value: string) => void;
  assigneeId: string;
  setAssigneeId: (id: string) => void;
  canSelect: boolean;
}) {
  return (
    <>
      <div className="view-controls">
        <label className="view-filter">
          Buscar o filtrar
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Clave, título o descripción"
          />
        </label>
        <FilterSelect
          label="Responsable"
          value={assigneeId}
          options={[
            { label: 'Todos', value: '' },
            ...people.map((person) => ({ label: person.displayName, value: person.id })),
          ]}
          onChange={setAssigneeId}
        />
      </div>
      <p role="status">{selected.length} tareas seleccionadas</p>
      <TanStackList items={items} />
      <div className="task-table" role="table" aria-label="Lista de tareas">
        <div role="row" className="task-table__head">
          <span>Seleccionar</span>
          <span>Tarea</span>
          <span>Estado</span>
          <span>Prioridad</span>
          <span>Inicio</span>
        </div>
        {items.map((item) => (
          <div role="row" key={item.id}>
            <span>
              {canSelect ? (
                <input
                  aria-label={`Seleccionar ${item.title}`}
                  type="checkbox"
                  checked={selected.includes(item.id)}
                  onChange={(event) =>
                    setSelected(
                      event.target.checked
                        ? [...selected, item.id]
                        : selected.filter((id) => id !== item.id),
                    )
                  }
                />
              ) : (
                '—'
              )}
            </span>
            <strong>
              {item.key} · {item.title}
              <select
                aria-label={`Responsable de ${item.title}`}
                value={item.assigneeId ?? ''}
                onChange={(event) => update(item, { assigneeId: event.target.value || undefined })}
              >
                <option value="">Sin asignar</option>
                {people.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.displayName}
                  </option>
                ))}
              </select>
            </strong>
            <select
              aria-label={`Estado de ${item.title}`}
              value={item.columnId}
              onChange={(event) => move(item, event.target.value)}
            >
              {columns.map((column) => (
                <option key={column.id} value={column.id}>
                  {column.name}
                </option>
              ))}
            </select>
            <select
              aria-label={`Prioridad de ${item.title}`}
              value={item.priority}
              onChange={(event) =>
                update(item, { priority: event.target.value as WorkItem['priority'] })
              }
            >
              {['LOW', 'MEDIUM', 'HIGH', 'URGENT'].map((priority) => (
                <option key={priority} value={priority}>
                  {priority}
                </option>
              ))}
            </select>
            <label>
              <span className="sr-only">Inicio de {item.title}</span>
              <input
                type="date"
                value={item.startsOn ?? ''}
                onChange={(event) => updateDate(item, event.target.value)}
              />
            </label>
          </div>
        ))}
      </div>
    </>
  );
}
function CalendarView({
  items,
  columns,
  updateDate,
  createForDate,
  mode,
  setMode,
}: {
  items: WorkItem[];
  columns: BoardColumn[];
  updateDate: (item: WorkItem, date: string) => void;
  createForDate: (date: string) => void;
  mode: 'month' | 'week' | 'agenda';
  setMode: (mode: 'month' | 'week' | 'agenda') => void;
}) {
  const [offset, setOffset] = useState(0);
  const calendarPicker = useRef<HTMLInputElement>(null);
  const days = daysAt(offset, mode === 'week');
  const unscheduled = items.filter((item) => !item.startsOn);
  const occurrences = items.flatMap((item) => expandOccurrences(item, days[0]!, days.at(-1)!));
  const drop = (id: string, day: string) => {
    const item = items.find((candidate) => candidate.id === id);
    if (item) updateDate(item, day);
  };
  const goToDate = (date: string) => {
    const base = mode === 'week' ? '2026-09-15' : '2026-09-01';
    const difference =
      (Date.parse(`${date}T00:00:00Z`) - Date.parse(`${base}T00:00:00Z`)) / 86_400_000;
    setOffset(Math.round(difference));
  };
  const openTodayPicker = () => {
    setOffset(0);
    const picker = calendarPicker.current;
    if (!picker) return;
    try {
      picker.showPicker();
    } catch {
      picker.focus();
    }
  };
  return (
    <>
      <div className="calendar-toolbar" aria-label="Controles de calendario">
        <div className="calendar-toolbar__views" role="group" aria-label="Vista">
          {([
            ['week', 'Semana'],
            ['month', 'Mes'],
            ['agenda', 'Agenda'],
          ] as const).map(([nextMode, name]) => (
            <button
              key={nextMode}
              type="button"
              className="calendar-toolbar__view"
              aria-pressed={mode === nextMode}
              onClick={() => setMode(nextMode)}
            >
              {name}
            </button>
          ))}
        </div>
        <div className="calendar-toolbar__navigation" role="group" aria-label="Navegación">
          <Button
            variant="secondary"
            onClick={() => setOffset((value) => value - (mode === 'week' ? 7 : 30))}
          >
            ‹
            <span className="sr-only">Anterior</span>
          </Button>
          <Button variant="secondary" onClick={openTodayPicker}>
            Hoy
          </Button>
          <Button
            variant="secondary"
            onClick={() => setOffset((value) => value + (mode === 'week' ? 7 : 30))}
          >
            <span className="sr-only">Siguiente</span>
            ›
          </Button>
          <input
            ref={calendarPicker}
            className="calendar-toolbar__date-picker"
            type="date"
            defaultValue={today}
            aria-label="Elegir fecha del calendario"
            onChange={(event) => event.target.value && goToDate(event.target.value)}
          />
        </div>
      </div>
      {mode === 'agenda' ? (
        <ul className="agenda">
          {[
            ...items.filter((item) => item.startsOn),
            ...occurrences.map((occurrence) => ({
              ...occurrence.workItem,
              id: `${occurrence.workItem.id}-${occurrence.index}`,
              startsOn: occurrence.date,
            })),
          ]
            .sort((a, b) => (a.startsOn ?? '').localeCompare(b.startsOn ?? ''))
            .map((item) => (
              <li key={item.id}>
                <time>{label(item.startsOn!)}</time>
                <strong>
                  {item.key} · {item.title}
                </strong>
                <State item={item} columns={columns} />
              </li>
            ))}
        </ul>
      ) : (
        <div className={`calendar-workspace calendar-workspace--${mode}`}>
          <div className={`calendar-grid calendar-grid--${mode}`}>
            {days.map((day) => (
              <section
                key={day}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => drop(event.dataTransfer.getData('task'), day)}
              >
                <header className="calendar-day__header">
                  <span>{mode === 'week' ? weekdayLabel(day) : label(day)}</span>
                  {day === today && <b>Hoy</b>}
                </header>
                {items
                  .filter((item) => item.startsOn === day)
                  .map((item) => (
                    <article
                      key={item.id}
                      className={`calendar-event calendar-event--${item.priority.toLowerCase()}`}
                      draggable
                      onDragStart={(event) => event.dataTransfer.setData('task', item.id)}
                    >
                      <span className="calendar-event__key">{item.key}</span>
                      <strong>{item.title}</strong>
                      <span className="calendar-event__meta">
                        <State item={item} columns={columns} />
                      </span>
                    </article>
                  ))}
                <button
                  className="calendar-create-task"
                  aria-label={`Crear tarea el ${label(day)}`}
                  onClick={() => createForDate(day)}
                >
                  + Crear tarea
                </button>
                <label className="calendar-date-control">
                  <span className="sr-only">Asignar fecha</span>
                  <input
                    type="date"
                    onChange={(event) => {
                      const item = unscheduled[0];
                      if (item && event.target.value) updateDate(item, event.target.value);
                    }}
                  />
                </label>
              </section>
            ))}
          </div>
          <aside className="unscheduled">
            <h2>Sin programar</h2>
            {unscheduled.length ? (
              unscheduled.map((item) => (
                <article
                  key={item.id}
                  draggable
                  onDragStart={(event) => event.dataTransfer.setData('task', item.id)}
                >
                  <strong>
                    {item.key} · {item.title}
                  </strong>
                  <label>
                    Fecha accesible
                    <input
                      type="date"
                      onChange={(event) =>
                        event.target.value && updateDate(item, event.target.value)
                      }
                    />
                  </label>
                </article>
              ))
            ) : (
              <p>Sin tareas pendientes de fecha.</p>
            )}
          </aside>
        </div>
      )}
    </>
  );
}
function TimelineView({
  items,
  columns,
  updateDate,
  update,
  zoom,
  setZoom,
}: {
  items: WorkItem[];
  columns: BoardColumn[];
  updateDate: (item: WorkItem, date: string) => void;
  update: (item: WorkItem, change: Partial<WorkItem>) => void;
  zoom: 'week' | 'month' | 'quarter';
  setZoom: (zoom: 'week' | 'month' | 'quarter') => void;
}) {
  const alerts = timelineAlerts(items, columns, today);
  const gantt = {
    week: { start: '2026-09-14', days: 14, marks: [0, 2, 4, 6, 8, 10, 12] },
    month: { start: '2026-09-01', days: 30, marks: [0, 7, 14, 21, 28] },
    quarter: { start: '2026-07-01', days: 92, marks: [0, 31, 62] },
  }[zoom];
  const scaleMarks = gantt.marks.map((offset) => ({
    date: addDays(gantt.start, offset),
    offset,
  }));
  return (
    <>
      <div className="view-controls">
        <label>
          Zoom
          <select value={zoom} onChange={(event) => setZoom(event.target.value as typeof zoom)}>
            <option value="week">Semana</option>
            <option value="month">Mes</option>
            <option value="quarter">Trimestre</option>
          </select>
        </label>
      </div>
      {alerts.length > 0 && (
        <p className="timeline-alert" role="status">
          {alerts.length} tarea(s) con retraso.
        </p>
      )}
      <div className={`gantt gantt--${zoom}`}>
        <div className="gantt__scroller">
          <div className="gantt__table">
            <header className="gantt__header">
              <span>Tarea</span>
              <div className="gantt__scale" style={{ '--gantt-days': gantt.days } as CSSProperties}>
                {scaleMarks.map(({ date, offset }) => (
                  <span key={date} style={{ '--gantt-offset': offset } as CSSProperties}>
                    {zoom === 'quarter'
                      ? new Intl.DateTimeFormat('es-PA', { month: 'short', timeZone: 'UTC' }).format(
                          new Date(`${date}T00:00:00Z`),
                        )
                      : label(date)}
                  </span>
                ))}
              </div>
            </header>
            {items.map((item) => {
              const start = item.startsOn ?? today;
              const end = item.dueOn ?? start;
              const startOffset = daysBetween(gantt.start, start);
              const duration = Math.max(1, daysBetween(start, end) + 1);
              const visibleStart = Math.max(0, startOffset);
              const visibleEnd = Math.min(gantt.days, startOffset + duration);
              const visibleDuration = Math.max(0, visibleEnd - visibleStart);
              const progress = completionPercent(item, columns);
              return (
                <article key={item.id} className="gantt__row">
                  <div className="gantt__task">
                    <strong>
                      {item.type === 'MILESTONE' ? '◆ ' : ''}
                      {item.key} · {item.title}
                    </strong>
                    <small>
                      {label(start)} – {label(end)} · {progress}% completado
                    </small>
                    <span>Dependencias: {item.dependencyIds.length || 'ninguna'}</span>
                    <div className="gantt__dates">
                      <label>
                        Inicio
                        <input
                          type="date"
                          value={item.startsOn ?? ''}
                          onChange={(event) => event.target.value && updateDate(item, event.target.value)}
                        />
                      </label>
                      <label>
                        Fin
                        <input
                          type="date"
                          value={item.dueOn ?? ''}
                          onChange={(event) =>
                            event.target.value && update(item, { dueOn: event.target.value })
                          }
                        />
                      </label>
                    </div>
                  </div>
                  <div className="gantt__track" style={{ '--gantt-days': gantt.days } as CSSProperties}>
                    {visibleDuration > 0 && (
                      <div
                        className={`gantt__bar gantt__bar--${item.priority.toLowerCase()}`}
                        style={
                          {
                            '--gantt-start': visibleStart,
                            '--gantt-duration': visibleDuration,
                            '--progress': `${progress}%`,
                          } as CSSProperties
                        }
                        aria-label={`${item.title}: ${progress}% completado`}
                      >
                        <span />
                        <b>{progress}%</b>
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}
