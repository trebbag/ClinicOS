import { z } from "zod";
import { randomId } from "../common";
import { roles, serviceLines } from "../enums";

export const delegationRuleStatusSchema = z.enum([
  "draft",
  "active",
  "retired"
]);

export const delegationSupervisionLevelSchema = z.enum([
  "protocol",
  "direct",
  "cosign",
  "not_allowed"
]);

export const delegationRuleRecordSchema = z.object({
  id: z.string(),
  serviceLineId: z.enum(serviceLines),
  taskCode: z.string().regex(/^[a-z0-9_]+$/),
  taskLabel: z.string().min(3),
  performerRole: z.enum(roles),
  supervisingRole: z.enum(roles).nullable().default(null),
  status: delegationRuleStatusSchema,
  supervisionLevel: delegationSupervisionLevelSchema,
  requiresCompetencyEvidence: z.boolean(),
  requiresDocumentedOrder: z.boolean(),
  requiresCosign: z.boolean(),
  patientFacing: z.boolean(),
  evidenceRequired: z.string(),
  notes: z.string().nullable().default(null),
  createdBy: z.string(),
  createdAt: z.string(),
  updatedAt: z.string()
});

export const delegationRuleCreateSchema = z.object({
  serviceLineId: z.enum(serviceLines),
  taskCode: z.string().regex(/^[a-z0-9_]+$/),
  taskLabel: z.string().min(3),
  performerRole: z.enum(roles),
  supervisingRole: z.enum(roles).nullable().optional(),
  status: delegationRuleStatusSchema.default("active"),
  supervisionLevel: delegationSupervisionLevelSchema,
  requiresCompetencyEvidence: z.boolean().default(true),
  requiresDocumentedOrder: z.boolean().default(false),
  requiresCosign: z.boolean().default(false),
  patientFacing: z.boolean().default(true),
  evidenceRequired: z.string().min(3),
  notes: z.string().max(2000).optional()
});

export const delegationRuleUpdateSchema = z.object({
  taskLabel: z.string().min(3).optional(),
  supervisingRole: z.enum(roles).nullable().optional(),
  status: delegationRuleStatusSchema.optional(),
  supervisionLevel: delegationSupervisionLevelSchema.optional(),
  requiresCompetencyEvidence: z.boolean().optional(),
  requiresDocumentedOrder: z.boolean().optional(),
  requiresCosign: z.boolean().optional(),
  patientFacing: z.boolean().optional(),
  evidenceRequired: z.string().min(3).optional(),
  notes: z.string().max(2000).nullable().optional()
}).refine((value) => Object.keys(value).length > 0, {
  message: "At least one delegation-rule field must be updated."
});

export const delegationEvaluationQuerySchema = z.object({
  serviceLineId: z.enum(serviceLines),
  taskCode: z.string().regex(/^[a-z0-9_]+$/),
  performerRole: z.enum(roles)
});

export const delegationEvaluationResultSchema = z.object({
  allowed: z.boolean(),
  reason: z.string(),
  matchedRule: delegationRuleRecordSchema.nullable()
});

export type DelegationRuleStatus = z.infer<typeof delegationRuleStatusSchema>;
export type DelegationSupervisionLevel = z.infer<typeof delegationSupervisionLevelSchema>;
export type DelegationRuleRecord = z.infer<typeof delegationRuleRecordSchema>;
export type DelegationRuleCreateCommand = z.infer<typeof delegationRuleCreateSchema>;
export type DelegationRuleUpdateCommand = z.infer<typeof delegationRuleUpdateSchema>;
export type DelegationEvaluationQuery = z.infer<typeof delegationEvaluationQuerySchema>;
export type DelegationEvaluationResult = z.infer<typeof delegationEvaluationResultSchema>;

export function createDelegationRuleRecord(input: DelegationRuleCreateCommand & {
  createdBy: string;
}): DelegationRuleRecord {
  const now = new Date().toISOString();
  return delegationRuleRecordSchema.parse({
    id: randomId("delegation_rule"),
    serviceLineId: input.serviceLineId,
    taskCode: input.taskCode,
    taskLabel: input.taskLabel,
    performerRole: input.performerRole,
    supervisingRole: input.supervisingRole ?? null,
    status: input.status ?? "active",
    supervisionLevel: input.supervisionLevel,
    requiresCompetencyEvidence: input.requiresCompetencyEvidence ?? true,
    requiresDocumentedOrder: input.requiresDocumentedOrder ?? false,
    requiresCosign: input.requiresCosign ?? false,
    patientFacing: input.patientFacing ?? true,
    evidenceRequired: input.evidenceRequired,
    notes: input.notes ?? null,
    createdBy: input.createdBy,
    createdAt: now,
    updatedAt: now
  });
}

export function evaluateDelegationRule(rule: DelegationRuleRecord | null): DelegationEvaluationResult {
  if (!rule || rule.status !== "active" || rule.supervisionLevel === "not_allowed") {
    return {
      allowed: false,
      reason: rule
        ? "A matching rule exists, but this task is not delegated for the selected role."
        : "No active delegation rule exists for this service line, task, and role.",
      matchedRule: rule
    };
  }

  const supervisionSummary =
    rule.supervisionLevel === "protocol"
      ? "Allowed under an approved protocol."
      : rule.supervisionLevel === "direct"
        ? "Allowed only with direct supervision."
        : "Allowed, but physician or delegated cosign is still required.";
  const evidenceSummary = rule.requiresCompetencyEvidence
    ? "Current competency evidence must be on file."
    : "No extra competency evidence is required by this rule.";

  return {
    allowed: true,
    reason: `${supervisionSummary} ${evidenceSummary}`,
    matchedRule: rule
  };
}
