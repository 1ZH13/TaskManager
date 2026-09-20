'use client';

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { demoIds, type RepositoryError } from '@task-manager/data';
import { checkWorkItemTransition } from '@task-manager/domain';
import { Button } from '../../../../packages/ui/src/index';
import type {
  Board,
  BoardColumn,
  Person,
  ProviderReference,
  Team,
  ValidationPolicy,
  WorkActivity,
  WorkAttachment,
  WorkComment,
  WorkItem,
} from '@task-manager/shared';
import { useDemo } from './demo-context';

function Column({
  column,
  children,
  hasTasks,
}: {
  column: BoardColumn;
  children: React.ReactNode;
  hasTasks: boolean;
}) {
  const { actor, repository } = useDemo();
  const [editing, setEditing] = useState(false);
  const [creatingTask, setCreatingTask] = useState(false);
  const { setNodeRef, isOver } = useDroppable({ id: column.id });
  const refresh = () => window.location.reload();
  const save = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    void repository
      .updateBoardColumn(column.id, {
        name: String(form.get('name')),
        color: String(form.get('color')),
        category: String(form.get('category')) as BoardColumn['category'],
      })
      .then(refresh);
  };
  const add = () =>
    void repository
      .createBoardColumn({
        phId: column.phId,
        boardId: column.boardId,
        name: 'Nueva columna',
        category: 'TODO',
        color: '#64748B',
        position: column.position + 1,
      })
      .then(refresh);
  const shift = (offset: number) =>
    void repository
      .listBoardColumns({ phId: column.phId, boardId: column.boardId })
      .then((columns) => {
        const index = columns.findIndex((entry) => entry.id === column.id);
        const target = index + offset;
        if (target < 0 || target >= columns.length) return;
        [columns[index], columns[target]] = [columns[target]!, columns[index]!];
        return repository.reorderBoardColumns(
          column.phId,
          column.boardId,
          columns.map((entry) => entry.id),
        );
      })
      .then(refresh);
  const remove = () => {
    if (window.confirm(`¿Eliminar la columna ${column.name}?`))
      void repository
        .deleteBoardColumn({ phId: column.phId, id: column.id })
        .then(refresh)
        .catch((failure: RepositoryError) => window.alert(failure.message));
  };
  const createTask = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const title = String(new FormData(event.currentTarget).get('title'));
    void repository
      .createWorkItem({
        phId: column.phId,
        projectId: demoIds.opsProject,
        boardId: column.boardId,
        columnId: column.id,
        key: 'TEMP-0',
        type: 'TASK',
        title,
        priority: 'MEDIUM',
        reporterId: actor.id,
        dependencyIds: [],
        requiresEvidence: false,
        requiresValidation: false,
        validationStatus: 'NOT_REQUIRED',
        position: 0,
        labels: [],
      })
      .then(refresh);
  };
  return (
    <section ref={setNodeRef} className="kanban-column" data-over={isOver || undefined}>
      <h2>
        {column.name}
        {actor.role === 'ADMIN' && (
          <>
            <button
              className="column-edit"
              aria-label={`Mover ${column.name} antes`}
              onClick={() => shift(-1)}
            >
              ‹
            </button>
            <button
              className="column-edit"
              aria-label={`Mover ${column.name} después`}
              onClick={() => shift(1)}
            >
              ›
            </button>
            <button
              className="column-edit"
              aria-label={`Crear columna después de ${column.name}`}
              onClick={add}
            >
              ＋
            </button>
            <button
              className="column-edit"
              aria-label={`Editar columna ${column.name}`}
              onClick={() => setEditing(!editing)}
            >
              ⋯
            </button>
          </>
        )}
      </h2>
      {editing && (
        <form className="column-editor" onSubmit={save}>
          <input name="name" defaultValue={column.name} required />
          <select name="category" defaultValue={column.category}>
            {['TODO', 'IN_PROGRESS', 'BLOCKED', 'DONE'].map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
          <input name="color" type="color" defaultValue={column.color} />
          <button>Guardar</button>
          <button type="button" className="column-delete" onClick={remove}>
            Eliminar
          </button>
        </form>
      )}
      {actor.role === 'ADMIN' && !hasTasks && !creatingTask && (
        <button className="column-create-task" onClick={() => setCreatingTask(true)}>
          ＋ Crear tarea
        </button>
      )}
      {creatingTask && (
        <form className="column-create-form" onSubmit={createTask}>
          <input name="title" autoFocus placeholder="Título de la tarea" required />
          <button>Crear</button>
          <button type="button" onClick={() => setCreatingTask(false)}>
            Cancelar
          </button>
        </form>
      )}
      {children}
    </section>
  );
}
function Card({
  item,
  onMove,
  onOpen,
  columns,
}: {
  item: WorkItem;
  onMove: (columnId: string) => void;
  onOpen: () => void;
  columns: BoardColumn[];
}) {
  const { phId, actor, repository } = useDemo();
  const [people, setPeople] = useState<Person[]>([]);
  const [creatingNext, setCreatingNext] = useState(false);
  useEffect(() => {
    void repository.listPeople({ phId }).then(setPeople);
  }, [phId, repository]);
  const { attributes, listeners, setNodeRef: dragRef, transform } = useDraggable({ id: item.id });
  const { setNodeRef: dropRef } = useDroppable({ id: item.id });
  const ref = (node: HTMLElement | null) => {
    dragRef(node);
    dropRef(node);
  };
  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;
  const createNext = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const title = String(new FormData(event.currentTarget).get('title'));
    void repository
      .createWorkItem({
        phId,
        projectId: item.projectId,
        boardId: item.boardId,
        columnId: item.columnId,
        key: 'TEMP-0',
        type: 'TASK',
        title,
        priority: 'MEDIUM',
        reporterId: actor.id,
        dependencyIds: [],
        requiresEvidence: false,
        requiresValidation: false,
        validationStatus: 'NOT_REQUIRED',
        position: 0,
        labels: [],
      })
      .then(() => window.location.reload());
  };
  return (
    <article ref={ref} style={style} className="task-card" {...attributes}>
      <button className="task-grip" aria-label={`Arrastrar ${item.title}`} {...listeners}>
        ↕
      </button>
      <button className="task-open" onClick={onOpen}>
        {item.key} · {item.title}
      </button>
      <small>
        {item.priority} · {item.type}
      </small>
      <label className="task-assignee" aria-label={`Asignar ${item.title}`}>
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm0 2c-4.2 0-7 2.1-7 4.5V20h14v-1.5C19 16.1 16.2 14 12 14Z" />
        </svg>
        <select
          value={item.assigneeId ?? ''}
          onChange={(event) =>
            void repository
              .updateWorkItem(item.id, {
                version: item.version,
                assigneeId: event.target.value || undefined,
              })
              .then(() => window.location.reload())
          }
        >
          <option value="">Sin asignar</option>
          {people.map((person) => (
            <option key={person.id} value={person.id}>
              {person.displayName}
            </option>
          ))}
        </select>
      </label>
      {!creatingNext && (
        <button
          type="button"
          className="task-add-below"
          aria-label={`Crear tarea debajo de ${item.title}`}
          onClick={() => setCreatingNext(true)}
        >
          ＋
        </button>
      )}
      {creatingNext && (
        <form className="task-add-form" onSubmit={createNext}>
          <input name="title" autoFocus placeholder="Nueva tarea" required />
          <button>Crear</button>
          <button type="button" onClick={() => setCreatingNext(false)}>
            Cancelar
          </button>
        </form>
      )}
    </article>
  );
}

function BoardControls({
  boards,
  current,
  onSelect,
  onChanged,
}: {
  boards: Board[];
  current: Board | null;
  onSelect: (id: string) => void;
  onChanged: () => void;
}) {
  const { phId, repository } = useDemo();
  const [open, setOpen] = useState(false);
  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = String(new FormData(event.currentTarget).get('name'));
    if (current)
      void repository.updateBoard(current.id, { version: current.version, name }).then(() => {
        setOpen(false);
        onChanged();
      });
    else
      void repository
        .createBoard({ phId, projectId: demoIds.opsProject, name, teamIds: [] })
        .then(() => {
          setOpen(false);
          onChanged();
        });
  };
  const create = () =>
    void repository
      .createBoard({ phId, projectId: demoIds.opsProject, name: 'Nuevo tablero', teamIds: [] })
      .then((created) => {
        onSelect(created.id);
        onChanged();
      });
  return (
    <section className="board-controls">
      <label>
        Tablero
        <select value={current?.id ?? ''} onChange={(event) => onSelect(event.target.value)}>
          {boards.map((entry) => (
            <option key={entry.id} value={entry.id}>
              {entry.name}
            </option>
          ))}
        </select>
      </label>
      <Button type="button" variant="secondary" onClick={create}>
        Nuevo tablero
      </Button>
      <Button type="button" variant="secondary" onClick={() => setOpen(!open)}>
        {open ? 'Cancelar' : 'Administrar tablero'}
      </Button>
      {open && (
        <form className="board-editor" onSubmit={submit}>
          <label>
            Nombre
            <input name="name" defaultValue={current?.name} required />
          </label>
          <Button>Guardar</Button>
          {current && (
            <Button
              type="button"
              variant="danger"
              onClick={() => {
                if (window.confirm(`¿Eliminar ${current.name}?`))
                  void repository
                    .deleteBoard(phId, current.id, current.version)
                    .then(onChanged)
                    .catch((failure: RepositoryError) => window.alert(failure.message));
              }}
            >
              Eliminar
            </Button>
          )}
        </form>
      )}
    </section>
  );
}

export function OperationalBoard() {
  const { phId, actor, repository } = useDemo();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const boardId = params.get('board');
  const [boards, setBoards] = useState<Board[]>([]);
  const [board, setBoard] = useState<Board | null>(null);
  const [columns, setColumns] = useState<BoardColumn[]>([]);
  const [items, setItems] = useState<WorkItem[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [providers, setProviders] = useState<ProviderReference[]>([]);
  const [policy, setPolicy] = useState<ValidationPolicy | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const [creating, setCreating] = useState(false);
  const [selected, setSelected] = useState<WorkItem | null>(null);
  const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor));
  const load = useCallback(() => {
    void repository
      .listBoards({ phId, projectId: demoIds.opsProject })
      .then(async (nextBoards) => {
        const nextBoard = nextBoards.find((entry) => entry.id === boardId) ?? nextBoards[0];
        if (!nextBoard) return;
        const [nextColumns, page, nextPolicy, nextPeople, nextTeams, nextProviders] =
          await Promise.all([
            repository.listBoardColumns({ phId, boardId: nextBoard.id }),
            repository.listWorkItems({ phId, boardId: nextBoard.id }),
            repository.getValidationPolicy(phId, nextBoard.projectId),
            repository.listPeople({ phId }),
            repository.listTeams({ phId }),
            repository.listProviders({ phId }),
          ]);
        setBoards(nextBoards);
        setBoard(nextBoard);
        setColumns(nextColumns);
        setItems(page.items);
        setPolicy(nextPolicy);
        setPeople(nextPeople);
        setTeams(nextTeams);
        setProviders(nextProviders);
        setSelected((current) =>
          current ? (page.items.find((item) => item.id === current.id) ?? null) : null,
        );
      })
      .catch((failure: RepositoryError) => setError(failure.message));
  }, [boardId, phId, repository]);
  useEffect(load, [load]);
  const q = params.get('q')?.toLowerCase() ?? '';
  const priority = params.get('priority') ?? '';
  const assignee = params.get('assignee') ?? '';
  const team = params.get('team') ?? '';
  const type = params.get('type') ?? '';
  const provider = params.get('provider') ?? '';
  const dueFrom = params.get('dueFrom') ?? '';
  const dueTo = params.get('dueTo') ?? '';
  const group = params.get('group') ?? 'none';
  const visible = useMemo(
    () =>
      items.filter(
        (item) =>
          (!q || `${item.key} ${item.title}`.toLowerCase().includes(q)) &&
          (!priority || item.priority === priority) &&
          (!assignee || item.assigneeId === assignee) &&
          (!team || item.teamId === team) &&
          (!type || item.type === type) &&
          (!provider || item.providerId === provider) &&
          (!dueFrom || (item.dueOn ?? '') >= dueFrom) &&
          (!dueTo || (item.dueOn ?? '') <= dueTo),
      ),
    [items, priority, q, assignee, team, type, provider, dueFrom, dueTo],
  );
  const grouped = useMemo(() => {
    const label = (item: WorkItem) =>
      group === 'assignee'
        ? (people.find((person) => person.id === item.assigneeId)?.displayName ?? 'Sin responsable')
        : group === 'team'
          ? (teams.find((entry) => entry.id === item.teamId)?.name ?? 'Sin equipo')
          : group === 'type'
            ? item.type
            : group === 'priority'
              ? item.priority
              : 'Todas';
    return columns.reduce<Record<string, Array<[string, WorkItem[]]>>>((result, column) => {
      const buckets = new Map<string, WorkItem[]>();
      visible
        .filter((item) => item.columnId === column.id)
        .forEach((item) => {
          const key = label(item);
          buckets.set(key, [...(buckets.get(key) ?? []), item]);
        });
      result[column.id] = [...buckets.entries()];
      return result;
    }, {});
  }, [columns, group, people, teams, visible]);
  const move = (
    item: WorkItem,
    columnId: string,
    position = items.filter((candidate) => candidate.columnId === columnId).length,
  ) => {
    const target = columns.find((column) => column.id === columnId);
    if (!target) return;
    const check = checkWorkItemTransition(item, target, policy);
    if (!check.allowed) {
      setError(check.message ?? 'La transición no está permitida.');
      return;
    }
    void repository
      .moveWorkItem({ id: item.id, phId, columnId, position, version: item.version })
      .then(() => {
        setAnnouncement(`${item.key} movida a ${target.name}.`);
        load();
      })
      .catch((failure: RepositoryError) => setError(failure.message));
  };
  const dragEnd = (event: DragEndEvent) => {
    const item = items.find((candidate) => candidate.id === event.active.id);
    const overId = String(event.over?.id ?? '');
    if (!item) return;
    const targetItem = items.find((candidate) => candidate.id === overId);
    if (targetItem) move(item, targetItem.columnId, targetItem.position);
    else if (columns.some((column) => column.id === overId) && item.columnId !== overId)
      move(item, overId);
  };
  const filter = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const next = new URLSearchParams();
    for (const key of [
      'q',
      'priority',
      'assignee',
      'team',
      'type',
      'provider',
      'dueFrom',
      'dueTo',
      'group',
    ]) {
      const value = String(form.get(key) ?? '').trim();
      if (value && !(key === 'group' && value === 'none')) next.set(key, value);
    }
    router.replace(`${pathname}${next.size ? `?${next}` : ''}`);
  };
  const clearFilter = (key: string) => {
    const next = new URLSearchParams(params);
    next.delete(key);
    router.replace(`${pathname}${next.size ? `?${next}` : ''}`);
  };
  const updateFilter = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (!value || (key === 'group' && value === 'none')) next.delete(key);
    else next.set(key, value);
    router.replace(`${pathname}${next.size ? `?${next}` : ''}`);
  };
  const create = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!board || !columns[0]) return;
    const form = new FormData(event.currentTarget);
    void repository
      .createWorkItem({
        phId,
        projectId: board.projectId,
        boardId: board.id,
        columnId: columns[0].id,
        key: 'TEMP-0',
        type: String(form.get('type')) as WorkItem['type'],
        title: String(form.get('title')),
        description: String(form.get('description')) || undefined,
        priority: String(form.get('priority')) as WorkItem['priority'],
        reporterId: actor.id,
        assigneeId: String(form.get('assigneeId')) || undefined,
        teamId: String(form.get('teamId')) || undefined,
        providerId: String(form.get('providerId')) || undefined,
        dependencyIds: [],
        requiresEvidence: false,
        requiresValidation: false,
        validationStatus: 'NOT_REQUIRED',
        position: 0,
        labels: [],
      })
      .then(() => {
        setCreating(false);
        setAnnouncement('Tarea creada.');
        load();
      })
      .catch((failure: RepositoryError) => setError(failure.message));
  };
  const selectBoard = (id: string) => {
    const next = new URLSearchParams(params);
    next.set('board', id);
    router.replace(`${pathname}?${next}`);
  };
  return (
    <section className="workspace-page board-page">
      <div className="toolbar">
        <div>
          <p className="eyebrow">Gestión operativa</p>
          <h1>{board?.name ?? 'Tablero'}</h1>
        </div>
      </div>
      <p className="sr-only" role="status" aria-live="polite">
        {announcement}
      </p>
      {actor.role === 'ADMIN' && (
        <BoardControls boards={boards} current={board} onSelect={selectBoard} onChanged={load} />
      )}
      {creating && false && (
        <form className="entity-form" onSubmit={create}>
          <label>
            Título
            <input name="title" required />
          </label>
          <label>
            Tipo
            <select name="type">
              <option value="TASK">Tarea</option>
              <option value="INCIDENT">Incidencia</option>
              <option value="MILESTONE">Hito</option>
            </select>
          </label>
          <label>
            Prioridad
            <select name="priority">
              <option value="MEDIUM">Media</option>
              <option value="HIGH">Alta</option>
            </select>
          </label>
          <label>
            Responsable
            <select name="assigneeId">
              <option value="">Sin asignar</option>
              {people.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.displayName}
                </option>
              ))}
            </select>
          </label>
          <label>
            Equipo
            <select name="teamId">
              <option value="">Sin equipo</option>
              {teams.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Proveedor
            <select name="providerId">
              <option value="">Sin proveedor</option>
              {providers.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Descripción</span>
            <textarea name="description" />
          </label>
          <Button>Guardar tarea</Button>
        </form>
      )}
      <form className="board-filter" onSubmit={filter}>
        <label>
          Buscar
          <input name="q" value={q} onChange={(event) => updateFilter('q', event.target.value)} />
          {q && (
            <button
              type="button"
              className="filter-clear"
              aria-label="Quitar búsqueda"
              onClick={() => clearFilter('q')}
            >
              ×
            </button>
          )}
        </label>
        <label>
          Prioridad
          <select
            name="priority"
            value={priority}
            onChange={(event) => updateFilter('priority', event.target.value)}
          >
            <option value="">Todas</option>
            <option value="LOW">Baja</option>
            <option value="MEDIUM">Media</option>
            <option value="HIGH">Alta</option>
            <option value="URGENT">Urgente</option>
          </select>
          {priority && (
            <button
              type="button"
              className="filter-clear"
              aria-label="Quitar prioridad"
              onClick={() => clearFilter('priority')}
            >
              ×
            </button>
          )}
        </label>
        <label>
          Responsable
          <select
            name="assignee"
            value={assignee}
            onChange={(event) => updateFilter('assignee', event.target.value)}
          >
            <option value="">Todos</option>
            {people.map((person) => (
              <option key={person.id} value={person.id}>
                {person.displayName}
              </option>
            ))}
          </select>
          {assignee && (
            <button
              type="button"
              className="filter-clear"
              aria-label="Quitar responsable"
              onClick={() => clearFilter('assignee')}
            >
              ×
            </button>
          )}
        </label>
        <label>
          Equipo
          <select
            name="team"
            value={team}
            onChange={(event) => updateFilter('team', event.target.value)}
          >
            <option value="">Todos</option>
            {teams.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.name}
              </option>
            ))}
          </select>
          {team && (
            <button
              type="button"
              className="filter-clear"
              aria-label="Quitar equipo"
              onClick={() => clearFilter('team')}
            >
              ×
            </button>
          )}
        </label>
        <label>
          Tipo
          <select
            name="type"
            value={type}
            onChange={(event) => updateFilter('type', event.target.value)}
          >
            <option value="">Todos</option>
            {['TASK', 'RECURRING_TASK', 'INCIDENT', 'SUBTASK', 'MILESTONE'].map((entry) => (
              <option key={entry} value={entry}>
                {entry}
              </option>
            ))}
          </select>
          {type && (
            <button
              type="button"
              className="filter-clear"
              aria-label="Quitar tipo"
              onClick={() => clearFilter('type')}
            >
              ×
            </button>
          )}
        </label>
        <label>
          Proveedor
          <select
            name="provider"
            value={provider}
            onChange={(event) => updateFilter('provider', event.target.value)}
          >
            <option value="">Todos</option>
            {providers.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.name}
              </option>
            ))}
          </select>
          {provider && (
            <button
              type="button"
              className="filter-clear"
              aria-label="Quitar proveedor"
              onClick={() => clearFilter('provider')}
            >
              ×
            </button>
          )}
        </label>
        <label>
          Desde
          <input
            name="dueFrom"
            type="date"
            value={dueFrom}
            onChange={(event) => updateFilter('dueFrom', event.target.value)}
          />
          {dueFrom && (
            <button
              type="button"
              className="filter-clear"
              aria-label="Quitar fecha inicial"
              onClick={() => clearFilter('dueFrom')}
            >
              ×
            </button>
          )}
        </label>
        <label>
          Hasta
          <input
            name="dueTo"
            type="date"
            value={dueTo}
            onChange={(event) => updateFilter('dueTo', event.target.value)}
          />
          {dueTo && (
            <button
              type="button"
              className="filter-clear"
              aria-label="Quitar fecha final"
              onClick={() => clearFilter('dueTo')}
            >
              ×
            </button>
          )}
        </label>
        <label>
          Agrupar
          <select
            name="group"
            value={group}
            onChange={(event) => updateFilter('group', event.target.value)}
          >
            <option value="none">Sin agrupar</option>
            <option value="assignee">Responsable</option>
            <option value="team">Equipo</option>
            <option value="type">Tipo</option>
            <option value="priority">Prioridad</option>
          </select>
          {group !== 'none' && (
            <button
              type="button"
              className="filter-clear"
              aria-label="Quitar agrupación"
              onClick={() => clearFilter('group')}
            >
              ×
            </button>
          )}
        </label>
      </form>
      {error && (
        <p role="alert" className="inline-error">
          {error}
        </p>
      )}
      <DndContext sensors={sensors} onDragEnd={dragEnd}>
        <div className="kanban" aria-label="Tablero de tareas">
          {columns.map((column) => (
            <Column
              key={column.id}
              column={column}
              hasTasks={items.some((item) => item.columnId === column.id)}
            >
              {grouped[column.id]?.map(([label, groupedItems]) => (
                <section className="kanban-group" key={label}>
                  <h3>{group === 'none' ? undefined : label}</h3>
                  {groupedItems.map((item) => (
                    <Card
                      key={item.id}
                      item={item}
                      columns={columns}
                      onOpen={() => setSelected(item)}
                      onMove={(columnId) => move(item, columnId)}
                    />
                  ))}
                </section>
              ))}
            </Column>
          ))}
        </div>
      </DndContext>
      {selected && (
        <TaskEditor
          item={selected}
          onClose={() => setSelected(null)}
          onChanged={load}
          onError={setError}
        />
      )}
    </section>
  );
}

function TaskEditor({
  item,
  onClose,
  onChanged,
  onError,
}: {
  item: WorkItem;
  onClose: () => void;
  onChanged: () => void;
  onError: (message: string) => void;
}) {
  const { phId, actor, repository } = useDemo();
  const [subtask, setSubtask] = useState(false);
  const [subtasks, setSubtasks] = useState<WorkItem[]>([]);
  const [comments, setComments] = useState<WorkComment[]>([]);
  const [attachments, setAttachments] = useState<WorkAttachment[]>([]);
  const [activity, setActivity] = useState<WorkActivity[]>([]);
  const loadDetail = useCallback(() => {
    void Promise.all([
      repository.listWorkItems({ phId, boardId: item.boardId, parentId: item.id }),
      repository.listComments(phId, item.id),
      repository.listAttachments(phId, item.id),
      repository.listActivity(phId, item.id),
    ])
      .then(([nextSubtasks, nextComments, nextAttachments, nextActivity]) => {
        setSubtasks(nextSubtasks.items);
        setComments(nextComments);
        setAttachments(nextAttachments);
        setActivity(nextActivity);
      })
      .catch((failure: RepositoryError) => onError(failure.message));
  }, [item.boardId, item.id, onError, phId, repository]);
  useEffect(loadDetail, [loadDetail]);
  const save = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    void repository
      .updateWorkItem(item.id, {
        version: item.version,
        title: String(form.get('title')),
        description: String(form.get('description')) || undefined,
        priority: String(form.get('priority')) as WorkItem['priority'],
        blockedReason: String(form.get('blockedReason')) || undefined,
      })
      .then(onChanged)
      .catch((failure: RepositoryError) => onError(failure.message));
  };
  const createSubtask = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    void repository
      .createWorkItem({
        phId,
        projectId: item.projectId,
        boardId: item.boardId,
        columnId: item.columnId,
        key: 'TEMP-0',
        type: 'SUBTASK',
        title: String(form.get('title')),
        priority: 'MEDIUM',
        reporterId: actor.id,
        parentId: item.id,
        dependencyIds: [],
        requiresEvidence: false,
        requiresValidation: false,
        validationStatus: 'NOT_REQUIRED',
        position: 0,
        labels: [],
      })
      .then(() => {
        setSubtask(false);
        loadDetail();
        onChanged();
      })
      .catch((failure: RepositoryError) => onError(failure.message));
  };
  const comment = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const body = String(new FormData(event.currentTarget).get('body'));
    void repository
      .addComment({ phId, workItemId: item.id, body })
      .then(() => {
        event.currentTarget.reset();
        loadDetail();
      })
      .catch((failure: RepositoryError) => onError(failure.message));
  };
  const attach = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = String(new FormData(event.currentTarget).get('name'));
    void repository
      .addAttachment({
        phId,
        workItemId: item.id,
        name,
        mimeType: 'application/octet-stream',
        sizeBytes: 0,
        url: `https://demo.local/adjuntos/${encodeURIComponent(name)}`,
      })
      .then(() => {
        event.currentTarget.reset();
        loadDetail();
      })
      .catch((failure: RepositoryError) => onError(failure.message));
  };
  const remove = () => {
    if (!window.confirm(`¿Eliminar la tarea ${item.key}? También se eliminarán sus subtareas y actividad.`)) return;
    void repository
      .deleteWorkItem(phId, item.id, item.version)
      .then(() => {
        onClose();
        onChanged();
      })
      .catch((failure: RepositoryError) => onError(failure.message));
  };
  return (
    <section className="task-detail" aria-label={`Detalle de ${item.title}`}>
      <div className="toolbar">
        <h2>{item.key}</h2>
        <Button variant="secondary" onClick={onClose}>
          Cerrar
        </Button>
      </div>
      <form className="entity-form" onSubmit={save}>
        <label>
          Título
          <input name="title" defaultValue={item.title} required />
        </label>
        <label>
          Prioridad
          <select name="priority" defaultValue={item.priority}>
            {['LOW', 'MEDIUM', 'HIGH', 'URGENT'].map((entry) => (
              <option key={entry}>{entry}</option>
            ))}
          </select>
        </label>
        <label>
          Motivo de bloqueo
          <input name="blockedReason" defaultValue={item.blockedReason} />
        </label>
        <label>
          <span>Descripción</span>
          <textarea name="description" defaultValue={item.description} />
        </label>
        <Button>Guardar cambios</Button>
        <Button type="button" variant="danger" onClick={remove}>
          Eliminar tarea
        </Button>
      </form>
      <h3>Subtareas ({subtasks.length})</h3>
      <ul>
        {subtasks.map((entry) => (
          <li key={entry.id}>
            {entry.key} · {entry.title}
          </li>
        ))}
      </ul>
      <Button variant="secondary" onClick={() => setSubtask(!subtask)}>
        {subtask ? 'Cancelar subtarea' : 'Crear subtarea'}
      </Button>
      {subtask && (
        <form className="entity-form" onSubmit={createSubtask}>
          <label>
            Título
            <input name="title" required />
          </label>
          <Button>Guardar subtarea</Button>
        </form>
      )}
      <h3>Comentarios</h3>
      <form className="entity-form" onSubmit={comment}>
        <label>
          <span>Comentario</span>
          <textarea name="body" required />
        </label>
        <Button>Publicar comentario</Button>
      </form>
      <ul>
        {comments.map((entry) => (
          <li key={entry.id}>{entry.body}</li>
        ))}
      </ul>
      <h3>Adjuntos</h3>
      <form className="entity-form" onSubmit={attach}>
        <label>
          Nombre del archivo
          <input name="name" required />
        </label>
        <Button variant="secondary">Adjuntar</Button>
      </form>
      <ul>
        {attachments.map((entry) => (
          <li key={entry.id}>
            <a href={entry.url}>{entry.name}</a>
          </li>
        ))}
      </ul>
      <h3>Actividad</h3>
      <ul>
        {activity.map((entry) => (
          <li key={entry.id}>{entry.message}</li>
        ))}
      </ul>
    </section>
  );
}
