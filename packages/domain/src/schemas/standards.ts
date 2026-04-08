import { z } from "zod";
import { randomId } from "../common";
import { roles, type Role } from "../enums";

export const accreditationDomainSchema = z.enum([
  "leadership",
  "medication_management",
  "infection_prevention",
  "staff_competency",
  "environment_of_care",
  "documentation",
  "rights_education",
  "lab_testing",
  "emergency_preparedness",
  "custom"
]);

export const standardMappingStatusSchema = z.enum([
  "not_started",
  "mapped",
  "evidence_ready",
  "review_pending",
  "complete",
  "attention_needed"
]);

export const evidenceBinderStatusSchema = z.enum([
  "draft",
  "approval_pending",
  "approved",
  "publish_pending",
  "published",
  "sent_back",
  "archived"
]);

export const standardMappingRecordSchema = z.object({
  id: z.string(),
  standardCode: z.string(),
  title: z.string(),
  domain: accreditationDomainSchema,
  sourceAuthority: z.string(),
  ownerRole: z.enum(roles),
  status: standardMappingStatusSchema,
  requirementSummary: z.string(),
  evidenceExpectation: z.string(),
  evidenceDocumentIds: z.array(z.string()).default([]),
  latestBinderId: z.string().nullable().default(null),
  reviewCadenceDays: z.number().int().positive().max(365),
  lastReviewedAt: z.string().nullable().default(null),
  nextReviewDueAt: z.string().nullable().default(null),
  notes: z.string().nullable().default(null),
  createdAt: z.string(),
  updatedAt: z.string()
});

export const evidenceBinderRecordSchema = z.object({
  id: z.string(),
  title: z.string(),
  ownerRole: z.enum(roles),
  status: evidenceBinderStatusSchema,
  sourceAuthority: z.string(),
  surveyWindowLabel: z.string().nullable().default(null),
  standardIds: z.array(z.string()).min(1),
  summary: z.string(),
  evidenceReadinessSummary: z.string(),
  openGapSummary: z.string(),
  reviewCadenceDays: z.number().int().positive().max(365),
  notes: z.string().nullable().default(null),
  documentId: z.string().nullable().default(null),
  workflowRunId: z.string().nullable().default(null),
  createdBy: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  publishedAt: z.string().nullable().default(null),
  publishedPath: z.string().nullable().default(null)
});

const standardSharedFields = {
  standardCode: z.string().min(2),
  title: z.string().min(3),
  domain: accreditationDomainSchema,
  sourceAuthority: z.string().min(2),
  ownerRole: z.enum(roles),
  requirementSummary: z.string().min(10),
  evidenceExpectation: z.string().min(10),
  evidenceDocumentIds: z.array(z.string()).default([]),
  reviewCadenceDays: z.number().int().positive().max(365).optional(),
  notes: z.string().max(2000).optional()
} as const;

export const standardMappingCreateSchema = z.object(standardSharedFields);

export const standardMappingUpdateSchema = z.object({
  standardCode: standardSharedFields.standardCode.optional(),
  title: standardSharedFields.title.optional(),
  domain: standardSharedFields.domain.optional(),
  sourceAuthority: standardSharedFields.sourceAuthority.optional(),
  ownerRole: standardSharedFields.ownerRole.optional(),
  status: standardMappingStatusSchema.optional(),
  requirementSummary: standardSharedFields.requirementSummary.optional(),
  evidenceExpectation: standardSharedFields.evidenceExpectation.optional(),
  evidenceDocumentIds: standardSharedFields.evidenceDocumentIds.optional(),
  latestBinderId: z.string().nullable().optional(),
  reviewCadenceDays: standardSharedFields.reviewCadenceDays,
  lastReviewedAt: z.string().nullable().optional(),
  nextReviewDueAt: z.string().nullable().optional(),
  notes: standardSharedFields.notes.nullable().optional()
}).refine(
  (value) => Object.values(value).some((entry) => entry !== undefined),
  "At least one standards-mapping field must be updated."
);

const binderSharedFields = {
  title: z.string().min(3),
  ownerRole: z.enum(roles),
  sourceAuthority: z.string().min(2),
  surveyWindowLabel: z.string().max(200).optional(),
  standardIds: z.array(z.string()).min(1),
  summary: z.string().min(10),
  evidenceReadinessSummary: z.string().min(10),
  openGapSummary: z.string().min(10),
  reviewCadenceDays: z.number().int().positive().max(365).optional(),
  notes: z.string().max(2000).optional()
} as const;

export const evidenceBinderCreateSchema = z.object(binderSharedFields);

export const evidenceBinderUpdateSchema = z.object({
  title: binderSharedFields.title.optional(),
  ownerRole: binderSharedFields.ownerRole.optional(),
  sourceAuthority: binderSharedFields.sourceAuthority.optional(),
  surveyWindowLabel: binderSharedFields.surveyWindowLabel.nullable().optional(),
  standardIds: binderSharedFields.standardIds.optional(),
  summary: binderSharedFields.summary.optional(),
  evidenceReadinessSummary: binderSharedFields.evidenceReadinessSummary.optional(),
  openGapSummary: binderSharedFields.openGapSummary.optional(),
  reviewCadenceDays: binderSharedFields.reviewCadenceDays,
  notes: binderSharedFields.notes.nullable().optional(),
  status: evidenceBinderStatusSchema.optional()
}).refine(
  (value) => Object.values(value).some((entry) => entry !== undefined),
  "At least one evidence-binder field must be updated."
);

export type AccreditationDomain = z.infer<typeof accreditationDomainSchema>;
export type StandardMappingStatus = z.infer<typeof standardMappingStatusSchema>;
export type EvidenceBinderStatus = z.infer<typeof evidenceBinderStatusSchema>;
export type StandardMappingRecord = z.infer<typeof standardMappingRecordSchema>;
export type EvidenceBinderRecord = z.infer<typeof evidenceBinderRecordSchema>;
export type StandardMappingCreateCommand = z.infer<typeof standardMappingCreateSchema>;
export type StandardMappingUpdateCommand = z.infer<typeof standardMappingUpdateSchema>;
export type EvidenceBinderCreateCommand = z.infer<typeof evidenceBinderCreateSchema>;
export type EvidenceBinderUpdateCommand = z.infer<typeof evidenceBinderUpdateSchema>;

export function createStandardMappingRecord(input: {
  standardCode: string;
  title: string;
  domain: AccreditationDomain;
  sourceAuthority: string;
  ownerRole: Role;
  requirementSummary: string;
  evidenceExpectation: string;
  evidenceDocumentIds?: string[];
  reviewCadenceDays?: number;
  notes?: string | null;
}): StandardMappingRecord {
  const now = new Date().toISOString();
  const reviewCadenceDays = input.reviewCadenceDays ?? 90;
  return standardMappingRecordSchema.parse({
    id: randomId("standard_mapping"),
    standardCode: input.standardCode,
    title: input.title,
    domain: input.domain,
    sourceAuthority: input.sourceAuthority,
    ownerRole: input.ownerRole,
    status: "mapped",
    requirementSummary: input.requirementSummary,
    evidenceExpectation: input.evidenceExpectation,
    evidenceDocumentIds: input.evidenceDocumentIds ?? [],
    latestBinderId: null,
    reviewCadenceDays,
    lastReviewedAt: null,
    nextReviewDueAt: new Date(Date.now() + reviewCadenceDays * 24 * 60 * 60 * 1000).toISOString(),
    notes: input.notes ?? null,
    createdAt: now,
    updatedAt: now
  });
}

export function createEvidenceBinderRecord(input: {
  title: string;
  ownerRole: Role;
  sourceAuthority: string;
  surveyWindowLabel?: string | null;
  standardIds: string[];
  summary: string;
  evidenceReadinessSummary: string;
  openGapSummary: string;
  reviewCadenceDays?: number;
  notes?: string | null;
  documentId?: string | null;
  workflowRunId?: string | null;
  createdBy: string;
}): EvidenceBinderRecord {
  const now = new Date().toISOString();
  return evidenceBinderRecordSchema.parse({
    id: randomId("evidence_binder"),
    title: input.title,
    ownerRole: input.ownerRole,
    status: "draft",
    sourceAuthority: input.sourceAuthority,
    surveyWindowLabel: input.surveyWindowLabel ?? null,
    standardIds: input.standardIds,
    summary: input.summary,
    evidenceReadinessSummary: input.evidenceReadinessSummary,
    openGapSummary: input.openGapSummary,
    reviewCadenceDays: input.reviewCadenceDays ?? 90,
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
