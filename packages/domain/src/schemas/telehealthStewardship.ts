import { z } from "zod";
import { randomId } from "../common";
import { roles, type Role } from "../enums";

export const telehealthStewardshipStatusSchema = z.enum([
  "draft",
  "approval_pending",
  "approved",
  "publish_pending",
  "published",
  "sent_back",
  "archived"
]);

export const telehealthStewardshipRecordSchema = z.object({
  id: z.string(),
  serviceLineId: z.literal("telehealth"),
  title: z.string(),
  ownerRole: z.enum(roles),
  supervisingPhysicianRole: z.enum(roles),
  status: telehealthStewardshipStatusSchema,
  linkedPracticeAgreementId: z.string().nullable().default(null),
  delegatedTaskCodes: z.array(z.string()).default([]),
  modalityScopeSummary: z.string(),
  stateCoverageSummary: z.string(),
  patientIdentitySummary: z.string(),
  consentWorkflowSummary: z.string(),
  documentationStandardSummary: z.string(),
  emergencyRedirectSummary: z.string(),
  qaReviewSummary: z.string(),
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
  linkedPracticeAgreementId: z.string().nullable().optional(),
  delegatedTaskCodes: z.array(z.string().min(2)).default([]),
  modalityScopeSummary: z.string().min(10),
  stateCoverageSummary: z.string().min(10),
  patientIdentitySummary: z.string().min(10),
  consentWorkflowSummary: z.string().min(10),
  documentationStandardSummary: z.string().min(10),
  emergencyRedirectSummary: z.string().min(10),
  qaReviewSummary: z.string().min(10),
  reviewCadenceDays: z.number().int().positive().max(365).optional(),
  effectiveDate: z.string().nullable().optional(),
  notes: z.string().max(2000).optional()
} as const;

export const telehealthStewardshipCreateSchema = z.object(sharedFields);

export const telehealthStewardshipUpdateSchema = z.object({
  title: sharedFields.title.optional(),
  ownerRole: sharedFields.ownerRole.optional(),
  supervisingPhysicianRole: sharedFields.supervisingPhysicianRole.optional(),
  linkedPracticeAgreementId: sharedFields.linkedPracticeAgreementId,
  delegatedTaskCodes: sharedFields.delegatedTaskCodes.optional(),
  modalityScopeSummary: sharedFields.modalityScopeSummary.optional(),
  stateCoverageSummary: sharedFields.stateCoverageSummary.optional(),
  patientIdentitySummary: sharedFields.patientIdentitySummary.optional(),
  consentWorkflowSummary: sharedFields.consentWorkflowSummary.optional(),
  documentationStandardSummary: sharedFields.documentationStandardSummary.optional(),
  emergencyRedirectSummary: sharedFields.emergencyRedirectSummary.optional(),
  qaReviewSummary: sharedFields.qaReviewSummary.optional(),
  reviewCadenceDays: sharedFields.reviewCadenceDays,
  effectiveDate: sharedFields.effectiveDate,
  notes: sharedFields.notes.nullable().optional(),
  status: telehealthStewardshipStatusSchema.optional()
}).refine(
  (value) => Object.values(value).some((entry) => entry !== undefined),
  "At least one telehealth-stewardship field must be updated."
);

export type TelehealthStewardshipStatus = z.infer<typeof telehealthStewardshipStatusSchema>;
export type TelehealthStewardshipRecord = z.infer<typeof telehealthStewardshipRecordSchema>;
export type TelehealthStewardshipCreateCommand = z.infer<typeof telehealthStewardshipCreateSchema>;
export type TelehealthStewardshipUpdateCommand = z.infer<typeof telehealthStewardshipUpdateSchema>;

export function createTelehealthStewardshipRecord(input: {
  title: string;
  ownerRole: Role;
  supervisingPhysicianRole: Role;
  linkedPracticeAgreementId?: string | null;
  delegatedTaskCodes?: string[];
  modalityScopeSummary: string;
  stateCoverageSummary: string;
  patientIdentitySummary: string;
  consentWorkflowSummary: string;
  documentationStandardSummary: string;
  emergencyRedirectSummary: string;
  qaReviewSummary: string;
  reviewCadenceDays?: number;
  effectiveDate?: string | null;
  notes?: string | null;
  documentId?: string | null;
  workflowRunId?: string | null;
  createdBy: string;
}): TelehealthStewardshipRecord {
  const now = new Date().toISOString();
  return telehealthStewardshipRecordSchema.parse({
    id: randomId("telehealth_stewardship"),
    serviceLineId: "telehealth",
    title: input.title,
    ownerRole: input.ownerRole,
    supervisingPhysicianRole: input.supervisingPhysicianRole,
    status: "draft",
    linkedPracticeAgreementId: input.linkedPracticeAgreementId ?? null,
    delegatedTaskCodes: input.delegatedTaskCodes ?? [],
    modalityScopeSummary: input.modalityScopeSummary,
    stateCoverageSummary: input.stateCoverageSummary,
    patientIdentitySummary: input.patientIdentitySummary,
    consentWorkflowSummary: input.consentWorkflowSummary,
    documentationStandardSummary: input.documentationStandardSummary,
    emergencyRedirectSummary: input.emergencyRedirectSummary,
    qaReviewSummary: input.qaReviewSummary,
    reviewCadenceDays: input.reviewCadenceDays ?? 60,
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
