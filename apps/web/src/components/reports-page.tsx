'use client';
/* eslint-disable react-hooks/set-state-in-effect -- repository reads occur after client mount. */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Download } from 'lucide-react';
import { selectWorkReport, type ReportFilters, type WorkReport } from '@task-manager/domain';
import type {
  Board,
  BoardColumn,
  Person,
  Project,
  ProviderReference,
  Team,
  WorkActivity,
  WorkItem,
} from '@task-manager/shared';
import type { RepositoryError } from '@task-manager/data';
import { Button } from '../../../../packages/ui/src/index';
import { useDemo } from './demo-context';
import { FilterSelect } from './filter-select';

const labels: Record<string, string> = {
  TODO: 'Pendientes',
  IN_PROGRESS: 'En progreso',
  BLOCKED: 'Estancadas',
  DONE: 'Terminadas',
  TASK: 'Tareas',
  RECURRING_TASK: 'Recurrentes',
  INCIDENT: 'Incidencias',
  SUBTASK: 'Subtareas',
  MILESTONE: 'Hitos',
  LOW: 'Baja',
  MEDIUM: 'Media',
  HIGH: 'Alta',
  URGENT: 'Urgente',
  UNASSIGNED: 'Sin asignar',
};
const formatNumber = new Intl.NumberFormat('es-PA', { maximumFractionDigits: 1 });
const panamaDay = () => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Panama',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
  return `${value('year')}-${value('month')}-${value('day')}`;
};
const pdfSafe = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7E]/g, ' ')
    .replace(/[\\()]/g, '\\$&');
const downloadPdf = (title: string, report: WorkReport, scope: string) => {
  const lines = [
    title,
    `Generado: ${new Date().toLocaleString('es-PA')}`,
    `Alcance: ${scope}`,
    '',
    `Total de tareas: ${report.total}`,
    `Pendientes: ${report.pending}`,
    `Terminadas ultimos 7 dias: ${report.completedLastSevenDays}`,
    `Proximas a vencer: ${report.dueSoon}`,
    `Atrasadas: ${report.overdue}`,
    `Estancadas: ${report.blocked}`,
    `Cumplimiento: ${report.completionRate === null ? '-' : `${formatNumber.format(report.completionRate)}%`}`,
    '',
    'Tareas por estado:',
    ...report.byStatus.map((item) => `- ${labels[item.key] ?? item.key}: ${item.value}`),
    '',
    'Tareas por prioridad:',
    ...report.byPriority.map((item) => `- ${labels[item.key] ?? item.key}: ${item.value}`),
  ];
  const content = lines
    .map((line, index) => `BT /F1 10 Tf 48 ${790 - index * 17} Td (${pdfSafe(line)}) Tj ET`)
    .join('\n');
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${String(offset).padStart(10, '0')} 00000 n `).join('\n')}\ntrailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  const url = URL.createObjectURL(new Blob([pdf], { type: 'application/pdf' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `${scope === 'Informe general' ? 'informe-general' : 'informe-gestion'}-${panamaDay()}.pdf`;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
};

function Distribution({
  title,
  values,
  labelFor = (key: string) => labels[key] ?? key,
}: {
  title: string;
  values: WorkReport['byStatus'];
  labelFor?: (key: string) => string;
}) {
  return (
    <section className="report-distribution">
      <h2>{title}</h2>
      {values.length === 0 ? (
        <p>Sin datos para los filtros actuales.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th scope="col">Categoría</th>
              <th scope="col">Tareas</th>
            </tr>
          </thead>
          <tbody>
            {values.map(({ key, value }) => (
              <tr key={key}>
                <th scope="row">{labelFor(key)}</th>
                <td>{value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
function ChartCard({
  title,
  values,
  labelFor,
}: {
  title: string;
  values: WorkReport['byStatus'];
  labelFor?: (key: string) => string;
}) {
  const resolve = labelFor ?? ((key: string) => labels[key] ?? key);
  const data = values.map((point) => ({ ...point, label: resolve(point.key) }));
  return (
    <section className="report-chart">
      <h2>{title}</h2>
      {data.length === 0 ? (
        <p>Sin datos para los filtros actuales.</p>
      ) : (
        <>
          <div
            className="report-chart__canvas"
            role="img"
            aria-label={`${title}: ${data.map((point) => `${point.label}, ${point.value}`).join('; ')}`}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 8, right: 8, bottom: 8, left: -16 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} interval={0} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="value" fill="#4583BD" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <Distribution
            title={`Tabla de ${title.toLocaleLowerCase('es-PA')}`}
            values={values}
            labelFor={resolve}
          />
        </>
      )}
    </section>
  );
}

export function ReportsPage({ projectId: forcedProjectId }: { projectId?: string }) {
  const { phId, actor, repository } = useDemo();
  const [projects, setProjects] = useState<Project[]>([]);
  const [boards, setBoards] = useState<Board[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [providers, setProviders] = useState<ProviderReference[]>([]);
  const [items, setItems] = useState<WorkItem[]>([]);
  const [columns, setColumns] = useState<BoardColumn[]>([]);
  const [activities, setActivities] = useState<WorkActivity[]>([]);
  const [filters, setFilters] = useState<Omit<ReportFilters, 'phId'>>({
    projectId: forcedProjectId,
  });
  const [error, setError] = useState<RepositoryError | null>(null);
  const [loading, setLoading] = useState(true);
  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    void repository
      .listProjects({ phId, includeArchived: false })
      .then(async (nextProjects) => {
        const visibleProjects = (
          actor.role === 'ADMIN'
            ? nextProjects
            : nextProjects.filter((project) => actor.projectIds.includes(project.id))
        ).filter((project) => !forcedProjectId || project.id === forcedProjectId);
        const [page, nextActivities, nextBoards, nextPeople, nextTeams, nextProviders] =
          await Promise.all([
            repository.listWorkItems({ phId }),
            repository.listActivity(phId),
            Promise.all(
              visibleProjects.map((project) =>
                repository.listBoards({ phId, projectId: project.id }),
              ),
            ).then((groups) => groups.flat()),
            repository.listPeople({ phId }),
            repository.listTeams({ phId }),
            repository.listProviders({ phId }),
          ]);
        const nextColumns = await Promise.all(
          nextBoards.map((board) => repository.listBoardColumns({ phId, boardId: board.id })),
        );
        setProjects(visibleProjects);
        setBoards(nextBoards);
        setPeople(nextPeople);
        setTeams(nextTeams);
        setProviders(nextProviders);
        setItems(
          page.items.filter((item) =>
            visibleProjects.some((project) => project.id === item.projectId),
          ),
        );
        setActivities(nextActivities);
        setColumns(nextColumns.flat());
      })
      .catch(setError)
      .finally(() => setLoading(false));
  }, [actor.projectIds, actor.role, forcedProjectId, phId, repository]);
  useEffect(load, [load]);
  const report = useMemo(
    () =>
      selectWorkReport({ items, columns, projects, activities }, { phId, ...filters }, panamaDay()),
    [activities, columns, filters, items, phId, projects],
  );
  const personLabel = (key: string) =>
    key === 'UNASSIGNED'
      ? labels[key]
      : (people.find((person) => person.id === key)?.displayName ?? key);
  const teamLabel = (key: string) =>
    key === 'UNASSIGNED' ? labels[key] : (teams.find((team) => team.id === key)?.name ?? key);
  return (
    <section className="workspace-page reports-page">
      <div className="toolbar">
        <div>
          <p className="eyebrow">Informes</p>
          <h1>Estado del trabajo</h1>
          <p>Los indicadores se ajustan automáticamente al cambiar cualquier filtro.</p>
        </div>
        {!loading && report.total > 0 && (
          <Button
            variant="secondary"
            onClick={() =>
              downloadPdf(
                forcedProjectId ? 'Informe de gestion' : 'Informe general',
                report,
                forcedProjectId ? projects[0]?.name ?? 'Informe de gestion' : 'Informe general',
              )
            }
          >
            <Download size={16} aria-hidden="true" /> Descargar PDF
          </Button>
        )}
      </div>
      <form className="report-filters" onSubmit={(event) => event.preventDefault()}>
        {!forcedProjectId ? (
          <>
            <FilterSelect
              label="Módulo"
              value={filters.module ?? ''}
              options={[
                { label: 'Todos', value: '' },
                { label: 'Administrativa', value: 'ADMINISTRATIVE' },
                { label: 'Operaciones', value: 'OPERATIONS' },
                { label: 'Contabilidad', value: 'ACCOUNTING' },
              ]}
              onChange={(value) =>
                setFilters((current) => ({
                  ...current,
                  module: (value as Project['module']) || undefined,
                  projectId: undefined,
                  boardId: undefined,
                }))
              }
            />
            <FilterSelect
              label="Proyecto"
              value={filters.projectId ?? ''}
              options={[
                { label: 'Todos', value: '' },
                ...projects
                  .filter((project) => !filters.module || project.module === filters.module)
                  .map((project) => ({
                    label: `${project.key} · ${project.name}`,
                    value: project.id,
                  })),
              ]}
              onChange={(value) =>
                setFilters((current) => ({
                  ...current,
                  projectId: value || undefined,
                  boardId: undefined,
                }))
              }
            />
          </>
        ) : (
          <FilterSelect
            label="Proyecto"
            value={filters.projectId ?? ''}
            disabled
            options={[{ label: projects[0]?.name ?? 'Proyecto actual', value: forcedProjectId }]}
            onChange={() => undefined}
          />
        )}
        <FilterSelect
          label="Tablero"
          value={filters.boardId ?? ''}
          options={[
            { label: 'Todos', value: '' },
            ...boards
              .filter((board) => !filters.projectId || board.projectId === filters.projectId)
              .map((board) => ({ label: board.name, value: board.id })),
          ]}
          onChange={(value) =>
            setFilters((current) => ({ ...current, boardId: value || undefined }))
          }
        />
        <FilterSelect
          label="Equipo"
          value={filters.teamId ?? ''}
          options={[
            { label: 'Todos', value: '' },
            ...teams.map((team) => ({ label: team.name, value: team.id })),
          ]}
          onChange={(value) =>
            setFilters((current) => ({ ...current, teamId: value || undefined }))
          }
        />
        <FilterSelect
          label="Persona"
          value={filters.assigneeId ?? ''}
          options={[
            { label: 'Todas', value: '' },
            ...people.map((person) => ({ label: person.displayName, value: person.id })),
          ]}
          onChange={(value) =>
            setFilters((current) => ({ ...current, assigneeId: value || undefined }))
          }
        />
        <FilterSelect
          label="Proveedor"
          value={filters.providerId ?? ''}
          options={[
            { label: 'Todos', value: '' },
            ...providers.map((provider) => ({ label: provider.name, value: provider.id })),
          ]}
          onChange={(value) =>
            setFilters((current) => ({ ...current, providerId: value || undefined }))
          }
        />
        <label>
          Desde
          <input
            type="date"
            value={filters.from ?? ''}
            onChange={(event) =>
              setFilters((current) => ({ ...current, from: event.target.value || undefined }))
            }
          />
        </label>
        <label>
          Hasta
          <input
            type="date"
            value={filters.to ?? ''}
            onChange={(event) =>
              setFilters((current) => ({ ...current, to: event.target.value || undefined }))
            }
          />
        </label>
      </form>
      {error ? (
        <section className="tm-state tm-state--error" role="alert">
          <p>{error.message}</p>
          <Button variant="secondary" onClick={load}>
            Reintentar
          </Button>
        </section>
      ) : loading ? (
        <div className="tm-skeleton" aria-label="Cargando informes" />
      ) : report.total === 0 ? (
        <section className="tm-state" aria-live="polite">
          <h2>Sin tareas para estos filtros</h2>
          <p>Cambia o restablece los filtros para consultar otro conjunto de trabajo.</p>
        </section>
      ) : (
        <>
          <div className="metric-grid" aria-label="Indicadores">
            <Metric label="Pendientes" value={report.pending} />
            <Metric label="Terminadas últimos 7 días" value={report.completedLastSevenDays} />
            <Metric label="Próximas a vencer" value={report.dueSoon} />
            <Metric label="Atrasadas" value={report.overdue} />
            <Metric label="Estancadas" value={report.blocked} />
            <Metric
              label="Tiempo medio de resolución"
              value={
                report.averageResolutionHours === null
                  ? '—'
                  : `${formatNumber.format(report.averageResolutionHours)} h`
              }
            />
            <Metric
              label="Cumplimiento"
              value={
                report.completionRate === null
                  ? '—'
                  : `${formatNumber.format(report.completionRate * 100)}%`
              }
            />
          </div>
          <div className="report-grid">
            <ChartCard title="Tareas por estado" values={report.byStatus} />
            <ChartCard title="Tareas por tipo" values={report.byType} />
            <ChartCard title="Tareas por prioridad" values={report.byPriority} />
            <ChartCard
              title="Carga pendiente por persona"
              values={report.workloadByAssignee}
              labelFor={personLabel}
            />
            <Distribution title="Por equipo" values={report.byTeam} labelFor={teamLabel} />
            <Distribution
              title="Por responsable"
              values={report.byAssignee}
              labelFor={personLabel}
            />
            <Distribution title="Cumplimientos por fecha" values={report.completionByPeriod} />
          </div>
        </>
      )}
    </section>
  );
}
function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <article className="metric-card">
      <h2>{label}</h2>
      <p>{value}</p>
    </article>
  );
}
