import { z } from "zod";
import { randomId } from "../common";
import { roles, serviceLines, type Role } from "../enums";

export const serviceLineGovernanceStatusSchema = z.enum([
  "not_started",
  "drafting",
  "review_pending",
  "approved",
  "published",
  "attention_needed"
]);

export const serviceLinePackStatusSchema = z.enum([
  "draft",
  "approval_pending",
  "approved",
  "publish_pending",
  "published",
  "archived",
  "sent_back"
]);

export const serviceLineRecordSchema = z.object({
  id: z.enum(serviceLines),
  ownerRole: z.enum(roles).nullable().default(null),
  governanceStatus: serviceLineGovernanceStatusSchema,
  hasCharter: z.boolean(),
  hasCompetencyMatrix: z.boolean(),
  hasAuditTool: z.boolean(),
  hasClaimsInventory: z.boolean(),
  reviewCadenceDays: z.number().int().positive(),
  lastReviewedAt: z.string().nullable().default(null),
  nextReviewDueAt: z.string().nullable().default(null),
  latestPackId: z.string().nullable().default(null),
  createdAt: z.string(),
  updatedAt: z.string()
});

export const serviceLinePackRecordSchema = z.object({
  id: z.string(),
  serviceLineId: z.enum(serviceLines),
  title: z.string(),
  ownerRole: z.enum(roles),
  status: serviceLinePackStatusSchema,
  charterSummary: z.string(),
  inclusionExclusionRules: z.string(),
  roleMatrixSummary: z.string(),
  competencyRequirements: z.string(),
  auditToolSummary: z.string(),
  emergencyEscalation: z.string(),
  pricingModelSummary: z.string(),
  claimsGovernanceSummary: z.string(),
  notes: z.string().nullable().default(null),
  documentId: z.string().nullable().default(null),
  workflowRunId: z.string().nullable().default(null),
  createdBy: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  publishedAt: z.string().nullable().default(null),
  publishedPath: z.string().nullable().default(null)
});

export const serviceLineCreateSchema = z.object({
  id: z.enum(serviceLines),
  ownerRole: z.enum(roles).nullable().optional(),
  reviewCadenceDays: z.number().int().positive().max(365).optional()
});

export const serviceLineUpdateSchema = z.object({
  ownerRole: z.enum(roles).nullable().optional(),
  reviewCadenceDays: z.number().int().positive().max(365).optional(),
  governanceStatus: serviceLineGovernanceStatusSchema.optional(),
  hasCharter: z.boolean().optional(),
  hasCompetencyMatrix: z.boolean().optional(),
  hasAuditTool: z.boolean().optional(),
  hasClaimsInventory: z.boolean().optional(),
  lastReviewedAt: z.string().nullable().optional(),
  nextReviewDueAt: z.string().nullable().optional()
}).refine(
  (value) => Object.values(value).some((entry) => entry !== undefined),
  "At least one service-line field must be updated."
);

export const serviceLinePackCreateSchema = z.object({
  ownerRole: z.enum(roles),
  title: z.string().min(3).optional(),
  charterSummary: z.string().min(10),
  inclusionExclusionRules: z.string().min(10),
  roleMatrixSummary: z.string().min(10),
  competencyRequirements: z.string().min(10),
  auditToolSummary: z.string().min(10),
  emergencyEscalation: z.string().min(10),
  pricingModelSummary: z.string().min(10),
  claimsGovernanceSummary: z.string().min(10),
  notes: z.string().max(2000).optional()
});

export type ServiceLineGovernanceStatus = z.infer<typeof serviceLineGovernanceStatusSchema>;
export type ServiceLinePackStatus = z.infer<typeof serviceLinePackStatusSchema>;
export type ServiceLineRecord = z.infer<typeof serviceLineRecordSchema>;
export type ServiceLinePackRecord = z.infer<typeof serviceLinePackRecordSchema>;

export function createServiceLineRecord(input: {
  id: z.infer<typeof serviceLineRecordSchema>["id"];
  ownerRole?: Role | null;
  reviewCadenceDays?: number;
}): ServiceLineRecord {
  const now = new Date().toISOString();
  const reviewCadenceDays = input.reviewCadenceDays ?? 90;
  const nextReviewDueAt = new Date(Date.now() + reviewCadenceDays * 24 * 60 * 60 * 1000).toISOString();
  return serviceLineRecordSchema.parse({
    id: input.id,
    ownerRole: input.ownerRole ?? null,
    governanceStatus: "not_started",
    hasCharter: false,
    hasCompetencyMatrix: false,
    hasAuditTool: false,
    hasClaimsInventory: false,
    reviewCadenceDays,
    lastReviewedAt: null,
    nextReviewDueAt,
    latestPackId: null,
    createdAt: now,
    updatedAt: now
  });
}

export function createServiceLinePackRecord(input: {
  serviceLineId: z.infer<typeof serviceLineRecordSchema>["id"];
  title: string;
  ownerRole: Role;
  charterSummary: string;
  inclusionExclusionRules: string;
  roleMatrixSummary: string;
  competencyRequirements: string;
  auditToolSummary: string;
  emergencyEscalation: string;
  pricingModelSummary: string;
  claimsGovernanceSummary: string;
  notes?: string | null;
  documentId?: string | null;
  workflowRunId?: string | null;
  createdBy: string;
}): ServiceLinePackRecord {
  const now = new Date().toISOString();
  return serviceLinePackRecordSchema.parse({
    id: randomId("service_line_pack"),
    serviceLineId: input.serviceLineId,
    title: input.title,
    ownerRole: input.ownerRole,
    status: "draft",
    charterSummary: input.charterSummary,
    inclusionExclusionRules: input.inclusionExclusionRules,
    roleMatrixSummary: input.roleMatrixSummary,
    competencyRequirements: input.competencyRequirements,
    auditToolSummary: input.auditToolSummary,
    emergencyEscalation: input.emergencyEscalation,
    pricingModelSummary: input.pricingModelSummary,
    claimsGovernanceSummary: input.claimsGovernanceSummary,
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
