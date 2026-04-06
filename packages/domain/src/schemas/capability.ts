import { z } from "zod";
import { roles, type Role } from "../enums";
import type { ActorContext } from "./actor";

export const appCapabilities = [
  "dashboard.view",
  "approvals.view",
  "office_ops.view",
  "office_ops.manage",
  "office_ops.reconcile_planner",
  "quality.view",
  "scorecards.view",
  "pilot_ops.view",
  "ops.view_config",
  "ops.run_cleanup",
  "integrations.view_status",
  "integrations.validate",
  "worker_jobs.view",
  "worker_jobs.retry",
  "auth.manage_profiles",
  "auth.manage_devices",
  "auth.mint_enrollment_codes",
  "audit.view_auth_events"
] as const;

export const appCapabilitySchema = z.enum(appCapabilities);

export const roleCapabilityRecordSchema = z.object({
  role: z.enum(roles),
  capabilities: z.array(appCapabilitySchema)
});

export type AppCapability = z.infer<typeof appCapabilitySchema>;
export type RoleCapabilityRecord = z.infer<typeof roleCapabilityRecordSchema>;

const roleCapabilityMatrix = {
  medical_director: [
    "dashboard.view",
    "approvals.view",
    "office_ops.view",
    "office_ops.manage",
    "office_ops.reconcile_planner",
    "scorecards.view",
    "pilot_ops.view",
    "ops.view_config",
    "ops.run_cleanup",
    "integrations.view_status",
    "integrations.validate",
    "worker_jobs.view",
    "worker_jobs.retry",
    "auth.manage_profiles",
    "auth.manage_devices",
    "auth.mint_enrollment_codes",
    "audit.view_auth_events"
  ],
  cfo: [
    "dashboard.view",
    "approvals.view",
    "pilot_ops.view",
    "ops.view_config",
    "ops.run_cleanup",
    "integrations.view_status",
    "integrations.validate",
    "worker_jobs.view",
    "worker_jobs.retry",
    "auth.manage_profiles",
    "auth.manage_devices",
    "auth.mint_enrollment_codes",
    "audit.view_auth_events"
  ],
  office_manager: [
    "dashboard.view",
    "office_ops.view",
    "office_ops.manage",
    "office_ops.reconcile_planner",
    "scorecards.view",
    "pilot_ops.view",
    "ops.view_config",
    "ops.run_cleanup",
    "integrations.view_status",
    "integrations.validate",
    "worker_jobs.view",
    "worker_jobs.retry",
    "auth.manage_profiles",
    "auth.manage_devices",
    "auth.mint_enrollment_codes",
    "audit.view_auth_events"
  ],
  hr_lead: [
    "dashboard.view",
    "scorecards.view",
    "pilot_ops.view",
    "ops.view_config",
    "auth.manage_profiles",
    "auth.manage_devices",
    "auth.mint_enrollment_codes",
    "audit.view_auth_events"
  ],
  quality_lead: [
    "dashboard.view",
    "quality.view",
    "pilot_ops.view",
    "ops.view_config",
    "ops.run_cleanup",
    "integrations.view_status",
    "integrations.validate",
    "worker_jobs.view",
    "worker_jobs.retry",
    "auth.manage_profiles",
    "auth.manage_devices",
    "auth.mint_enrollment_codes",
    "audit.view_auth_events"
  ],
  patient_care_team_physician: [],
  nurse_practitioner: [],
  medical_assistant: [],
  front_desk: []
} as const satisfies Record<Role, readonly AppCapability[]>;

export function capabilitiesForRole(role: Role): AppCapability[] {
  return [...roleCapabilityMatrix[role]];
}

export function roleHasCapability(role: Role, capability: AppCapability): boolean {
  return capabilitiesForRole(role).includes(capability);
}

export function actorHasCapability(
  actor: Pick<ActorContext, "role">,
  capability: AppCapability
): boolean {
  return roleHasCapability(actor.role, capability);
}

export function listRoleCapabilities(): RoleCapabilityRecord[] {
  return roles.map((role) =>
    roleCapabilityRecordSchema.parse({
      role,
      capabilities: capabilitiesForRole(role)
    })
  );
}

export function rolesWithCapability(capability: AppCapability): Role[] {
  return roles.filter((role) => roleHasCapability(role, capability));
}
