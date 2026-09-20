import { describe, expect, it } from 'vitest';
import { selectWorkReport } from '../src/report-selectors.js';
import type { BoardColumn, Project, WorkActivity, WorkItem } from '@task-manager/shared';

const phId = '10000000-0000-4000-8000-000000000001';
const projectId = '30000000-0000-4000-8000-000000000001';
const boardId = '40000000-0000-4000-8000-000000000001';
const base = { phId, projectId, boardId, reporterId: '20000000-0000-4000-8000-000000000001', dependencyIds: [], requiresEvidence: false, requiresValidation: false, validationStatus: 'NOT_REQUIRED' as const, labels: [], version: 1 };
const columns = [
  { id: 'b0000000-0000-4000-8000-000000000001', phId, boardId, name: 'Pendiente', category: 'TODO' as const, color: '#64748B', position: 0 },
  { id: 'b0000000-0000-4000-8000-000000000002', phId, boardId, name: 'Hecha', category: 'DONE' as const, color: '#245E40', position: 1 },
  { id: 'b0000000-0000-4000-8000-000000000003', phId, boardId, name: 'Estancada', category: 'BLOCKED' as const, color: '#B45309', position: 2 },
] satisfies BoardColumn[];
const projects = [{ id: projectId, phId, module: 'OPERATIONS' as const, key: 'OPS', name: 'Operación', status: 'ACTIVE' as const, createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z', version: 1 }] satisfies Project[];
const items = [
  { ...base, id: 'a0000000-0000-4000-8000-000000000001', columnId: columns[0].id, key: 'OPS-1', type: 'TASK' as const, title: 'Vence pronto', priority: 'HIGH' as const, assigneeId: '20000000-0000-4000-8000-000000000002', teamId: '50000000-0000-4000-8000-000000000001', dueOn: '2026-09-23', createdAt: '2026-09-18T00:00:00.000Z', updatedAt: '2026-09-18T00:00:00.000Z', position: 0 },
  { ...base, id: 'a0000000-0000-4000-8000-000000000002', columnId: columns[1].id, key: 'OPS-2', type: 'TASK' as const, title: 'Terminada', priority: 'MEDIUM' as const, createdAt: '2026-09-17T00:00:00.000Z', updatedAt: '2026-09-19T12:00:00.000Z', position: 1 },
  { ...base, id: 'a0000000-0000-4000-8000-000000000003', columnId: columns[2].id, key: 'OPS-3', type: 'INCIDENT' as const, title: 'Atrasada', priority: 'URGENT' as const, dueOn: '2026-09-18', createdAt: '2026-09-10T00:00:00.000Z', updatedAt: '2026-09-18T00:00:00.000Z', position: 2 },
] satisfies WorkItem[];
const activities = [{ id: 'c0000000-0000-4000-8000-000000000001', phId, workItemId: items[1].id, actorId: base.reporterId, type: 'MOVED' as const, message: 'Terminó', toStatusCategory: 'DONE' as const, createdAt: '2026-09-19T12:00:00.000Z', updatedAt: '2026-09-19T12:00:00.000Z', version: 1 }] satisfies WorkActivity[];

describe('report selectors', () => {
  it('deriva indicadores, distribución y resolución desde tareas y actividad', () => {
    const report = selectWorkReport({ items, columns, projects, activities }, { phId }, '2026-09-19');
    expect(report).toMatchObject({ total: 3, pending: 2, completedLastSevenDays: 1, dueSoon: 1, overdue: 1, blocked: 1, completionRate: 1 / 3, averageResolutionHours: 60 });
    expect(report.byStatus).toEqual([{ key: 'BLOCKED', value: 1 }, { key: 'DONE', value: 1 }, { key: 'TODO', value: 1 }]);
    expect(report.workloadByAssignee).toEqual([{ key: '20000000-0000-4000-8000-000000000002', value: 1 }, { key: 'UNASSIGNED', value: 1 }]);
  });

  it('no mezcla PH, módulo ni tareas fuera de los filtros', () => {
    const foreign = { ...items[0], id: 'a0000000-0000-4000-8000-000000000004', phId: '10000000-0000-4000-8000-000000000002' };
    const report = selectWorkReport({ items: [...items, foreign], columns, projects, activities }, { phId, module: 'ACCOUNTING' }, '2026-09-19');
    expect(report).toMatchObject({ total: 0, completionRate: null, averageResolutionHours: null });
  });
});
