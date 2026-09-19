import { describe, expect, it } from 'vitest';
import { expandOccurrences, selectWorkItems } from '../src/work-item-selectors.js';
import type { BoardColumn, WorkItem } from '@task-manager/shared';

const item = { id: 'a0000000-0000-4000-8000-000000000001', phId: '10000000-0000-4000-8000-000000000001', createdAt: '2026-09-18T00:00:00.000Z', updatedAt: '2026-09-18T00:00:00.000Z', version: 1, projectId: '30000000-0000-4000-8000-000000000002', boardId: '40000000-0000-4000-8000-000000000002', columnId: 'b0000000-0000-4000-8000-000000000001', key: 'OPS-1', type: 'RECURRING_TASK', title: 'Inspección', priority: 'MEDIUM', reporterId: '20000000-0000-4000-8000-000000000001', assigneeId: '20000000-0000-4000-8000-000000000002', startsOn: '2026-09-19', dueOn: '2026-09-19', dependencyIds: [], recurrence: { frequency: 'WEEKLY', interval: 1, startsOn: '2026-09-19', occurrenceCount: 3, weekdays: [] }, requiresEvidence: false, requiresValidation: false, validationStatus: 'NOT_REQUIRED', position: 0, labels: [] } satisfies WorkItem;
const columns = [{ id: item.columnId, phId: item.phId, boardId: item.boardId, name: 'Por hacer', category: 'TODO', color: '#000000', position: 0 }] satisfies BoardColumn[];

describe('work item selectors', () => {
  it('expande recurrencias de forma determinista y limitada', () => expect(expandOccurrences(item, '2026-09-01', '2026-10-31').map((occurrence) => occurrence.date)).toEqual(['2026-09-19', '2026-09-26', '2026-10-03']));
  it('aplica los mismos filtros puros que consumen las vistas', () => expect(selectWorkItems([item], columns, { query: 'inspección', status: 'TODO' })).toEqual([item]));
});
