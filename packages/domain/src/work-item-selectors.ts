import type { BoardColumn, RecurrenceRule, WorkItem } from '@task-manager/shared';

export interface WorkItemOccurrence { workItem: WorkItem; date: string; index: number; }
export interface WorkItemFilters { query?: string; projectId?: string; boardId?: string; assigneeId?: string; teamId?: string; type?: WorkItem['type']; status?: BoardColumn['category']; }

const asDate = (value: string) => new Date(`${value}T00:00:00.000Z`);
const iso = (value: Date) => value.toISOString().slice(0, 10);
const addMonths = (date: Date, months: number) => { const next = new Date(date); next.setUTCMonth(next.getUTCMonth() + months); return next; };

export function selectWorkItems(items: WorkItem[], columns: BoardColumn[], filters: WorkItemFilters = {}) {
  const categories = new Map(columns.map((column) => [column.id, column.category]));
  const query = filters.query?.trim().toLocaleLowerCase();
  return items.filter((item) => (!filters.projectId || item.projectId === filters.projectId)
    && (!filters.boardId || item.boardId === filters.boardId)
    && (!filters.assigneeId || item.assigneeId === filters.assigneeId)
    && (!filters.teamId || item.teamId === filters.teamId)
    && (!filters.type || item.type === filters.type)
    && (!filters.status || categories.get(item.columnId) === filters.status)
    && (!query || `${item.key} ${item.title} ${item.description ?? ''}`.toLocaleLowerCase().includes(query)));
}

function nextDate(date: Date, rule: RecurrenceRule) {
  if (rule.frequency === 'DAILY') return new Date(date.getTime() + rule.interval * 86_400_000);
  if (rule.frequency === 'WEEKLY') return new Date(date.getTime() + rule.interval * 7 * 86_400_000);
  if (rule.frequency === 'MONTHLY') return addMonths(date, rule.interval);
  if (rule.frequency === 'ANNUAL') return addMonths(date, rule.interval * 12);
  return new Date(date.getTime() + rule.interval * 86_400_000);
}

/** Deterministically expands a local recurrence without mutating its source item. */
export function expandOccurrences(item: WorkItem, from: string, to: string): WorkItemOccurrence[] {
  const rule = item.recurrence; if (!rule) return [];
  const start = asDate(rule.startsOn); const end = asDate(rule.endsOn ?? to); const lower = asDate(from); const upper = asDate(to);
  const result: WorkItemOccurrence[] = []; let current = start; let index = 0;
  while (current <= end && current <= upper && (!rule.occurrenceCount || index < rule.occurrenceCount)) {
    const weekdayOk = rule.frequency !== 'WEEKLY' || rule.weekdays.length === 0 || rule.weekdays.includes(current.getUTCDay());
    if (current >= lower && weekdayOk) result.push({ workItem: item, date: iso(current), index });
    current = nextDate(current, rule); index += 1;
  }
  return result;
}

export function selectOccurrences(items: WorkItem[], from: string, to: string) { return items.flatMap((item) => expandOccurrences(item, from, to)); }
export function completionPercent(item: WorkItem, columns: BoardColumn[]) { return columns.find((column) => column.id === item.columnId)?.category === 'DONE' ? 100 : 0; }
export function timelineAlerts(items: WorkItem[], columns: BoardColumn[], today: string) { return items.filter((item) => !!item.dueOn && item.dueOn < today && completionPercent(item, columns) < 100); }
