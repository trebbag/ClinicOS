import { z } from "zod";
import { randomId } from "../common";
import { authModeSchema } from "./auth";

export const deploymentPromotionStatusSchema = z.enum([
  "draft",
  "in_review",
  "ready",
  "completed"
]);

export const deploymentPromotionChecklistKeySchema = z.enum([
  "smoke_passed",
  "rollback_verified",
  "auth_target_confirmed",
  "runtime_agent_freeze_confirmed",
  "microsoft_validation_ready"
]);

export const deploymentPromotionChecklistItemStatusSchema = z.enum([
  "pending",
  "in_progress",
  "completed",
  "blocked",
  "not_applicable"
]);

export const deploymentPromotionChecklistItemRecordSchema = z.object({
  id: z.string(),
  promotionId: z.string(),
  checklistKey: deploymentPromotionChecklistKeySchema,
  label: z.string(),
  status: deploymentPromotionChecklistItemStatusSchema,
  detail: z.string().nullable().default(null),
  completedAt: z.string().nullable().default(null),
  completedBy: z.string().nullable().default(null),
  sortOrder: z.number().int().nonnegative(),
  createdAt: z.string(),
  updatedAt: z.string()
});

export const deploymentRollbackVerificationSchema = z.object({
  completed: z.boolean(),
  completedAt: z.string().nullable().default(null),
  completedBy: z.string().nullable().default(null),
  detail: z.string().nullable().default(null)
});

export const trustedProxyReadinessSchema = z.object({
  sharedSecretConfigured: z.boolean(),
  allowedSkewSeconds: z.number().int().positive(),
  expectedHeaders: z.array(z.string()),
  signatureValidationReady: z.boolean(),
  currentAuthMode: authModeSchema,
  ready: z.boolean()
});

export const deploymentChecklistProgressSchema = z.object({
  totalItems: z.number().int().nonnegative(),
  completedItems: z.number().int().nonnegative(),
  blockedItems: z.number().int().nonnegative(),
  completionPercent: z.number().min(0).max(100)
});

export const alertDeliveryHistoryEntrySchema = z.object({
  key: z.string(),
  scope: z.string(),
  severity: z.string(),
  dispatchedAt: z.string(),
  cooldownMinutes: z.number().int().positive().nullable().default(null),
  messageId: z.string().nullable().default(null)
});

export const deploymentPromotionRecordSchema = z.object({
  id: z.string(),
  environmentKey: z.string(),
  status: deploymentPromotionStatusSchema,
  targetAuthMode: authModeSchema,
  runtimeAgentsDisabled: z.boolean(),
  latestSmokeAt: z.string().nullable().default(null),
  rollbackVerifiedAt: z.string().nullable().default(null),
  notes: z.string().nullable().default(null),
  checklistItems: z.array(deploymentPromotionChecklistItemRecordSchema).default([]),
  rollbackVerification: deploymentRollbackVerificationSchema,
  createdBy: z.string(),
  createdAt: z.string(),
  updatedAt: z.string()
});

export const deploymentPromotionCreateSchema = z.object({
  environmentKey: z.string().min(2),
  status: deploymentPromotionStatusSchema.default("draft"),
  targetAuthMode: authModeSchema.default("trusted_proxy"),
  runtimeAgentsDisabled: z.boolean().default(true),
  latestSmokeAt: z.string().nullable().optional(),
  rollbackVerifiedAt: z.string().nullable().optional(),
  notes: z.string().max(2000).nullable().optional()
});

export const deploymentPromotionUpdateSchema = z.object({
  status: deploymentPromotionStatusSchema.optional(),
  targetAuthMode: authModeSchema.optional(),
  runtimeAgentsDisabled: z.boolean().optional(),
  latestSmokeAt: z.string().nullable().optional(),
  rollbackVerifiedAt: z.string().nullable().optional(),
  notes: z.string().max(2000).nullable().optional()
}).refine(
  (value) => Object.values(value).some((entry) => entry !== undefined),
  "At least one deployment-promotion field must be updated."
);

export const deploymentPromotionChecklistItemCreateSchema = z.object({
  checklistKey: deploymentPromotionChecklistKeySchema,
  label: z.string().min(3).max(200).optional(),
  status: deploymentPromotionChecklistItemStatusSchema.default("pending"),
  detail: z.string().max(2000).nullable().optional(),
  completedAt: z.string().nullable().optional(),
  completedBy: z.string().nullable().optional(),
  sortOrder: z.number().int().min(0).optional()
});

export const deploymentPromotionChecklistItemUpdateSchema = z.object({
  status: deploymentPromotionChecklistItemStatusSchema.optional(),
  detail: z.string().max(2000).nullable().optional(),
  completedAt: z.string().nullable().optional(),
  completedBy: z.string().nullable().optional()
}).refine(
  (value) => Object.values(value).some((entry) => entry !== undefined),
  "At least one deployment-promotion checklist item field must be updated."
);

export const deployHardeningStatusSchema = z.object({
  currentAuthMode: authModeSchema,
  runtimeAgentsExplicitlyDisabled: z.boolean(),
  runtimeAgentsConfigValue: z.string().nullable().default(null),
  trustedProxyConfigured: z.boolean(),
  trustedProxyReady: z.boolean(),
  trustedProxyReadiness: trustedProxyReadinessSchema,
  recommendedTargetAuthMode: authModeSchema,
  latestPromotion: deploymentPromotionRecordSchema.nullable(),
  latestPromotionChecklistProgress: deploymentChecklistProgressSchema.nullable(),
  latestAlertDispatchAt: z.string().nullable(),
  alertHistory: z.array(alertDeliveryHistoryEntrySchema),
  latestRollbackVerificationAt: z.string().nullable(),
  latestSmokeAt: z.string().nullable()
});

export type DeploymentPromotionStatus = z.infer<typeof deploymentPromotionStatusSchema>;
export type DeploymentPromotionChecklistKey = z.infer<typeof deploymentPromotionChecklistKeySchema>;
export type DeploymentPromotionChecklistItemStatus = z.infer<typeof deploymentPromotionChecklistItemStatusSchema>;
export type DeploymentPromotionChecklistItemRecord = z.infer<typeof deploymentPromotionChecklistItemRecordSchema>;
export type DeploymentRollbackVerification = z.infer<typeof deploymentRollbackVerificationSchema>;
export type DeploymentChecklistProgress = z.infer<typeof deploymentChecklistProgressSchema>;
export type AlertDeliveryHistoryEntry = z.infer<typeof alertDeliveryHistoryEntrySchema>;
export type DeploymentPromotionRecord = z.infer<typeof deploymentPromotionRecordSchema>;
export type DeploymentPromotionCreateCommand = z.infer<typeof deploymentPromotionCreateSchema>;
export type DeploymentPromotionUpdateCommand = z.infer<typeof deploymentPromotionUpdateSchema>;
export type DeploymentPromotionChecklistItemCreateCommand = z.infer<typeof deploymentPromotionChecklistItemCreateSchema>;
export type DeploymentPromotionChecklistItemUpdateCommand = z.infer<typeof deploymentPromotionChecklistItemUpdateSchema>;
export type DeployHardeningStatus = z.infer<typeof deployHardeningStatusSchema>;

export function defaultDeploymentPromotionChecklistItems(input: {
  promotionId: string;
  createdBy: string;
  runtimeAgentsDisabled?: boolean;
  latestSmokeAt?: string | null;
  rollbackVerifiedAt?: string | null;
}): DeploymentPromotionChecklistItemRecord[] {
  const now = new Date().toISOString();
  const items: Array<{
    checklistKey: DeploymentPromotionChecklistKey;
    label: string;
    status: DeploymentPromotionChecklistItemStatus;
    detail?: string | null;
    completedAt?: string | null;
    completedBy?: string | null;
    sortOrder: number;
  }> = [
    {
      checklistKey: "smoke_passed",
      label: "Smoke passed",
      status: input.latestSmokeAt ? "completed" : "pending",
      completedAt: input.latestSmokeAt ?? null,
      completedBy: input.latestSmokeAt ? input.createdBy : null,
      sortOrder: 0
    },
    {
      checklistKey: "rollback_verified",
      label: "Rollback verified",
      status: input.rollbackVerifiedAt ? "completed" : "pending",
      completedAt: input.rollbackVerifiedAt ?? null,
      completedBy: input.rollbackVerifiedAt ? input.createdBy : null,
      sortOrder: 1
    },
    {
      checklistKey: "auth_target_confirmed",
      label: "Auth target confirmed",
      status: "pending",
      sortOrder: 2
    },
    {
      checklistKey: "runtime_agent_freeze_confirmed",
      label: "Runtime-agent freeze confirmed",
      status: input.runtimeAgentsDisabled ? "completed" : "pending",
      completedAt: input.runtimeAgentsDisabled ? now : null,
      completedBy: input.runtimeAgentsDisabled ? input.createdBy : null,
      sortOrder: 3
    },
    {
      checklistKey: "microsoft_validation_ready",
      label: "Microsoft validation ready",
      status: "pending",
      sortOrder: 4
    }
  ];

  return items.map((item) =>
    createDeploymentPromotionChecklistItemRecord({
      promotionId: input.promotionId,
      checklistKey: item.checklistKey,
      label: item.label,
      status: item.status,
      detail: item.detail ?? null,
      completedAt: item.completedAt ?? null,
      completedBy: item.completedBy ?? null,
      sortOrder: item.sortOrder
    })
  );
}

export function deriveDeploymentRollbackVerification(
  checklistItems: DeploymentPromotionChecklistItemRecord[]
): DeploymentRollbackVerification {
  const rollbackItem = checklistItems.find((item) => item.checklistKey === "rollback_verified");
  return deploymentRollbackVerificationSchema.parse({
    completed: rollbackItem?.status === "completed",
    completedAt: rollbackItem?.completedAt ?? null,
    completedBy: rollbackItem?.completedBy ?? null,
    detail: rollbackItem?.detail ?? null
  });
}

export function createDeploymentPromotionChecklistItemRecord(input: {
  promotionId: string;
  checklistKey: DeploymentPromotionChecklistKey;
  label: string;
  status?: DeploymentPromotionChecklistItemStatus;
  detail?: string | null;
  completedAt?: string | null;
  completedBy?: string | null;
  sortOrder?: number;
}): DeploymentPromotionChecklistItemRecord {
  const now = new Date().toISOString();
  return deploymentPromotionChecklistItemRecordSchema.parse({
    id: randomId("deployment_check_item"),
    promotionId: input.promotionId,
    checklistKey: input.checklistKey,
    label: input.label,
    status: input.status ?? "pending",
    detail: input.detail ?? null,
    completedAt: input.completedAt ?? null,
    completedBy: input.completedBy ?? null,
    sortOrder: input.sortOrder ?? 0,
    createdAt: now,
    updatedAt: now
  });
}

export function createDeploymentPromotionRecord(input: {
  environmentKey: string;
  status?: DeploymentPromotionStatus;
  targetAuthMode?: z.infer<typeof authModeSchema>;
  runtimeAgentsDisabled?: boolean;
  latestSmokeAt?: string | null;
  rollbackVerifiedAt?: string | null;
  notes?: string | null;
  createdBy: string;
}): DeploymentPromotionRecord {
  const now = new Date().toISOString();
  return deploymentPromotionRecordSchema.parse({
    id: randomId("deployment_promotion"),
    environmentKey: input.environmentKey,
    status: input.status ?? "draft",
    targetAuthMode: input.targetAuthMode ?? "trusted_proxy",
    runtimeAgentsDisabled: input.runtimeAgentsDisabled ?? true,
    latestSmokeAt: input.latestSmokeAt ?? null,
    rollbackVerifiedAt: input.rollbackVerifiedAt ?? null,
    notes: input.notes ?? null,
    checklistItems: [],
    rollbackVerification: {
      completed: false,
      completedAt: null,
      completedBy: null,
      detail: null
    },
    createdBy: input.createdBy,
    createdAt: now,
    updatedAt: now
  });
}
