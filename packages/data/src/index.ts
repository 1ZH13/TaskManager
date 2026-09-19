import type { Board, Person, Project, ProviderReference, Team, WorkItem } from '@task-manager/shared';

export interface RepositoryError { code: string; message: string; requestId: string; details?: unknown; }
export interface Page<T> { items: T[]; nextCursor?: string; }
export interface ProjectQuery { phId: string; module?: Project['module']; }
export interface WorkItemQuery { phId: string; projectId?: string; boardId?: string; cursor?: string; }
export interface PeopleQuery { phId: string; }
export interface TeamQuery { phId: string; }
export interface ProviderQuery { phId: string; }
export type CreateWorkItemInput = Omit<WorkItem, 'id' | 'createdAt' | 'updatedAt' | 'version'>;
export type UpdateWorkItemInput = Partial<Omit<CreateWorkItemInput, 'phId' | 'projectId' | 'boardId'>> & { version: number; };
export interface MoveWorkItemInput { id: string; phId: string; columnId: string; position: number; version: number; }
export interface WorkManagementRepository {
  listProjects(query: ProjectQuery): Promise<Project[]>;
  getProject(id: string): Promise<Project>;
  listBoards(projectId: string): Promise<Board[]>;
  listWorkItems(query: WorkItemQuery): Promise<Page<WorkItem>>;
  createWorkItem(input: CreateWorkItemInput): Promise<WorkItem>;
  updateWorkItem(id: string, input: UpdateWorkItemInput): Promise<WorkItem>;
  moveWorkItem(input: MoveWorkItemInput): Promise<WorkItem>;
  listPeople(query: PeopleQuery): Promise<Person[]>;
  listTeams(query: TeamQuery): Promise<Team[]>;
  listProviders(query: ProviderQuery): Promise<ProviderReference[]>;
}
