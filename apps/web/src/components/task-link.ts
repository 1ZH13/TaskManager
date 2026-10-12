import { DataError, type WorkManagementRepository, type WorkItemQuery } from '@task-manager/data';

export async function listAllWorkItems(repository: WorkManagementRepository, query: WorkItemQuery) {
  const items = [] as Awaited<ReturnType<WorkManagementRepository['listWorkItems']>>['items'];
  let cursor: string | undefined;
  const visited = new Set<string>();
  do {
    const page = await repository.listWorkItems({ ...query, cursor });
    items.push(...page.items);
    cursor = page.nextCursor;
    if (cursor && visited.has(cursor))
      throw new DataError('NOT_CONFIGURED', 'No se pudo completar la búsqueda de la tarea.');
    if (cursor) visited.add(cursor);
  } while (cursor);
  return { items };
}

/** Resolve only through the current actor's repository; URL identifiers grant no access. */
export async function resolveTaskLink(
  repository: WorkManagementRepository,
  phId: string,
  taskId: string,
) {
  let cursor: string | undefined;
  const visited = new Set<string>();
  do {
    const page = await repository.listWorkItems({ phId, cursor });
    const task = page.items.find((item) => item.id === taskId && item.phId === phId);
    if (task) {
      const project = await repository.getProject(phId, task.projectId);
      const modulePath = {
        ADMINISTRATIVE: 'administrativa',
        OPERATIONS: 'operaciones',
        ACCOUNTING: 'contabilidad',
      }[project.module];
      const query = new URLSearchParams({
        phId,
        projectId: task.projectId,
        board: task.boardId,
        taskId: task.id,
      });
      return `/${modulePath}/tablero?${query}`;
    }
    cursor = page.nextCursor;
    if (cursor && visited.has(cursor))
      throw new DataError('NOT_CONFIGURED', 'No se pudo completar la búsqueda de la tarea.');
    if (cursor) visited.add(cursor);
  } while (cursor);
  throw new DataError(
    'NOT_FOUND',
    'La tarea no está disponible en esta propiedad o no tienes acceso.',
  );
}
