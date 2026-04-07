import { config as loadDotenv } from "dotenv";
import type { MicrosoftIntegrationMode } from "@clinic-os/msgraph";

if (!process.env.VITEST && process.env.NODE_ENV !== "test") {
  loadDotenv();
}

const integrationMode: MicrosoftIntegrationMode =
  process.env.MICROSOFT_INTEGRATION_MODE === "live" ? "live" : "stub";

export const workerConfig = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  pollIntervalMs: Number(process.env.WORKER_POLL_INTERVAL_MS ?? 5000),
  batchSize: Number(process.env.WORKER_BATCH_SIZE ?? 10),
  microsoft: {
    integrationMode,
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

export function assertWorkerConfig(): void {
  if (workerConfig.nodeEnv === "production" && !process.env.DATABASE_URL) {
    throw new Error("Missing required env var: DATABASE_URL");
  }
}
