export type Role = 'ADMIN' | 'COLLABORATOR';

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
}

export interface AuthorizationResource {
  phId: string;
  projectId?: string;
  teamId?: string;
  assigneeId?: string;
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
