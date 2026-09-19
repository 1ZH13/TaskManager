export { statusCategorySchema, type WorkItem } from '@task-manager/shared';
export * from './authorization.js';

export const isCompletedCategory = (category: string) => category === 'DONE';
