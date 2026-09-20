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

  it('expone por HTTP las consultas base que necesitan las vistas existentes', async () => {
    const urls: string[] = [];
    const fetchFn = async (input: string | URL | Request) => {
      const url = String(input); urls.push(url);
      return new Response(JSON.stringify(url.includes('/work-items?') ? { items: [] } : []), { status: 200, headers: { 'Content-Type': 'application/json' } });
    };
    const repository = createHttpRepository({ baseUrl: 'https://api.demo.local', fetchFn: fetchFn as typeof fetch });
    await Promise.all([
      repository.listPropertyContexts(),
      repository.listProjects({ phId: demoIds.vista, includeArchived: true }),
      repository.listBoards({ phId: demoIds.vista, projectId: demoIds.opsProject }),
      repository.listBoardColumns({ phId: demoIds.vista, boardId: demoIds.opsBoard }),
      repository.listWorkItems({ phId: demoIds.vista, boardId: demoIds.opsBoard }),
      repository.listPeople({ phId: demoIds.vista }),
      repository.listTeams({ phId: demoIds.vista }),
      repository.listComments(demoIds.vista, 'a0000000-0000-4000-8000-000000000001'),
      repository.listAttachments(demoIds.vista, 'a0000000-0000-4000-8000-000000000001'),
      repository.listProjectTeams(demoIds.vista),
      repository.listProjectMembers(demoIds.vista),
      repository.listBoardTeams(demoIds.vista),
      repository.listTeamMemberships(demoIds.vista),
    ]);
    expect(urls).toContain('https://api.demo.local/api/v1/property-contexts');
    expect(urls).toContain(`https://api.demo.local/api/v1/property-contexts/${demoIds.vista}/boards?phId=${demoIds.vista}&projectId=${demoIds.opsProject}`);
    expect(urls).toContain(`https://api.demo.local/api/v1/property-contexts/${demoIds.vista}/work-items?phId=${demoIds.vista}&boardId=${demoIds.opsBoard}`);
    expect(urls).toContain(`https://api.demo.local/api/v1/property-contexts/${demoIds.vista}/work-items/a0000000-0000-4000-8000-000000000001/comments`);
    expect(urls).toContain(`https://api.demo.local/api/v1/property-contexts/${demoIds.vista}/project-teams`);
  });

  it('envía recursos E6 por HTTP con idempotencia y versiones', async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const fetchFn = async (input: string | URL | Request, init?: RequestInit) => { calls.push({ url: String(input), init }); const entity = { id: calls.length === 1 ? 'd0000000-0000-4000-8000-000000000099' : 'e0000000-0000-4000-8000-000000000099', phId: demoIds.vista, createdAt: '2026-09-18T12:00:00.000Z', updatedAt: '2026-09-18T12:00:00.000Z', version: 1 }; const payload = calls.length === 1 ? { ...entity, name: 'acta.pdf', mimeType: 'application/pdf', sizeBytes: 10, url: 'https://demo.local/acta.pdf', uploadedById: demoIds.admin } : { ...entity, recipientId: demoIds.admin, title: 'Actualizada', body: 'Leída', resourceType: 'WORK_ITEM', resourceId: 'a0000000-0000-4000-8000-000000000001', readAt: '2026-09-18T12:00:00.000Z' }; return new Response(JSON.stringify(payload), { status: 200, headers: { 'Content-Type': 'application/json' } }); };
    const repository = createHttpRepository({ baseUrl: 'https://api.demo.local/', fetchFn: fetchFn as typeof fetch });
    await repository.createDocument({ phId: demoIds.vista, name: 'acta.pdf', mimeType: 'application/pdf', sizeBytes: 10, url: 'https://demo.local/acta.pdf' });
    await repository.markNotificationRead(demoIds.vista, 'e0000000-0000-4000-8000-000000000001', 2);
    expect(calls[0]?.url).toBe(`https://api.demo.local/api/v1/property-contexts/${demoIds.vista}/documents`);
    expect(new Headers(calls[0]?.init?.headers).get('Idempotency-Key')).toBeTruthy();
    expect(new Headers(calls[1]?.init?.headers).get('If-Match')).toBe('2');
  });

  it('preserva idempotencia y concurrencia en mutaciones HTTP base', async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const fetchFn = async (input: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(input), init });
      return new Response(JSON.stringify({ id: demoIds.opsProject, phId: demoIds.vista, createdAt: '2026-09-18T12:00:00.000Z', updatedAt: '2026-09-18T12:00:00.000Z', version: 2, module: 'OPERATIONS', key: 'OPS', name: 'Operaciones', color: '#245E40', status: 'ACTIVE' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    };
    const repository = createHttpRepository({ baseUrl: 'https://api.demo.local', fetchFn: fetchFn as typeof fetch });
    await repository.createProject({ phId: demoIds.vista, module: 'OPERATIONS', key: 'OPS', name: 'Operaciones', color: '#245E40' });
    await repository.updateProject(demoIds.opsProject, { version: 1, name: 'Operaciones actualizadas' });
    expect(calls[0]?.url).toBe(`https://api.demo.local/api/v1/property-contexts/${demoIds.vista}/projects`);
    expect(new Headers(calls[0]?.init?.headers).get('Idempotency-Key')).toBeTruthy();
    expect(calls[1]?.url).toBe(`https://api.demo.local/api/v1/projects/${demoIds.opsProject}`);
    expect(new Headers(calls[1]?.init?.headers).get('If-Match')).toBe('1');
  });

  it('envía las solicitudes especiales E6 por la frontera HTTP', async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const fetchFn = async (input: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(input), init });
      const entity = { id: 'd0000000-0000-4000-8000-000000000099', phId: demoIds.vista, createdAt: '2026-09-18T12:00:00.000Z', updatedAt: '2026-09-18T12:00:00.000Z', version: 1 };
      const payload = calls.length === 1
        ? { ...entity, formId: 'f0000000-0000-4000-8000-000000000002', submittedById: demoIds.admin, values: {} }
        : { ...entity, name: 'factura.pdf', mimeType: 'application/pdf', sizeBytes: 0, url: 'https://demo.local/factura.pdf', uploadedById: demoIds.admin };
      return new Response(JSON.stringify(payload), { status: 200, headers: { 'Content-Type': 'application/json' } });
    };
    const repository = createHttpRepository({ baseUrl: 'https://api.demo.local', fetchFn: fetchFn as typeof fetch });
    await repository.submitAppointment(demoIds.vista, { ruc: '123', dv: '1', attendeeName: 'Ana Pérez', date: '2026-10-01', time: '10:30' });
    await repository.submitInvoice({ phId: demoIds.vista, invoiceName: 'factura.pdf', documentUrl: 'https://demo.local/factura.pdf', subtotal: 100, itbmsRate: 0.07 });
    expect(calls.map((call) => call.url)).toEqual([
      `https://api.demo.local/api/v1/property-contexts/${demoIds.vista}/appointments`,
      `https://api.demo.local/api/v1/property-contexts/${demoIds.vista}/invoices`,
    ]);
    expect(new Headers(calls[0]?.init?.headers).get('Idempotency-Key')).toBeTruthy();
    expect(new Headers(calls[1]?.init?.headers).get('Idempotency-Key')).toBeTruthy();
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

  it('valida formularios publicados, crea su tarea configurada y preserva el aislamiento PH', async () => {
    const repository = new LocalWorkManagementRepository(new MemoryStore(), () => admin);
    const form = await repository.createForm({ phId: demoIds.vista, projectId: demoIds.opsProject, name: 'Incidencia', status: 'PUBLISHED', fields: [{ id: 'title', label: 'Título', type: 'TEXT', required: true }], createTask: true, destinationProjectId: demoIds.opsProject, destinationBoardId: demoIds.opsBoard });
    await expect(repository.submitForm({ phId: demoIds.vista, formId: form.id, values: {} })).rejects.toMatchObject({ code: 'VALIDATION' });
    const submission = await repository.submitForm({ phId: demoIds.vista, formId: form.id, values: { title: 'Fuga en lobby' } });
    expect(submission.createdWorkItemId).toBeDefined();
    await expect(repository.listForms({ phId: demoIds.bahia })).rejects.toMatchObject({ code: 'ACCESS_DENIED' });
  });

  it('aplica validadores Zod según el tipo de campo publicado', async () => {
    const repository = new LocalWorkManagementRepository(new MemoryStore(), () => admin);
    const form = await repository.createForm({ phId: demoIds.vista, name: 'Datos de contacto', status: 'PUBLISHED', fields: [{ id: 'email', label: 'Correo', type: 'EMAIL', required: true }, { id: 'amount', label: 'Monto', type: 'NUMBER', required: true }, { id: 'choice', label: 'Opción', type: 'SELECT', required: true, options: ['A', 'B'] }], createTask: false });
    await expect(repository.submitForm({ phId: demoIds.vista, formId: form.id, values: { email: 'invalido', amount: 'diez', choice: 'C' } })).rejects.toMatchObject({ code: 'VALIDATION' });
    await expect(repository.submitForm({ phId: demoIds.vista, formId: form.id, values: { email: 'ana@vista.pa', amount: '10.50', choice: 'A' } })).resolves.toMatchObject({ formId: form.id });
  });

  it('mantiene documentos y notificaciones dentro de la PH y permite marcar lectura', async () => {
    const repository = new LocalWorkManagementRepository(new MemoryStore(), () => admin);
    const document = await repository.createDocument({ phId: demoIds.vista, name: 'Acta.pdf', mimeType: 'application/pdf', sizeBytes: 42, url: 'https://demo.local/acta.pdf' });
    expect((await repository.listDocuments({ phId: demoIds.vista, query: 'acta' })).items).toContainEqual(document);
    const [notification] = (await repository.listNotifications({ phId: demoIds.vista })).items;
    expect((await repository.markNotificationRead(demoIds.vista, notification!.id, notification!.version)).readAt).toBeDefined();
    await expect(repository.listDocuments({ phId: demoIds.bahia })).rejects.toMatchObject({ code: 'ACCESS_DENIED' });
  });

  it('persiste solicitudes de cita y factura como recursos simulados del PH', async () => {
    const repository = new LocalWorkManagementRepository(new MemoryStore(), () => admin);
    const appointment = await repository.submitAppointment(demoIds.vista, { ruc: '155-123-456', dv: '7', attendeeName: 'María Pérez', date: '2026-09-22', time: '09:30' });
    expect(appointment.formId).toBe('f0000000-0000-4000-8000-000000000002');
    const invoice = await repository.submitInvoice({ phId: demoIds.vista, invoiceName: 'Factura septiembre.pdf', documentUrl: 'https://demo.local/facturas/septiembre.pdf', subtotal: 100, itbmsRate: 0.07 });
    expect(invoice.projectId).toBe(demoIds.accountingProject);
    expect((await repository.listDocuments({ phId: demoIds.vista, projectId: demoIds.accountingProject })).items).toContainEqual(invoice);
  });
});
