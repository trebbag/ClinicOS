import { z } from "zod";
import { randomId } from "../common";
import { roles, type Role } from "../enums";

export const microsoftSurfaceKeySchema = z.enum([
  "sharepoint",
  "planner",
  "teams",
  "issue_list",
  "action_item_list",
  "import_status_list"
]);

export const microsoftSurfaceStatusSchema = z.enum([
  "ready",
  "missing_config",
  "auth_error",
  "unreachable"
]);

export const microsoftSurfaceVerificationModeSchema = z.enum([
  "live_probe",
  "config_only"
]);

export const microsoftValidationOverallStatusSchema = z.enum([
  "ready",
  "degraded",
  "missing_config"
]);

export const publicationModeSchema = z.enum([
  "local_stub",
  "sharepoint_live"
]);

export const microsoftSurfaceValidationSchema = z.object({
  key: microsoftSurfaceKeySchema,
  label: z.string(),
  status: microsoftSurfaceStatusSchema,
  verificationMode: microsoftSurfaceVerificationModeSchema,
  configured: z.boolean(),
  reachable: z.boolean(),
  detail: z.string().nullable().default(null)
});

export const microsoftIntegrationValidationRecordSchema = z.object({
  id: z.string(),
  provider: z.literal("microsoft"),
  mode: z.enum(["stub", "live"]),
  configComplete: z.boolean(),
  overallStatus: microsoftValidationOverallStatusSchema,
  readyForLive: z.boolean(),
  missingConfigKeys: z.array(z.string()),
  surfaces: z.array(microsoftSurfaceValidationSchema),
  checkedAt: z.string(),
  checkedById: z.string(),
  checkedByRole: z.enum(roles)
});

export const microsoftIntegrationStatusSchema = z.object({
  provider: z.literal("microsoft"),
  mode: z.enum(["stub", "live"]),
  configComplete: z.boolean(),
  readyForLive: z.boolean(),
  pilotUsable: z.boolean(),
  publicationMode: publicationModeSchema,
  missingConfigKeys: z.array(z.string()),
  latestValidation: microsoftIntegrationValidationRecordSchema.nullable()
});

export type MicrosoftSurfaceValidation = z.infer<typeof microsoftSurfaceValidationSchema>;
export type MicrosoftIntegrationValidationRecord = z.infer<typeof microsoftIntegrationValidationRecordSchema>;
export type MicrosoftIntegrationStatus = z.infer<typeof microsoftIntegrationStatusSchema>;
export type PublicationMode = z.infer<typeof publicationModeSchema>;

export function createMicrosoftIntegrationValidationRecord(input: {
  mode: "stub" | "live";
  configComplete: boolean;
  overallStatus: z.infer<typeof microsoftValidationOverallStatusSchema>;
  readyForLive: boolean;
  missingConfigKeys: string[];
  surfaces: MicrosoftSurfaceValidation[];
  checkedById: string;
  checkedByRole: Role;
}): MicrosoftIntegrationValidationRecord {
  return microsoftIntegrationValidationRecordSchema.parse({
    id: randomId("integration"),
    provider: "microsoft",
    mode: input.mode,
    configComplete: input.configComplete,
    overallStatus: input.overallStatus,
    readyForLive: input.readyForLive,
    missingConfigKeys: input.missingConfigKeys,
    surfaces: input.surfaces,
    checkedAt: new Date().toISOString(),
    checkedById: input.checkedById,
    checkedByRole: input.checkedByRole
  });
}
