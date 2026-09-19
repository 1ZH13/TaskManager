import { describe, expect, it } from 'vitest';
import { createDemoState, createHttpRepository, demoIds, LocalWorkManagementRepository, type KeyValueStore } from '@task-manager/data';
import type { Actor } from '@task-manager/domain';
import type { CreateWorkItemInput } from '@task-manager/data';

class MemoryStore implements KeyValueStore {
  private data = new Map<string, string>();
  getItem(key: string) { return this.data.get(key) ?? null; }
  setItem(key: string, value: string) { this.data.set(key, value); }
  removeItem(key: string) { this.data.delete(key); }
}
const admin: Actor = { id: demoIds.admin, phId: demoIds.vista, role: 'ADMIN', status: 'ACTIVE', projectIds: [], teamIds: [] };
const taskInput: CreateWorkItemInput = { phId: demoIds.vista, projectId: demoIds.opsProject, boardId: demoIds.opsBoard, columnId: 'b0000000-0000-4000-8000-000000000001', key: 'OPS-4', type: 'TASK', title: 'Revisar bomba', priority: 'HIGH', reporterId: demoIds.admin, assigneeId: demoIds.collab, dependencyIds: [], requiresEvidence: false, requiresValidation: false, validationStatus: 'NOT_REQUIRED', position: 0, labels: [] };

describe('LocalWorkManagementRepository', () => {
  it('siembra datos deterministas de dos PH y recupera persistencia corrupta', async () => {
    const store = new MemoryStore(); store.setItem('task-manager.demo.v2', '{corrupto');
    const repository = new LocalWorkManagementRepository(store, () => admin);
    expect((await repository.listPropertyContexts()).map((context) => context.id)).toEqual([demoIds.vista, demoIds.bahia]);
    expect(await repository.listProjects({ phId: demoIds.vista })).toHaveLength(3);
    const bahiaAdmin: Actor = { ...admin, id: demoIds.bahiaAdmin, phId: demoIds.bahia };
    expect(await new LocalWorkManagementRepository(store, () => bahiaAdmin).listProjects({ phId: demoIds.bahia })).toHaveLength(1);
    expect(createDemoState()).toEqual(createDemoState());
  });

  it('migra datos v1 conservando los identificadores existentes', async () => {
    const store = new MemoryStore(); const v1 = { ...createDemoState(), schemaVersion: 1 };
    store.setItem('task-manager.demo.v1', JSON.stringify(v1));
    const contexts = await new LocalWorkManagementRepository(store, () => admin).listPropertyContexts();
    expect(contexts.map((context) => context.id)).toEqual([demoIds.vista, demoIds.bahia]);
    expect(store.getItem('task-manager.demo.v2')).toContain('"schemaVersion":4');
  });

  it('no permite consultar ni mutar recursos de otra PH', async () => {
    const repository = new LocalWorkManagementRepository(new MemoryStore(), () => admin);
    await expect(repository.getProject(demoIds.vista, demoIds.bahiaProject)).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(repository.listProjects({ phId: demoIds.bahia })).rejects.toMatchObject({ code: 'ACCESS_DENIED' });
    await expect(repository.createProject({ phId: demoIds.bahia, module: 'OPERATIONS', key: 'CRZ', name: 'Cruce', color: '#000000' })).rejects.toMatchObject({ code: 'ACCESS_DENIED' });
    await expect(repository.setProjectArchived(demoIds.bahia, demoIds.bahiaProject, true, 1)).rejects.toMatchObject({ code: 'ACCESS_DENIED' });
    await expect(repository.setTeamMembers(demoIds.bahia, demoIds.teamB, [])).rejects.toMatchObject({ code: 'ACCESS_DENIED' });
  });

  it('mantiene un contrato HTTP intercambiable y con errores uniformes', async () => {
    await expect(createHttpRepository().listProjects({ phId: demoIds.vista })).rejects.toMatchObject({ code: 'NOT_CONFIGURED' });
  });

  it('limita al colaborador a sus proyectos asignados', async () => {
    const collaborator: Actor = { id: demoIds.collab, phId: demoIds.vista, role: 'COLLABORATOR', status: 'ACTIVE', projectIds: [demoIds.opsProject], teamIds: [demoIds.teamB] };
    const projects = await new LocalWorkManagementRepository(new MemoryStore(), () => collaborator).listProjects({ phId: demoIds.vista });
    expect(projects.map((project) => project.id)).toEqual([demoIds.opsProject]);
  });

  it('persiste cambios y expone conflictos de versión recuperables', async () => {
    const store = new MemoryStore(); const repository = new LocalWorkManagementRepository(store, () => admin);
    const created = await repository.createWorkItem(taskInput);
    const initialVersion = created.version;
    expect((await new LocalWorkManagementRepository(store, () => admin).listWorkItems({ phId: demoIds.vista })).items).toHaveLength(4);
    await repository.updateWorkItem(created.id, { version: initialVersion, title: 'Revisar bomba principal' });
    await expect(repository.updateWorkItem(created.id, { version: initialVersion, title: 'Cambio obsoleto' })).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('permite evidencia del colaborador y validación exclusiva del administrador', async () => {
    const store = new MemoryStore(); const administrator = new LocalWorkManagementRepository(store, () => admin);
    const workItem = (await administrator.listWorkItems({ phId: demoIds.vista, projectId: demoIds.opsProject })).items[0]!;
    const collaborator: Actor = { id: demoIds.collab, phId: demoIds.vista, role: 'COLLABORATOR', status: 'ACTIVE', projectIds: [demoIds.opsProject], teamIds: [demoIds.teamB] };
    const submitted = await new LocalWorkManagementRepository(store, () => collaborator).submitEvidence({ id: workItem.id, phId: demoIds.vista, evidenceUrl: 'https://demo.local/evidence/new.jpg', version: workItem.version });
    const reviewed = await new LocalWorkManagementRepository(store, () => admin).reviewWorkItem({ id: submitted.id, phId: demoIds.vista, decision: 'APPROVED', version: submitted.version });
    expect(reviewed.validationStatus).toBe('APPROVED');
    await expect(new LocalWorkManagementRepository(store, () => collaborator).reviewWorkItem({ id: reviewed.id, phId: demoIds.vista, decision: 'REJECTED', comment: 'No', version: reviewed.version })).rejects.toMatchObject({ code: 'ACCESS_DENIED' });
  });

  it('protege las invariantes de columnas y exige migrar las tareas al borrar', async () => {
    const repository = new LocalWorkManagementRepository(new MemoryStore(), () => admin);
    const columns = await repository.listBoardColumns({ phId: demoIds.vista, boardId: demoIds.opsBoard });
    expect(columns).toHaveLength(4);
    await expect(repository.deleteBoardColumn({ phId: demoIds.vista, id: columns[0]!.id })).rejects.toMatchObject({ code: 'VALIDATION' });
    const reordered = await repository.reorderBoardColumns(demoIds.vista, demoIds.opsBoard, columns.map((column) => column.id).reverse());
    expect(reordered.map((column) => column.id)).toEqual(columns.map((column) => column.id).reverse());
    await repository.deleteBoardColumn({ phId: demoIds.vista, id: columns[0]!.id, destinationColumnId: columns[1]!.id, replacements: { rejectedColumnId: columns[1]!.id } });
    expect(await repository.listBoardColumns({ phId: demoIds.vista, boardId: demoIds.opsBoard })).toHaveLength(3);
  });

  it('inserta columnas en la posición solicitada sin duplicar el orden', async () => {
    const repository = new LocalWorkManagementRepository(new MemoryStore(), () => admin);
    await repository.createBoardColumn({ phId: demoIds.vista, boardId: demoIds.opsBoard, name: 'Priorizada', category: 'TODO', color: '#4583BD', position: 1 });
    expect((await repository.listBoardColumns({ phId: demoIds.vista, boardId: demoIds.opsBoard })).map((column) => column.position)).toEqual([0, 1, 2, 3, 4]);
  });

  it('cubre el ciclo CRUD de tableros y protege los que aún tienen tareas', async () => {
    const repository = new LocalWorkManagementRepository(new MemoryStore(), () => admin);
    const board = await repository.createBoard({ phId: demoIds.vista, projectId: demoIds.opsProject, name: 'Inspecciones', teamIds: [demoIds.teamB] });
    expect(await repository.listBoardColumns({ phId: demoIds.vista, boardId: board.id })).toHaveLength(4);
    const renamed = await repository.updateBoard(board.id, { version: board.version, name: 'Inspecciones mensuales' });
    expect(renamed.name).toBe('Inspecciones mensuales');
    await repository.deleteBoard(demoIds.vista, board.id, renamed.version);
    const workBoard = (await repository.listBoards({ phId: demoIds.vista, projectId: demoIds.opsProject }))[0]!;
    await expect(repository.deleteBoard(demoIds.vista, workBoard.id, workBoard.version)).rejects.toMatchObject({ code: 'VALIDATION' });
  });

  it('expone la regla de transición del dominio desde el adaptador local', async () => {
    const repository = new LocalWorkManagementRepository(new MemoryStore(), () => admin);
    const item = (await repository.listWorkItems({ phId: demoIds.vista, projectId: demoIds.opsProject })).items[0]!;
    const done = (await repository.listBoardColumns({ phId: demoIds.vista, boardId: demoIds.opsBoard })).find((column) => column.category === 'DONE')!;
    expect(() => repository.checkTransition({ ...item, evidenceSubmittedAt: undefined }, done.id)).toThrow('evidencia');
  });

  it('aplica la política y el orden dentro del repositorio, incluso sin UI', async () => {
    const repository = new LocalWorkManagementRepository(new MemoryStore(), () => admin);
    const [item] = (await repository.listWorkItems({ phId: demoIds.vista, projectId: demoIds.opsProject })).items;
    const columns = await repository.listBoardColumns({ phId: demoIds.vista, boardId: demoIds.opsBoard });
    const done = columns.find((column) => column.category === 'DONE')!;
    await expect(repository.moveWorkItem({ id: item!.id, phId: demoIds.vista, columnId: done.id, position: 0, version: item!.version })).rejects.toMatchObject({ code: 'VALIDATION' });
    const created = await repository.createWorkItem(taskInput);
    expect(created.key).toBe('OPS-4');
    expect((await repository.listActivity(demoIds.vista, created.id))[0]?.type).toBe('CREATED');
  });
});
