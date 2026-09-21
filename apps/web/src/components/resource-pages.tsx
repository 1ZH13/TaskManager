'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { Download, Eye, FileUp, Pencil, Plus, Trash2, X } from 'lucide-react';
import { Button, ConflictState, IconButton, StatusBadge } from '../../../../packages/ui/src/index';
import type {
  BoardColumn,
  Document,
  FormDefinition,
  Notification,
  Person,
  Project,
  ProviderReference,
  Team,
  WorkActivity,
  WorkItem,
} from '@task-manager/shared';
import type { RepositoryError } from '@task-manager/data';
import { useDemo } from './demo-context';
import { FilterSelect } from './filter-select';

function ErrorMessage({ error, onRetry }: { error: RepositoryError | null; onRetry?: () => void }) {
  if (!error) return null;
  if (error.code === 'CONFLICT')
    return <ConflictState onReload={() => window.location.reload()} onRetry={onRetry} />;
  return (
    <p className="inline-error" role="alert">
      {error.message}
    </p>
  );
}

export function DocumentsPage({ projectId: forcedProjectId }: { projectId?: string }) {
  const { phId, actor, repository } = useDemo();
  const [items, setItems] = useState<Document[] | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<WorkItem[]>([]);
  const [providers, setProviders] = useState<ProviderReference[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [query, setQuery] = useState('');
  const [projectId, setProjectId] = useState(forcedProjectId ?? '');
  const [workItemId, setWorkItemId] = useState('');
  const [providerId, setProviderId] = useState('');
  const [teamId, setTeamId] = useState('');
  const [error, setError] = useState<RepositoryError | null>(null);
  const [uploading, setUploading] = useState(false);
  const load = useCallback(() => {
    void Promise.all([
      repository.listDocuments({
        phId,
        query,
        projectId: projectId || undefined,
        workItemId: workItemId || undefined,
        providerId: providerId || undefined,
        teamId: teamId || undefined,
      }),
      repository.listProjects({ phId }),
      repository.listWorkItems({ phId }),
      repository.listProviders({ phId }),
      repository.listTeams({ phId }),
      repository.listPeople({ phId }),
    ])
      .then(([documents, nextProjects, work, nextProviders, nextTeams, nextPeople]) => {
        setItems(documents.items);
        setProjects(nextProjects);
        setTasks(work.items);
        setProviders(nextProviders);
        setTeams(nextTeams);
        setPeople(nextPeople);
      })
      .catch(setError);
  }, [phId, projectId, providerId, query, repository, teamId, workItemId]);
  useEffect(load, [load]);
  const upload = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const file = data.get('file') as File | null;
    if (!file) return;
    setUploading(true);
    void repository
      .createDocument({
        phId,
        name: file.name,
        mimeType: file.type || 'application/octet-stream',
        sizeBytes: file.size,
        url: `/api/demo-document?name=${encodeURIComponent(file.name)}`,
        projectId: String(data.get('uploadProjectId') || '') || undefined,
        workItemId: String(data.get('workItemId') || '') || undefined,
        providerId: String(data.get('providerId') || '') || undefined,
        teamId: String(data.get('teamId') || '') || undefined,
      })
      .then(() => {
        form.reset();
        load();
      })
      .catch(setError)
      .finally(() => setUploading(false));
  };
  const documentUrl = (item: Document, download = false) =>
    item.url.startsWith('https://demo.local')
      ? `/api/demo-document?name=${encodeURIComponent(item.name)}${download ? '&download=1' : ''}`
      : `${item.url}${download ? '&download=1' : ''}`;
  return (
    <section className="workspace-page">
      <p className="eyebrow">Recursos</p>
      <h1>Documentos</h1>
      <div className="toolbar">
        <label>
          Buscar documentos
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Nombre de archivo"
          />
        </label>
        <FilterSelect
          label="Proyecto"
          value={projectId}
          disabled={!!forcedProjectId}
          options={[
            { label: 'Todos', value: '' },
            ...projects.map((project) => ({ label: project.name, value: project.id })),
          ]}
          onChange={setProjectId}
        />
        <FilterSelect
          label="Tarea"
          value={workItemId}
          options={[
            { label: 'Todas', value: '' },
            ...tasks.map((task) => ({ label: task.key, value: task.id })),
          ]}
          onChange={setWorkItemId}
        />
        <FilterSelect
          label="Proveedor"
          value={providerId}
          options={[
            { label: 'Todos', value: '' },
            ...providers.map((provider) => ({ label: provider.name, value: provider.id })),
          ]}
          onChange={setProviderId}
        />
        <FilterSelect
          label="Equipo"
          value={teamId}
          options={[
            { label: 'Todos', value: '' },
            ...teams.map((team) => ({ label: team.name, value: team.id })),
          ]}
          onChange={setTeamId}
        />
      </div>
      {actor.role === 'ADMIN' && (
        <form className="entity-form document-upload" onSubmit={upload}>
          <label className="document-file">
            <FileUp size={20} aria-hidden="true" />
            <span>Adjuntar archivo</span>
            <input name="file" type="file" required />
          </label>
          {forcedProjectId && <input type="hidden" name="uploadProjectId" value={forcedProjectId} />}
          <label>
            Proyecto
            <select
              name={forcedProjectId ? undefined : 'uploadProjectId'}
              value={forcedProjectId ?? ''}
              disabled={!!forcedProjectId}
              onChange={() => undefined}
            >
              <option value="">Sin proyecto</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Tarea
            <select name="workItemId">
              <option value="">Sin tarea</option>
              {tasks.map((task) => (
                <option key={task.id} value={task.id}>
                  {task.key} · {task.title}
                </option>
              ))}
            </select>
          </label>
          <label>
            Proveedor
            <select name="providerId">
              <option value="">Sin proveedor</option>
              {providers.map((provider) => (
                <option key={provider.id} value={provider.id}>
                  {provider.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Equipo
            <select name="teamId">
              <option value="">Sin equipo</option>
              {teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>
          </label>
          <div className="document-upload__action">
            <Button disabled={uploading}>{uploading ? 'Cargando…' : 'Cargar documento'}</Button>
          </div>
        </form>
      )}
      <ErrorMessage error={error} onRetry={load} />
      {!items ? (
        <div className="tm-skeleton" />
      ) : items.length === 0 ? (
        <section className="tm-state" aria-live="polite">
          <h2>
            {query || projectId || workItemId || providerId || teamId
              ? 'Sin resultados'
              : 'Sin documentos'}
          </h2>
          <p>
            {query || projectId || workItemId || providerId || teamId
              ? 'Cambia o restablece los filtros para ver otros documentos.'
              : 'Adjunta el primer documento para empezar.'}
          </p>
        </section>
      ) : (
        <ul className="entity-list document-list">
          {items.map((item) => (
            <li key={item.id}>
              <div>
                <strong>{item.name}</strong>
                <span>
                  {item.mimeType} · {(item.sizeBytes / 1024).toFixed(1)} KB
                </span>
                <small>
                  {item.projectId ? 'Relacionado a proyecto' : 'Recurso general'} · Responsable:{' '}
                  {people.find((person) => person.id === item.uploadedById)?.displayName ??
                    'No disponible'}{' '}
                  · {new Date(item.createdAt).toLocaleDateString('es-PA')}
                </small>
              </div>
              <div className="document-actions">
                <a
                  className="tm-button tm-button--secondary"
                  href={documentUrl(item)}
                  target="_blank"
                  rel="noreferrer"
                >
                  <Eye size={16} />
                  Vista previa
                </a>
                <a className="tm-button tm-button--secondary" href={documentUrl(item, true)}>
                  <Download size={16} />
                  Descargar
                </a>
                {actor.role === 'ADMIN' && (
                  <Button
                    variant="secondary"
                    onClick={() => {
                      if (window.confirm(`¿Eliminar ${item.name}?`))
                        void repository
                          .deleteDocument(phId, item.id, item.version)
                          .then(load)
                          .catch(setError);
                    }}
                  >
                    Eliminar
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

export function ProvidersPage() {
  const { phId, actor, repository } = useDemo();
  const [data, setData] = useState<{
    providers: ProviderReference[];
    documents: Document[];
    workItems: WorkItem[];
    projects: Project[];
    forms: FormDefinition[];
    activity: WorkActivity[];
    columns: BoardColumn[];
  } | null>(null);
  const [query, setQuery] = useState('');
  const [error, setError] = useState<RepositoryError | null>(null);
  const [editing, setEditing] = useState<ProviderReference | null>(null);
  const [creating, setCreating] = useState(false);
  const load = useCallback(() => {
    void Promise.all([
      repository.listProviders({ phId }),
      repository.listDocuments({ phId }),
      repository.listWorkItems({ phId }),
      repository.listProjects({ phId }),
      repository.listForms({ phId, includeDrafts: true }),
      repository.listActivity(phId),
      repository.listBoards({ phId }),
    ])
      .then(async ([providers, documents, work, projects, forms, activity, boards]) => {
        const columns = (
          await Promise.all(
            boards.map((board) => repository.listBoardColumns({ phId, boardId: board.id })),
          )
        ).flat();
        setData({
          providers,
          documents: documents.items,
          workItems: work.items,
          projects,
          forms,
          activity,
          columns,
        });
      })
      .catch(setError);
  }, [phId, repository]);
  useEffect(load, [load]);
  const saveProvider = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const input = { name: String(form.get('name')), externalId: String(form.get('externalId')), legalName: String(form.get('legalName')) || undefined, taxId: String(form.get('taxId')) || undefined, status: String(form.get('status')) as ProviderReference['status'] };
    const request = editing
      ? repository.updateProvider(editing.id, { ...input, version: editing.version })
      : repository.createProvider({ phId, ...input });
    void request.then(() => { setCreating(false); setEditing(null); load(); }).catch(setError);
  };
  return (
    <section className="workspace-page">
      <p className="eyebrow">PH Platform</p>
      <h1>Proveedores</h1>
      <p>Gestiona el catálogo operativo; no incluye pagos ni gestión financiera.</p>
      {actor.role === 'ADMIN' && <div className="toolbar"><IconButton label="Agregar proveedor" onClick={() => { setCreating(true); setEditing(null); }}><Plus size={18} /></IconButton></div>}
      <label>
        Buscar proveedor
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Nombre o referencia"
        />
      </label>
      <ErrorMessage error={error} />
      {(creating || editing) && <form className="entity-form" onSubmit={saveProvider}>
        <label>Nombre<input name="name" required defaultValue={editing?.name} /></label>
        <label>Referencia<input name="externalId" required defaultValue={editing?.externalId} /></label>
        <label>Razón social<input name="legalName" defaultValue={editing?.legalName} /></label>
        <label>RUC / identificación fiscal<input name="taxId" defaultValue={editing?.taxId} /></label>
        <label>Estado<select name="status" defaultValue={editing?.status ?? 'ACTIVE'}><option value="ACTIVE">Activo</option><option value="INACTIVE">Inactivo</option></select></label>
        <div className="entity-form__actions"><IconButton label="Guardar proveedor" type="submit"><Plus size={18} /></IconButton><IconButton label="Cancelar" onClick={() => { setCreating(false); setEditing(null); }}><X size={18} /></IconButton></div>
      </form>}
      {!data ? (
        <div className="tm-skeleton" />
      ) : (
        <ul className="entity-list">
          {data.providers
            .filter((provider) =>
              `${provider.name} ${provider.externalId}`.toLowerCase().includes(query.toLowerCase()),
            )
            .map((provider) => {
              const work = data.workItems.filter((item) => item.providerId === provider.id);
              const openWork = work.filter(
                (item) =>
                  data.columns.find((column) => column.id === item.columnId)?.category !== 'DONE',
              );
              const documents = data.documents.filter((item) => item.providerId === provider.id);
              const projectIds = new Set(work.map((item) => item.projectId));
              const projects = data.projects.filter((item) => projectIds.has(item.id));
              const forms = data.forms.filter(
                (item) => item.projectId && projectIds.has(item.projectId),
              );
              const activity = data.activity.filter((item) =>
                work.some((workItem) => workItem.id === item.workItemId),
              );
              return (
                <li key={provider.id}>
                  <div>
                    <strong>{provider.name}</strong>
                    <span>
                      {provider.externalId} · {provider.status === 'ACTIVE' ? 'Activo' : 'Inactivo'}
                    </span>
                    <small>
                      Sincronizado:{' '}
                      {provider.syncedAt
                        ? new Date(provider.syncedAt).toLocaleString('es-PA')
                        : 'Pendiente'}{' '}
                      · {openWork.length} trabajo abierto · {documents.length} documentos
                    </small>
                    <small>
                      Proyectos: {projects.map((item) => item.name).join(', ') || 'Sin referencias'}{' '}
                      · Formularios:{' '}
                      {forms.map((item) => item.name).join(', ') || 'Sin referencias'} · Actividad:{' '}
                      {activity.length}
                    </small>
                  </div>
                  <div className="entity-actions"><StatusBadge tone={provider.syncedAt ? 'success' : 'warning'}>{provider.syncedAt ? 'Sincronizado' : 'Pendiente'}</StatusBadge>{actor.role === 'ADMIN' && <><IconButton label={`Editar ${provider.name}`} onClick={() => { setEditing(provider); setCreating(false); }}><Pencil size={16} /></IconButton><IconButton label={`Eliminar ${provider.name}`} onClick={() => { if (window.confirm(`¿Eliminar ${provider.name}?`)) void repository.deleteProvider(phId, provider.id, provider.version).then(load).catch(setError); }}><Trash2 size={16} /></IconButton></>}</div>
                </li>
              );
            })}
        </ul>
      )}
    </section>
  );
}

export function NotificationsPage() {
  const { phId, repository } = useDemo();
  const [items, setItems] = useState<Notification[] | null>(null);
  const [error, setError] = useState<RepositoryError | null>(null);
  const load = useCallback(() => {
    void repository
      .listNotifications({ phId })
      .then((page) => setItems(page.items))
      .catch(setError);
  }, [phId, repository]);
  useEffect(load, [load]);
  const href = (item: Notification) =>
    item.resourceType === 'WORK_ITEM'
      ? `/operaciones/mantenimiento/tablero?taskId=${item.resourceId}`
      : item.resourceType === 'DOCUMENT'
        ? `/documentos?documentId=${item.resourceId}`
        : item.resourceType === 'FORM'
          ? `/formularios?formId=${item.resourceId}`
          : `/proveedores?providerId=${item.resourceId}`;
  return (
    <section className="workspace-page">
      <p className="eyebrow">Actividad</p>
      <h1>Notificaciones</h1>
      <ErrorMessage error={error} />
      {!items ? (
        <div className="tm-skeleton" />
      ) : items.length === 0 ? (
        <section className="tm-state" aria-live="polite">
          <h2>Sin notificaciones</h2>
          <p>Las novedades de tus tareas y recursos aparecerán aquí.</p>
        </section>
      ) : (
        <ul className="entity-list">
          {items.map((item) => (
            <li key={item.id}>
              <div>
                <strong>{item.title}</strong>
                <span>{item.body}</span>
                <small>{item.readAt ? 'Leída' : 'Sin leer'}</small>
                <Link href={href(item)}>Abrir recurso</Link>
              </div>
              {!item.readAt && (
                <Button
                  variant="secondary"
                  onClick={() =>
                    void repository
                      .markNotificationRead(phId, item.id, item.version)
                      .then(load)
                      .catch(setError)
                  }
                >
                  Marcar leída
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
