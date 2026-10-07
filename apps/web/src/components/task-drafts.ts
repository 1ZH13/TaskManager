import type { WorkItem } from '@task-manager/shared';

export type TaskDraft = {
  title: string;
  description: string;
  priority: WorkItem['priority'];
  blockedReason: string;
};
// Memory only: survives SPA back/forward, not reloads, and never crosses identity scopes.
export const taskDrafts = new Map<string, { draft: TaskDraft; base: TaskDraft; version: number }>();
export const taskDraftKey = (phId: string, actorId: string, role: string, taskId: string) =>
  JSON.stringify([phId, actorId, role, taskId]);
