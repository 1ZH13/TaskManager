'use client';

import {
  DndContext,
  DragOverlay,
  closestCenter,
  pointerWithin,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type CollisionDetection,
} from '@dnd-kit/core';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  Bookmark,
  CalendarDays,
  ChevronDown,
  GripVertical,
  MoreHorizontal,
  UserRound,
  X,
} from 'lucide-react';
import { demoIds, type RepositoryError } from '@task-manager/data';
import { can, checkWorkItemTransition } from '@task-manager/domain';
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
import { AccessibleDialog } from './accessible-dialog';
import { listAllWorkItems, resolveTaskLink } from './task-link';
import { taskDraftKey, taskDrafts, type TaskDraft } from './task-drafts';
import { useBoardAction } from './use-board-action';

const priorityLabel: Record<WorkItem['priority'], string> = {
  LOW: 'Baja',
  MEDIUM: 'Media',
  HIGH: 'Alta',
  URGENT: 'Urgente',
};
const typeLabel: Record<WorkItem['type'], string> = {
  TASK: 'Tarea',
  RECURRING_TASK: 'Tarea recurrente',
  INCIDENT: 'Incidencia',
  SUBTASK: 'Subtarea',
  MILESTONE: 'Hito',
};

// Pointer hits take precedence over overlapping column rectangles. Keyboard
// dragging keeps a geometric fallback; no animation is applied to pointer tracking.
const boardCollision: CollisionDetection = (args) => {
  const draggingColumn = String(args.active.id).startsWith('column:');
  const containers = args.droppableContainers.filter((entry) =>
    draggingColumn ? entry.data.current?.kind === 'column' : true,
  );
  const hits = pointerWithin({ ...args, droppableContainers: containers });
  if (hits.length) {
    return hits.sort(
      (a, b) =>
        Number(
          args.droppableContainers.find((entry) => entry.id === a.id)?.data.current?.kind ===
            'column',
        ) -
        Number(
          args.droppableContainers.find((entry) => entry.id === b.id)?.data.current?.kind ===
            'column',
        ),
    );
  }
  return args.pointerCoordinates ? [] : closestCenter({ ...args, droppableContainers: containers });
};

function BoardActionError({ action }: { action: ReturnType<typeof useBoardAction> }) {
  return (
    <>
      {action.error && (
        <p className="inline-error" role="alert">
          {action.error}
        </p>
      )}
      {action.refreshFailed && (
        <button type="button" disabled={action.pending} onClick={() => void action.retryRefresh()}>
          Reintentar actualización
        </button>
      )}
    </>
  );
}

function Column({
  column,
  projectId,
  children,
  itemCount,
  canMoveLeft,
  canMoveRight,
  onMove,
  onChanged,
  boardPending,
  dropSide,
}: {
  column: BoardColumn;
  projectId: string;
  children: React.ReactNode;
  itemCount: number;
  canMoveLeft: boolean;
  canMoveRight: boolean;
  onMove: (offset: number) => void;
  onChanged: () => Promise<boolean>;
  boardPending: boolean;
  dropSide?: 'before' | 'after' | 'inside';
}) {
  const { actor, repository } = useDemo();
  const [editing, setEditing] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [limitOpen, setLimitOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const createButton = useRef<HTMLButtonElement>(null);
  const restoreCreateFocus = useRef(false);
  const [creatingTask, setCreatingTask] = useState(false);
  const action = useBoardAction(onChanged);
  const pending = action.pending || boardPending;
  useEffect(() => {
    if (!creatingTask && !pending && restoreCreateFocus.current) {
      restoreCreateFocus.current = false;
      createButton.current?.focus();
    }
  }, [creatingTask, pending]);
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: column.id,
    data: { kind: 'column' },
  });
  const {
    attributes,
    listeners,
    setNodeRef: setDragRef,
    isDragging,
  } = useDraggable({
    id: `column:${column.id}`,
    disabled: actor.role !== 'ADMIN' || pending,
  });
  const setNodeRef = (node: HTMLElement | null) => {
    setDropRef(node);
    setDragRef(node);
  };
  const saveName = async (name: string) => {
    const nextName = name.trim();
    if (!nextName || nextName === column.name) {
      setEditing(false);
      return;
    }
    if (
      await action.run(
        () => repository.updateBoardColumn(column.id, { name: nextName }),
        'Nombre de columna guardado.',
      )
    )
      setEditing(false);
  };
  const remove = () => {
    if (window.confirm(`¿Eliminar la columna ${column.name}?`))
      void action.run(
        () => repository.deleteBoardColumn({ phId: column.phId, id: column.id }),
        'Columna eliminada.',
      );
  };
  const saveLimit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const minimum = String(form.get('minimum') ?? '');
    const maximum = String(form.get('maximum') ?? '');
    const minItems = minimum === '' ? undefined : Number(minimum);
    const maxItems = maximum === '' ? undefined : Number(maximum);
    if (minItems !== undefined && maxItems !== undefined && minItems > maxItems) {
      action.setError('El mínimo no puede ser mayor que el máximo.');
      return;
    }
    void action
      .run(
        () => repository.updateBoardColumn(column.id, { minItems, maxItems }),
        'Límites guardados.',
      )
      .then((saved) => {
        if (saved) setLimitOpen(false);
      });
  };
  const createTask = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const title = String(new FormData(event.currentTarget).get('title')).trim();
    if (!title) {
      action.setError('Escribe un título para la tarea.');
      return;
    }
    void action
      .run(
        () =>
          repository.createWorkItem({
            phId: column.phId,
            projectId,
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
          }),
        'Tarea creada.',
      )
      .then((saved) => {
        if (saved) {
          restoreCreateFocus.current = true;
          setCreatingTask(false);
        }
      });
  };
  return (
    <section
      ref={setNodeRef}
      className="kanban-column"
      data-over={isOver || undefined}
      data-dragging={isDragging || undefined}
      data-drop-side={dropSide}
      aria-busy={pending}
    >
      <header className="column-header">
        {editing ? (
          <input
            className="column-name-input"
            aria-label="Nombre de la columna"
            autoFocus
            defaultValue={column.name}
            disabled={pending}
            onBlur={(event) => saveName(event.currentTarget.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') event.currentTarget.blur();
              if (event.key === 'Escape') setEditing(false);
            }}
          />
        ) : (
          <button
            className="column-title"
            aria-label={actor.role === 'ADMIN' ? `Renombrar columna ${column.name}` : undefined}
            disabled={actor.role !== 'ADMIN' || pending}
            onDoubleClick={() => setEditing(true)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') setEditing(true);
            }}
            title={actor.role === 'ADMIN' ? 'Doble clic para cambiar el nombre' : undefined}
          >
            {column.name}
          </button>
        )}
        <span className="column-count" aria-label={`${itemCount} tareas`}>
          {itemCount}
        </span>
        {actor.role === 'ADMIN' && (
          <div className="column-actions">
            <button
              className="column-icon-button column-drag-handle"
              aria-label={`Arrastrar ${column.name}`}
              title="Arrastrar columna"
              disabled={pending}
              {...attributes}
              {...listeners}
            >
              <GripVertical size={16} aria-hidden="true" />
            </button>
            <button
              className="column-icon-button"
              aria-label={`Opciones de ${column.name}`}
              ref={menuButton}
              aria-expanded={menuOpen}
              disabled={pending}
              onClick={() => setMenuOpen((open) => !open)}
            >
              <MoreHorizontal size={17} aria-hidden="true" />
            </button>
            {menuOpen && (
              <div className="column-menu" role="menu">
                <button
                  role="menuitem"
                  disabled={pending}
                  onClick={() => {
                    // The menu item unmounts; restore focus to its persistent trigger.
                    menuButton.current?.focus();
                    setLimitOpen(true);
                    setMenuOpen(false);
                  }}
                >
                  Establecer límite de columna
                </button>
                {canMoveLeft && (
                  <button
                    role="menuitem"
                    disabled={pending}
                    onClick={() => {
                      onMove(-1);
                      setMenuOpen(false);
                    }}
                  >
                    Mover columna a la izquierda
                  </button>
                )}
                {canMoveRight && (
                  <button
                    role="menuitem"
                    disabled={pending}
                    onClick={() => {
                      onMove(1);
                      setMenuOpen(false);
                    }}
                  >
                    Mover columna a la derecha
                  </button>
                )}
                <button
                  className="column-menu-delete"
                  role="menuitem"
                  disabled={pending}
                  onClick={remove}
                >
                  Eliminar columna
                </button>
              </div>
            )}
          </div>
        )}
      </header>
      {!limitOpen && <BoardActionError action={action} />}
      <p className="board-action-status" role="status">
        {action.status}
      </p>
      {limitOpen && (
        <AccessibleDialog
          label="Límite de columna"
          className="column-limit-dialog"
          onClose={() => {
            if (!pending) setLimitOpen(false);
          }}
        >
          <form onSubmit={saveLimit}>
            <div>
              <h3>Límite de columna</h3>
              <button
                type="button"
                aria-label="Cerrar"
                disabled={pending}
                onClick={() => setLimitOpen(false)}
              >
                ×
              </button>
            </div>
            <p>Define el mínimo y máximo de tareas permitidas en esta columna.</p>
            <label>
              Mínimo
              <input
                name="minimum"
                disabled={pending}
                type="number"
                min="0"
                defaultValue={column.minItems ?? ''}
                placeholder="Sin límite"
              />
            </label>
            <label>
              Máximo
              <input
                name="maximum"
                disabled={pending}
                type="number"
                min="1"
                defaultValue={column.maxItems ?? ''}
                placeholder="Sin límite"
              />
            </label>
            <BoardActionError action={action} />
            <footer>
              <button type="button" disabled={pending} onClick={() => setLimitOpen(false)}>
                Cancelar
              </button>
              <button disabled={pending}>{pending ? 'Guardando…' : 'Guardar'}</button>
            </footer>
          </form>
        </AccessibleDialog>
      )}
      {children}
      {actor.role === 'ADMIN' && !creatingTask && (
        <button
          className="column-create-task"
          ref={createButton}
          disabled={pending}
          onClick={() => setCreatingTask(true)}
        >
          ＋ Crear
        </button>
      )}
      {creatingTask && (
        <form className="column-create-form" onSubmit={createTask}>
          <input
            name="title"
            aria-label={`Título de nueva tarea en ${column.name}`}
            disabled={pending}
            autoFocus
            placeholder="¿Qué hay que hacer?"
            required
          />
          <div className="column-create-actions">
            <span aria-hidden="true">
              <Bookmark size={15} />
            </span>
            <span aria-hidden="true">
              <ChevronDown size={15} />
            </span>
            <span aria-hidden="true">
              <CalendarDays size={15} />
            </span>
            <span aria-hidden="true">
              <UserRound size={15} />
            </span>
            <button type="submit" disabled={pending}>
              {pending ? 'Creando…' : 'Crear'}
            </button>
            <button
              type="button"
              aria-label="Cancelar creación"
              disabled={pending}
              onClick={() => {
                restoreCreateFocus.current = true;
                setCreatingTask(false);
              }}
            >
              ×
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
function Card({
  item,
  onMove,
  onOpen,
  columns,
  people,
  onChanged,
  boardPending,
  detailOpen,
}: {
  item: WorkItem;
  onMove: (columnId: string) => void;
  onOpen: () => void;
  columns: BoardColumn[];
  people: Person[];
  onChanged: () => Promise<boolean>;
  boardPending: boolean;
  detailOpen: boolean;
}) {
  const { actor, repository } = useDemo();
  const action = useBoardAction(onChanged);
  const pending = action.pending || boardPending;
  const canMove = can(actor, 'task.move', item);
  const canAssign = can(actor, 'task.assign', item);
  const quickActionsDisabled = pending || detailOpen;
  const hintId = detailOpen ? `task-action-hint-${item.id}` : undefined;
  const {
    attributes,
    listeners,
    setNodeRef: dragRef,
    isDragging,
  } = useDraggable({ id: item.id, disabled: !canMove || quickActionsDisabled });
  const { setNodeRef: dropRef, isOver } = useDroppable({ id: item.id, data: { kind: 'task' } });
  const ref = (node: HTMLElement | null) => {
    dragRef(node);
    dropRef(node);
  };
  return (
    <article
      ref={ref}
      className="task-card"
      data-dragging={isDragging || undefined}
      data-over={isOver || undefined}
      aria-busy={pending}
    >
      {canMove && (
        <button
          className="task-grip"
          disabled={quickActionsDisabled}
          aria-label={`Arrastrar ${item.title}`}
          {...attributes}
          {...listeners}
          aria-describedby={hintId ?? attributes['aria-describedby']}
        >
          ↕
        </button>
      )}
      <button className="task-open" disabled={pending} onClick={onOpen}>
        {item.key} · {item.title}
      </button>
      <small>
        {priorityLabel[item.priority]} · {typeLabel[item.type]}
      </small>
      {canAssign ? (
        <label className="task-assignee">
          <svg aria-hidden="true" viewBox="0 0 24 24">
            <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm0 2c-4.2 0-7 2.1-7 4.5V20h14v-1.5C19 16.1 16.2 14 12 14Z" />
          </svg>
          <select
            aria-label={`Asignar ${item.title}`}
            aria-describedby={hintId}
            disabled={quickActionsDisabled}
            value={item.assigneeId ?? ''}
            onChange={(event) =>
              void action.run(
                () =>
                  repository.updateWorkItem(item.id, {
                    version: item.version,
                    assigneeId: event.target.value || undefined,
                  }),
                'Responsable actualizado.',
              )
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
      ) : (
        <span className="task-assignee">
          {people.find((person) => person.id === item.assigneeId)?.displayName ?? 'Sin asignar'}
        </span>
      )}
      {canMove && (
        <label className="task-move">
          <span>Mover a</span>
          <select
            id={`move-task-${item.id}`}
            aria-label={`Mover ${item.title} a`}
            value={item.columnId}
            aria-describedby={hintId}
            disabled={quickActionsDisabled}
            onChange={(event) => onMove(event.target.value)}
          >
            {columns.map((column) => (
              <option key={column.id} value={column.id}>
                {column.name}
              </option>
            ))}
          </select>
        </label>
      )}
      {detailOpen && (canAssign || canMove) && (
        <small id={hintId} className="task-action-hint">
          Cierra el detalle para {canAssign ? 'asignar o mover' : 'mover'} esta tarea.
        </small>
      )}
      <BoardActionError action={action} />
      <p className="board-action-status" role="status">
        {action.status}
      </p>
    </article>
  );
}

function BoardControls({
  boards,
  current,
  projectId,
  onSelect,
  onChanged,
}: {
  boards: Board[];
  current: Board | null;
  projectId: string;
  onSelect: (id: string) => void;
  onChanged: () => Promise<boolean>;
}) {
  const { phId, actor, repository } = useDemo();
  const action = useBoardAction(onChanged);
  const manage = can(actor, 'board.manage', { phId, projectId });
  const [open, setOpen] = useState(false);
  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = String(new FormData(event.currentTarget).get('name'));
    if (!manage) return;
    void action
      .run(
        () =>
          current
            ? repository.updateBoard(current.id, { version: current.version, name })
            : repository.createBoard({ phId, projectId, name, teamIds: [] }),
        'Tablero guardado.',
      )
      .then((saved) => {
        if (saved) setOpen(false);
      });
  };
  const create = async () => {
    if (!manage) return;
    let createdId = '';
    const saved = await action.run(async () => {
      const created = await repository.createBoard({
        phId,
        projectId,
        name: 'Nuevo tablero',
        teamIds: [],
      });
      createdId = created.id;
    }, 'Tablero creado.');
    if (saved) onSelect(createdId);
  };
  return (
    <section className="board-controls">
      <label>
        Tablero
        <select
          value={current?.id ?? ''}
          disabled={action.pending || !boards.length}
          onChange={(event) => onSelect(event.target.value)}
        >
          {boards.map((entry) => (
            <option key={entry.id} value={entry.id}>
              {entry.name}
            </option>
          ))}
        </select>
      </label>
      {manage && (
        <>
          <Button type="button" variant="secondary" disabled={action.pending} onClick={create}>
            Nuevo tablero
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={action.pending}
            onClick={() => setOpen(!open)}
          >
            {open ? 'Cancelar' : 'Administrar tablero'}
          </Button>
        </>
      )}
      <BoardActionError action={action} />
      <p className="board-action-status" role="status">
        {action.status}
      </p>
      {manage && open && (
        <form className="board-editor" onSubmit={submit}>
          <label>
            Nombre
            <input name="name" defaultValue={current?.name} disabled={action.pending} required />
          </label>
          <Button disabled={action.pending}>{action.pending ? 'Guardando…' : 'Guardar'}</Button>
          {current && (
            <Button
              type="button"
              variant="danger"
              disabled={action.pending}
              onClick={() => {
                if (window.confirm(`¿Eliminar ${current.name}?`))
                  void action
                    .run(
                      () => repository.deleteBoard(phId, current.id, current.version),
                      'Tablero eliminado.',
                    )
                    .then((saved) => {
                      if (saved) setOpen(false);
                    });
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
  const { phId, actor } = useDemo();
  const params = useSearchParams();
  const taskId = params.get('taskId');
  if (params.get('phId') && params.get('phId') !== phId) {
    return (
      <section className="workspace-page">
        <h1>Enlace de otra propiedad</h1>
        <p role="alert">Selecciona la propiedad correspondiente y vuelve a abrir el enlace.</p>
        <Link href="/notificaciones">Volver a notificaciones</Link>
      </section>
    );
  }
  if (taskId && (!params.get('projectId') || !params.get('board'))) {
    return <TaskLinkResolver key={`${phId}:${actor.id}:${actor.role}:${taskId}`} taskId={taskId} />;
  }
  // A new scope must never render the previous property's tasks or drafts.
  const scope = [phId, actor.id, actor.role, params.get('projectId'), params.get('board')].join(
    ':',
  );
  return <OperationalBoardContent key={scope} />;
}

function TaskLinkResolver({ taskId }: { taskId: string }) {
  const { phId, repository } = useDemo();
  const router = useRouter();
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    void resolveTaskLink(repository, phId, taskId)
      .then((href) => {
        if (active) router.replace(href, { scroll: false });
      })
      .catch(() => {
        if (active) setError(true);
      });
    return () => {
      active = false;
    };
  }, [phId, repository, router, taskId, attempt]);
  return (
    <section className="workspace-page">
      <h1>Abrir tarea</h1>
      {error ? (
        <>
          <p role="alert">
            No se pudo abrir la tarea. Puede que ya no exista, no tengas acceso o haya fallado la
            conexión.
          </p>
          <Button
            onClick={() => {
              setError(false);
              setAttempt((value) => value + 1);
            }}
          >
            Reintentar
          </Button>
          <Link href="/notificaciones">Volver a notificaciones</Link>
        </>
      ) : (
        <p role="status">Buscando la tarea…</p>
      )}
    </section>
  );
}

function OperationalBoardContent() {
  const { phId, actor, repository } = useDemo();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const boardId = params.get('board');
  const projectId = params.get('projectId') ?? demoIds.opsProject;
  const taskId = params.get('taskId');
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
  const [dirty, setDirty] = useState(false);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dropId, setDropId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const loadRequest = useRef(0);
  const previousTaskId = useRef(taskId);
  const moveFocus = useRef<{ id: string; source: Element } | null>(null);
  const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor));
  const load = useCallback(() => {
    const request = ++loadRequest.current;
    return repository
      .listBoards({ phId, projectId })
      .then(async (nextBoards) => {
        if (request !== loadRequest.current) return false;
        const nextBoard = boardId
          ? nextBoards.find((entry) => entry.id === boardId)
          : nextBoards[0];
        if (!nextBoard) {
          setError(
            taskId || boardId
              ? 'El tablero o la tarea no están disponibles en este proyecto.'
              : null,
          );
          setBoards(nextBoards);
          setBoard(null);
          setColumns([]);
          setItems([]);
          setPeople([]);
          setTeams([]);
          setProviders([]);
          setPolicy(undefined);
          setSelected(null);
          setDirty(false);
          return true;
        }
        const [nextColumns, page, nextPolicy, nextPeople, nextTeams, nextProviders] =
          await Promise.all([
            repository.listBoardColumns({ phId, boardId: nextBoard.id }),
            listAllWorkItems(repository, { phId, boardId: nextBoard.id }),
            repository.getValidationPolicy(phId, nextBoard.projectId),
            repository.listPeople({ phId }),
            repository.listTeams({ phId }),
            repository.listProviders({ phId }),
          ]);
        if (request !== loadRequest.current) return false;
        const linkedTask = taskId ? page.items.find((item) => item.id === taskId) : undefined;
        setError(
          taskId && !linkedTask
            ? 'La tarea no está disponible en este tablero o no tienes acceso.'
            : null,
        );
        setBoards(nextBoards);
        setBoard(nextBoard);
        setColumns(nextColumns);
        setItems(page.items);
        setPolicy(nextPolicy);
        setPeople(nextPeople);
        setTeams(nextTeams);
        setProviders(nextProviders);
        const changedTask = previousTaskId.current !== taskId;
        previousTaskId.current = taskId;
        setSelected((current) =>
          taskId
            ? (linkedTask ?? null)
            : changedTask
              ? null
              : current
                ? (page.items.find((item) => item.id === current.id) ?? null)
                : null,
        );
        return true;
      })
      .catch((failure: RepositoryError) => {
        if (request === loadRequest.current) setError(failure.message);
        return false;
      })
      .finally(() => {
        if (request === loadRequest.current) setLoading(false);
      });
  }, [boardId, phId, projectId, repository, taskId]);
  const action = useBoardAction(load);
  useEffect(() => {
    if (action.pending || !moveFocus.current) return;
    const { id, source } = moveFocus.current;
    moveFocus.current = null;
    if (document.activeElement === document.body || document.activeElement === source)
      document.getElementById(`move-task-${id}`)?.focus();
  }, [items, action.pending]);
  useEffect(() => {
    load();
    return () => {
      loadRequest.current += 1;
    };
  }, [load]);
  useEffect(() => {
    if (!dirty) return;
    const leave = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    const followLink = (event: MouseEvent) => {
      const link = event.target instanceof Element ? event.target.closest('a[href]') : null;
      if (
        !(link instanceof HTMLAnchorElement) ||
        link.target === '_blank' ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        event.altKey ||
        event.button !== 0
      )
        return;
      if (!window.confirm('Tienes cambios sin guardar. ¿Descartarlos y continuar?')) {
        event.preventDefault();
        event.stopPropagation();
      } else if (selected) {
        taskDrafts.delete(taskDraftKey(phId, actor.id, actor.role, selected.id));
      }
    };
    window.addEventListener('beforeunload', leave);
    document.addEventListener('click', followLink, true);
    return () => {
      window.removeEventListener('beforeunload', leave);
      document.removeEventListener('click', followLink, true);
    };
  }, [dirty, selected, phId, actor.id, actor.role]);
  const openTask = (item: WorkItem | null) => {
    if (item?.id === selected?.id) return;
    if (dirty && !window.confirm('Tienes cambios sin guardar. ¿Descartarlos y continuar?')) return;
    if (selected) taskDrafts.delete(taskDraftKey(phId, actor.id, actor.role, selected.id));
    setDirty(false);
    setSelected(item);
    const next = new URLSearchParams(params);
    next.set('phId', phId);
    next.set('projectId', projectId);
    if (board) next.set('board', board.id);
    if (item) next.set('taskId', item.id);
    else next.delete('taskId');
    if (item) router.push(`${pathname}?${next}`, { scroll: false });
    else router.replace(`${pathname}?${next}`, { scroll: false });
  };
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
          (!q || `${item.key} ${item.title} ${item.description ?? ''}`.toLowerCase().includes(q)) &&
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
            ? typeLabel[item.type]
            : group === 'priority'
              ? priorityLabel[item.priority]
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
    if (!target || item.id === selected?.id || !can(actor, 'task.move', item)) return;
    const check = checkWorkItemTransition(item, target, policy);
    if (!check.allowed) {
      setError(check.message ?? 'La transición no está permitida.');
      return;
    }
    if (document.activeElement?.id === `move-task-${item.id}`)
      moveFocus.current = { id: item.id, source: document.activeElement };
    setError(null);
    void action.run(
      () =>
        repository.moveWorkItem({ id: item.id, phId, columnId, position, version: item.version }),
      `${item.key} movida a ${target.name}.`,
    );
  };
  const dragEnd = (event: DragEndEvent) => {
    setDraggedId(null);
    setDropId(null);
    const activeId = String(event.active.id);
    const item = items.find((candidate) => candidate.id === event.active.id);
    const overId = String(event.over?.id ?? '');
    if (activeId.startsWith('column:')) {
      if (!board || !can(actor, 'board.manage', board)) return;
      const columnId = activeId.slice('column:'.length);
      const targetId = columns.some((column) => column.id === overId)
        ? overId
        : items.find((candidate) => candidate.id === overId)?.columnId;
      if (!targetId || columnId === targetId) return;
      const reordered = [...columns];
      const from = reordered.findIndex((column) => column.id === columnId);
      const to = reordered.findIndex((column) => column.id === targetId);
      if (from < 0 || to < 0) return;
      const [moved] = reordered.splice(from, 1);
      reordered.splice(to, 0, moved!);
      setError(null);
      void action.run(
        () =>
          repository.reorderBoardColumns(
            phId,
            board?.id ?? '',
            reordered.map((column) => column.id),
          ),
        `${moved!.name} movida a la posición ${to + 1}.`,
      );
      return;
    }
    if (!item) return;
    const targetItem = items.find((candidate) => candidate.id === overId);
    if (targetItem) {
      if (targetItem.id === item.id) return;
      const remaining = items
        .filter((entry) => entry.columnId === targetItem.columnId && entry.id !== item.id)
        .sort((a, b) => a.position - b.position);
      move(
        item,
        targetItem.columnId,
        remaining.findIndex((entry) => entry.id === targetItem.id),
      );
    } else if (columns.some((column) => column.id === overId)) move(item, overId);
  };
  const moveColumn = (columnId: string, offset: number) => {
    if (!board || !can(actor, 'board.manage', board)) return;
    const reordered = [...columns];
    const from = reordered.findIndex((column) => column.id === columnId);
    const to = from + offset;
    if (from < 0 || to < 0 || to >= reordered.length) return;
    [reordered[from], reordered[to]] = [reordered[to]!, reordered[from]!];
    setError(null);
    void action.run(
      () =>
        repository.reorderBoardColumns(
          phId,
          board.id,
          reordered.map((column) => column.id),
        ),
      `${columns[from]!.name} movida a la posición ${to + 1}.`,
    );
  };
  const createColumn = () => {
    if (!board || !can(actor, 'board.manage', board)) return;
    setError(null);
    void action.run(
      () =>
        repository.createBoardColumn({
          phId,
          boardId: board.id,
          name: 'Nueva columna',
          category: 'TODO',
          color: '#64748B',
          position: columns.length,
        }),
      'Columna creada.',
    );
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
    if (dirty && !window.confirm('Tienes cambios sin guardar. ¿Descartarlos y continuar?')) return;
    if (selected) taskDrafts.delete(taskDraftKey(phId, actor.id, actor.role, selected.id));
    const next = new URLSearchParams(params);
    next.set('board', id);
    next.delete('taskId');
    router.replace(`${pathname}?${next}`);
  };
  return (
    <section className="workspace-page board-page">
      <div className="toolbar">
        <div>
          <p className="eyebrow">
            {pathname.startsWith('/administrativa')
              ? 'Gestión administrativa'
              : pathname.startsWith('/contabilidad')
                ? 'Gestión de contabilidad'
                : 'Gestión operativa'}
          </p>
          <h1 tabIndex={-1}>{board?.name ?? 'Tablero'}</h1>
        </div>
      </div>
      <p className="sr-only" role="status" aria-live="polite">
        {announcement}
      </p>
      <p className="board-action-status" role="status">
        {action.pending ? 'Guardando cambio…' : action.status}
      </p>
      <BoardControls
        boards={boards}
        current={board}
        projectId={projectId}
        onSelect={selectBoard}
        onChanged={load}
      />
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
                {typeLabel[entry as WorkItem['type']]}
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
      <BoardActionError action={action} />
      {loading && !board && <p role="status">Cargando tablero…</p>}
      {!loading && !board && !error && (
        <p role="status">
          Este proyecto no tiene tableros.{' '}
          {actor.role === 'ADMIN'
            ? 'Crea un tablero para organizar sus tareas.'
            : 'Solicita un tablero a la administración.'}
        </p>
      )}
      {(error || action.error) && (
        <Button
          variant="secondary"
          disabled={action.pending}
          onClick={() => {
            setError(null);
            action.setError('');
            setLoading(true);
            load();
          }}
        >
          Reintentar
        </Button>
      )}
      <DndContext
        sensors={sensors}
        collisionDetection={boardCollision}
        onDragStart={({ active }) => setDraggedId(String(active.id))}
        onDragOver={({ over }) => setDropId(over ? String(over.id) : null)}
        onDragCancel={() => {
          setDraggedId(null);
          setDropId(null);
        }}
        onDragEnd={dragEnd}
      >
        <div className="kanban" aria-label="Tablero de tareas">
          {columns.map((column, index) => (
            <Column
              key={column.id}
              column={column}
              projectId={board?.projectId ?? projectId}
              itemCount={items.filter((item) => item.columnId === column.id).length}
              canMoveLeft={index > 0}
              canMoveRight={index < columns.length - 1}
              onMove={(offset) => moveColumn(column.id, offset)}
              onChanged={load}
              boardPending={action.pending}
              dropSide={
                dropId === column.id ||
                items.find((item) => item.id === dropId)?.columnId === column.id
                  ? draggedId?.startsWith('column:')
                    ? draggedId === `column:${column.id}`
                      ? undefined
                      : columns.findIndex((entry) => `column:${entry.id}` === draggedId) < index
                        ? 'after'
                        : 'before'
                    : 'inside'
                  : undefined
              }
            >
              {grouped[column.id]?.map(([label, groupedItems]) => (
                <section className="kanban-group" key={label}>
                  <h3>{group === 'none' ? undefined : label}</h3>
                  {groupedItems.map((item) => (
                    <Card
                      key={item.id}
                      item={item}
                      columns={columns}
                      people={people}
                      onChanged={load}
                      boardPending={action.pending}
                      detailOpen={selected?.id === item.id}
                      onOpen={() => openTask(item)}
                      onMove={(columnId) => move(item, columnId)}
                    />
                  ))}
                </section>
              ))}
            </Column>
          ))}
          {actor.role === 'ADMIN' && board && (
            <button className="kanban-add-column" disabled={action.pending} onClick={createColumn}>
              + Añadir columna
            </button>
          )}
        </div>
        <DragOverlay dropAnimation={null} transition="" zIndex={100}>
          {draggedId && (
            <div
              className={`board-drag-preview ${draggedId.startsWith('column:') ? 'board-drag-preview--column' : ''}`}
              aria-hidden="true"
            >
              {draggedId.startsWith('column:') ? (
                <>
                  <div className="board-drag-preview__heading">
                    <GripVertical size={16} />
                    {columns.find((entry) => `column:${entry.id}` === draggedId)?.name}
                  </div>
                  <small>Mover columna</small>
                  {visible
                    .filter((entry) => `column:${entry.columnId}` === draggedId)
                    .slice(0, 3)
                    .map((entry) => (
                      <div className="board-drag-preview__card" key={entry.id}>
                        <small>{entry.key}</small>
                        <strong>{entry.title}</strong>
                      </div>
                    ))}
                </>
              ) : (
                <>
                  <small>{items.find((entry) => entry.id === draggedId)?.key}</small>
                  <strong>{items.find((entry) => entry.id === draggedId)?.title}</strong>
                  <small>Soltar para mover</small>
                </>
              )}
            </div>
          )}
        </DragOverlay>
      </DndContext>
      {selected && (!taskId || selected.id === taskId) && (
        <TaskEditor
          key={selected.id}
          item={selected}
          onClose={() => openTask(null)}
          onChanged={load}
          onDirtyChange={setDirty}
        />
      )}
    </section>
  );
}

function TaskEditor({
  item,
  onClose,
  onChanged,
  onDirtyChange,
}: {
  item: WorkItem;
  onClose: () => void;
  onChanged: () => void;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const { phId, actor, repository } = useDemo();
  const [subtask, setSubtask] = useState(false);
  const [detailError, onError] = useState('');
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  const [subtasks, setSubtasks] = useState<WorkItem[]>([]);
  const [comments, setComments] = useState<WorkComment[]>([]);
  const [attachments, setAttachments] = useState<WorkAttachment[]>([]);
  const [activity, setActivity] = useState<WorkActivity[]>([]);
  const draftKey = taskDraftKey(phId, actor.id, actor.role, item.id);
  const [initialDraft] = useState(() => taskDrafts.get(draftKey));
  const [savedDraft, setSavedDraft] = useState<TaskDraft>(
    () =>
      initialDraft?.base ?? {
        title: item.title,
        description: item.description ?? '',
        priority: item.priority,
        blockedReason: item.blockedReason ?? '',
      },
  );
  const [draft, setDraft] = useState<TaskDraft>(() => initialDraft?.draft ?? savedDraft);
  const [version, setVersion] = useState(initialDraft?.version ?? item.version);
  const changeDraft = (next: TaskDraft) => {
    setDraft(next);
    if (JSON.stringify(next) === JSON.stringify(savedDraft)) taskDrafts.delete(draftKey);
    else taskDrafts.set(draftKey, { draft: next, base: savedDraft, version });
  };
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState(
    initialDraft ? 'Borrador recuperado de esta sesión. Revisa los cambios antes de guardar.' : '',
  );
  const isDirty = Object.keys(draft).some(
    (key) => draft[key as keyof typeof draft] !== savedDraft[key as keyof typeof draft],
  );
  useEffect(() => {
    onDirtyChange(isDirty);
  }, [isDirty, onDirtyChange]);
  const loadDetail = useCallback(() => {
    void Promise.all([
      repository.listWorkItems({ phId, boardId: item.boardId, parentId: item.id }),
      repository.listComments(phId, item.id),
      repository.listAttachments(phId, item.id),
      repository.listActivity(phId, item.id),
    ])
      .then(([nextSubtasks, nextComments, nextAttachments, nextActivity]) => {
        if (!active.current) return;
        setSubtasks(nextSubtasks.items);
        setComments(nextComments);
        setAttachments(nextAttachments);
        setActivity(nextActivity);
      })
      .catch((failure: RepositoryError) => {
        if (active.current) onError(failure.message);
      });
  }, [item.boardId, item.id, onError, phId, repository]);
  useEffect(loadDetail, [loadDetail]);
  const save = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving) return;
    const submittedDraft = taskDrafts.get(draftKey);
    setSaving(true);
    onError('');
    setNotice('');
    void repository
      .updateWorkItem(item.id, {
        version,
        title: draft.title,
        description: draft.description || undefined,
        priority: draft.priority,
        blockedReason: draft.blockedReason || undefined,
      })
      .then((updated) => {
        if (taskDrafts.get(draftKey) === submittedDraft) taskDrafts.delete(draftKey);
        if (!active.current) return;
        setVersion(updated.version);
        setSavedDraft(draft);
        setNotice('Cambios guardados.');
        onChanged();
      })
      .catch((failure: RepositoryError) => {
        if (active.current) onError(failure.message);
      })
      .finally(() => {
        if (active.current) setSaving(false);
      });
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
        if (!active.current) return;
        setSubtask(false);
        loadDetail();
        onChanged();
      })
      .catch((failure: RepositoryError) => {
        if (active.current) onError(failure.message);
      });
  };
  const comment = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const body = String(new FormData(form).get('body'));
    void repository
      .addComment({ phId, workItemId: item.id, body })
      .then(() => {
        if (!active.current) return;
        form.reset();
        loadDetail();
      })
      .catch((failure: RepositoryError) => {
        if (active.current) onError(failure.message);
      });
  };
  const attach = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const name = String(new FormData(form).get('name'));
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
        if (!active.current) return;
        form.reset();
        loadDetail();
      })
      .catch((failure: RepositoryError) => {
        if (active.current) onError(failure.message);
      });
  };
  const remove = () => {
    if (
      !window.confirm(
        `¿Eliminar la tarea ${item.key}? También se eliminarán sus subtareas y actividad.`,
      )
    )
      return;
    void repository
      .deleteWorkItem(phId, item.id, version)
      .then(() => {
        taskDrafts.delete(draftKey);
        if (!active.current) return;
        onClose();
        onChanged();
      })
      .catch((failure: RepositoryError) => {
        if (active.current) onError(failure.message);
      });
  };
  return (
    <AccessibleDialog
      className="task-detail-dialog"
      label={`Detalle de ${item.title}`}
      onClose={onClose}
      returnFocusSelector=".board-page h1"
    >
      <header className="task-detail-header">
        <div>
          <span className="task-detail-eyebrow">{typeLabel[item.type]}</span>
          <h2 tabIndex={-1} data-autofocus>
            {item.key}
          </h2>
        </div>
        <button type="button" className="task-detail-close" aria-label="Cerrar" onClick={onClose}>
          <X size={20} aria-hidden="true" />
        </button>
      </header>
      <div className="task-detail-body">
        {detailError && (
          <p className="inline-error" role="alert">
            {detailError}
          </p>
        )}
        {notice && (
          <p className="task-detail-notice" role="status">
            {notice}
          </p>
        )}
        <section className="task-detail-section" aria-label="Información de la tarea">
          <form id={`task-edit-${item.id}`} className="task-detail-form" onSubmit={save}>
            <label className="task-detail-wide">
              Título
              <input
                name="title"
                value={draft.title}
                onChange={(event) => changeDraft({ ...draft, title: event.target.value })}
                disabled={saving}
                required
              />
            </label>
            <label>
              Prioridad
              <select
                name="priority"
                value={draft.priority}
                onChange={(event) =>
                  changeDraft({ ...draft, priority: event.target.value as WorkItem['priority'] })
                }
                disabled={saving}
              >
                {['LOW', 'MEDIUM', 'HIGH', 'URGENT'].map((entry) => (
                  <option key={entry} value={entry}>
                    {priorityLabel[entry as WorkItem['priority']]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Motivo de bloqueo
              <input
                name="blockedReason"
                value={draft.blockedReason}
                onChange={(event) => changeDraft({ ...draft, blockedReason: event.target.value })}
                disabled={saving}
              />
            </label>
            <label className="task-detail-wide">
              <span>Descripción</span>
              <textarea
                name="description"
                value={draft.description}
                onChange={(event) => changeDraft({ ...draft, description: event.target.value })}
                disabled={saving}
              />
            </label>
          </form>
        </section>
        <section className="task-detail-section" aria-label="Subtareas">
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
            <form className="task-detail-form" onSubmit={createSubtask}>
              <label>
                Título
                <input name="title" required />
              </label>
              <Button>Guardar subtarea</Button>
            </form>
          )}
        </section>
        <section className="task-detail-section" aria-label="Comentarios">
          <h3>Comentarios</h3>
          <form className="task-detail-form" onSubmit={comment}>
            <label className="task-detail-wide">
              <span>Comentario</span>
              <textarea name="body" required />
            </label>
            <Button variant="secondary">Publicar comentario</Button>
          </form>
          <ul>
            {comments.map((entry) => (
              <li key={entry.id}>{entry.body}</li>
            ))}
          </ul>
        </section>
        <section className="task-detail-section" aria-label="Adjuntos">
          <h3>Adjuntos</h3>
          <p className="task-detail-hint">
            Demo: registra el nombre del adjunto; no sube archivos.
          </p>
          <form className="task-detail-form" onSubmit={attach}>
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
        </section>
        <section className="task-detail-section" aria-label="Actividad">
          <h3>Actividad</h3>
          <ul>
            {activity.map((entry) => (
              <li key={entry.id}>{entry.message}</li>
            ))}
          </ul>
        </section>
      </div>
      <footer className="task-detail-footer">
        <Button type="button" variant="danger" disabled={saving} onClick={remove}>
          Eliminar tarea
        </Button>
        <span className="task-detail-save-state">
          {isDirty ? 'Cambios sin guardar' : 'Sin cambios pendientes'}
        </span>
        <Button type="submit" form={`task-edit-${item.id}`} disabled={saving}>
          {saving ? 'Guardando…' : 'Guardar cambios'}
        </Button>
      </footer>
    </AccessibleDialog>
  );
}
