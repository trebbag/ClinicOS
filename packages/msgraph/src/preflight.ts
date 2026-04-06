import { GraphClient } from "./client";
import type { MicrosoftIntegrationMode, MicrosoftPilotOpsConfig } from "./pilotOps";

export type MicrosoftPreflightSurfaceStatus =
  | "ready"
  | "missing_config"
  | "auth_error"
  | "unreachable";

export type MicrosoftPreflightVerificationMode = "live_probe" | "config_only";

export type MicrosoftPreflightSurface = {
  key: "sharepoint" | "planner" | "teams" | "issue_list" | "action_item_list" | "import_status_list";
  label: string;
  status: MicrosoftPreflightSurfaceStatus;
  verificationMode: MicrosoftPreflightVerificationMode;
  configured: boolean;
  reachable: boolean;
  detail: string | null;
};

export type MicrosoftPreflightResult = {
  mode: MicrosoftIntegrationMode;
  configComplete: boolean;
  overallStatus: "ready" | "degraded" | "missing_config";
  readyForLive: boolean;
  missingConfigKeys: string[];
  surfaces: MicrosoftPreflightSurface[];
};

type GraphRequestClient = Pick<GraphClient, "request">;

type SurfaceDefinition = {
  key: MicrosoftPreflightSurface["key"];
  label: string;
  requiredEnvKeys: string[];
  verificationMode: MicrosoftPreflightVerificationMode;
  validate: (client: GraphRequestClient | null) => Promise<void>;
};

function encodeDrivePath(path: string): string {
  return encodeURIComponent(path.replace(/^\/+|\/+$/g, "")).replace(/%2F/g, "/");
}

function authLikeError(error: unknown): boolean {
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  return message.includes("token") || message.includes("401") || message.includes("403");
}

function hasValidHttpsUrl(value: string | undefined): boolean {
  if (!value) {
    return false;
  }

  try {
    const url = new URL(value);
    return url.protocol === "https:" && Boolean(url.hostname);
  } catch {
    return false;
  }
}

class MicrosoftPreflightService {
  private readonly client: GraphRequestClient | null;

  constructor(
    private readonly config: MicrosoftPilotOpsConfig,
    client?: GraphRequestClient
  ) {
    this.client = client ?? (
      config.tenantId && config.clientId && config.clientSecret
        ? new GraphClient({
          tenantId: config.tenantId,
          clientId: config.clientId,
          clientSecret: config.clientSecret
        })
        : null
    );
  }

  private getSurfaceDefinitions(): SurfaceDefinition[] {
    return [
      {
        key: "sharepoint",
        label: "SharePoint policy folder",
        requiredEnvKeys: [
          "MICROSOFT_TENANT_ID",
          "MICROSOFT_CLIENT_ID",
          "MICROSOFT_CLIENT_SECRET",
          "MICROSOFT_SHAREPOINT_SITE_ID",
          "MICROSOFT_SHAREPOINT_POLICY_FOLDER"
        ],
        verificationMode: "live_probe",
        validate: async (client) => {
          const folderPath = encodeDrivePath(this.config.sharepointPolicyFolder ?? "");
          await client!.request(`/sites/${this.config.sharepointSiteId}/drive/root:/${folderPath}`);
        }
      },
      {
        key: "planner",
        label: "Planner plan and bucket",
        requiredEnvKeys: [
          "MICROSOFT_TENANT_ID",
          "MICROSOFT_CLIENT_ID",
          "MICROSOFT_CLIENT_SECRET",
          "MICROSOFT_PLANNER_PLAN_ID",
          "MICROSOFT_PLANNER_BUCKET_ID"
        ],
        verificationMode: "live_probe",
        validate: async (client) => {
          await client!.request(`/planner/plans/${this.config.plannerPlanId}`);
          await client!.request(`/planner/buckets/${this.config.plannerBucketId}`);
        }
      },
      {
        key: "teams",
        label: "Teams webhook notifications",
        requiredEnvKeys: [
          "MICROSOFT_TEAMS_APPROVALS_WEBHOOK_URL",
          "MICROSOFT_TEAMS_OFFICE_OPS_WEBHOOK_URL"
        ],
        verificationMode: "config_only",
        validate: async () => {
          if (!hasValidHttpsUrl(this.config.approvalsWebhookUrl)) {
            throw new Error("MICROSOFT_TEAMS_APPROVALS_WEBHOOK_URL must be a valid https URL.");
          }
          if (!hasValidHttpsUrl(this.config.officeOpsWebhookUrl)) {
            throw new Error("MICROSOFT_TEAMS_OFFICE_OPS_WEBHOOK_URL must be a valid https URL.");
          }
        }
      },
      {
        key: "issue_list",
        label: "Issue register list",
        requiredEnvKeys: [
          "MICROSOFT_TENANT_ID",
          "MICROSOFT_CLIENT_ID",
          "MICROSOFT_CLIENT_SECRET",
          "MICROSOFT_LISTS_SITE_ID",
          "MICROSOFT_LIST_ISSUES_ID"
        ],
        verificationMode: "live_probe",
        validate: async (client) => {
          await client!.request(`/sites/${this.config.listsSiteId}/lists/${this.config.issueListId}`);
        }
      },
      {
        key: "action_item_list",
        label: "Action item list",
        requiredEnvKeys: [
          "MICROSOFT_TENANT_ID",
          "MICROSOFT_CLIENT_ID",
          "MICROSOFT_CLIENT_SECRET",
          "MICROSOFT_LISTS_SITE_ID",
          "MICROSOFT_LIST_ACTION_ITEMS_ID"
        ],
        verificationMode: "live_probe",
        validate: async (client) => {
          await client!.request(`/sites/${this.config.listsSiteId}/lists/${this.config.actionItemListId}`);
        }
      },
      {
        key: "import_status_list",
        label: "Import status list",
        requiredEnvKeys: [
          "MICROSOFT_TENANT_ID",
          "MICROSOFT_CLIENT_ID",
          "MICROSOFT_CLIENT_SECRET",
          "MICROSOFT_LISTS_SITE_ID",
          "MICROSOFT_LIST_IMPORT_STATUS_ID"
        ],
        verificationMode: "live_probe",
        validate: async (client) => {
          await client!.request(`/sites/${this.config.listsSiteId}/lists/${this.config.importStatusListId}`);
        }
      }
    ];
  }

  getMissingConfigKeys(): string[] {
    const missing = new Set<string>();
    const presence: Record<string, string | undefined> = {
      MICROSOFT_TENANT_ID: this.config.tenantId,
      MICROSOFT_CLIENT_ID: this.config.clientId,
      MICROSOFT_CLIENT_SECRET: this.config.clientSecret,
      MICROSOFT_SHAREPOINT_SITE_ID: this.config.sharepointSiteId,
      MICROSOFT_SHAREPOINT_POLICY_FOLDER: this.config.sharepointPolicyFolder,
      MICROSOFT_LISTS_SITE_ID: this.config.listsSiteId,
      MICROSOFT_PLANNER_PLAN_ID: this.config.plannerPlanId,
      MICROSOFT_PLANNER_BUCKET_ID: this.config.plannerBucketId,
      MICROSOFT_TEAMS_APPROVALS_WEBHOOK_URL: hasValidHttpsUrl(this.config.approvalsWebhookUrl)
        ? this.config.approvalsWebhookUrl
        : undefined,
      MICROSOFT_TEAMS_OFFICE_OPS_WEBHOOK_URL: hasValidHttpsUrl(this.config.officeOpsWebhookUrl)
        ? this.config.officeOpsWebhookUrl
        : undefined,
      MICROSOFT_LIST_ISSUES_ID: this.config.issueListId,
      MICROSOFT_LIST_ACTION_ITEMS_ID: this.config.actionItemListId,
      MICROSOFT_LIST_IMPORT_STATUS_ID: this.config.importStatusListId
    };

    for (const definition of this.getSurfaceDefinitions()) {
      for (const key of definition.requiredEnvKeys) {
        if (!presence[key]) {
          missing.add(key);
        }
      }
    }

    return Array.from(missing).sort();
  }

  async validate(): Promise<MicrosoftPreflightResult> {
    const missingConfigKeys = this.getMissingConfigKeys();
    const surfaces: MicrosoftPreflightSurface[] = [];

    for (const definition of this.getSurfaceDefinitions()) {
      const configured = definition.requiredEnvKeys.every((key) => !missingConfigKeys.includes(key));
      if (!configured) {
        surfaces.push({
          key: definition.key,
          label: definition.label,
          status: "missing_config",
          verificationMode: definition.verificationMode,
          configured: false,
          reachable: false,
          detail: `Missing ${definition.requiredEnvKeys.filter((key) => missingConfigKeys.includes(key)).join(", ")}`
        });
        continue;
      }

      if (definition.verificationMode === "live_probe" && !this.client) {
        surfaces.push({
          key: definition.key,
          label: definition.label,
          status: "missing_config",
          verificationMode: definition.verificationMode,
          configured: false,
          reachable: false,
          detail: "Graph client credentials are not configured."
        });
        continue;
      }

      try {
        await definition.validate(this.client);
        surfaces.push({
          key: definition.key,
          label: definition.label,
          status: "ready",
          verificationMode: definition.verificationMode,
          configured: true,
          reachable: true,
          detail: definition.verificationMode === "config_only"
            ? "Webhook URLs are configured. Run a live smoke test to verify channel delivery."
            : null
        });
      } catch (error) {
        surfaces.push({
          key: definition.key,
          label: definition.label,
          status: authLikeError(error) ? "auth_error" : "unreachable",
          verificationMode: definition.verificationMode,
          configured: true,
          reachable: false,
          detail: error instanceof Error ? error.message : "Unknown Graph preflight failure."
        });
      }
    }

    const configComplete = missingConfigKeys.length === 0;
    const readySurfaces = surfaces.filter((surface) => surface.status === "ready").length;
    const readyForLive = configComplete && readySurfaces === surfaces.length;
    const overallStatus = !configComplete
      ? "missing_config"
      : readyForLive
        ? "ready"
        : "degraded";

    return {
      mode: this.config.mode,
      configComplete,
      overallStatus,
      readyForLive,
      missingConfigKeys,
      surfaces
    };
  }
}

export function buildMicrosoftPreflightService(
  config: MicrosoftPilotOpsConfig,
  client?: GraphRequestClient
): MicrosoftPreflightService {
  return new MicrosoftPreflightService(config, client);
}
