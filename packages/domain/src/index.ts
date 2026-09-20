export { statusCategorySchema, type WorkItem } from '@task-manager/shared';
export * from './authorization.ts';
export * from './workflow.ts';
export * from './work-item-selectors.ts';
export * from './report-selectors.ts';

export const isCompletedCategory = (category: string) => category === 'DONE';
