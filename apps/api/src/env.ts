import { config as loadDotenv } from "dotenv";
import type { AuthMode } from "@clinic-os/domain";
import type { MicrosoftIntegrationMode } from "@clinic-os/msgraph";

if (!process.env.VITEST && process.env.NODE_ENV !== "test") {
  loadDotenv();
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }

  return value;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  openaiApiKey: process.env.OPENAI_API_KEY ?? "",
  runtimeAgentsConfigValue: process.env.RUNTIME_AGENTS_ENABLED ?? null,
  runtimeAgentsEnabled: process.env.RUNTIME_AGENTS_ENABLED === "true",
  databaseUrl: process.env.DATABASE_URL ?? "postgresql://clinic_os:clinic_os@localhost:5432/clinic_os",
  publicAppOrigin: process.env.PUBLIC_APP_ORIGIN ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000",
  auth: {
    mode: (
      process.env.AUTH_MODE === "trusted_proxy"
        ? "trusted_proxy"
        : process.env.AUTH_MODE === "device_profiles"
          ? "device_profiles"
          : "dev_headers"
    ) as AuthMode,
    trustedProxySharedSecret: process.env.TRUSTED_PROXY_SHARED_SECRET ?? "",
    trustedProxyAllowedSkewSeconds: Number(process.env.TRUSTED_PROXY_ALLOWED_SKEW_SECONDS ?? 300)
  },
  microsoft: {
    integrationMode: (process.env.MICROSOFT_INTEGRATION_MODE === "live" ? "live" : "stub") as MicrosoftIntegrationMode,
    tenantId: process.env.MICROSOFT_TENANT_ID ?? "",
    clientId: process.env.MICROSOFT_CLIENT_ID ?? "",
    clientSecret: process.env.MICROSOFT_CLIENT_SECRET ?? "",
    sharepointSiteId: process.env.MICROSOFT_SHAREPOINT_SITE_ID ?? "",
    sharepointPolicyFolder: process.env.MICROSOFT_SHAREPOINT_POLICY_FOLDER ?? "ClinicOS/approved-documents",
    listsSiteId: process.env.MICROSOFT_LISTS_SITE_ID ?? process.env.MICROSOFT_SHAREPOINT_SITE_ID ?? "",
    plannerPlanId: process.env.MICROSOFT_PLANNER_PLAN_ID ?? "",
    plannerBucketId: process.env.MICROSOFT_PLANNER_BUCKET_ID ?? "",
    approvalsWebhookUrl: process.env.MICROSOFT_TEAMS_APPROVALS_WEBHOOK_URL ?? "",
    officeOpsWebhookUrl: process.env.MICROSOFT_TEAMS_OFFICE_OPS_WEBHOOK_URL ?? "",
    issueListId: process.env.MICROSOFT_LIST_ISSUES_ID ?? "",
    actionItemListId: process.env.MICROSOFT_LIST_ACTION_ITEMS_ID ?? "",
    importStatusListId: process.env.MICROSOFT_LIST_IMPORT_STATUS_ID ?? "",
    incidentsListId: process.env.MICROSOFT_LIST_INCIDENTS_ID ?? "",
    capaListId: process.env.MICROSOFT_LIST_CAPA_ID ?? ""
  }
};

export function assertProductionConfig(): void {
  if (env.nodeEnv === "production") {
    required("DATABASE_URL");
    required("AUTH_MODE");
    required("PUBLIC_APP_ORIGIN");
    const runtimeAgentsEnabled = required("RUNTIME_AGENTS_ENABLED");
    if (!["true", "false"].includes(runtimeAgentsEnabled)) {
      throw new Error("RUNTIME_AGENTS_ENABLED must be explicitly set to true or false in production.");
    }
    if (env.auth.mode === "trusted_proxy") {
      required("TRUSTED_PROXY_SHARED_SECRET");
    }
  }
}
