import { describe, expect, it, vi } from 'vitest';
import {
  createDemoState,
  demoIds,
  LocalWorkManagementRepository,
  type WorkManagementRepository,
} from '@task-manager/data';
import type { Actor } from '@task-manager/domain';
import { listAllWorkItems, resolveTaskLink } from './task-link';

function repository(actor?: Partial<Actor>): WorkManagementRepository {
  return new LocalWorkManagementRepository(undefined, () => ({
    id: demoIds.admin,
    phId: demoIds.vista,
    role: 'ADMIN',
    status: 'ACTIVE',
    projectIds: [],
    teamIds: [],
    ...actor,
  }));
}

describe('task link resolution', () => {
  it('resuelve un proyecto administrativo y tablero secundario, no el operativo por defecto', async () => {
    const repo = repository();
    const task = createDemoState().workItems[0];
    const board = await repo.createBoard({
      phId: demoIds.vista,
      projectId: demoIds.adminProject,
      name: 'Secundario',
      teamIds: [],
    });
    const columns = await repo.listBoardColumns({ phId: demoIds.vista, boardId: board.id });
    const created = await repo.createWorkItem({
      ...task,
      projectId: demoIds.adminProject,
      boardId: board.id,
      columnId: columns[0].id,
      key: 'ADM-999',
    });
    const href = new URL(
      await resolveTaskLink(repo, demoIds.vista, created.id),
      'https://test.local',
    );
    expect(href.pathname).toBe('/administrativa/tablero');
    expect(href.searchParams.get('projectId')).toBe(demoIds.adminProject);
    expect(href.searchParams.get('board')).toBe(board.id);
    expect(href.searchParams.get('taskId')).toBe(created.id);
  });

  it('no resuelve tareas de otra PH ni fuera del acceso del colaborador', async () => {
    const opsTask = createDemoState().workItems.find((item) => item.key === 'OPS-1')!;
    await expect(
      resolveTaskLink(
        repository({ phId: demoIds.bahia, id: demoIds.bahiaAdmin }),
        demoIds.bahia,
        opsTask.id,
      ),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(
      resolveTaskLink(
        repository({ id: demoIds.cleaner, role: 'COLLABORATOR' }),
        demoIds.vista,
        opsTask.id,
      ),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('busca también en páginas posteriores y no convierte un error de transporte en un destino', async () => {
    const repo = repository();
    const task = createDemoState().workItems.find((item) => item.key === 'OPS-1')!;
    const list = vi
      .spyOn(repo, 'listWorkItems')
      .mockResolvedValueOnce({ items: [], nextCursor: 'next' })
      .mockResolvedValueOnce({ items: [task] });
    expect(await resolveTaskLink(repo, demoIds.vista, task.id)).toContain(`taskId=${task.id}`);
    expect(list).toHaveBeenLastCalledWith({ phId: demoIds.vista, cursor: 'next' });
    list.mockRejectedValueOnce(new Error('offline'));
    await expect(resolveTaskLink(repo, demoIds.vista, task.id)).rejects.toThrow('offline');
  });

  it('carga el tablero completo y corta cursores cíclicos', async () => {
    const repo = repository();
    const task = createDemoState().workItems[0];
    const list = vi
      .spyOn(repo, 'listWorkItems')
      .mockResolvedValueOnce({ items: [], nextCursor: 'next' })
      .mockResolvedValueOnce({ items: [task] });
    expect(
      (await listAllWorkItems(repo, { phId: demoIds.vista, boardId: task.boardId })).items,
    ).toEqual([task]);
    list.mockResolvedValue({ items: [], nextCursor: 'same' });
    await expect(resolveTaskLink(repo, demoIds.vista, task.id)).rejects.toMatchObject({
      code: 'NOT_CONFIGURED',
    });
  });
});
