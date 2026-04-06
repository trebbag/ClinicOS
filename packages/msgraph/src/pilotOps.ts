import type { DocumentRecord } from "@clinic-os/domain";
import { uploadApprovedDocument } from "./sharepoint";
import { createPlannerTask, getPlannerTask } from "./planner";
import { sendTeamsWebhookMessage } from "./teams";
import { createListItem } from "./lists";
import { GraphClient } from "./client";

export type MicrosoftIntegrationMode = "stub" | "live";

export type MicrosoftPilotOpsConfig = {
  mode: MicrosoftIntegrationMode;
  tenantId?: string;
  clientId?: string;
  clientSecret?: string;
  sharepointSiteId?: string;
  sharepointPolicyFolder?: string;
  listsSiteId?: string;
  plannerPlanId?: string;
  plannerBucketId?: string;
  approvalsWebhookUrl?: string;
  officeOpsWebhookUrl?: string;
  issueListId?: string;
  actionItemListId?: string;
  importStatusListId?: string;
};

export type MicrosoftPilotOps = {
  readonly mode: MicrosoftIntegrationMode;
  publishApprovedDocument(document: DocumentRecord): Promise<{ externalId: string | null; path: string }>;
  createPlannerTask(input: {
    title: string;
    details?: string;
    dueDateTime?: string | null;
  }): Promise<{ taskId: string }>;
  getPlannerTaskState(input: {
    taskId: string;
  }): Promise<{
    taskId: string;
    status: "not_started" | "in_progress" | "completed";
    completedAt: string | null;
    dueDateTime: string | null;
  }>;
  sendApprovalReminder(input: {
    reviewerRole: string;
    documentTitle: string;
    documentId: string;
  }): Promise<{ messageId: string }>;
  sendOfficeOpsNotification(input: {
    title: string;
    body: string;
  }): Promise<{ messageId: string }>;
  createIssueListItem(fields: Record<string, unknown>): Promise<{ itemId: string }>;
  createActionItemListItem(fields: Record<string, unknown>): Promise<{ itemId: string }>;
  createImportStatusListItem(fields: Record<string, unknown>): Promise<{ itemId: string }>;
};

function slugify(input: string): string {
  return input.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase();
}

function withRequired(value: string | undefined, name: string): string {
  if (!value) {
    throw new Error(`Missing Microsoft integration config: ${name}`);
  }

  return value;
}

class StubMicrosoftPilotOps implements MicrosoftPilotOps {
  readonly mode = "stub" as const;

  async publishApprovedDocument(document: DocumentRecord): Promise<{ externalId: string | null; path: string }> {
    return {
      externalId: `stub-sharepoint-${document.id}`,
      path: `stub://sharepoint/${document.id}/v${document.version}`
    };
  }

  async createPlannerTask(input: {
    title: string;
    details?: string;
    dueDateTime?: string | null;
  }): Promise<{ taskId: string }> {
    return {
      taskId: `stub-planner-${slugify(input.title)}`
    };
  }

  async getPlannerTaskState(input: {
    taskId: string;
  }): Promise<{
    taskId: string;
    status: "not_started" | "in_progress" | "completed";
    completedAt: string | null;
    dueDateTime: string | null;
  }> {
    return {
      taskId: input.taskId,
      status: "not_started",
      completedAt: null,
      dueDateTime: null
    };
  }

  async sendApprovalReminder(input: {
    reviewerRole: string;
    documentTitle: string;
    documentId: string;
  }): Promise<{ messageId: string }> {
    return {
      messageId: `stub-approval-${input.reviewerRole}-${input.documentId}`
    };
  }

  async sendOfficeOpsNotification(input: {
    title: string;
    body: string;
  }): Promise<{ messageId: string }> {
    return {
      messageId: `stub-office-ops-${slugify(input.title || input.body)}`
    };
  }

  async createIssueListItem(fields: Record<string, unknown>): Promise<{ itemId: string }> {
    return {
      itemId: `stub-issue-${slugify(String(fields.Title ?? "item"))}`
    };
  }

  async createActionItemListItem(fields: Record<string, unknown>): Promise<{ itemId: string }> {
    return {
      itemId: `stub-action-${slugify(String(fields.Title ?? "item"))}`
    };
  }

  async createImportStatusListItem(fields: Record<string, unknown>): Promise<{ itemId: string }> {
    return {
      itemId: `stub-import-${slugify(String(fields.Title ?? "item"))}`
    };
  }
}

class LiveMicrosoftPilotOps implements MicrosoftPilotOps {
  readonly mode = "live" as const;
  private readonly client: GraphClient;

  constructor(private readonly config: MicrosoftPilotOpsConfig) {
    this.client = new GraphClient({
      tenantId: withRequired(config.tenantId, "MICROSOFT_TENANT_ID"),
      clientId: withRequired(config.clientId, "MICROSOFT_CLIENT_ID"),
      clientSecret: withRequired(config.clientSecret, "MICROSOFT_CLIENT_SECRET")
    });
  }

  async publishApprovedDocument(document: DocumentRecord): Promise<{ externalId: string | null; path: string }> {
    const filename = `${slugify(document.title)}-v${document.version}.md`;
    const result = await uploadApprovedDocument(
      this.client,
      withRequired(this.config.sharepointSiteId, "MICROSOFT_SHAREPOINT_SITE_ID"),
      this.config.sharepointPolicyFolder ?? "ClinicOS/approved-documents",
      filename,
      document.body
    );

    return {
      externalId: result.itemId,
      path: result.webUrl
    };
  }

  async createPlannerTask(input: {
    title: string;
    details?: string;
    dueDateTime?: string | null;
  }): Promise<{ taskId: string }> {
    return createPlannerTask(
      this.client,
      withRequired(this.config.plannerPlanId, "MICROSOFT_PLANNER_PLAN_ID"),
      input.title,
      this.config.plannerBucketId,
      input.details,
      input.dueDateTime ?? undefined
    );
  }

  async getPlannerTaskState(input: {
    taskId: string;
  }): Promise<{
    taskId: string;
    status: "not_started" | "in_progress" | "completed";
    completedAt: string | null;
    dueDateTime: string | null;
  }> {
    const task = await getPlannerTask(this.client, input.taskId);
    return {
      taskId: task.taskId,
      status: task.completedDateTime
        ? "completed"
        : task.percentComplete > 0
          ? "in_progress"
          : "not_started",
      completedAt: task.completedDateTime,
      dueDateTime: task.dueDateTime
    };
  }

  async sendApprovalReminder(input: {
    reviewerRole: string;
    documentTitle: string;
    documentId: string;
  }): Promise<{ messageId: string }> {
    return sendTeamsWebhookMessage(
      withRequired(this.config.approvalsWebhookUrl, "MICROSOFT_TEAMS_APPROVALS_WEBHOOK_URL"),
      {
        title: "Approval reminder",
        body: `${input.documentTitle} is waiting for ${input.reviewerRole} review.`,
        facts: [
          {
            label: "Document ID",
            value: input.documentId
          },
          {
            label: "Reviewer role",
            value: input.reviewerRole
          }
        ]
      }
    );
  }

  async sendOfficeOpsNotification(input: {
    title: string;
    body: string;
  }): Promise<{ messageId: string }> {
    return sendTeamsWebhookMessage(
      withRequired(this.config.officeOpsWebhookUrl, "MICROSOFT_TEAMS_OFFICE_OPS_WEBHOOK_URL"),
      {
        title: input.title,
        body: input.body
      }
    );
  }

  async createIssueListItem(fields: Record<string, unknown>): Promise<{ itemId: string }> {
    return createListItem(
      this.client,
      withRequired(this.config.listsSiteId, "MICROSOFT_LISTS_SITE_ID"),
      withRequired(this.config.issueListId, "MICROSOFT_LIST_ISSUES_ID"),
      fields
    );
  }

  async createActionItemListItem(fields: Record<string, unknown>): Promise<{ itemId: string }> {
    return createListItem(
      this.client,
      withRequired(this.config.listsSiteId, "MICROSOFT_LISTS_SITE_ID"),
      withRequired(this.config.actionItemListId, "MICROSOFT_LIST_ACTION_ITEMS_ID"),
      fields
    );
  }

  async createImportStatusListItem(fields: Record<string, unknown>): Promise<{ itemId: string }> {
    return createListItem(
      this.client,
      withRequired(this.config.listsSiteId, "MICROSOFT_LISTS_SITE_ID"),
      withRequired(this.config.importStatusListId, "MICROSOFT_LIST_IMPORT_STATUS_ID"),
      fields
    );
  }
}

export function buildMicrosoftPilotOps(config: MicrosoftPilotOpsConfig): MicrosoftPilotOps {
  const liveReady = Boolean(
    config.mode === "live"
    && config.tenantId
    && config.clientId
    && config.clientSecret
    && config.sharepointSiteId
    && config.listsSiteId
    && config.plannerPlanId
    && config.plannerBucketId
    && config.issueListId
    && config.actionItemListId
    && config.importStatusListId
    && config.approvalsWebhookUrl
    && config.officeOpsWebhookUrl
  );

  if (!liveReady) {
    return new StubMicrosoftPilotOps();
  }

  return new LiveMicrosoftPilotOps(config);
}
