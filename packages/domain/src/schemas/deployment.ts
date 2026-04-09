import { z } from "zod";
import { randomId } from "../common";
import { authModeSchema } from "./auth";

export const deploymentPromotionStatusSchema = z.enum([
  "draft",
  "in_review",
  "ready",
  "completed"
]);

export const deploymentPromotionRecordSchema = z.object({
  id: z.string(),
  environmentKey: z.string(),
  status: deploymentPromotionStatusSchema,
  targetAuthMode: authModeSchema,
  runtimeAgentsDisabled: z.boolean(),
  latestSmokeAt: z.string().nullable().default(null),
  rollbackVerifiedAt: z.string().nullable().default(null),
  notes: z.string().nullable().default(null),
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

export const deployHardeningStatusSchema = z.object({
  currentAuthMode: authModeSchema,
  runtimeAgentsExplicitlyDisabled: z.boolean(),
  runtimeAgentsConfigValue: z.string().nullable().default(null),
  trustedProxyConfigured: z.boolean(),
  trustedProxyReady: z.boolean(),
  recommendedTargetAuthMode: authModeSchema,
  latestPromotion: deploymentPromotionRecordSchema.nullable(),
  latestAlertDispatchAt: z.string().nullable(),
  latestRollbackVerificationAt: z.string().nullable(),
  latestSmokeAt: z.string().nullable()
});

export type DeploymentPromotionStatus = z.infer<typeof deploymentPromotionStatusSchema>;
export type DeploymentPromotionRecord = z.infer<typeof deploymentPromotionRecordSchema>;
export type DeploymentPromotionCreateCommand = z.infer<typeof deploymentPromotionCreateSchema>;
export type DeploymentPromotionUpdateCommand = z.infer<typeof deploymentPromotionUpdateSchema>;
export type DeployHardeningStatus = z.infer<typeof deployHardeningStatusSchema>;

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
    createdBy: input.createdBy,
    createdAt: now,
    updatedAt: now
  });
}
