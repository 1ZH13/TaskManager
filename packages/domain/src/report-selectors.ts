import type { BoardColumn, Project, WorkActivity, WorkItem } from '@task-manager/shared';

export interface ReportFilters {
  phId: string;
  module?: Project['module'];
  projectId?: string;
  boardId?: string;
  teamId?: string;
  assigneeId?: string;
  providerId?: string;
  from?: string;
  to?: string;
}

export interface ReportPoint { key: string; value: number; }

export interface WorkReport {
  total: number;
  pending: number;
  completedLastSevenDays: number;
  created: number;
  updated: number;
  dueSoon: number;
  overdue: number;
  blocked: number;
  averageResolutionHours: number | null;
  completionRate: number | null;
  byStatus: ReportPoint[];
  byType: ReportPoint[];
  byAssignee: ReportPoint[];
  byTeam: ReportPoint[];
  byPriority: ReportPoint[];
  workloadByAssignee: ReportPoint[];
  completionByPeriod: ReportPoint[];
}

export interface ReportSource {
  items: WorkItem[];
  columns: BoardColumn[];
  projects: Project[];
  activities?: WorkActivity[];
}

const day = (value: string) => value.slice(0, 10);
const addDays = (value: string, days: number) => {
  const result = new Date(`${value}T00:00:00.000Z`);
  result.setUTCDate(result.getUTCDate() + days);
  return result.toISOString().slice(0, 10);
};
const countBy = (values: Iterable<string | undefined>): ReportPoint[] => {
  const counts = new Map<string, number>();
  for (const value of values) if (value) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts].sort(([left], [right]) => left.localeCompare(right)).map(([key, value]) => ({ key, value }));
};
const inRange = (date: string, from?: string, to?: string) => (!from || date >= from) && (!to || date <= to);

/**
 * Produces every report value from scoped work items and their activity; it never
 * stores independent counters. Callers must pass only entities the actor may read.
 */
export function selectWorkReport(source: ReportSource, filters: ReportFilters, today: string): WorkReport {
  const projectById = new Map(source.projects.filter((project) => project.phId === filters.phId).map((project) => [project.id, project]));
  const statusByColumn = new Map(source.columns.filter((column) => column.phId === filters.phId).map((column) => [column.id, column.category]));
  const items = source.items.filter((item) => {
    const project = projectById.get(item.projectId);
    return item.phId === filters.phId && !!project
      && (!filters.module || project.module === filters.module)
      && (!filters.projectId || item.projectId === filters.projectId)
      && (!filters.boardId || item.boardId === filters.boardId)
      && (!filters.teamId || item.teamId === filters.teamId)
      && (!filters.assigneeId || item.assigneeId === filters.assigneeId)
      && (!filters.providerId || item.providerId === filters.providerId)
      && inRange(day(item.createdAt), filters.from, filters.to);
  });
  const itemIds = new Set(items.map((item) => item.id));
  const activities = (source.activities ?? []).filter((activity) => activity.phId === filters.phId && itemIds.has(activity.workItemId));
  const status = (item: WorkItem): BoardColumn['category'] | undefined => statusByColumn.get(item.columnId);
  const doneItems = items.filter((item) => status(item) === 'DONE');
  const weekAgo = addDays(today, -6);
  const activityDates = activities.map((activity) => day(activity.createdAt));
  const completedAt = (item: WorkItem) => activities.filter((activity) => activity.workItemId === item.id && activity.toStatusCategory === 'DONE')
    .map((activity) => activity.createdAt).sort().at(-1) ?? (status(item) === 'DONE' ? item.updatedAt : undefined);
  const resolutions = doneItems.map((item) => ({ item, completedAt: completedAt(item) })).filter((value): value is { item: WorkItem; completedAt: string } => !!value.completedAt)
    .map(({ item, completedAt: value }) => Math.max(0, new Date(value).getTime() - new Date(item.createdAt).getTime()) / 3_600_000);
  const completedPeriods = activities.filter((activity) => activity.toStatusCategory === 'DONE').map((activity) => day(activity.createdAt));

  return {
    total: items.length,
    pending: items.filter((item) => status(item) !== 'DONE').length,
    completedLastSevenDays: doneItems.filter((item) => { const completed = day(completedAt(item) ?? ''); return completed >= weekAgo && completed <= today; }).length,
    created: items.filter((item) => inRange(day(item.createdAt), filters.from, filters.to)).length,
    updated: new Set(activities.filter((activity) => activity.type !== 'CREATED' && inRange(day(activity.createdAt), filters.from, filters.to)).map((activity) => activity.workItemId)).size,
    dueSoon: items.filter((item) => status(item) !== 'DONE' && !!item.dueOn && item.dueOn >= today && item.dueOn <= addDays(today, 7)).length,
    overdue: items.filter((item) => status(item) !== 'DONE' && !!item.dueOn && item.dueOn < today).length,
    blocked: items.filter((item) => status(item) === 'BLOCKED').length,
    averageResolutionHours: resolutions.length ? resolutions.reduce((sum, value) => sum + value, 0) / resolutions.length : null,
    completionRate: items.length ? doneItems.length / items.length : null,
    byStatus: countBy(items.map(status)), byType: countBy(items.map((item) => item.type)),
    byAssignee: countBy(items.map((item) => item.assigneeId ?? 'UNASSIGNED')), byTeam: countBy(items.map((item) => item.teamId ?? 'UNASSIGNED')),
    byPriority: countBy(items.map((item) => item.priority)), workloadByAssignee: countBy(items.filter((item) => status(item) !== 'DONE').map((item) => item.assigneeId ?? 'UNASSIGNED')),
    completionByPeriod: countBy(completedPeriods),
  };
}
