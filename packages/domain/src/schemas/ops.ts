import { z } from "zod";

export const opsCleanupTargetSchema = z.enum([
  "enrollment_codes",
  "expired_sessions",
  "stale_processing_jobs",
  "succeeded_worker_jobs",
  "dead_letter_worker_jobs"
]);

export const opsAlertSeveritySchema = z.enum([
  "info",
  "warning",
  "critical"
]);

export const opsAlertSchema = z.object({
  key: z.string(),
  scope: z.enum([
    "runtime",
    "microsoft",
    "worker",
    "auth",
    "office_ops",
    "scorecards"
  ]),
  severity: opsAlertSeveritySchema,
  title: z.string(),
  detail: z.string(),
  action: z.string().nullable(),
  count: z.number().int().nonnegative().nullable(),
  createdAt: z.string()
});

export const opsAlertSummarySchema = z.object({
  checkedAt: z.string(),
  criticalCount: z.number().int().nonnegative(),
  warningCount: z.number().int().nonnegative(),
  infoCount: z.number().int().nonnegative(),
  alerts: z.array(opsAlertSchema)
});

export const opsMaintenanceSummarySchema = z.object({
  checkedAt: z.string(),
  thresholds: z.object({
    authArtifactRetentionDays: z.number().int().positive(),
    workerJobRetentionDays: z.number().int().positive(),
    staleProcessingMinutes: z.number().int().positive()
  }),
  auth: z.object({
    activeDevices: z.number().int().nonnegative(),
    activeSessions: z.number().int().nonnegative(),
    expiredActiveSessions: z.number().int().nonnegative(),
    purgeableRevokedSessions: z.number().int().nonnegative(),
    activeEnrollmentCodes: z.number().int().nonnegative(),
    purgeableEnrollmentCodes: z.number().int().nonnegative(),
    lockedProfileAssignments: z.number().int().nonnegative()
  }),
  worker: z.object({
    queued: z.number().int().nonnegative(),
    processing: z.number().int().nonnegative(),
    staleProcessing: z.number().int().nonnegative(),
    failed: z.number().int().nonnegative(),
    deadLetter: z.number().int().nonnegative(),
    purgeableSucceeded: z.number().int().nonnegative(),
    purgeableDeadLetter: z.number().int().nonnegative()
  }),
  microsoft: z.object({
    mode: z.enum(["stub", "live"]),
    readyForLive: z.boolean()
  })
});

export const opsCleanupCommandSchema = z.object({
  dryRun: z.boolean().default(false),
  targets: z.array(opsCleanupTargetSchema).min(1).default([
    "enrollment_codes",
    "expired_sessions",
    "stale_processing_jobs"
  ]),
  authArtifactRetentionDays: z.number().int().min(1).max(365).default(7),
  workerJobRetentionDays: z.number().int().min(1).max(365).default(14),
  staleProcessingMinutes: z.number().int().min(1).max(1440).default(15)
});

export const opsCleanupResultSchema = z.object({
  checkedAt: z.string(),
  dryRun: z.boolean(),
  targets: z.array(opsCleanupTargetSchema),
  revokedExpiredSessions: z.number().int().nonnegative(),
  purgedRevokedSessions: z.number().int().nonnegative(),
  purgedEnrollmentCodes: z.number().int().nonnegative(),
  requeuedStaleProcessingJobs: z.number().int().nonnegative(),
  purgedSucceededWorkerJobs: z.number().int().nonnegative(),
  purgedDeadLetterWorkerJobs: z.number().int().nonnegative()
});

export type OpsCleanupTarget = z.infer<typeof opsCleanupTargetSchema>;
export type OpsAlertSeverity = z.infer<typeof opsAlertSeveritySchema>;
export type OpsAlert = z.infer<typeof opsAlertSchema>;
export type OpsAlertSummary = z.infer<typeof opsAlertSummarySchema>;
export type OpsMaintenanceSummary = z.infer<typeof opsMaintenanceSummarySchema>;
export type OpsCleanupCommand = z.infer<typeof opsCleanupCommandSchema>;
export type OpsCleanupResult = z.infer<typeof opsCleanupResultSchema>;
