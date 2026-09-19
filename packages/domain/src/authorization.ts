export type Role = 'ADMIN' | 'SUPERVISOR' | 'COLLABORATOR';

export type Action =
  | 'project.read'
  | 'project.manage'
  | 'board.manage'
  | 'task.create'
  | 'task.read'
  | 'task.update'
  | 'task.assign'
  | 'task.move'
  | 'task.block'
  | 'task.validate'
  | 'people.manage'
  | 'people.readNationalId'
  | 'team.manage'
  | 'report.read'
  | 'resource.manage'
  | 'entity.archive';

export interface Actor {
  id: string;
  phId: string;
  role: Role;
  status: 'ACTIVE' | 'INACTIVE';
  projectIds: readonly string[];
  teamIds: readonly string[];
  ledTeamIds: readonly string[];
}

export interface AuthorizationResource {
  phId: string;
  projectId?: string;
  teamId?: string;
  assigneeId?: string;
  validatorId?: string;
  projectAllowsCollaboratorCreate?: boolean;
}

const administratorActions = new Set<Action>([
  'project.read',
  'project.manage',
  'board.manage',
  'task.create',
  'task.read',
  'task.update',
  'task.assign',
  'task.move',
  'task.block',
  'task.validate',
  'people.manage',
  'people.readNationalId',
  'team.manage',
  'report.read',
  'resource.manage',
  'entity.archive',
]);

function isInScope(actor: Actor, resource: AuthorizationResource): boolean {
  const projectMatches = !resource.projectId || actor.projectIds.includes(resource.projectId);
  const teamMatches = !resource.teamId || actor.teamIds.includes(resource.teamId);
  return projectMatches && teamMatches;
}

/**
 * Decides access from domain data only. Callers must pass the resource that is
 * actually being read or changed; a UI visibility check is never authorization.
 */
export function can(actor: Actor, action: Action, resource: AuthorizationResource): boolean {
  if (actor.status !== 'ACTIVE' || actor.phId !== resource.phId) {
    return false;
  }

  if (actor.role === 'ADMIN') {
    return administratorActions.has(action);
  }

  const inScope = isInScope(actor, resource);

  if (actor.role === 'SUPERVISOR') {
    if (!inScope) return false;

    if (action === 'task.validate') {
      return resource.validatorId === actor.id || (resource.teamId !== undefined && actor.ledTeamIds.includes(resource.teamId));
    }

    return action !== 'project.manage' && action !== 'board.manage' && action !== 'people.manage' && action !== 'people.readNationalId' && action !== 'team.manage' && action !== 'entity.archive';
  }

  if (!inScope || action === 'task.validate' || action === 'task.assign') {
    return false;
  }

  if (action === 'task.create') {
    return resource.projectAllowsCollaboratorCreate === true;
  }

  if (action === 'task.read' || action === 'project.read') {
    return true;
  }

  const ownsTask = resource.assigneeId === actor.id;
  return ownsTask && (action === 'task.update' || action === 'task.move' || action === 'task.block');
}
