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
export const recurrenceFrequencySchema = z.enum(['DAILY', 'WEEKLY', 'MONTHLY', 'CUSTOM']);
export const recurrenceRuleSchema = z.object({
  frequency: recurrenceFrequencySchema,
  interval: z.int().positive().default(1),
  startsOn: z.iso.date(),
  endsOn: z.iso.date().optional(),
  occurrenceCount: z.int().positive().optional(),
  weekdays: z.array(z.int().min(0).max(6)).default([]),
}).refine((rule) => !(rule.endsOn && rule.occurrenceCount), { message: 'La recurrencia usa fecha final o cantidad de repeticiones, no ambas.', path: ['occurrenceCount'] });

export const propertyContextSchema = entity.extend({
  name: z.string().min(1), code: z.string().min(2), status: z.enum(['ACTIVE', 'INACTIVE']),
});
export const projectSchema = entity.extend({
  module: managementModuleSchema, key: z.string().regex(/^[A-Z]{2,10}$/), name: z.string().min(1),
  description: z.string().optional(), icon: z.string().optional(), color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  startsOn: z.iso.date().optional(), endsOn: z.iso.date().optional(), status: z.enum(['ACTIVE', 'ARCHIVED']),
}).refine((project) => !project.startsOn || !project.endsOn || project.startsOn <= project.endsOn, { message: 'La fecha de inicio debe preceder a la fecha final', path: ['endsOn'] });
export const boardSchema = entity.extend({ projectId: z.uuid(), name: z.string().min(1), teamIds: z.array(z.uuid()) });
export const boardColumnSchema = z.object({ id: z.uuid(), phId: z.uuid(), boardId: z.uuid(), name: z.string().min(1), category: statusCategorySchema, color: z.string().regex(/^#[0-9A-Fa-f]{6}$/), position: z.int().nonnegative(), minItems: z.int().nonnegative().optional(), maxItems: z.int().positive().optional() }).refine((column) => column.minItems === undefined || column.maxItems === undefined || column.minItems <= column.maxItems, { message: 'El límite mínimo no puede superar el máximo.', path: ['minItems'] });
export const validationPolicySchema = entity.extend({
  projectId: z.uuid(), requiresValidation: z.boolean(), waitingColumnId: z.uuid().optional(), approvedColumnId: z.uuid().optional(), rejectedColumnId: z.uuid().optional(),
});
export const workCommentSchema = entity.extend({ workItemId: z.uuid(), authorId: z.uuid(), body: z.string().min(1) });
export const workAttachmentSchema = entity.extend({ workItemId: z.uuid(), name: z.string().min(1), mimeType: z.string().min(1), sizeBytes: z.int().nonnegative(), url: z.url() });
export const workActivitySchema = entity.extend({ workItemId: z.uuid(), actorId: z.uuid(), type: z.enum(['CREATED', 'UPDATED', 'ASSIGNED', 'MOVED', 'BLOCKED', 'EVIDENCE_SUBMITTED', 'COMMENTED']), message: z.string().min(1), toStatusCategory: statusCategorySchema.optional() });
export const workItemSchema = entity.extend({
  projectId: z.uuid(), boardId: z.uuid(), columnId: z.uuid(), key: z.string().regex(/^[A-Z]{2,10}-\d+$/), type: workItemTypeSchema,
  title: z.string().min(1), description: z.string().optional(), priority: prioritySchema, reporterId: z.uuid(), assigneeId: z.uuid().optional(), teamId: z.uuid().optional(), providerId: z.uuid().optional(), parentId: z.uuid().optional(), startsOn: z.iso.date().optional(), dueOn: z.iso.date().optional(), recurrence: recurrenceRuleSchema.optional(), dependencyIds: z.array(z.uuid()).default([]), blockedReason: z.string().min(1).optional(), requiresEvidence: z.boolean(), requiresValidation: z.boolean(), evidenceUrl: z.url().optional(), evidenceSubmittedAt: isoDateTime.optional(), validationStatus: z.enum(['NOT_REQUIRED', 'PENDING', 'APPROVED', 'REJECTED']), validationComment: z.string().min(1).optional(), position: z.int().nonnegative(), labels: z.array(z.string().min(1)),
}).refine((item) => !item.startsOn || !item.dueOn || item.startsOn <= item.dueOn, { message: 'La fecha inicial debe preceder al vencimiento', path: ['dueOn'] });
export const personSchema = entity.extend({ nationalId: z.string().min(3), firstName: z.string().min(1), lastName: z.string().min(1), displayName: z.string().min(1), avatarUrl: z.url().optional(), jobTitle: z.string().optional(), role: roleSchema, status: z.enum(['ACTIVE', 'INACTIVE']) });
export const teamSchema = entity.extend({ name: z.string().min(1), type: z.enum(['ADMINISTRATION', 'OPERATIONS', 'CLEANING', 'MAINTENANCE', 'SECURITY', 'ACCOUNTING', 'OTHER']), description: z.string().optional(), leadId: z.uuid().optional(), memberIds: z.array(z.uuid()), status: z.enum(['ACTIVE', 'ARCHIVED']) });
export const providerReferenceSchema = entity.extend({ externalId: z.string().min(1), source: z.literal('PH_PLATFORM'), name: z.string().min(1), legalName: z.string().optional(), taxId: z.string().optional(), status: z.enum(['ACTIVE', 'INACTIVE']), syncedAt: isoDateTime.optional() });
export const documentSchema = entity.extend({
  name: z.string().min(1), mimeType: z.string().min(1), sizeBytes: z.int().nonnegative(), url: z.url(),
  projectId: z.uuid().optional(), workItemId: z.uuid().optional(), providerId: z.uuid().optional(), teamId: z.uuid().optional(), uploadedById: z.uuid(),
});
export const formFieldSchema = z.object({
  id: z.string().min(1), label: z.string().min(1), type: z.enum(['TEXT', 'TEXTAREA', 'EMAIL', 'NUMBER', 'DATE', 'TIME', 'SELECT', 'CHECKBOX', 'FILE']), required: z.boolean(), options: z.array(z.string().min(1)).optional(),
});
export const formSchema = entity.extend({
  projectId: z.uuid().optional(), name: z.string().min(1), description: z.string().optional(), status: z.enum(['DRAFT', 'PUBLISHED']), fields: z.array(formFieldSchema), createTask: z.boolean(), destinationProjectId: z.uuid().optional(), destinationBoardId: z.uuid().optional(),
});
export const formSubmissionSchema = entity.extend({ formId: z.uuid(), submittedById: z.uuid(), values: z.record(z.string(), z.unknown()), createdWorkItemId: z.uuid().optional() });
export const notificationSchema = entity.extend({ recipientId: z.uuid(), title: z.string().min(1), body: z.string().min(1), resourceType: z.enum(['WORK_ITEM', 'DOCUMENT', 'FORM', 'PROVIDER']), resourceId: z.uuid(), readAt: isoDateTime.optional() });
export const appointmentRequestSchema = z.object({ ruc: z.string().trim().min(3).max(32), dv: z.string().trim().min(1).max(8), attendeeName: z.string().trim().min(3).max(120), date: z.iso.date(), time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/) });
export const invoiceSubmissionSchema = z.object({ invoiceName: z.string().trim().min(3).max(160), documentUrl: z.url(), subtotal: z.coerce.number().nonnegative(), itbmsRate: z.coerce.number().min(0).max(1), notes: z.string().trim().max(1000).optional() }).transform((value) => ({ ...value, tax: Number((value.subtotal * value.itbmsRate).toFixed(2)), total: Number((value.subtotal * (1 + value.itbmsRate)).toFixed(2)) }));

const association = entity.extend({});
export const projectTeamSchema = association.extend({ projectId: z.uuid(), teamId: z.uuid(), isPrimary: z.boolean() });
export const projectMemberSchema = association.extend({ projectId: z.uuid(), personId: z.uuid(), access: z.enum(['VIEWER', 'CONTRIBUTOR', 'MANAGER']) });
export const boardTeamSchema = association.extend({ boardId: z.uuid(), teamId: z.uuid() });
export const teamMembershipSchema = association.extend({ teamId: z.uuid(), personId: z.uuid(), role: z.enum(['LEAD', 'MEMBER']) });

export type PropertyContext = z.infer<typeof propertyContextSchema>;
export type Project = z.infer<typeof projectSchema>;
export type Board = z.infer<typeof boardSchema>;
export type BoardColumn = z.infer<typeof boardColumnSchema>;
export type ValidationPolicy = z.infer<typeof validationPolicySchema>;
export type WorkItem = z.infer<typeof workItemSchema>;
export type RecurrenceRule = z.infer<typeof recurrenceRuleSchema>;
export type WorkComment = z.infer<typeof workCommentSchema>;
export type WorkAttachment = z.infer<typeof workAttachmentSchema>;
export type WorkActivity = z.infer<typeof workActivitySchema>;
export type Person = z.infer<typeof personSchema>;
export type Team = z.infer<typeof teamSchema>;
export type ProviderReference = z.infer<typeof providerReferenceSchema>;
export type Document = z.infer<typeof documentSchema>;
export type FormDefinition = z.infer<typeof formSchema>;
export type FormField = z.infer<typeof formFieldSchema>;
export type FormSubmission = z.infer<typeof formSubmissionSchema>;
export type Notification = z.infer<typeof notificationSchema>;
export type AppointmentRequest = z.infer<typeof appointmentRequestSchema>;
export type InvoiceSubmission = z.infer<typeof invoiceSubmissionSchema>;
export type ProjectTeam = z.infer<typeof projectTeamSchema>;
export type ProjectMember = z.infer<typeof projectMemberSchema>;
export type BoardTeam = z.infer<typeof boardTeamSchema>;
export type TeamMembership = z.infer<typeof teamMembershipSchema>;
