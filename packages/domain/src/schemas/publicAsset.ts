import { z } from "zod";
import { randomId } from "../common";
import { roles, serviceLines, type Role, type ServiceLine } from "../enums";

export const publicAssetTypeSchema = z.enum([
  "website_page",
  "ad_copy",
  "service_page",
  "handout",
  "intake_packet",
  "social_post",
  "landing_page",
  "email_campaign"
]);

export const publicAssetStatusSchema = z.enum([
  "draft",
  "claims_in_review",
  "claims_reviewed",
  "approval_pending",
  "approved",
  "publish_pending",
  "published",
  "archived",
  "sent_back"
]);

export const publicAssetClaimReviewStatusSchema = z.enum([
  "pending",
  "approved",
  "needs_revision",
  "unsupported"
]);

export const publicAssetClaimsReviewStateSchema = z.enum([
  "not_started",
  "in_review",
  "completed",
  "needs_revision"
]);

export const publicAssetClaimSchema = z.object({
  id: z.string(),
  claimText: z.string(),
  evidenceNote: z.string().nullable().default(null),
  reviewStatus: publicAssetClaimReviewStatusSchema,
  reviewerNotes: z.string().nullable().default(null)
});

export const publicAssetRecordSchema = z.object({
  id: z.string(),
  assetType: publicAssetTypeSchema,
  title: z.string(),
  status: publicAssetStatusSchema,
  ownerRole: z.enum(roles),
  serviceLine: z.enum(serviceLines).nullable().default(null),
  audience: z.string().nullable().default(null),
  channelLabel: z.string().nullable().default(null),
  summary: z.string(),
  body: z.string(),
  claims: z.array(publicAssetClaimSchema),
  claimsReviewed: z.boolean(),
  claimsReviewStatus: publicAssetClaimsReviewStateSchema,
  claimsReviewNotes: z.string().nullable().default(null),
  claimsReviewedAt: z.string().nullable().default(null),
  claimsReviewedByRole: z.enum(roles).nullable().default(null),
  documentId: z.string().nullable().default(null),
  workflowRunId: z.string().nullable().default(null),
  createdBy: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  publishedAt: z.string().nullable().default(null),
  publishedPath: z.string().nullable().default(null)
});

export const publicAssetCreateSchema = z.object({
  assetType: publicAssetTypeSchema,
  title: z.string().min(3),
  ownerRole: z.enum(roles),
  serviceLine: z.enum(serviceLines).nullable().optional(),
  audience: z.string().max(200).optional(),
  channelLabel: z.string().max(200).optional(),
  summary: z.string().max(1000).default(""),
  body: z.string().min(1),
  claims: z.array(z.object({
    claimText: z.string().min(3),
    evidenceNote: z.string().max(1000).optional()
  })).min(1)
});

export const publicAssetUpdateSchema = z.object({
  assetType: publicAssetTypeSchema.optional(),
  title: z.string().min(3).optional(),
  ownerRole: z.enum(roles).optional(),
  serviceLine: z.enum(serviceLines).nullable().optional(),
  audience: z.string().max(200).nullable().optional(),
  channelLabel: z.string().max(200).nullable().optional(),
  summary: z.string().max(1000).optional(),
  body: z.string().min(1).optional(),
  claims: z.array(z.object({
    claimText: z.string().min(3),
    evidenceNote: z.string().max(1000).optional()
  })).min(1).optional()
}).refine(
  (value) => Object.values(value).some((entry) => entry !== undefined),
  "At least one public-asset field must be updated."
);

export const claimsReviewDecisionCommandSchema = z.object({
  claimDecisions: z.array(z.object({
    claimId: z.string(),
    decision: z.enum(["approved", "needs_revision", "unsupported"]),
    notes: z.string().max(2000).optional()
  })).min(1),
  overallNotes: z.string().max(2000).optional()
});

export type PublicAssetClaim = z.infer<typeof publicAssetClaimSchema>;
export type PublicAssetRecord = z.infer<typeof publicAssetRecordSchema>;
export type PublicAsset = PublicAssetRecord;
export type PublicAssetCreateCommand = z.infer<typeof publicAssetCreateSchema>;
export type PublicAssetUpdateCommand = z.infer<typeof publicAssetUpdateSchema>;
export type ClaimsReviewDecisionCommand = z.infer<typeof claimsReviewDecisionCommandSchema>;

export function createPublicAssetRecord(input: {
  assetType: z.infer<typeof publicAssetTypeSchema>;
  title: string;
  ownerRole: Role;
  serviceLine?: ServiceLine | null;
  audience?: string | null;
  channelLabel?: string | null;
  summary?: string;
  body: string;
  claims: Array<{ claimText: string; evidenceNote?: string | null }>;
  createdBy: string;
  documentId?: string | null;
  workflowRunId?: string | null;
}): PublicAssetRecord {
  const now = new Date().toISOString();
  return publicAssetRecordSchema.parse({
    id: randomId("public_asset"),
    assetType: input.assetType,
    title: input.title,
    status: "draft",
    ownerRole: input.ownerRole,
    serviceLine: input.serviceLine ?? null,
    audience: input.audience ?? null,
    channelLabel: input.channelLabel ?? null,
    summary: input.summary ?? "",
    body: input.body,
    claims: input.claims.map((claim) => ({
      id: randomId("claim"),
      claimText: claim.claimText,
      evidenceNote: claim.evidenceNote ?? null,
      reviewStatus: "pending",
      reviewerNotes: null
    })),
    claimsReviewed: false,
    claimsReviewStatus: "not_started",
    claimsReviewNotes: null,
    claimsReviewedAt: null,
    claimsReviewedByRole: null,
    documentId: input.documentId ?? null,
    workflowRunId: input.workflowRunId ?? null,
    createdBy: input.createdBy,
    createdAt: now,
    updatedAt: now,
    publishedAt: null,
    publishedPath: null
  });
}
