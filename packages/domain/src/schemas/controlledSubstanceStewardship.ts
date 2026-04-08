import { z } from "zod";
import { randomId } from "../common";
import { roles, serviceLines, type Role, type ServiceLine } from "../enums";

export const controlledSubstanceStewardshipStatusSchema = z.enum([
  "draft",
  "approval_pending",
  "approved",
  "publish_pending",
  "published",
  "sent_back",
  "archived"
]);

export const controlledSubstanceStewardshipRecordSchema = z.object({
  id: z.string(),
  title: z.string(),
  ownerRole: z.enum(roles),
  supervisingPhysicianRole: z.enum(roles),
  serviceLineIds: z.array(z.enum(serviceLines)).min(1),
  status: controlledSubstanceStewardshipStatusSchema,
  linkedPracticeAgreementId: z.string().nullable().default(null),
  prescribingScopeSummary: z.string(),
  pdmpReviewSummary: z.string(),
  screeningProtocolSummary: z.string(),
  refillEscalationSummary: z.string(),
  inventoryControlSummary: z.string(),
  patientEducationSummary: z.string(),
  adverseEventEscalationSummary: z.string(),
  reviewCadenceDays: z.number().int().positive().max(365),
  effectiveDate: z.string().nullable().default(null),
  reviewDueAt: z.string().nullable().default(null),
  notes: z.string().nullable().default(null),
  documentId: z.string().nullable().default(null),
  workflowRunId: z.string().nullable().default(null),
  createdBy: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  publishedAt: z.string().nullable().default(null),
  publishedPath: z.string().nullable().default(null)
});

const sharedFields = {
  title: z.string().min(3),
  ownerRole: z.enum(roles),
  supervisingPhysicianRole: z.enum(roles),
  serviceLineIds: z.array(z.enum(serviceLines)).min(1),
  linkedPracticeAgreementId: z.string().nullable().optional(),
  prescribingScopeSummary: z.string().min(10),
  pdmpReviewSummary: z.string().min(10),
  screeningProtocolSummary: z.string().min(10),
  refillEscalationSummary: z.string().min(10),
  inventoryControlSummary: z.string().min(10),
  patientEducationSummary: z.string().min(10),
  adverseEventEscalationSummary: z.string().min(10),
  reviewCadenceDays: z.number().int().positive().max(365).optional(),
  effectiveDate: z.string().nullable().optional(),
  notes: z.string().max(2000).optional()
} as const;

export const controlledSubstanceStewardshipCreateSchema = z.object(sharedFields);

export const controlledSubstanceStewardshipUpdateSchema = z.object({
  title: sharedFields.title.optional(),
  ownerRole: sharedFields.ownerRole.optional(),
  supervisingPhysicianRole: sharedFields.supervisingPhysicianRole.optional(),
  serviceLineIds: sharedFields.serviceLineIds.optional(),
  linkedPracticeAgreementId: sharedFields.linkedPracticeAgreementId,
  prescribingScopeSummary: sharedFields.prescribingScopeSummary.optional(),
  pdmpReviewSummary: sharedFields.pdmpReviewSummary.optional(),
  screeningProtocolSummary: sharedFields.screeningProtocolSummary.optional(),
  refillEscalationSummary: sharedFields.refillEscalationSummary.optional(),
  inventoryControlSummary: sharedFields.inventoryControlSummary.optional(),
  patientEducationSummary: sharedFields.patientEducationSummary.optional(),
  adverseEventEscalationSummary: sharedFields.adverseEventEscalationSummary.optional(),
  reviewCadenceDays: sharedFields.reviewCadenceDays,
  effectiveDate: sharedFields.effectiveDate,
  notes: sharedFields.notes.nullable().optional(),
  status: controlledSubstanceStewardshipStatusSchema.optional()
}).refine(
  (value) => Object.values(value).some((entry) => entry !== undefined),
  "At least one controlled-substance stewardship field must be updated."
);

export type ControlledSubstanceStewardshipStatus = z.infer<typeof controlledSubstanceStewardshipStatusSchema>;
export type ControlledSubstanceStewardshipRecord = z.infer<typeof controlledSubstanceStewardshipRecordSchema>;
export type ControlledSubstanceStewardshipCreateCommand = z.infer<typeof controlledSubstanceStewardshipCreateSchema>;
export type ControlledSubstanceStewardshipUpdateCommand = z.infer<typeof controlledSubstanceStewardshipUpdateSchema>;

export function createControlledSubstanceStewardshipRecord(input: {
  title: string;
  ownerRole: Role;
  supervisingPhysicianRole: Role;
  serviceLineIds: ServiceLine[];
  linkedPracticeAgreementId?: string | null;
  prescribingScopeSummary: string;
  pdmpReviewSummary: string;
  screeningProtocolSummary: string;
  refillEscalationSummary: string;
  inventoryControlSummary: string;
  patientEducationSummary: string;
  adverseEventEscalationSummary: string;
  reviewCadenceDays?: number;
  effectiveDate?: string | null;
  notes?: string | null;
  documentId?: string | null;
  workflowRunId?: string | null;
  createdBy: string;
}): ControlledSubstanceStewardshipRecord {
  const now = new Date().toISOString();
  return controlledSubstanceStewardshipRecordSchema.parse({
    id: randomId("controlled_substance_stewardship"),
    title: input.title,
    ownerRole: input.ownerRole,
    supervisingPhysicianRole: input.supervisingPhysicianRole,
    serviceLineIds: input.serviceLineIds,
    status: "draft",
    linkedPracticeAgreementId: input.linkedPracticeAgreementId ?? null,
    prescribingScopeSummary: input.prescribingScopeSummary,
    pdmpReviewSummary: input.pdmpReviewSummary,
    screeningProtocolSummary: input.screeningProtocolSummary,
    refillEscalationSummary: input.refillEscalationSummary,
    inventoryControlSummary: input.inventoryControlSummary,
    patientEducationSummary: input.patientEducationSummary,
    adverseEventEscalationSummary: input.adverseEventEscalationSummary,
    reviewCadenceDays: input.reviewCadenceDays ?? 45,
    effectiveDate: input.effectiveDate ?? null,
    reviewDueAt: null,
    notes: input.notes ?? null,
    documentId: input.documentId ?? null,
    workflowRunId: input.workflowRunId ?? null,
    createdBy: input.createdBy,
    createdAt: now,
    updatedAt: now,
    publishedAt: null,
    publishedPath: null
  });
}
