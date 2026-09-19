'use client';
/* eslint-disable react-hooks/set-state-in-effect -- repository reads occur after client mount. */

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { demoIds, type RepositoryError } from '@task-manager/data';
import { Button, ConflictState, StatusBadge } from '../../../../packages/ui/src/index';
import type { BoardColumn, Person, Project, Team, WorkItem } from '@task-manager/shared';
import { useDemo } from './demo-context';
import { OperationalBoard } from './operational-board';

const moduleBySegment: Record<string, Project['module']> = {
  administrativa: 'ADMINISTRATIVE',
  operaciones: 'OPERATIONS',
  contabilidad: 'ACCOUNTING',
};
const moduleName: Record<Project['module'], string> = {
  ADMINISTRATIVE: 'Gestión administrativa',
  OPERATIONS: 'Gestión operativa',
  ACCOUNTING: 'Gestión de contabilidad',
};
const templates: Record<Project['module'], { name: string; description: string }> = {
  ADMINISTRATIVE: {
    name: 'Atención administrativa',
    description: 'Solicitudes, comunicaciones y coordinación administrativa.',
  },
  OPERATIONS: {
    name: 'Operación del edificio',
    description: 'Mantenimiento, limpieza, seguridad e incidencias.',
  },
  ACCOUNTING: {
    name: 'Seguimientos de cobro',
    description: 'Cuentas por cobrar y seguimiento contable.',
  },
};
const teamTypes: Team['type'][] = [
  'ADMINISTRATION',
  'OPERATIONS',
  'CLEANING',
  'MAINTENANCE',
  'SECURITY',
  'ACCOUNTING',
  'OTHER',
];

function ErrorNotice({ error, onRetry }: { error: RepositoryError | null; onRetry?: () => void }) {
  if (!error) return null;
  if (error.code === 'CONFLICT')
    return <ConflictState onReload={() => window.location.reload()} onRetry={onRetry} />;
  return (
    <section className="tm-state tm-state--error" role="alert">
      <p>{error.message}</p>
      {onRetry && (
        <Button variant="secondary" onClick={onRetry}>
          Reintentar
        </Button>
      )}
    </section>
  );
}
export function WorkspaceContent({ segments }: { segments: string[] }) {
  const { phId } = useDemo();
  const requestedPhId = useSearchParams().get('phId');
  if (requestedPhId && requestedPhId !== phId)
    return (
      <section className="tm-state tm-state--error" role="alert">
        <h2>Acceso denegado</h2>
        <p>
          Esta URL solicita una PH distinta de tu contexto permitido. Cambia al contexto autorizado
          desde el encabezado.
        </p>
      </section>
    );
  if (segments.includes('validaciones')) return <ValidationPanel />;
  if (segments.includes('tablero')) return <OperationalBoard />;
  if (segments.includes('tareas')) return <TaskPage />;
  const section = segments[0] ?? '';
  if (section === 'personas') return <PeoplePage />;
  if (section === 'equipos') return <TeamsPage />;
  if (!section) return <HomePage />;
  return <ProjectsPage module={moduleBySegment[section]} />;
}
function BoardPage() {
  const { phId, actor, repository } = useDemo();
  const params = useSearchParams();
  const [board, setBoard] = useState<import('@task-manager/shared').Board | null>(null);
  const [columns, setColumns] = useState<import('@task-manager/shared').BoardColumn[]>([]);
  const [items, setItems] = useState<WorkItem[]>([]);
  const [error, setError] = useState<RepositoryError | null>(null);
  const [creating, setCreating] = useState(false);
  const query = params.get('q')?.toLowerCase() ?? '';
  const load = useCallback(() => {
    setError(null);
    void repository
      .listBoards({ phId, projectId: demoIds.opsProject })
      .then(async (boards) => {
        const current = boards[0];
        if (!current) return;
        setBoard(current);
        const [nextColumns, page] = await Promise.all([
          repository.listBoardColumns({ phId, boardId: current.id }),
          repository.listWorkItems({ phId, boardId: current.id }),
        ]);
        setColumns(nextColumns);
        setItems(page.items);
      })
      .catch(setError);
  }, [phId, repository]);
  useEffect(load, [load]);
  const move = (item: WorkItem, columnId: string) =>
    void repository
      .moveWorkItem({
        id: item.id,
        phId,
        columnId,
        position: items.filter((next) => next.columnId === columnId).length,
        version: item.version,
      })
      .then(load)
      .catch(setError);
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
        key: `OPS-${items.length + 1}`,
        type: String(form.get('type')) as WorkItem['type'],
        title: String(form.get('title')),
        description: String(form.get('description')) || undefined,
        priority: String(form.get('priority')) as WorkItem['priority'],
        reporterId: actor.id,
        assigneeId: String(form.get('assignee')) || undefined,
        dependencyIds: [],
        requiresEvidence: false,
        requiresValidation: false,
        validationStatus: 'NOT_REQUIRED',
        position: items.length,
        labels: [],
      })
      .then(() => {
        setCreating(false);
        load();
      })
      .catch(setError);
  };
  const filtered = items.filter(
    (item) =>
      !query || `${item.key} ${item.title} ${item.description ?? ''}`.toLowerCase().includes(query),
  );
  return (
    <section className="workspace-page board-page">
      <div className="toolbar">
        <div>
          <p className="eyebrow">Tablero operativo</p>
          <h1>{board?.name ?? 'Cargando tablero…'}</h1>
        </div>
        {actor.role === 'ADMIN' && (
          <Button onClick={() => setCreating(!creating)}>
            {creating ? 'Cancelar' : 'Crear tarea'}
          </Button>
        )}
      </div>
      <form className="board-filter" action="">
        <label>
          Buscar tareas
          <input name="q" defaultValue={params.get('q') ?? ''} placeholder="Clave o título" />
        </label>
        <Button variant="secondary">Aplicar filtros</Button>
        <Link href="/operaciones/mantenimiento/tablero">Restablecer</Link>
      </form>
      {creating && (
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
              <option value="URGENT">Urgente</option>
            </select>
          </label>
          <label>
            Responsable
            <input name="assignee" placeholder="ID opcional" />
          </label>
          <label>
            <span>Descripción</span>
            <textarea name="description" />
          </label>
          <Button>Guardar tarea</Button>
        </form>
      )}
      {actor.role === 'ADMIN' && board && (
        <ColumnManager
          boardId={board.id}
          columns={columns}
          items={items}
          onChanged={load}
          onError={setError}
        />
      )}
      <ErrorNotice error={error} onRetry={load} />
      <div className="kanban" aria-label="Columnas del tablero">
        {columns.map((column) => (
          <section className="kanban-column" key={column.id}>
            <header>
              <span className="column-dot" style={{ background: column.color }} />
              <h2>{column.name}</h2>
              <span>{filtered.filter((item) => item.columnId === column.id).length}</span>
            </header>
            <div>
              {filtered
                .filter((item) => item.columnId === column.id)
                .sort((a, b) => a.position - b.position)
                .map((item) => (
                  <article className="task-card" key={item.id}>
                    <strong>
                      {item.key} · {item.title}
                    </strong>
                    <small>
                      {item.type} · {item.priority}
                    </small>
                    {item.blockedReason && <small>Bloqueada: {item.blockedReason}</small>}
                    <label>
                      Mover a
                      <select
                        aria-label={`Mover ${item.title}`}
                        value={item.columnId}
                        onChange={(event) => move(item, event.target.value)}
                      >
                        {columns.map((target) => (
                          <option key={target.id} value={target.id}>
                            {target.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  </article>
                ))}
            </div>
          </section>
        ))}
      </div>
    </section>
  );
}
function ColumnManager({
  boardId,
  columns,
  items,
  onChanged,
  onError,
}: {
  boardId: string;
  columns: BoardColumn[];
  items: WorkItem[];
  onChanged: () => void;
  onError: (error: RepositoryError) => void;
}) {
  const { phId, repository } = useDemo();
  const [open, setOpen] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const add = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    void repository
      .createBoardColumn({
        phId,
        boardId,
        name: String(form.get('name')),
        category: String(form.get('category')) as BoardColumn['category'],
        color: String(form.get('color')),
        position: columns.length,
      })
      .then(() => {
        setOpen(false);
        onChanged();
      })
      .catch(onError);
  };
  const shift = (id: string, offset: number) => {
    const from = columns.findIndex((column) => column.id === id);
    const to = from + offset;
    if (to < 0 || to >= columns.length) return;
    const order = [...columns];
    [order[from], order[to]] = [order[to]!, order[from]!];
    void repository
      .reorderBoardColumns(
        phId,
        boardId,
        order.map((column) => column.id),
      )
      .then(onChanged)
      .catch(onError);
  };
  const remove = (id: string, destinationColumnId?: string) =>
    void repository
      .deleteBoardColumn({
        phId,
        id,
        destinationColumnId,
        replacements: destinationColumnId
          ? {
              waitingColumnId: destinationColumnId,
              approvedColumnId: destinationColumnId,
              rejectedColumnId: destinationColumnId,
            }
          : undefined,
      })
      .then(() => {
        setRemoving(null);
        onChanged();
      })
      .catch(onError);
  return (
    <section className="column-manager">
      <div className="toolbar">
        <h2>Configurar columnas</h2>
        <Button variant="secondary" onClick={() => setOpen(!open)}>
          {open ? 'Cancelar' : 'Añadir columna'}
        </Button>
      </div>
      {open && (
        <form className="entity-form" onSubmit={add}>
          <label>
            Nombre
            <input name="name" required />
          </label>
          <label>
            Categoría
            <select name="category">
              <option value="TODO">Por hacer</option>
              <option value="IN_PROGRESS">En progreso</option>
              <option value="BLOCKED">Bloqueada</option>
              <option value="DONE">Terminada</option>
            </select>
          </label>
          <label>
            Color
            <input name="color" type="color" defaultValue="#4583BD" />
          </label>
          <Button>Crear columna</Button>
        </form>
      )}
      <ul className="entity-list">
        {columns.map((column, index) => (
          <li key={column.id}>
            <div>
              <strong>{column.name}</strong>
              <span>{column.category}</span>
            </div>
            <div>
              <Button variant="secondary" disabled={!index} onClick={() => shift(column.id, -1)}>
                Mover antes
              </Button>
              <Button
                variant="secondary"
                disabled={index === columns.length - 1}
                onClick={() => shift(column.id, 1)}
              >
                Mover después
              </Button>
              <Button variant="secondary" onClick={() => setRemoving(column.id)}>
                Eliminar
              </Button>
            </div>
            {removing === column.id && (
              <div className="inline-error">
                {items.some((item) => item.columnId === column.id) ? (
                  <label>
                    Migrar tareas a{' '}
                    <select
                      defaultValue=""
                      onChange={(event) => remove(column.id, event.target.value || undefined)}
                    >
                      <option value="">Elige destino</option>
                      {columns
                        .filter((target) => target.id !== column.id)
                        .map((target) => (
                          <option key={target.id} value={target.id}>
                            {target.name}
                          </option>
                        ))}
                    </select>
                  </label>
                ) : (
                  <>
                    <span>
                      La columna se eliminará. Si pertenece a una política, elige un reemplazo.
                    </span>
                    <select
                      defaultValue=""
                      onChange={(event) => remove(column.id, event.target.value || undefined)}
                    >
                      <option value="">Elegir reemplazo</option>
                      {columns
                        .filter((target) => target.id !== column.id)
                        .map((target) => (
                          <option key={target.id} value={target.id}>
                            {target.name}
                          </option>
                        ))}
                    </select>
                  </>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
function TaskPage() {
  const { phId, repository } = useDemo();
  const [items, setItems] = useState<WorkItem[]>([]);
  const [selected, setSelected] = useState<WorkItem | null>(null);
  const [error, setError] = useState<RepositoryError | null>(null);
  const load = useCallback(
    () =>
      void repository
        .listWorkItems({ phId, projectId: demoIds.opsProject })
        .then((page) => {
          setItems(page.items);
          setSelected((current) =>
            current ? (page.items.find((item) => item.id === current.id) ?? null) : null,
          );
        })
        .catch(setError),
    [phId, repository],
  );
  useEffect(load, [load]);
  const save = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selected) return;
    const form = new FormData(event.currentTarget);
    void repository
      .updateWorkItem(selected.id, {
        version: selected.version,
        title: String(form.get('title')),
        description: String(form.get('description')) || undefined,
        priority: String(form.get('priority')) as WorkItem['priority'],
        dueOn: String(form.get('dueOn')) || undefined,
        blockedReason: String(form.get('blockedReason')) || undefined,
      })
      .then(load)
      .catch(setError);
  };
  return (
    <section className="workspace-page">
      <p className="eyebrow">Trabajo operativo</p>
      <h1>Tareas</h1>
      <ErrorNotice error={error} onRetry={load} />
      <div className="task-detail-layout">
        <ul className="entity-list">
          {items.map((item) => (
            <li key={item.id}>
              <button className="tm-button tm-button--secondary" onClick={() => setSelected(item)}>
                {item.key} · {item.title}
              </button>
            </li>
          ))}
        </ul>
        {selected && (
          <>
            <form className="entity-form" onSubmit={save}>
              <h2>{selected.key}</h2>
              <label>
                Título
                <input name="title" required defaultValue={selected.title} />
              </label>
              <label>
                Prioridad
                <select name="priority" defaultValue={selected.priority}>
                  <option value="LOW">Baja</option>
                  <option value="MEDIUM">Media</option>
                  <option value="HIGH">Alta</option>
                  <option value="URGENT">Urgente</option>
                </select>
              </label>
              <label>
                Vence
                <input name="dueOn" type="date" defaultValue={selected.dueOn} />
              </label>
              <label>
                Motivo de bloqueo
                <input name="blockedReason" defaultValue={selected.blockedReason} />
              </label>
              <label>
                <span>Descripción</span>
                <textarea name="description" defaultValue={selected.description} />
              </label>
              <Button>Guardar cambios</Button>
            </form>
            <TaskCollaboration item={selected} onChanged={load} onError={setError} />
          </>
        )}
      </div>
    </section>
  );
}
function TaskCollaboration({
  item,
  onChanged,
  onError,
}: {
  item: WorkItem;
  onChanged: () => void;
  onError: (error: RepositoryError) => void;
}) {
  const { phId, repository } = useDemo();
  const [comments, setComments] = useState<import('@task-manager/shared').WorkComment[]>([]);
  const [attachments, setAttachments] = useState<import('@task-manager/shared').WorkAttachment[]>(
    [],
  );
  const [activity, setActivity] = useState<import('@task-manager/shared').WorkActivity[]>([]);
  const load = useCallback(() => {
    void Promise.all([
      repository.listComments(phId, item.id),
      repository.listAttachments(phId, item.id),
      repository.listActivity(phId, item.id),
    ])
      .then(([nextComments, nextAttachments, nextActivity]) => {
        setComments(nextComments);
        setAttachments(nextAttachments);
        setActivity(nextActivity);
      })
      .catch(onError);
  }, [item.id, onError, phId, repository]);
  useEffect(load, [load]);
  const comment = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const body = String(new FormData(event.currentTarget).get('body'));
    void repository
      .addComment({ phId, workItemId: item.id, body })
      .then(() => {
        event.currentTarget.reset();
        load();
        onChanged();
      })
      .catch(onError);
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
        load();
        onChanged();
      })
      .catch(onError);
  };
  return (
    <section className="task-collaboration">
      <h2>Colaboración y evidencia</h2>
      <form onSubmit={comment}>
        <label>
          Comentario
          <textarea name="body" required />
        </label>
        <Button>Publicar comentario</Button>
      </form>
      <form onSubmit={attach}>
        <label>
          Nombre de evidencia
          <input name="name" required placeholder="foto-bomba.jpg" />
        </label>
        <Button variant="secondary">Adjuntar evidencia</Button>
      </form>
      <h3>Adjuntos</h3>
      <ul>
        {attachments.map((attachment) => (
          <li key={attachment.id}>
            <a href={attachment.url}>{attachment.name}</a> · {attachment.sizeBytes} bytes
          </li>
        ))}
      </ul>
      <h3>Actividad</h3>
      <ul>
        {activity.map((event) => (
          <li key={event.id}>{event.message}</li>
        ))}
      </ul>
      <h3>Comentarios</h3>
      <ul>
        {comments.map((entry) => (
          <li key={entry.id}>{entry.body}</li>
        ))}
      </ul>
    </section>
  );
}
function ValidationPanel() {
  const { phId, actor, repository } = useDemo();
  const [items, setItems] = useState<WorkItem[] | null>(null);
  const [error, setError] = useState<RepositoryError | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const load = useCallback(() => {
    setError(null);
    void repository
      .listWorkItems({ phId, projectId: demoIds.opsProject })
      .then((page) => setItems(page.items))
      .catch(setError);
  }, [repository, phId]);
  useEffect(load, [load]);
  const submitEvidence = (item: WorkItem) =>
    void repository
      .submitEvidence({
        id: item.id,
        phId,
        version: item.version,
        evidenceUrl: `https://demo.local/evidence/${item.id}.jpg`,
      })
      .then(() => {
        setNotice('Evidencia enviada para revisión.');
        load();
      })
      .catch(setError);
  const review = (item: WorkItem, decision: 'APPROVED' | 'REJECTED') =>
    void repository
      .reviewWorkItem({
        id: item.id,
        phId,
        decision,
        comment:
          decision === 'REJECTED' ? 'La evidencia no permite validar el trabajo.' : undefined,
        version: item.version,
      })
      .then(() => {
        setNotice(
          decision === 'APPROVED' ? 'Trabajo aprobado.' : 'Trabajo rechazado con comentario.',
        );
        load();
      })
      .catch(setError);
  return (
    <section className="workspace-page">
      <p className="eyebrow">Gestión operativa</p>
      <h1>Validaciones</h1>
      <p>Demostración de evidencia y aprobación según el rol seleccionado.</p>
      {notice && <p role="status">{notice}</p>}
      {error && <ErrorNotice error={error} onRetry={load} />}
      {!items ? (
        <div className="tm-skeleton" />
      ) : items.length === 0 ? (
        <section className="tm-state">
          <h2>Sin resultados</h2>
          <p>No hay evidencias pendientes en este proyecto.</p>
        </section>
      ) : (
        <ul className="entity-list">
          {items.map((item) => (
            <li key={item.id}>
              <div>
                <strong>
                  {item.key} · {item.title}
                </strong>
                <span>
                  Evidencia: {item.evidenceUrl ? 'adjunta' : 'pendiente'} · Validación:{' '}
                  {item.validationStatus}
                </span>
                {item.validationComment && <small>{item.validationComment}</small>}
              </div>
              <div>
                {actor.role === 'ADMIN' ? (
                  <>
                    <Button
                      variant="secondary"
                      disabled={item.validationStatus !== 'PENDING'}
                      onClick={() => review(item, 'REJECTED')}
                    >
                      Rechazar
                    </Button>
                    <Button
                      disabled={item.validationStatus !== 'PENDING'}
                      onClick={() => review(item, 'APPROVED')}
                    >
                      Aprobar
                    </Button>
                  </>
                ) : (
                  <Button
                    disabled={item.assigneeId !== actor.id}
                    onClick={() => submitEvidence(item)}
                  >
                    Enviar evidencia
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
function HomePage() {
  const { phId, repository, phName } = useDemo();
  const [data, setData] = useState<{ projects: Project[]; people: Person[]; teams: Team[] } | null>(
    null,
  );
  const load = useCallback(() => {
    void Promise.all([
      repository.listProjects({ phId }),
      repository.listPeople({ phId }),
      repository.listTeams({ phId }),
    ]).then(([projects, people, teams]) => setData({ projects, people, teams }));
  }, [repository, phId]);
  useEffect(load, [load]);
  if (!data)
    return (
      <section className="tm-state" aria-busy="true">
        <p>Cargando inicio…</p>
      </section>
    );
  return (
    <section className="workspace-page">
      <p className="eyebrow">{phName}</p>
      <h1>Inicio del PH</h1>
      <p>Una vista contextual de los proyectos y equipos a los que tienes acceso.</p>
      <div className="metric-grid">
        <article>
          <strong>{data.projects.length}</strong>
          <span>Proyectos autorizados</span>
        </article>
        <article>
          <strong>{data.teams.length}</strong>
          <span>Equipos activos</span>
        </article>
        <article>
          <strong>{data.people.length}</strong>
          <span>Personas activas</span>
        </article>
      </div>
      <h2>Accesos rápidos</h2>
      <div className="quick-links">
        <Link href="/administrativa">Administración</Link>
        <Link href="/operaciones">Operaciones</Link>
        <Link href="/contabilidad">Contabilidad</Link>
        <Link href="/personas">Personas</Link>
        <Link href="/equipos">Equipos</Link>
      </div>
    </section>
  );
}
function ProjectsPage({ module }: { module?: Project['module'] }) {
  const { phId, actor, repository } = useDemo();
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [error, setError] = useState<RepositoryError | null>(null);
  const [creating, setCreating] = useState(false);
  const load = useCallback(() => {
    setError(null);
    void repository
      .listProjects({ phId, module, includeArchived: showArchived })
      .then(setProjects)
      .catch((e: RepositoryError) => setError(e));
  }, [repository, phId, module, showArchived]);
  useEffect(load, [load]);
  if (!module)
    return (
      <section className="tm-state">
        <h1>Vista en preparación</h1>
        <p>Esta sección no forma parte del alcance del épico de organización.</p>
      </section>
    );
  const archive = (project: Project) =>
    void repository
      .setProjectArchived(phId, project.id, project.status === 'ACTIVE', project.version)
      .then(load)
      .catch(setError);
  return (
    <section className="workspace-page">
      <p className="eyebrow">{moduleName[module]}</p>
      <h1>Proyectos</h1>
      <p>
        Plantilla disponible: {templates[module].name}.{' '}
        {module === 'ADMINISTRATIVE'
          ? 'No incluye contratos ni renovaciones.'
          : module === 'ACCOUNTING'
            ? 'Incluye seguimientos de cobro.'
            : ''}
      </p>
      <div className="toolbar">
        <label>
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => setShowArchived(e.target.checked)}
          />{' '}
          Mostrar archivados
        </label>
        {actor.role === 'ADMIN' && (
          <Button onClick={() => setCreating(!creating)}>
            {creating ? 'Cerrar formulario' : 'Crear proyecto'}
          </Button>
        )}
      </div>
      {creating && (
        <ProjectForm
          module={module}
          onDone={() => {
            setCreating(false);
            load();
          }}
          onError={setError}
        />
      )}
      {error?.code === 'ACCESS_DENIED' ? (
        <section className="tm-state tm-state--error">
          <h2>Acceso denegado</h2>
          <p>No tienes acceso a este módulo.</p>
        </section>
      ) : (
        <>
          <ErrorNotice error={error} onRetry={load} />
          {!projects ? (
            <div className="tm-skeleton" />
          ) : projects.length === 0 ? (
            <section className="tm-state">
              <h2>Sin proyectos</h2>
              <p>Crea un proyecto desde la plantilla del módulo.</p>
            </section>
          ) : (
            <ul className="project-list">
              {projects.map((project) => (
                <li key={project.id}>
                  <div>
                    <strong>
                      <i style={{ backgroundColor: project.color }} />
                      {project.key} · {project.name}
                    </strong>
                    <span>{project.description ?? 'Sin descripción'}</span>
                  </div>
                  <div>
                    {module === 'OPERATIONS' && (
                      <Link
                        className="tm-button tm-button--secondary"
                        href="/operaciones/mantenimiento/tablero"
                      >
                        Abrir tablero
                      </Link>
                    )}
                    <StatusBadge tone={project.status === 'ARCHIVED' ? 'warning' : 'success'}>
                      {project.status === 'ARCHIVED' ? 'Archivado' : 'Activo'}
                    </StatusBadge>
                    {actor.role === 'ADMIN' && (
                      <Button variant="secondary" onClick={() => archive(project)}>
                        {project.status === 'ACTIVE' ? 'Archivar' : 'Restaurar'}
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
function ProjectForm({
  module,
  onDone,
  onError,
}: {
  module: Project['module'];
  onDone: () => void;
  onError: (e: RepositoryError) => void;
}) {
  const { phId, repository } = useDemo();
  const temp = templates[module];
  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    void repository
      .createProject({
        phId,
        module,
        name: String(form.get('name')),
        key: String(form.get('key')),
        description: String(form.get('description')) || undefined,
        color: String(form.get('color')) || undefined,
      })
      .then(onDone)
      .catch(onError);
  };
  return (
    <form className="entity-form" onSubmit={submit}>
      <label>
        Nombre
        <input name="name" required defaultValue={temp.name} />
      </label>
      <label>
        Clave visible
        <input name="key" required maxLength={10} pattern="[A-Za-z]{2,10}" placeholder="EJ: OPS" />
      </label>
      <label>
        Descripción
        <textarea name="description" defaultValue={temp.description} />
      </label>
      <label>
        Color
        <input name="color" type="color" defaultValue="#4583bd" />
      </label>
      <Button type="submit">Guardar proyecto</Button>
    </form>
  );
}
function PeoplePage() {
  const { phId, actor, repository } = useDemo();
  const [people, setPeople] = useState<Person[] | null>(null);
  const [error, setError] = useState<RepositoryError | null>(null);
  const [creating, setCreating] = useState(false);
  const load = useCallback(
    () =>
      void repository.listPeople({ phId, includeInactive: true }).then(setPeople).catch(setError),
    [repository, phId],
  );
  useEffect(load, [load]);
  const visibleId = actor.role === 'ADMIN';
  return (
    <section className="workspace-page">
      <p className="eyebrow">Organización</p>
      <h1>Personas</h1>
      <p>Las tarjetas protegen el identificador personal; solo el rol administrativo lo revela.</p>
      <div className="toolbar">
        {actor.role === 'ADMIN' && (
          <Button onClick={() => setCreating(!creating)}>
            {creating ? 'Cerrar formulario' : 'Agregar persona'}
          </Button>
        )}
      </div>
      {creating && (
        <PersonForm
          onDone={() => {
            setCreating(false);
            load();
          }}
          onError={setError}
        />
      )}
      <ErrorNotice error={error} onRetry={load} />
      {!people ? (
        <div className="tm-skeleton" />
      ) : (
        <ul className="entity-list">
          {people.map((person) => (
            <li key={person.id}>
              <div>
                <strong>{person.displayName}</strong>
                <span>
                  {person.jobTitle ?? 'Sin cargo'} ·{' '}
                  {person.role === 'ADMIN' ? 'Administrador' : 'Colaborador'}
                </span>
                {visibleId && <small>Cédula: {person.nationalId}</small>}
              </div>
              <StatusBadge tone={person.status === 'ACTIVE' ? 'success' : 'warning'}>
                {person.status === 'ACTIVE' ? 'Activo' : 'Inactivo'}
              </StatusBadge>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
function PersonForm({
  onDone,
  onError,
}: {
  onDone: () => void;
  onError: (e: RepositoryError) => void;
}) {
  const { phId, repository } = useDemo();
  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const firstName = String(f.get('firstName'));
    const lastName = String(f.get('lastName'));
    void repository
      .createPerson({
        phId,
        firstName,
        lastName,
        displayName: `${firstName} ${lastName}`,
        nationalId: String(f.get('nationalId')),
        jobTitle: String(f.get('jobTitle')) || undefined,
        role: String(f.get('role')) as Person['role'],
        status: 'ACTIVE',
      })
      .then(onDone)
      .catch(onError);
  };
  return (
    <form className="entity-form" onSubmit={submit}>
      <label>
        Nombre
        <input name="firstName" required />
      </label>
      <label>
        Apellido
        <input name="lastName" required />
      </label>
      <label>
        Cédula
        <input name="nationalId" required />
      </label>
      <label>
        Cargo
        <input name="jobTitle" />
      </label>
      <label>
        Rol
        <select name="role">
          <option value="COLLABORATOR">Colaborador</option>
          <option value="ADMIN">Administrador</option>
        </select>
      </label>
      <Button>Guardar persona</Button>
    </form>
  );
}
function TeamsPage() {
  const { phId, actor, repository } = useDemo();
  const [teams, setTeams] = useState<Team[] | null>(null);
  const [people, setPeople] = useState<Person[]>([]);
  const [error, setError] = useState<RepositoryError | null>(null);
  const [creating, setCreating] = useState(false);
  const load = useCallback(() => {
    void Promise.all([
      repository.listTeams({ phId, includeArchived: true }),
      repository.listPeople({ phId }),
    ])
      .then(([nextTeams, nextPeople]) => {
        setTeams(nextTeams);
        setPeople(nextPeople);
      })
      .catch(setError);
  }, [repository, phId]);
  useEffect(load, [load]);
  const archive = (team: Team) =>
    void repository
      .setTeamArchived(phId, team.id, team.status === 'ACTIVE', team.version)
      .then(load)
      .catch(setError);
  return (
    <section className="workspace-page">
      <p className="eyebrow">Organización</p>
      <h1>Equipos</h1>
      <p>
        Las membresías son muchos-a-muchos: una persona puede formar parte de varios equipos y los
        equipos pueden servir a distintos proyectos o tableros.
      </p>
      <div className="toolbar">
        {actor.role === 'ADMIN' && (
          <Button onClick={() => setCreating(!creating)}>
            {creating ? 'Cerrar formulario' : 'Crear equipo'}
          </Button>
        )}
      </div>
      {creating && (
        <TeamForm
          people={people}
          onDone={() => {
            setCreating(false);
            load();
          }}
          onError={setError}
        />
      )}
      <ErrorNotice error={error} onRetry={load} />
      {!teams ? (
        <div className="tm-skeleton" />
      ) : (
        <ul className="entity-list">
          {teams.map((team) => {
            const lead = people.find((person) => person.id === team.leadId);
            return (
              <li key={team.id}>
                <div>
                  <strong>{team.name}</strong>
                  <span>
                    Líder: {lead?.displayName ?? 'Sin asignar'} · {team.memberIds.length} miembros ·
                    0 pendientes
                  </span>
                  <small>
                    {team.memberIds
                      .map((id) => people.find((p) => p.id === id)?.displayName)
                      .filter(Boolean)
                      .join(', ') || 'Sin miembros'}
                  </small>
                </div>
                <div>
                  <StatusBadge tone={team.status === 'ACTIVE' ? 'success' : 'warning'}>
                    {team.status === 'ACTIVE' ? 'Activo' : 'Archivado'}
                  </StatusBadge>
                  {actor.role === 'ADMIN' && (
                    <Button variant="secondary" onClick={() => archive(team)}>
                      {team.status === 'ACTIVE' ? 'Archivar' : 'Restaurar'}
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
function TeamForm({
  people,
  onDone,
  onError,
}: {
  people: Person[];
  onDone: () => void;
  onError: (e: RepositoryError) => void;
}) {
  const { phId, repository } = useDemo();
  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const memberIds = f.getAll('members').map(String);
    void repository
      .createTeam({
        phId,
        name: String(f.get('name')),
        type: String(f.get('type')) as Team['type'],
        description: String(f.get('description')) || undefined,
        leadId: String(f.get('leadId')) || undefined,
        memberIds,
      })
      .then(async (team) => {
        await repository.setTeamMembers(phId, team.id, memberIds);
        onDone();
      })
      .catch(onError);
  };
  return (
    <form className="entity-form" onSubmit={submit}>
      <label>
        Nombre
        <input name="name" required />
      </label>
      <label>
        Tipo
        <select name="type">
          {teamTypes.map((type) => (
            <option key={type}>{type}</option>
          ))}
        </select>
      </label>
      <label>
        Líder
        <select name="leadId">
          <option value="">Sin asignar</option>
          {people.map((person) => (
            <option key={person.id} value={person.id}>
              {person.displayName}
            </option>
          ))}
        </select>
      </label>
      <fieldset>
        <legend>Miembros</legend>
        {people.map((person) => (
          <label key={person.id}>
            <input type="checkbox" name="members" value={person.id} /> {person.displayName}
          </label>
        ))}
      </fieldset>
      <label>
        Descripción
        <textarea name="description" />
      </label>
      <Button>Guardar equipo</Button>
    </form>
  );
}
