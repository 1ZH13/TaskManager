export { statusCategorySchema, type WorkItem } from '@task-manager/shared';
export * from './authorization.ts';

export const isCompletedCategory = (category: string) => category === 'DONE';
