import { z } from "zod";
import { randomId } from "../common";
import { roles, serviceLines, type Role, type ServiceLine } from "../enums";

export const evidenceGapStatusSchema = z.enum([
  "open",
  "in_progress",
  "blocked",
  "ready_for_verification",
  "verified",
  "archived"
]);

export const evidenceGapSeveritySchema = z.enum([
  "low",
  "medium",
  "high",
  "critical"
]);

export const evidenceGapRecordSchema = z.object({
  id: z.string(),
  title: z.string(),
  normalizedGapKey: z.string(),
  status: evidenceGapStatusSchema,
  severity: evidenceGapSeveritySchema,
  ownerRole: z.enum(roles),
  summary: z.string(),
  resolutionSummary: z.string().nullable().default(null),
  standardId: z.string().nullable().default(null),
  binderId: z.string().nullable().default(null),
  committeeMeetingId: z.string().nullable().default(null),
  serviceLineId: z.enum(serviceLines).nullable().default(null),
  actionItemId: z.string().nullable().default(null),
  dueDate: z.string().nullable().default(null),
  createdBy: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  verifiedAt: z.string().nullable().default(null),
  archivedAt: z.string().nullable().default(null)
}).refine(
  (value) => Boolean(value.standardId || value.binderId || value.committeeMeetingId || value.serviceLineId),
  "Evidence gaps must link to at least one standards, binder, committee, or service-line record."
);

const evidenceGapSharedFields = {
  title: z.string().min(3),
  severity: evidenceGapSeveritySchema,
  ownerRole: z.enum(roles),
  summary: z.string().min(10),
  standardId: z.string().nullable().optional(),
  binderId: z.string().nullable().optional(),
  committeeMeetingId: z.string().nullable().optional(),
  serviceLineId: z.enum(serviceLines).nullable().optional(),
  dueDate: z.string().nullable().optional(),
  resolutionSummary: z.string().max(4000).nullable().optional(),
  escalateToActionItem: z.boolean().optional()
} as const;

export const evidenceGapCreateSchema = z.object(evidenceGapSharedFields).refine(
  (value) => Boolean(value.standardId || value.binderId || value.committeeMeetingId || value.serviceLineId),
  "Evidence gaps must link to at least one standards, binder, committee, or service-line record."
);

export const evidenceGapUpdateSchema = z.object({
  title: evidenceGapSharedFields.title.optional(),
  severity: evidenceGapSharedFields.severity.optional(),
  ownerRole: evidenceGapSharedFields.ownerRole.optional(),
  summary: evidenceGapSharedFields.summary.optional(),
  standardId: evidenceGapSharedFields.standardId,
  binderId: evidenceGapSharedFields.binderId,
  committeeMeetingId: evidenceGapSharedFields.committeeMeetingId,
  serviceLineId: evidenceGapSharedFields.serviceLineId,
  dueDate: evidenceGapSharedFields.dueDate,
  resolutionSummary: evidenceGapSharedFields.resolutionSummary,
  status: z.enum(["open", "in_progress", "blocked", "ready_for_verification", "archived"]).optional(),
  escalateToActionItem: z.boolean().optional()
}).refine(
  (value) => Object.values(value).some((entry) => entry !== undefined),
  "At least one evidence-gap field must be updated."
).refine(
  (value) => {
    if (
      value.standardId === undefined
      && value.binderId === undefined
      && value.committeeMeetingId === undefined
      && value.serviceLineId === undefined
    ) {
      return true;
    }

    return Boolean(value.standardId || value.binderId || value.committeeMeetingId || value.serviceLineId);
  },
  "Evidence gaps must link to at least one standards, binder, committee, or service-line record."
);

export const evidenceGapVerifySchema = z.object({
  resolutionSummary: z.string().min(3),
  archive: z.boolean().default(false)
});

export const qapiTrendBucketSchema = z.object({
  periodLabel: z.string(),
  periodStart: z.string(),
  periodEnd: z.string(),
  incidentsOpened: z.number().int().nonnegative(),
  incidentsClosed: z.number().int().nonnegative(),
  capasOpened: z.number().int().nonnegative(),
  capasClosed: z.number().int().nonnegative(),
  evidenceGapsOpened: z.number().int().nonnegative(),
  evidenceGapsVerified: z.number().int().nonnegative(),
  overdueStandardsReviews: z.number().int().nonnegative(),
  evidenceBindersDraft: z.number().int().nonnegative(),
  evidenceBindersInReview: z.number().int().nonnegative(),
  evidenceBindersPublished: z.number().int().nonnegative()
});

export const qapiTrendRollupSchema = z.object({
  requestedMonths: z.number().int().positive(),
  incidentsOpened: z.number().int().nonnegative(),
  incidentsClosed: z.number().int().nonnegative(),
  capasOpened: z.number().int().nonnegative(),
  capasClosed: z.number().int().nonnegative(),
  evidenceGapsOpened: z.number().int().nonnegative(),
  evidenceGapsVerified: z.number().int().nonnegative(),
  averageOverdueStandardsReviews: z.number().nonnegative(),
  averageEvidenceBindersInReview: z.number().nonnegative(),
  currentOpenEvidenceGaps: z.number().int().nonnegative(),
  currentVerificationBacklog: z.number().int().nonnegative(),
  currentStandardsMissingEvidence: z.number().int().nonnegative()
});

export const qapiTrendSummarySchema = z.object({
  generatedAt: z.string(),
  requestedMonths: z.number().int().positive(),
  periods: z.array(qapiTrendBucketSchema),
  rollup: qapiTrendRollupSchema,
  highlights: z.array(z.string())
});

export type EvidenceGapStatus = z.infer<typeof evidenceGapStatusSchema>;
export type EvidenceGapSeverity = z.infer<typeof evidenceGapSeveritySchema>;
export type EvidenceGapRecord = z.infer<typeof evidenceGapRecordSchema>;
export type EvidenceGapCreateCommand = z.infer<typeof evidenceGapCreateSchema>;
export type EvidenceGapUpdateCommand = z.infer<typeof evidenceGapUpdateSchema>;
export type EvidenceGapVerificationCommand = z.infer<typeof evidenceGapVerifySchema>;
export type QapiTrendBucket = z.infer<typeof qapiTrendBucketSchema>;
export type QapiTrendRollup = z.infer<typeof qapiTrendRollupSchema>;
export type QapiTrendSummary = z.infer<typeof qapiTrendSummarySchema>;

export function normalizeEvidenceGapKey(input: {
  title: string;
  standardId?: string | null;
  binderId?: string | null;
  committeeMeetingId?: string | null;
  serviceLineId?: ServiceLine | null;
}): string {
  const slug = input.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return [
    input.standardId ?? "none",
    input.binderId ?? "none",
    input.committeeMeetingId ?? "none",
    input.serviceLineId ?? "none",
    slug || "gap"
  ].join(":");
}

export function createEvidenceGapRecord(input: {
  title: string;
  severity: EvidenceGapSeverity;
  ownerRole: Role;
  summary: string;
  standardId?: string | null;
  binderId?: string | null;
  committeeMeetingId?: string | null;
  serviceLineId?: ServiceLine | null;
  dueDate?: string | null;
  resolutionSummary?: string | null;
  actionItemId?: string | null;
  createdBy: string;
}): EvidenceGapRecord {
  const now = new Date().toISOString();
  return evidenceGapRecordSchema.parse({
    id: randomId("evidence_gap"),
    title: input.title,
    normalizedGapKey: normalizeEvidenceGapKey({
      title: input.title,
      standardId: input.standardId ?? null,
      binderId: input.binderId ?? null,
      committeeMeetingId: input.committeeMeetingId ?? null,
      serviceLineId: input.serviceLineId ?? null
    }),
    status: "open",
    severity: input.severity,
    ownerRole: input.ownerRole,
    summary: input.summary,
    resolutionSummary: input.resolutionSummary ?? null,
    standardId: input.standardId ?? null,
    binderId: input.binderId ?? null,
    committeeMeetingId: input.committeeMeetingId ?? null,
    serviceLineId: input.serviceLineId ?? null,
    actionItemId: input.actionItemId ?? null,
    dueDate: input.dueDate ?? null,
    createdBy: input.createdBy,
    createdAt: now,
    updatedAt: now,
    verifiedAt: null,
    archivedAt: null
  });
}
