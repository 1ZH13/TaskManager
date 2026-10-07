'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  completionPercent,
  expandOccurrences,
  selectWorkItems,
  timelineAlerts,
} from '@task-manager/domain';
import { DataError, demoIds } from '@task-manager/data';
import type { Board, BoardColumn, Person, WorkItem } from '@task-manager/shared';
import { Button } from '../../../../packages/ui/src/index';
import { IconButton } from '../../../../packages/ui/src/index';
import { Pencil, Trash2 } from 'lucide-react';
import { useDemo } from './demo-context';
import { FilterSelect } from './filter-select';
import { AccessibleDialog } from './accessible-dialog';
import { projectViewHref } from './project-view-query';
import { listAllWorkItems } from './task-link';

type View = 'list' | 'calendar' | 'timeline';
const today = '2026-09-19';
const daysAt = (anchor: string, week: boolean) => {
  const date = new Date(`${anchor}T00:00:00Z`);
  if (week) date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
  else date.setUTCDate(1);
  const count = week
    ? 7
    : new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  return Array.from({ length: count }, (_, index) =>
    addDays(date.toISOString().slice(0, 10), index),
  );
};
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
const recurrenceLabel: Record<NonNullable<WorkItem['recurrence']>['frequency'], string> = {
  DAILY: 'Diaria',
  WEEKLY: 'Semanal',
  MONTHLY: 'Mensual',
  ANNUAL: 'Anual',
  CUSTOM: 'Personalizada',
};

export function SynchronizedViews({
  view,
  projectId = demoIds.opsProject,
}: {
  view: View;
  projectId?: string;
}) {
  const demo = useDemo();
  return (
    <ScopedViews
      key={`${demo.phId}:${projectId}:${demo.actor.id}:${demo.actor.role}`}
      view={view}
      projectId={projectId}
      demo={demo}
    />
  );
}

function ScopedViews({
  view,
  projectId,
  demo,
}: {
  view: View;
  projectId: string;
  demo: ReturnType<typeof useDemo>;
}) {
  const { phId, actor, repository } = demo;
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const [items, setItems] = useState<WorkItem[]>([]);
  const [columns, setColumns] = useState<BoardColumn[]>([]);
  const [boards, setBoards] = useState<Board[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const query = params.get('q') ?? '';
  const assigneeId = params.get('assignee') ?? '';
  const startsFrom = view === 'list' ? (params.get('startsFrom') ?? '') : '';
  const startsTo = view === 'list' ? (params.get('startsTo') ?? '') : '';
  const updateFilter = (name: string, value: string) => {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(name, value);
    else next.delete(name);
    const slug = view === 'list' ? 'lista' : view === 'calendar' ? 'calendario' : 'cronograma';
    const base = pathname.slice(0, pathname.lastIndexOf('/'));
    router.replace(projectViewHref(base, slug, next), { scroll: false });
  };
  const [calendarMode, setCalendarMode] = useState<'month' | 'week' | 'agenda'>('week');
  const [zoom, setZoom] = useState<'week' | 'month' | 'quarter'>('month');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const requestId = useRef(0);
  const generation = useRef(0);
  const operationPending = useRef(false);
  const load = useCallback(async () => {
    const request = ++requestId.current;
    try {
      const [page, nextBoards, nextPeople] = await Promise.all([
        listAllWorkItems(repository, { phId, projectId }),
        repository.listBoards({ phId, projectId }),
        repository.listPeople({ phId }),
      ]);
      const boardColumns = (
        await Promise.all(
          nextBoards.map((board) => repository.listBoardColumns({ phId, boardId: board.id })),
        )
      ).flat();
      if (request !== requestId.current) return false;
      setItems(page.items);
      setColumns(boardColumns);
      setBoards(nextBoards);
      setPeople(nextPeople);
      setLoaded(true);
      setError(null);
      return true;
    } catch (failure) {
      if (request === requestId.current)
        setError(
          failure instanceof DataError
            ? failure.message
            : 'No se pudieron cargar las tareas. Inténtalo de nuevo.',
        );
      return false;
    } finally {
      if (request === requestId.current) setLoading(false);
    }
  }, [phId, projectId, repository]);
  const invalidate = useCallback(() => {
    requestId.current++;
    generation.current++;
  }, []);
  useEffect(() => {
    // Repository results settle asynchronously; the effect itself does not derive UI state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
    return invalidate;
  }, [load, invalidate]);
  const perform = async (operation: () => Promise<unknown>) => {
    if (operationPending.current) return false;
    const current = generation.current;
    operationPending.current = true;
    setPending(true);
    setError(null);
    try {
      await operation();
      if (current !== generation.current) return false;
      const refreshed = await load();
      if (current !== generation.current) return false;
      if (!refreshed)
        setError(
          (reason) =>
            `El cambio se guardó, pero no pudimos actualizar la vista. Vuelve a cargar; no repitas el cambio.${reason ? ` ${reason}` : ''}`,
        );
      return true;
    } catch (failure) {
      if (current === generation.current)
        setError(
          failure instanceof DataError
            ? failure.message
            : 'No se pudo guardar el cambio. Tus datos siguen disponibles; revisa e inténtalo de nuevo.',
        );
      return false;
    } finally {
      if (current === generation.current) {
        operationPending.current = false;
        setPending(false);
      }
    }
  };
  const filtered = useMemo(
    () =>
      selectWorkItems(items, columns, { query, assigneeId: assigneeId || undefined }).filter(
        (item) =>
          (!startsFrom || (!!item.startsOn && item.startsOn >= startsFrom)) &&
          (!startsTo || (!!item.startsOn && item.startsOn <= startsTo)),
      ),
    [items, columns, query, assigneeId, startsFrom, startsTo],
  );
  const updateDate = (item: WorkItem, startsOn: string) =>
    perform(() =>
      repository.updateWorkItem(item.id, {
        version: item.version,
        startsOn,
        dueOn: item.dueOn && item.dueOn < startsOn ? startsOn : item.dueOn,
      }),
    );
  const update = (item: WorkItem, change: Partial<WorkItem>) =>
    perform(() => repository.updateWorkItem(item.id, { version: item.version, ...change }));
  const move = (item: WorkItem, columnId: string) =>
    perform(() =>
      repository.moveWorkItem({
        id: item.id,
        phId,
        columnId,
        position: items.filter((candidate) => candidate.columnId === columnId).length,
        version: item.version,
      }),
    );
  const createForDate = (startsOn: string) => {
    const column = columns[0];
    const board = boards[0];
    if (!column || !board) return;
    return perform(() =>
      repository.createWorkItem({
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
      }),
    );
  };
  const createRecurring = (form: FormData) => {
    const column = columns[0];
    const board = boards[0];
    if (!column || !board) return Promise.resolve(false);
    const startsOn = String(form.get('startsOn'));
    const endsOn = String(form.get('endsOn')) || undefined;
    const occurrenceCount = Number(form.get('occurrenceCount')) || undefined;
    return perform(() =>
      repository.createWorkItem({
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
          frequency: String(form.get('frequency')) as NonNullable<
            WorkItem['recurrence']
          >['frequency'],
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
      }),
    );
  };
  if (loading) return <p role="status">Cargando tareas…</p>;
  if (error && !loaded)
    return (
      <section className="tm-state tm-state--error" role="alert">
        <p>{error}</p>
        <Button
          onClick={() => {
            setLoading(true);
            void load();
          }}
        >
          Reintentar
        </Button>
      </section>
    );
  return (
    <section className="workspace-page synced-view" aria-busy={pending}>
      <header className="view-heading">
        <div>
          <h1>
            {view === 'list'
              ? 'Lista de tareas'
              : view === 'calendar'
                ? 'Calendario'
                : 'Cronograma'}
          </h1>
        </div>
      </header>
      {error && (
        <div role="alert">
          <p>{error}</p>
          <Button variant="secondary" onClick={() => void load()}>
            Volver a cargar
          </Button>
        </div>
      )}
      {pending && <p role="status">Guardando cambios…</p>}
      {view === 'list' && actor.role === 'ADMIN' && (
        <RecurrenceComposer people={people} onCreate={createRecurring} />
      )}
      <div className="view-controls" role="group" aria-label="Filtros de tareas">
        <label className="view-filter">
          Buscar o filtrar
          <input
            value={query}
            onChange={(event) => updateFilter('q', event.target.value)}
            placeholder="Clave, título o descripción"
          />
        </label>
        <FilterSelect
          label="Responsable"
          value={assigneeId}
          options={[
            { label: 'Todos', value: '' },
            ...(assigneeId && !people.some((person) => person.id === assigneeId)
              ? [{ label: 'Responsable no disponible', value: assigneeId }]
              : []),
            ...people.map((person) => ({ label: person.displayName, value: person.id })),
          ]}
          onChange={(value) => updateFilter('assignee', value)}
        />
        {view === 'list' && (
          <>
            <label className="view-filter view-filter--date">
              Inicio desde
              <input
                aria-label="Filtrar tareas por inicio desde"
                type="date"
                value={startsFrom}
                max={startsTo || undefined}
                onChange={(event) => updateFilter('startsFrom', event.target.value)}
              />
            </label>
            <label className="view-filter view-filter--date">
              Inicio hasta
              <input
                aria-label="Filtrar tareas por inicio hasta"
                type="date"
                value={startsTo}
                min={startsFrom || undefined}
                onChange={(event) => updateFilter('startsTo', event.target.value)}
              />
            </label>
          </>
        )}
      </div>
      {view === 'list' ? (
        <ListView
          items={filtered}
          columns={columns}
          update={update}
          move={move}
          canEdit={actor.role === 'ADMIN'}
          pending={pending}
          error={error}
          onDelete={(item) =>
            void perform(() => repository.deleteWorkItem(phId, item.id, item.version))
          }
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
  onCreate: (form: FormData) => Promise<boolean>;
}) {
  const [saving, setSaving] = useState(false);
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    setSaving(true);
    if (await onCreate(new FormData(form))) form.reset();
    setSaving(false);
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
            <option value="ANNUAL">Anual</option>
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
        <Button disabled={saving}>{saving ? 'Creando…' : 'Crear recurrencia'}</Button>
      </form>
    </details>
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
  update,
  move,
  canEdit,
  pending,
  error,
  onDelete,
}: {
  items: WorkItem[];
  columns: BoardColumn[];
  update: (item: WorkItem, change: Partial<WorkItem>) => Promise<boolean>;
  move: (item: WorkItem, columnId: string) => void;
  canEdit: boolean;
  pending: boolean;
  error: string | null;
  onDelete: (item: WorkItem) => void;
}) {
  const [editingItem, setEditingItem] = useState<WorkItem | null>(null);
  return (
    <>
      <p role="status">
        {items.length ? `${items.length} tareas` : 'No hay tareas que coincidan con los filtros.'}
      </p>
      <div className="task-table" role="table" aria-label="Lista de tareas">
        <div role="row" className="task-table__head">
          <span role="columnheader">ID de la tarea</span>
          <span role="columnheader">Nombre de la tarea</span>
          <span role="columnheader">Descripción de la tarea</span>
          <span role="columnheader">Recurrencia</span>
          <span role="columnheader">Estado</span>
          <span role="columnheader">Acciones</span>
        </div>
        {items.map((item) => (
          <div role="row" key={item.id}>
            <strong role="cell">{item.key}</strong>
            <strong role="cell">{item.title}</strong>
            <span role="cell">{item.description ?? 'Sin descripción'}</span>
            <span role="cell">
              {item.recurrence ? recurrenceLabel[item.recurrence.frequency] : 'No recurrente'}
            </span>
            <span role="cell">
              <select
                disabled={pending}
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
            </span>
            <span role="cell" className="task-table__actions">
              {canEdit && (
                <>
                  <IconButton label={`Editar ${item.title}`} onClick={() => setEditingItem(item)}>
                    <Pencil size={16} />
                  </IconButton>
                  <IconButton
                    disabled={pending}
                    label={`Eliminar ${item.title}`}
                    onClick={() => {
                      if (window.confirm(`¿Eliminar ${item.title}?`)) onDelete(item);
                    }}
                  >
                    <Trash2 size={16} />
                  </IconButton>
                </>
              )}
            </span>
          </div>
        ))}
      </div>
      {editingItem && (
        <TaskEditModal
          item={editingItem}
          failureMessage={error}
          onClose={() => setEditingItem(null)}
          onSave={(change) => update(editingItem, change)}
        />
      )}
    </>
  );
}
function TaskEditModal({
  item,
  onClose,
  onSave,
  failureMessage,
}: {
  item: WorkItem;
  onClose: () => void;
  onSave: (change: Partial<WorkItem>) => Promise<boolean>;
  failureMessage: string | null;
}) {
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const close = () => {
    if (!saving) onClose();
  };
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const title = String(form.get('title')).trim();
    if (!title || saving) return;
    setSaving(true);
    setFailed(false);
    if (await onSave({ title, description: String(form.get('description')).trim() || undefined }))
      onClose();
    else setFailed(true);
    setSaving(false);
  };
  return (
    <AccessibleDialog className="task-modal" labelledBy="task-modal-title" onClose={close}>
      <header>
        <div>
          <p className="eyebrow">Editar tarea</p>
          <h2 id="task-modal-title">{item.key}</h2>
        </div>
        <button
          disabled={saving}
          className="task-modal__close"
          type="button"
          aria-label="Cerrar"
          onClick={close}
        >
          ×
        </button>
      </header>
      <form onSubmit={submit}>
        <label>
          Nombre de la tarea
          <input name="title" defaultValue={item.title} required data-autofocus />
        </label>
        <label>
          Descripción
          <textarea
            name="description"
            defaultValue={item.description}
            placeholder="Agrega una descripción"
          />
        </label>
        {failed && (
          <p role="alert">
            {failureMessage ??
              'No se guardaron los cambios. Conservamos lo que escribiste; puedes volver a intentarlo.'}
          </p>
        )}
        {saving && <p role="status">Guardando…</p>}
        <footer>
          <Button disabled={saving} type="button" variant="secondary" onClick={close}>
            Cancelar
          </Button>
          <Button disabled={saving} type="submit">
            Guardar cambios
          </Button>
        </footer>
      </form>
    </AccessibleDialog>
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
  const [anchor, setAnchor] = useState(today);
  const days = daysAt(anchor, mode === 'week');
  const unscheduled = items.filter((item) => !item.startsOn);
  const events = items.flatMap((item) =>
    item.recurrence
      ? expandOccurrences(item, days[0]!, days.at(-1)!).map((occurrence) => ({
          item,
          date: occurrence.date,
          key: `${item.id}-${occurrence.index}`,
        }))
      : item.startsOn && item.startsOn >= days[0]! && item.startsOn <= days.at(-1)!
        ? [{ item, date: item.startsOn, key: item.id }]
        : [],
  );
  const drop = (id: string, day: string) => {
    const item = items.find((candidate) => candidate.id === id);
    if (item && !item.recurrence) updateDate(item, day);
  };
  const navigate = (direction: number) => {
    if (mode === 'week') setAnchor(addDays(anchor, direction * 7));
    else {
      const next = new Date(`${anchor}T00:00:00Z`);
      next.setUTCDate(1);
      next.setUTCMonth(next.getUTCMonth() + direction);
      setAnchor(next.toISOString().slice(0, 10));
    }
  };
  return (
    <>
      <div className="calendar-toolbar" aria-label="Controles de calendario">
        <div className="calendar-toolbar__views" role="group" aria-label="Vista">
          {(
            [
              ['week', 'Semana'],
              ['month', 'Mes'],
              ['agenda', 'Agenda'],
            ] as const
          ).map(([nextMode, name]) => (
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
          <Button variant="secondary" onClick={() => navigate(-1)}>
            ‹<span className="sr-only">Anterior</span>
          </Button>
          <Button variant="secondary" onClick={() => setAnchor(today)}>
            Fecha de demostración
          </Button>
          <Button variant="secondary" onClick={() => navigate(1)}>
            <span className="sr-only">Siguiente</span>›
          </Button>
          <input
            type="date"
            value={anchor}
            aria-label="Elegir fecha del calendario"
            onChange={(event) => event.target.value && setAnchor(event.target.value)}
          />
        </div>
      </div>
      <p role="status">
        {label(days[0]!)} – {label(days.at(-1)!)}
        {events.length === 0 ? ' · No hay tareas programadas en este período.' : ''}
      </p>
      {mode === 'agenda' ? (
        <ul className="agenda">
          {events
            .sort((a, b) => a.date.localeCompare(b.date))
            .map(({ item, date, key }) => (
              <li key={key}>
                <time dateTime={date}>{label(date)}</time>
                <strong>
                  {item.key} · {item.title}
                </strong>
                <State item={item} columns={columns} />
              </li>
            ))}
        </ul>
      ) : (
        <div className={`calendar-workspace calendar-workspace--${mode}`}>
          <p className="calendar-scroll-hint" id="calendar-scroll-hint">
            Desplázate horizontalmente para ver todos los días, o usa Agenda.
          </p>
          <div
            className={`calendar-grid calendar-grid--${mode}`}
            role="region"
            aria-label="Días del calendario"
            aria-describedby="calendar-scroll-hint"
            tabIndex={0}
          >
            {days.map((day) => (
              <section
                key={day}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => drop(event.dataTransfer.getData('task'), day)}
              >
                <header className="calendar-day__header">
                  <span>{mode === 'week' ? weekdayLabel(day) : label(day)}</span>
                  {day === today && <b>Demo</b>}
                </header>
                {events
                  .filter((event) => event.date === day)
                  .map(({ item, key }) => (
                    <article
                      key={key}
                      className={`calendar-event calendar-event--${item.priority.toLowerCase()}`}
                      draggable={!item.recurrence}
                      onDragStart={(event) => event.dataTransfer.setData('task', item.id)}
                    >
                      <span className="calendar-event__key">{item.key}</span>
                      <strong>{item.title}</strong>
                      <span className="calendar-event__meta">
                        <State item={item} columns={columns} />
                      </span>
                      {item.recurrence ? (
                        <small>Recurrente</small>
                      ) : (
                        <label>
                          Fecha
                          <input
                            aria-label={`Fecha de ${item.title}`}
                            type="date"
                            value={item.startsOn ?? ''}
                            onChange={(event) =>
                              event.target.value && updateDate(item, event.target.value)
                            }
                          />
                        </label>
                      )}
                    </article>
                  ))}
                <button
                  className="calendar-create-task"
                  aria-label={`Crear tarea el ${label(day)}`}
                  onClick={() => createForDate(day)}
                >
                  + Crear tarea
                </button>
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
                    Fecha
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
                      ? new Intl.DateTimeFormat('es-PA', {
                          month: 'short',
                          timeZone: 'UTC',
                        }).format(new Date(`${date}T00:00:00Z`))
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
                          onChange={(event) =>
                            event.target.value && updateDate(item, event.target.value)
                          }
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
                  <div
                    className="gantt__track"
                    style={{ '--gantt-days': gantt.days } as CSSProperties}
                  >
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
