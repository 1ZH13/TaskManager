import { describe, expect, it } from 'vitest';
import { checkWorkItemTransition } from '../src/workflow.js';
import type { BoardColumn, ValidationPolicy, WorkItem } from '@task-manager/shared';

const item = (overrides: Partial<WorkItem> = {}) => ({ requiresEvidence: true, evidenceSubmittedAt: undefined, blockedReason: undefined, validationStatus: 'PENDING', ...overrides }) as WorkItem;
const column = (id: string, category: BoardColumn['category']) => ({ id, category }) as BoardColumn;

describe('checkWorkItemTransition', () => {
  it('requiere motivo para bloquear y evidencia para terminar', () => {
    expect(checkWorkItemTransition(item(), column('blocked', 'BLOCKED')).allowed).toBe(false);
    expect(checkWorkItemTransition(item(), column('done', 'DONE')).allowed).toBe(false);
  });

  it('no permite aprobar sin revisión administrativa', () => {
    const policy = { requiresValidation: true, approvedColumnId: 'approved' } as ValidationPolicy;
    expect(checkWorkItemTransition(item(), column('approved', 'DONE'), policy)).toMatchObject({ allowed: false });
  });
});
