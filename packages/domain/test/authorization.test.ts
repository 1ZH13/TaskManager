import { describe, expect, it } from 'vitest';
import { can, type Actor, type AuthorizationResource } from '../src/index.js';

const actor: Actor = {
  id: 'person-1',
  phId: 'ph-a',
  role: 'COLLABORATOR',
  status: 'ACTIVE',
  projectIds: ['project-a'],
  teamIds: ['team-a'],
};

const resource: AuthorizationResource = {
  phId: 'ph-a',
  projectId: 'project-a',
  teamId: 'team-a',
  assigneeId: 'person-1',
};

describe('can', () => {
  it('deniega cualquier acción a un actor inactivo o de otro PH', () => {
    expect(can({ ...actor, status: 'INACTIVE' }, 'task.read', resource)).toBe(false);
    expect(can({ ...actor, phId: 'ph-b' }, 'task.read', resource)).toBe(false);
  });

  it('permite al administrador activo gestionar recursos de su PH', () => {
    expect(can({ ...actor, role: 'ADMIN', projectIds: [], teamIds: [] }, 'board.manage', resource)).toBe(true);
    expect(can({ ...actor, role: 'ADMIN', projectIds: [], teamIds: [] }, 'people.readNationalId', resource)).toBe(true);
  });

  it('solo permite al colaborador operar su propia tarea', () => {
    expect(can(actor, 'task.move', resource)).toBe(true);
    expect(can(actor, 'task.block', resource)).toBe(true);
    expect(can(actor, 'task.assign', resource)).toBe(false);
    expect(can(actor, 'task.move', { ...resource, assigneeId: 'person-2' })).toBe(false);
  });

  it('requiere habilitación explícita para que un colaborador cree tareas', () => {
    expect(can(actor, 'task.create', resource)).toBe(false);
    expect(can(actor, 'task.create', { ...resource, projectAllowsCollaboratorCreate: true })).toBe(true);
  });

  it('reserva la validación y el identificador personal para administradores', () => {
    expect(can(actor, 'task.validate', resource)).toBe(false);
    expect(can(actor, 'people.readNationalId', resource)).toBe(false);
  });
});
