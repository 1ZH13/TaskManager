import { describe, expect, it } from 'vitest';
import { can, type Actor, type AuthorizationResource } from '../src/index.js';

const actor: Actor = {
  id: 'person-1',
  phId: 'ph-a',
  role: 'COLLABORATOR',
  status: 'ACTIVE',
  projectIds: ['project-a'],
  teamIds: ['team-a'],
  ledTeamIds: [],
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

  it('limita al supervisor a su alcance y a su validación asignada o equipo liderado', () => {
    const supervisor: Actor = { ...actor, role: 'SUPERVISOR', id: 'supervisor-1', ledTeamIds: ['team-a'] };
    expect(can(supervisor, 'task.update', resource)).toBe(true);
    expect(can(supervisor, 'task.validate', resource)).toBe(true);
    expect(can(supervisor, 'task.update', { ...resource, projectId: 'project-b' })).toBe(false);
    expect(can(supervisor, 'people.readNationalId', resource)).toBe(false);
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

  it('solo permite validar al supervisor elegido cuando no lidera el equipo', () => {
    const supervisor: Actor = { ...actor, role: 'SUPERVISOR', id: 'supervisor-1', ledTeamIds: [] };
    expect(can(supervisor, 'task.validate', { ...resource, validatorId: 'supervisor-1' })).toBe(true);
    expect(can(supervisor, 'task.validate', resource)).toBe(false);
  });
});
