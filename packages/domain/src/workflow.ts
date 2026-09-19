import type { BoardColumn, ValidationPolicy, WorkItem } from '@task-manager/shared';

export interface TransitionCheck {
  allowed: boolean;
  message?: string;
}

/**
 * Business guard used before a task changes semantic column.  It deliberately
 * accepts entities rather than UI state so both local and future HTTP adapters
 * enforce the same workflow.
 */
export function checkWorkItemTransition(item: WorkItem, target: BoardColumn, policy?: ValidationPolicy): TransitionCheck {
  if (target.category === 'BLOCKED' && !item.blockedReason?.trim()) {
    return { allowed: false, message: 'Bloquear una tarea exige un motivo.' };
  }
  if (target.category === 'DONE' && item.requiresEvidence && !item.evidenceSubmittedAt) {
    return { allowed: false, message: 'La tarea exige evidencia antes de terminarse.' };
  }
  if (policy?.requiresValidation && target.id === policy.approvedColumnId && item.validationStatus !== 'APPROVED') {
    return { allowed: false, message: 'Solo una tarea aprobada puede pasar a la columna aprobada.' };
  }
  if (policy?.requiresValidation && target.id === policy.waitingColumnId && item.requiresEvidence && !item.evidenceSubmittedAt) {
    return { allowed: false, message: 'Debes adjuntar evidencia antes de enviar la tarea a validación.' };
  }
  return { allowed: true };
}
