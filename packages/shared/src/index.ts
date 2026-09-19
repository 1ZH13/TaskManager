import { z } from 'zod';

const isoDateTime = z.iso.datetime({ offset: true });
const entity = z.object({
  id: z.uuid(),
  phId: z.uuid(),
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
  version: z.int().nonnegative(),
});

export const managementModuleSchema = z.enum(['ADMINISTRATIVE', 'OPERATIONS', 'ACCOUNTING']);
export const statusCategorySchema = z.enum(['TODO', 'IN_PROGRESS', 'BLOCKED', 'DONE']);
export const workItemTypeSchema = z.enum(['TASK', 'RECURRING_TASK', 'INCIDENT', 'SUBTASK', 'MILESTONE']);
export const prioritySchema = z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']);
export const roleSchema = z.enum(['ADMIN', 'COLLABORATOR']);

export const propertyContextSchema = entity.extend({
  name: z.string().min(1), code: z.string().min(2), status: z.enum(['ACTIVE', 'INACTIVE']),
});
export const projectSchema = entity.extend({
  module: managementModuleSchema, key: z.string().regex(/^[A-Z]{2,10}$/), name: z.string().min(1),
  description: z.string().optional(), icon: z.string().optional(), color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  startsOn: z.iso.date().optional(), endsOn: z.iso.date().optional(), status: z.enum(['ACTIVE', 'ARCHIVED']),
}).refine((project) => !project.startsOn || !project.endsOn || project.startsOn <= project.endsOn, { message: 'La fecha de inicio debe preceder a la fecha final', path: ['endsOn'] });
export const boardSchema = entity.extend({ projectId: z.uuid(), name: z.string().min(1), teamIds: z.array(z.uuid()) });
export const boardColumnSchema = z.object({ id: z.uuid(), phId: z.uuid(), boardId: z.uuid(), name: z.string().min(1), category: statusCategorySchema, color: z.string().regex(/^#[0-9A-Fa-f]{6}$/), position: z.int().nonnegative() });
export const workItemSchema = entity.extend({
  projectId: z.uuid(), boardId: z.uuid(), columnId: z.uuid(), key: z.string().regex(/^[A-Z]{2,10}-\d+$/), type: workItemTypeSchema,
  title: z.string().min(1), description: z.string().optional(), priority: prioritySchema, reporterId: z.uuid(), assigneeId: z.uuid().optional(), teamId: z.uuid().optional(), providerId: z.uuid().optional(), parentId: z.uuid().optional(), startsOn: z.iso.date().optional(), dueOn: z.iso.date().optional(), blockedReason: z.string().min(1).optional(), requiresEvidence: z.boolean(), requiresValidation: z.boolean(), evidenceUrl: z.url().optional(), evidenceSubmittedAt: isoDateTime.optional(), validationStatus: z.enum(['NOT_REQUIRED', 'PENDING', 'APPROVED', 'REJECTED']), validationComment: z.string().min(1).optional(), position: z.int().nonnegative(), labels: z.array(z.string().min(1)),
}).refine((item) => !item.startsOn || !item.dueOn || item.startsOn <= item.dueOn, { message: 'La fecha inicial debe preceder al vencimiento', path: ['dueOn'] });
export const personSchema = entity.extend({ nationalId: z.string().min(3), firstName: z.string().min(1), lastName: z.string().min(1), displayName: z.string().min(1), avatarUrl: z.url().optional(), jobTitle: z.string().optional(), role: roleSchema, status: z.enum(['ACTIVE', 'INACTIVE']) });
export const teamSchema = entity.extend({ name: z.string().min(1), type: z.enum(['ADMINISTRATION', 'OPERATIONS', 'CLEANING', 'MAINTENANCE', 'SECURITY', 'ACCOUNTING', 'OTHER']), description: z.string().optional(), leadId: z.uuid().optional(), memberIds: z.array(z.uuid()), status: z.enum(['ACTIVE', 'ARCHIVED']) });
export const providerReferenceSchema = entity.extend({ externalId: z.string().min(1), source: z.literal('PH_PLATFORM'), name: z.string().min(1), legalName: z.string().optional(), taxId: z.string().optional(), status: z.enum(['ACTIVE', 'INACTIVE']), syncedAt: isoDateTime.optional() });

const association = entity.extend({});
export const projectTeamSchema = association.extend({ projectId: z.uuid(), teamId: z.uuid(), isPrimary: z.boolean() });
export const projectMemberSchema = association.extend({ projectId: z.uuid(), personId: z.uuid(), access: z.enum(['VIEWER', 'CONTRIBUTOR', 'MANAGER']) });
export const boardTeamSchema = association.extend({ boardId: z.uuid(), teamId: z.uuid() });
export const teamMembershipSchema = association.extend({ teamId: z.uuid(), personId: z.uuid(), role: z.enum(['LEAD', 'MEMBER']) });

export type PropertyContext = z.infer<typeof propertyContextSchema>;
export type Project = z.infer<typeof projectSchema>;
export type Board = z.infer<typeof boardSchema>;
export type BoardColumn = z.infer<typeof boardColumnSchema>;
export type WorkItem = z.infer<typeof workItemSchema>;
export type Person = z.infer<typeof personSchema>;
export type Team = z.infer<typeof teamSchema>;
export type ProviderReference = z.infer<typeof providerReferenceSchema>;
export type ProjectTeam = z.infer<typeof projectTeamSchema>;
export type ProjectMember = z.infer<typeof projectMemberSchema>;
export type BoardTeam = z.infer<typeof boardTeamSchema>;
export type TeamMembership = z.infer<typeof teamMembershipSchema>;
