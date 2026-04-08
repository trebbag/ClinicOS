import { z } from "zod";
import { randomId } from "../common";
import { roles, serviceLines, type Role, type ServiceLine } from "../enums";

export const payerIssueStatusSchema = z.enum([
  "open",
  "under_review",
  "escalated",
  "resolved",
  "closed"
]);

export const payerIssueTypeSchema = z.enum([
  "denial",
  "reimbursement_delay",
  "coverage_policy",
  "pricing_exception",
  "credentialing",
  "other"
]);

export const pricingGovernanceStatusSchema = z.enum([
  "draft",
  "approval_pending",
  "approved",
  "publish_pending",
  "published",
  "attention_needed"
]);

export const revenueReviewStatusSchema = z.enum([
  "draft",
  "review_pending",
  "completed",
  "archived"
]);

export const payerIssueRecordSchema = z.object({
  id: z.string(),
  title: z.string(),
  payerName: z.string(),
  issueType: payerIssueTypeSchema,
  serviceLineId: z.enum(serviceLines).nullable().default(null),
  ownerRole: z.enum(roles),
  status: payerIssueStatusSchema,
  summary: z.string(),
  financialImpactSummary: z.string().nullable().default(null),
  dueDate: z.string().nullable().default(null),
  resolutionNote: z.string().nullable().default(null),
  actionItemId: z.string().nullable().default(null),
  createdBy: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  resolvedAt: z.string().nullable().default(null),
  closedAt: z.string().nullable().default(null)
});

export const pricingGovernanceRecordSchema = z.object({
  id: z.string(),
  title: z.string(),
  serviceLineId: z.enum(serviceLines).nullable().default(null),
  ownerRole: z.enum(roles),
  status: pricingGovernanceStatusSchema,
  pricingSummary: z.string(),
  marginGuardrailsSummary: z.string(),
  discountGuardrailsSummary: z.string(),
  payerAlignmentSummary: z.string(),
  claimsConstraintSummary: z.string(),
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

export const revenueDashboardSummarySchema = z.object({
  openPayerIssues: z.number().int().nonnegative(),
  escalatedPayerIssues: z.number().int().nonnegative(),
  overduePayerIssues: z.number().int().nonnegative(),
  pricingPendingApproval: z.number().int().nonnegative(),
  pricingAttentionNeeded: z.number().int().nonnegative(),
  overdueRevenueReviews: z.number().int().nonnegative(),
  serviceLinesMissingPricingGovernance: z.number().int().nonnegative(),
  serviceLinesWeakClaimsGovernance: z.number().int().nonnegative(),
  publicAssetsAtRisk: z.number().int().nonnegative(),
  attentionItems: z.array(z.string())
});

export const revenueReviewRecordSchema = z.object({
  id: z.string(),
  title: z.string(),
  status: revenueReviewStatusSchema,
  ownerRole: z.enum(roles),
  serviceLineId: z.enum(serviceLines).nullable().default(null),
  reviewWindowLabel: z.string(),
  targetReviewDate: z.string().nullable().default(null),
  completedAt: z.string().nullable().default(null),
  summaryNote: z.string().nullable().default(null),
  linkedCommitteeId: z.string().nullable().default(null),
  snapshot: revenueDashboardSummarySchema,
  createdBy: z.string(),
  createdAt: z.string(),
  updatedAt: z.string()
});

export const payerIssueCreateSchema = z.object({
  title: z.string().min(3),
  payerName: z.string().min(2),
  issueType: payerIssueTypeSchema,
  serviceLineId: z.enum(serviceLines).nullable().optional(),
  ownerRole: z.enum(roles),
  summary: z.string().min(10),
  financialImpactSummary: z.string().max(2000).optional(),
  dueDate: z.string().optional()
});

export const payerIssueUpdateSchema = z.object({
  title: z.string().min(3).optional(),
  payerName: z.string().min(2).optional(),
  issueType: payerIssueTypeSchema.optional(),
  serviceLineId: z.enum(serviceLines).nullable().optional(),
  ownerRole: z.enum(roles).optional(),
  status: payerIssueStatusSchema.optional(),
  summary: z.string().min(10).optional(),
  financialImpactSummary: z.string().max(2000).nullable().optional(),
  dueDate: z.string().nullable().optional(),
  resolutionNote: z.string().max(4000).nullable().optional()
}).refine(
  (value) => Object.values(value).some((entry) => entry !== undefined),
  "At least one payer-issue field must be updated."
);

export const pricingGovernanceCreateSchema = z.object({
  title: z.string().min(3).optional(),
  serviceLineId: z.enum(serviceLines).nullable().optional(),
  ownerRole: z.enum(roles),
  pricingSummary: z.string().min(10),
  marginGuardrailsSummary: z.string().min(10),
  discountGuardrailsSummary: z.string().min(10),
  payerAlignmentSummary: z.string().min(10),
  claimsConstraintSummary: z.string().min(10),
  effectiveDate: z.string().optional(),
  reviewDueAt: z.string().optional(),
  notes: z.string().max(4000).optional()
});

export const pricingGovernanceUpdateSchema = z.object({
  title: z.string().min(3).optional(),
  serviceLineId: z.enum(serviceLines).nullable().optional(),
  ownerRole: z.enum(roles).optional(),
  status: pricingGovernanceStatusSchema.optional(),
  pricingSummary: z.string().min(10).optional(),
  marginGuardrailsSummary: z.string().min(10).optional(),
  discountGuardrailsSummary: z.string().min(10).optional(),
  payerAlignmentSummary: z.string().min(10).optional(),
  claimsConstraintSummary: z.string().min(10).optional(),
  effectiveDate: z.string().nullable().optional(),
  reviewDueAt: z.string().nullable().optional(),
  notes: z.string().max(4000).nullable().optional()
}).refine(
  (value) => Object.values(value).some((entry) => entry !== undefined),
  "At least one pricing-governance field must be updated."
);

export const revenueReviewCreateSchema = z.object({
  title: z.string().min(3).optional(),
  ownerRole: z.enum(roles),
  serviceLineId: z.enum(serviceLines).nullable().optional(),
  reviewWindowLabel: z.string().min(3),
  targetReviewDate: z.string().optional(),
  summaryNote: z.string().max(4000).optional(),
  linkedCommitteeId: z.string().optional()
});

export const revenueReviewUpdateSchema = z.object({
  title: z.string().min(3).optional(),
  ownerRole: z.enum(roles).optional(),
  serviceLineId: z.enum(serviceLines).nullable().optional(),
  status: revenueReviewStatusSchema.optional(),
  reviewWindowLabel: z.string().min(3).optional(),
  targetReviewDate: z.string().nullable().optional(),
  summaryNote: z.string().max(4000).nullable().optional(),
  linkedCommitteeId: z.string().nullable().optional()
}).refine(
  (value) => Object.values(value).some((entry) => entry !== undefined),
  "At least one revenue-review field must be updated."
);

export type PayerIssueStatus = z.infer<typeof payerIssueStatusSchema>;
export type PayerIssueType = z.infer<typeof payerIssueTypeSchema>;
export type PricingGovernanceStatus = z.infer<typeof pricingGovernanceStatusSchema>;
export type RevenueReviewStatus = z.infer<typeof revenueReviewStatusSchema>;
export type PayerIssueRecord = z.infer<typeof payerIssueRecordSchema>;
export type PricingGovernanceRecord = z.infer<typeof pricingGovernanceRecordSchema>;
export type RevenueDashboardSummary = z.infer<typeof revenueDashboardSummarySchema>;
export type RevenueReviewRecord = z.infer<typeof revenueReviewRecordSchema>;

export function createPayerIssueRecord(input: {
  title: string;
  payerName: string;
  issueType: PayerIssueType;
  serviceLineId?: ServiceLine | null;
  ownerRole: Role;
  summary: string;
  financialImpactSummary?: string | null;
  dueDate?: string | null;
  createdBy: string;
}): PayerIssueRecord {
  const now = new Date().toISOString();
  return payerIssueRecordSchema.parse({
    id: randomId("payer_issue"),
    title: input.title,
    payerName: input.payerName,
    issueType: input.issueType,
    serviceLineId: input.serviceLineId ?? null,
    ownerRole: input.ownerRole,
    status: "open",
    summary: input.summary,
    financialImpactSummary: input.financialImpactSummary ?? null,
    dueDate: input.dueDate ?? null,
    resolutionNote: null,
    actionItemId: null,
    createdBy: input.createdBy,
    createdAt: now,
    updatedAt: now,
    resolvedAt: null,
    closedAt: null
  });
}

export function createPricingGovernanceRecord(input: {
  title: string;
  serviceLineId?: ServiceLine | null;
  ownerRole: Role;
  pricingSummary: string;
  marginGuardrailsSummary: string;
  discountGuardrailsSummary: string;
  payerAlignmentSummary: string;
  claimsConstraintSummary: string;
  effectiveDate?: string | null;
  reviewDueAt?: string | null;
  notes?: string | null;
  documentId?: string | null;
  workflowRunId?: string | null;
  createdBy: string;
}): PricingGovernanceRecord {
  const now = new Date().toISOString();
  return pricingGovernanceRecordSchema.parse({
    id: randomId("pricing_governance"),
    title: input.title,
    serviceLineId: input.serviceLineId ?? null,
    ownerRole: input.ownerRole,
    status: "draft",
    pricingSummary: input.pricingSummary,
    marginGuardrailsSummary: input.marginGuardrailsSummary,
    discountGuardrailsSummary: input.discountGuardrailsSummary,
    payerAlignmentSummary: input.payerAlignmentSummary,
    claimsConstraintSummary: input.claimsConstraintSummary,
    effectiveDate: input.effectiveDate ?? null,
    reviewDueAt: input.reviewDueAt ?? null,
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

export function createRevenueReviewRecord(input: {
  title: string;
  ownerRole: Role;
  serviceLineId?: ServiceLine | null;
  reviewWindowLabel: string;
  targetReviewDate?: string | null;
  summaryNote?: string | null;
  linkedCommitteeId?: string | null;
  snapshot: RevenueDashboardSummary;
  createdBy: string;
}): RevenueReviewRecord {
  const now = new Date().toISOString();
  return revenueReviewRecordSchema.parse({
    id: randomId("revenue_review"),
    title: input.title,
    status: "draft",
    ownerRole: input.ownerRole,
    serviceLineId: input.serviceLineId ?? null,
    reviewWindowLabel: input.reviewWindowLabel,
    targetReviewDate: input.targetReviewDate ?? null,
    completedAt: null,
    summaryNote: input.summaryNote ?? null,
    linkedCommitteeId: input.linkedCommitteeId ?? null,
    snapshot: input.snapshot,
    createdBy: input.createdBy,
    createdAt: now,
    updatedAt: now
  });
}
