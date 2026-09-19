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
const taskInput: CreateWorkItemInput = { phId: demoIds.vista, projectId: demoIds.opsProject, boardId: demoIds.opsBoard, columnId: '70000000-0000-4000-8000-000000000001', key: 'OPS-1', type: 'TASK', title: 'Revisar bomba', priority: 'HIGH', reporterId: demoIds.admin, assigneeId: demoIds.collab, requiresEvidence: false, requiresValidation: false, validationStatus: 'NOT_REQUIRED', position: 0, labels: [] };

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
    expect(store.getItem('task-manager.demo.v2')).toContain('"schemaVersion":2');
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
    expect((await new LocalWorkManagementRepository(store, () => admin).listWorkItems({ phId: demoIds.vista })).items).toHaveLength(2);
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
});
