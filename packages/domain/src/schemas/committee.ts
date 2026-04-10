import { z } from "zod";
import { randomId } from "../common";
import { roles, serviceLines, type Role, type ServiceLine } from "../enums";

export const committeeCadenceSchema = z.enum(["monthly", "quarterly", "semiannual", "annual", "ad_hoc"]);
export const committeeCategorySchema = z.enum([
  "leadership",
  "qapi",
  "hr_training",
  "revenue_commercial",
  "service_line_governance",
  "custom"
]);
export const committeeMeetingStatusSchema = z.enum([
  "planned",
  "packet_drafting",
  "packet_ready",
  "review_pending",
  "approved",
  "completed",
  "cancelled",
  "sent_back"
]);
export const committeeAgendaItemStatusSchema = z.enum(["proposed", "confirmed", "carried_forward", "closed"]);
export const committeeDecisionStatusSchema = z.enum(["open", "in_progress", "closed", "deferred"]);

export const committeeRecordSchema = z.object({
  id: z.string(),
  name: z.string(),
  category: committeeCategorySchema,
  cadence: committeeCadenceSchema,
  chairRole: z.enum(roles),
  recorderRole: z.enum(roles),
  scope: z.string(),
  serviceLine: z.enum(serviceLines).nullable().default(null),
  qapiFocus: z.boolean().default(false),
  isActive: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string()
});

export const committeeAgendaItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  summary: z.string(),
  ownerRole: z.enum(roles),
  dueDate: z.string().nullable().default(null),
  status: committeeAgendaItemStatusSchema,
  linkedIncidentId: z.string().nullable().default(null),
  linkedCapaId: z.string().nullable().default(null)
});

export const committeeDecisionRecordSchema = z.object({
  id: z.string(),
  summary: z.string(),
  ownerRole: z.enum(roles),
  dueDate: z.string().nullable().default(null),
  status: committeeDecisionStatusSchema,
  actionItemId: z.string().nullable().default(null),
  linkedIncidentId: z.string().nullable().default(null),
  linkedCapaId: z.string().nullable().default(null),
  notes: z.string().nullable().default(null)
});

export const committeeQapiSnapshotSchema = z.object({
  openIncidents: z.number().int().nonnegative(),
  criticalIncidents: z.number().int().nonnegative(),
  openCapas: z.number().int().nonnegative(),
  overdueCapas: z.number().int().nonnegative(),
  overdueActionItems: z.number().int().nonnegative(),
  pendingApprovals: z.number().int().nonnegative(),
  overdueScorecardReviews: z.number().int().nonnegative(),
  queuedJobs: z.number().int().nonnegative(),
  summaryNote: z.string().nullable().default(null)
});

export const committeeQapiDashboardSummarySchema = z.object({
  openIncidents: z.number().int().nonnegative(),
  criticalIncidents: z.number().int().nonnegative(),
  openCapas: z.number().int().nonnegative(),
  overdueCapas: z.number().int().nonnegative(),
  openEvidenceGaps: z.number().int().nonnegative(),
  verifiedEvidenceGaps: z.number().int().nonnegative(),
  criticalEvidenceGaps: z.number().int().nonnegative(),
  blockedEvidenceGaps: z.number().int().nonnegative(),
  overdueEvidenceGaps: z.number().int().nonnegative(),
  evidenceGapVerificationBacklog: z.number().int().nonnegative(),
  evidenceGapActionItemsOpen: z.number().int().nonnegative(),
  overdueActionItems: z.number().int().nonnegative(),
  pendingApprovals: z.number().int().nonnegative(),
  overdueScorecardReviews: z.number().int().nonnegative(),
  queuedJobs: z.number().int().nonnegative(),
  standardsAttentionNeeded: z.number().int().nonnegative(),
  standardsReviewPending: z.number().int().nonnegative(),
  overdueStandardsReviews: z.number().int().nonnegative(),
  standardsSurveyReady: z.number().int().nonnegative(),
  standardsWithCurrentEvidenceCoverage: z.number().int().nonnegative(),
  standardsMissingCurrentEvidence: z.number().int().nonnegative(),
  standardsMissingBinderLink: z.number().int().nonnegative(),
  evidenceBindersDraft: z.number().int().nonnegative(),
  evidenceBindersInReview: z.number().int().nonnegative(),
  evidenceBindersPublished: z.number().int().nonnegative(),
  controlledSubstancePacketsNeedingReview: z.number().int().nonnegative(),
  controlledSubstancePacketsPublished: z.number().int().nonnegative(),
  telehealthPacketsNeedingReview: z.number().int().nonnegative(),
  practiceAgreementsExpiringSoon: z.number().int().nonnegative()
});

export const committeeMeetingRecordSchema = z.object({
  id: z.string(),
  committeeId: z.string(),
  title: z.string(),
  scheduledFor: z.string(),
  status: committeeMeetingStatusSchema,
  packetDocumentId: z.string().nullable().default(null),
  workflowRunId: z.string().nullable().default(null),
  notes: z.string().nullable().default(null),
  agendaItems: z.array(committeeAgendaItemSchema),
  decisions: z.array(committeeDecisionRecordSchema),
  qapiSnapshot: committeeQapiSnapshotSchema.nullable().default(null),
  createdBy: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  completedAt: z.string().nullable().default(null)
});

export const committeeCreateSchema = z.object({
  name: z.string().min(3),
  category: committeeCategorySchema,
  cadence: committeeCadenceSchema,
  chairRole: z.enum(roles),
  recorderRole: z.enum(roles),
  scope: z.string().min(5),
  serviceLine: z.enum(serviceLines).nullable().optional(),
  qapiFocus: z.boolean().optional()
});

export const committeeUpdateSchema = z.object({
  name: z.string().min(3).optional(),
  category: committeeCategorySchema.optional(),
  cadence: committeeCadenceSchema.optional(),
  chairRole: z.enum(roles).optional(),
  recorderRole: z.enum(roles).optional(),
  scope: z.string().min(5).optional(),
  serviceLine: z.enum(serviceLines).nullable().optional(),
  qapiFocus: z.boolean().optional(),
  isActive: z.boolean().optional()
}).refine(
  (value) => Object.values(value).some((entry) => entry !== undefined),
  "At least one committee field must be updated."
);

export const committeeMeetingAgendaItemInputSchema = z.object({
  title: z.string().min(3),
  summary: z.string().min(5),
  ownerRole: z.enum(roles),
  dueDate: z.string().optional(),
  linkedIncidentId: z.string().optional(),
  linkedCapaId: z.string().optional()
});

export const committeeMeetingCreateSchema = z.object({
  committeeId: z.string(),
  title: z.string().min(3).optional(),
  scheduledFor: z.string(),
  notes: z.string().max(4000).optional(),
  agendaItems: z.array(committeeMeetingAgendaItemInputSchema).min(1),
  qapiSummaryNote: z.string().max(2000).optional()
});

export const committeeDecisionCreateSchema = z.object({
  summary: z.string().min(3),
  ownerRole: z.enum(roles),
  dueDate: z.string().optional(),
  notes: z.string().max(2000).optional(),
  status: committeeDecisionStatusSchema.optional(),
  linkedIncidentId: z.string().optional(),
  linkedCapaId: z.string().optional()
});

export const committeeMeetingDecisionCommandSchema = z.object({
  decisions: z.array(committeeDecisionCreateSchema).min(1)
});

export const committeeMeetingCompleteSchema = z.object({
  notes: z.string().max(2000).optional()
});

export type CommitteeCadence = z.infer<typeof committeeCadenceSchema>;
export type CommitteeCategory = z.infer<typeof committeeCategorySchema>;
export type CommitteeMeetingStatus = z.infer<typeof committeeMeetingStatusSchema>;
export type CommitteeAgendaItemStatus = z.infer<typeof committeeAgendaItemStatusSchema>;
export type CommitteeDecisionStatus = z.infer<typeof committeeDecisionStatusSchema>;
export type CommitteeRecord = z.infer<typeof committeeRecordSchema>;
export type CommitteeAgendaItem = z.infer<typeof committeeAgendaItemSchema>;
export type CommitteeDecisionRecord = z.infer<typeof committeeDecisionRecordSchema>;
export type CommitteeQapiSnapshot = z.infer<typeof committeeQapiSnapshotSchema>;
export type CommitteeQapiDashboardSummary = z.infer<typeof committeeQapiDashboardSummarySchema>;
export type CommitteeMeetingRecord = z.infer<typeof committeeMeetingRecordSchema>;
export type Committee = CommitteeRecord;

export function createCommitteeRecord(input: {
  name: string;
  category: CommitteeCategory;
  cadence: CommitteeCadence;
  chairRole: Role;
  recorderRole: Role;
  scope: string;
  serviceLine?: ServiceLine | null;
  qapiFocus?: boolean;
  isActive?: boolean;
}): CommitteeRecord {
  const now = new Date().toISOString();
  return committeeRecordSchema.parse({
    id: randomId("committee"),
    name: input.name,
    category: input.category,
    cadence: input.cadence,
    chairRole: input.chairRole,
    recorderRole: input.recorderRole,
    scope: input.scope,
    serviceLine: input.serviceLine ?? null,
    qapiFocus: input.qapiFocus ?? input.category === "qapi",
    isActive: input.isActive ?? true,
    createdAt: now,
    updatedAt: now
  });
}

export function createCommitteeMeetingRecord(input: {
  committeeId: string;
  title: string;
  scheduledFor: string;
  notes?: string | null;
  agendaItems: Array<{
    title: string;
    summary: string;
    ownerRole: Role;
    dueDate?: string | null;
    linkedIncidentId?: string | null;
    linkedCapaId?: string | null;
  }>;
  qapiSnapshot?: CommitteeQapiSnapshot | null;
  createdBy: string;
}): CommitteeMeetingRecord {
  const now = new Date().toISOString();
  return committeeMeetingRecordSchema.parse({
    id: randomId("committee_meeting"),
    committeeId: input.committeeId,
    title: input.title,
    scheduledFor: input.scheduledFor,
    status: "planned",
    packetDocumentId: null,
    workflowRunId: null,
    notes: input.notes ?? null,
    agendaItems: input.agendaItems.map((item) => ({
      id: randomId("committee_agenda"),
      title: item.title,
      summary: item.summary,
      ownerRole: item.ownerRole,
      dueDate: item.dueDate ?? null,
      status: "proposed",
      linkedIncidentId: item.linkedIncidentId ?? null,
      linkedCapaId: item.linkedCapaId ?? null
    })),
    decisions: [],
    qapiSnapshot: input.qapiSnapshot ?? null,
    createdBy: input.createdBy,
    createdAt: now,
    updatedAt: now,
    completedAt: null
  });
}
