export { statusCategorySchema, type WorkItem } from '@task-manager/shared';

export const isCompletedCategory = (category: string) => category === 'DONE';
