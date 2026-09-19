export interface RepositoryError { code: string; message: string; requestId: string; details?: unknown; }
export interface Repository<T> { list(contextId: string): Promise<T[]>; get(id: string): Promise<T>; }
