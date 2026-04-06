import { parse } from "csv-parse/sync";
import type { ClinicRepository } from "@clinic-os/db";
import { publicationAllowed, reviewersForApprovalClass } from "@clinic-os/approvals";
import type { MicrosoftPreflightResult } from "@clinic-os/msgraph";
import { z } from "zod";
import {
  actionItemCreateSchema,
  actionItemUpdateSchema,
  checklistItemUpdateSchema,
  createChecklistItemRecord,
  createChecklistRun,
  createChecklistTemplate,
  createMicrosoftIntegrationValidationRecord,
  createActionItemRecord,
  createAuditEvent,
  createDraftDocument,
  createScorecardReviewRecord,
  createTrainingCompletionRecord,
  createTrainingRequirement,
  createWorkerJob,
  createWorkflowRun,
  deidentifiedOperationalRowSchema,
  documentMetadataSchema,
  listRoleCapabilities,
  opsCleanupCommandSchema,
  opsCleanupResultSchema,
  scorecardImportJobSchema,
  scorecardReviewDecisionCommandSchema,
  trainingCompletionCreateSchema,
  trainingRequirementCreateSchema,
  workflowTransitionCommandSchema,
  approvalDecisionCommandSchema,
  type ActorContext,
  type ActionItemRecord,
  type ApiRuntimeConfigStatus,
  type ApprovalTask,
  type AppCapability,
  type AuditEvent,
  type AuthMode,
  type ChecklistItemRecord,
  type ChecklistRun,
  type ChecklistTemplate,
  type MetricRun,
  type MicrosoftIntegrationStatus,
  type MicrosoftIntegrationValidationRecord,
  type DocumentRecord,
  type OpsCleanupResult,
  type OpsCleanupTarget,
  type OpsMaintenanceSummary,
  type OfficeOpsDailyStatus,
  type PublicationMode,
  type RoleCapabilityRecord,
  type TrainingDashboard,
  type TrainingGapItem,
  type TrainingGapStatus,
  type TrainingGapSummary,
  type TrainingRequirement,
  type TrainingCompletionRecord,
  type Role,
  type RoleScorecard,
  type ScorecardHistoryPoint,
  type ScorecardReviewRecord,
  type WorkerJobSummary,
  type WorkerJobRecord,
  type WorkflowDefinition,
  type WorkflowRun
} from "@clinic-os/domain";
import { randomId } from "@clinic-os/domain";
import { calculateRoleScorecard } from "@clinic-os/metrics";
import { canTransition, transitionWorkflow, workflowRegistry } from "@clinic-os/workflows";
import { badRequest, forbidden, notFound } from "./http";
import { getApprovedDocumentPublisherMode, type ApprovedDocumentPublisher } from "./publishing";

type OverviewStats = {
  openApprovals: number;
  publishedDocuments: number;
  publishPendingDocuments: number;
  openIssues: number;
  overdueActionItems: number;
  overdueScorecardReviews: number;
  scorecardsImported: number;
  queuedJobs: number;
  failedJobs: number;
};

type MicrosoftPreflightService = {
  validate(): Promise<MicrosoftPreflightResult>;
  getMissingConfigKeys(): string[];
};

function addDays(input: string, days: number): string {
  const date = new Date(input);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString();
}

function subtractDays(input: string, days: number): string {
  return addDays(input, days * -1);
}

function subtractMinutes(input: string, minutes: number): string {
  return new Date(new Date(input).getTime() - minutes * 60_000).toISOString();
}

function buildMetricRuns(scorecard: RoleScorecard): MetricRun[] {
  const createdAt = new Date().toISOString();
  return [
    {
      id: randomId("metric"),
      metricKey: "overall_score",
      entityId: `${scorecard.employeeRole}:${scorecard.employeeId}`,
      periodStart: scorecard.periodStart,
      periodEnd: scorecard.periodEnd,
      value: scorecard.overallScore,
      createdAt
    },
    ...scorecard.buckets.map((bucket) => ({
      id: randomId("metric"),
      metricKey: bucket.name,
      entityId: `${scorecard.employeeRole}:${scorecard.employeeId}`,
      periodStart: scorecard.periodStart,
      periodEnd: scorecard.periodEnd,
      value: bucket.score,
      createdAt
    }))
  ];
}

function serializeScorecards(scorecards: RoleScorecard[]): string {
  return scorecards
    .map((scorecard) =>
      [
        `## ${scorecard.employeeRole} / ${scorecard.employeeId}`,
        `Overall score: ${scorecard.overallScore}`,
        "",
        ...scorecard.buckets.map((bucket) => `- ${bucket.name}: ${bucket.score}`),
        "",
        "Recommendations:",
        ...scorecard.recommendations.map((item) => `- ${item}`)
      ].join("\n")
    )
    .join("\n\n");
}

function actorSnapshot(actor: ActorContext): Record<string, unknown> {
  return {
    actorId: actor.actorId,
    role: actor.role,
    name: actor.name ?? actor.actorId
  };
}

const clinicTimeZone = "America/New_York";

const officeOpsPacketCommandSchema = z.object({
  targetDate: z.string().optional()
});

const officeOpsCloseoutCommandSchema = z.object({
  targetDate: z.string(),
  notes: z.string().max(2000).optional()
});

const trainingDashboardQuerySchema = z.object({
  employeeId: z.string().min(1),
  employeeRole: z.string().min(1)
});

const defaultOfficeOpsChecklistItems = [
  {
    label: "Front desk opening readiness",
    areaLabel: "Front desk",
    required: true
  },
  {
    label: "Exam room turnover and room readiness",
    areaLabel: "Clinical rooms",
    required: true
  },
  {
    label: "Supply and stock spot check",
    areaLabel: "Supplies",
    required: true
  },
  {
    label: "Testing and vaccine log review",
    areaLabel: "Clinical logs",
    required: true
  },
  {
    label: "Staffing and huddle checklist",
    areaLabel: "Huddle",
    required: true
  }
] as const;

function isOpenActionStatus(status: string): boolean {
  return status !== "done";
}

function getBucketScore(scorecard: RoleScorecard, bucketName: "reliability" | "throughput" | "safety_compliance" | "team_behavior"): number {
  return scorecard.buckets.find((bucket) => bucket.name === bucketName)?.score ?? 0;
}

function getTimeZoneOffsetMinutes(timeZone: string, date: Date): number {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    timeZoneName: "shortOffset",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  });
  const offsetLabel = formatter.formatToParts(date).find((part) => part.type === "timeZoneName")?.value ?? "GMT+0";
  const match = offsetLabel.match(/^GMT([+-])(\d{1,2})(?::?(\d{2}))?$/);
  if (!match) {
    return 0;
  }

  const sign = match[1] === "-" ? -1 : 1;
  return sign * (Number(match[2]) * 60 + Number(match[3] ?? "0"));
}

function buildClinicDateTime(targetDate: string, hour: number, minute: number): string {
  const [year, month, day] = targetDate.split("-").map(Number);
  const offsetMinutes = getTimeZoneOffsetMinutes(clinicTimeZone, new Date(Date.UTC(year, month - 1, day, 12, 0, 0)));
  return new Date(Date.UTC(year, month - 1, day, hour, minute) - offsetMinutes * 60_000).toISOString();
}

function getChecklistCutoffStatus(closeoutDueAt: string, now: string): "before_cutoff" | "due_soon" | "overdue" {
  const diff = new Date(closeoutDueAt).getTime() - new Date(now).getTime();
  if (diff <= 0) {
    return "overdue";
  }
  if (diff <= 2 * 60 * 60 * 1000) {
    return "due_soon";
  }
  return "before_cutoff";
}

function isPlannerEligibleActionItem(item: ActionItemRecord): boolean {
  return item.kind !== "issue" && Boolean(item.sourceWorkflowRunId);
}

function isTrainingGapOpen(status: TrainingGapStatus): boolean {
  return status !== "complete";
}

export class ClinicApiService {
  constructor(
    private readonly repository: ClinicRepository,
    private readonly publisher: ApprovedDocumentPublisher,
    private readonly options: {
      authMode: AuthMode;
      integrationMode: "stub" | "live";
      microsoftPreflight: MicrosoftPreflightService;
    }
  ) {}

  listWorkflowDefinitions(): WorkflowDefinition[] {
    return Array.from(workflowRegistry.values()).map(({ inputSchema: _inputSchema, ...definition }) => definition);
  }

  async listWorkflowRuns(filters?: { workflowDefinitionId?: string }): Promise<WorkflowRun[]> {
    return this.repository.listWorkflowRuns(filters);
  }

  async createWorkflowRun(
    actor: ActorContext,
    input: { workflowId: string; input: Record<string, unknown> }
  ): Promise<WorkflowRun> {
    const definition = workflowRegistry.get(input.workflowId);
    if (!definition) {
      badRequest(`Unknown workflow: ${input.workflowId}`);
    }
    if (!definition.ownerRoles.includes(actor.role)) {
      forbidden(`Role ${actor.role} cannot start workflow ${definition.id}.`);
    }

    const parsed = definition.inputSchema.parse(input.input);
    const run = createWorkflowRun(definition.id, actor.actorId, actor.role, parsed);
    const created = await this.repository.createWorkflowRun(run);
    await this.recordAudit(actor, "workflow.created", "workflow_run", created.id, {
      workflowDefinitionId: created.workflowDefinitionId
    });
    return created;
  }

  async transitionWorkflowRun(
    actor: ActorContext,
    workflowRunId: string,
    input: unknown
  ): Promise<WorkflowRun> {
    const command = workflowTransitionCommandSchema.parse(input);
    const run = await this.repository.getWorkflowRun(workflowRunId);
    if (!run) {
      notFound(`Workflow run not found: ${workflowRunId}`);
    }

    const definition = workflowRegistry.get(run.workflowDefinitionId);
    if (!definition) {
      badRequest(`Workflow definition not registered: ${run.workflowDefinitionId}`);
    }
    if (!definition.ownerRoles.includes(actor.role)) {
      forbidden(`Role ${actor.role} cannot transition workflow ${definition.id}.`);
    }

    if (!canTransition(definition, run.state, command.nextState)) {
      badRequest(`Invalid transition: ${run.state} -> ${command.nextState}`);
    }

    if (command.nextState === "approved" && run.documentId) {
      const linkedDocument = await this.repository.getDocument(run.documentId);
      if (linkedDocument?.status !== "approved") {
        badRequest("Linked document must be fully approved before workflow approval.");
      }
    }

    if (command.nextState === "published" && run.documentId) {
      const linkedDocument = await this.repository.getDocument(run.documentId);
      if (linkedDocument?.status !== "published") {
        badRequest("Linked document must be published before workflow publication.");
      }
    }

    const transitioned = transitionWorkflow(definition, run, command.nextState);
    const updated = await this.repository.updateWorkflowRun(workflowRunId, {
      ...transitioned,
      lastTransitionNote: command.note ?? null
    });

    await this.recordAudit(actor, "workflow.transitioned", "workflow_run", workflowRunId, {
      from: run.state,
      to: command.nextState,
      note: command.note ?? null
    });

    return updated;
  }

  async listDocuments(filters?: { status?: string; approvalClass?: string }) {
    return this.repository.listDocuments(filters);
  }

  async createDocument(actor: ActorContext, input: unknown) {
    const metadata = documentMetadataSchema.parse(input);
    const document = createDraftDocument({
      ...metadata,
      createdBy: actor.actorId
    });
    const created = await this.repository.createDocument(document);

    if (created.workflowRunId) {
      const workflowRun = await this.repository.getWorkflowRun(created.workflowRunId);
      if (workflowRun) {
        await this.repository.updateWorkflowRun(workflowRun.id, {
          documentId: created.id,
          updatedAt: new Date().toISOString()
        });
      }
    }

    await this.recordAudit(actor, "artifact.created", "document", created.id, {
      approvalClass: created.approvalClass,
      artifactType: created.artifactType
    });

    return created;
  }

  async generateOfficeOpsDailyPacket(actor: ActorContext, input: unknown): Promise<OfficeOpsDailyStatus> {
    const command = officeOpsPacketCommandSchema.parse(input);
    const targetDate = command.targetDate ?? new Date().toISOString().slice(0, 10);
    const existing = await this.findOfficeOpsWorkflowRun(targetDate);
    if (existing) {
      await this.ensureChecklistRunForWorkflow(actor, existing, targetDate);
      return this.buildOfficeOpsDashboard(targetDate);
    }

    const openIssues = (await this.repository.listActionItems({
      ownerRole: "office_manager",
      kind: "issue"
    })).filter((item) => isOpenActionStatus(item.status));

    const workflow = await this.createWorkflowRun(actor, {
      workflowId: "office_manager_daily",
      input: {
        targetDate,
        requestedBy: actor.actorId,
        unresolvedIssuesCount: openIssues.length,
        huddleTemplateId: "default-huddle-template"
      }
    });

    await this.transitionWorkflowRun(actor, workflow.id, { nextState: "scoped" });
    await this.createDocument(actor, {
      title: `Daily Huddle Packet ${targetDate}`,
      ownerRole: "office_manager",
      approvalClass: "action_request",
      artifactType: "huddle_packet",
      summary: "Daily packet generated from office-manager cockpit",
      workflowRunId: workflow.id,
      serviceLines: [],
      body: `# Daily Huddle Packet\n\nGenerated ${targetDate}\n\n## Open issues\n${openIssues.map((item) => `- ${item.title}`).join("\n") || "- No open issues"}`
    });
    await this.ensureChecklistRunForWorkflow(actor, workflow, targetDate);
    await this.transitionWorkflowRun(actor, workflow.id, { nextState: "drafted" });
    await this.createActionItem(actor, {
      kind: "review",
      title: `Review daily packet ${targetDate}`,
      description: "Confirm huddle packet and assign follow-through items.",
      ownerRole: "office_manager",
      sourceWorkflowRunId: workflow.id,
      dueDate: buildClinicDateTime(targetDate, 18, 0)
    });

    await this.recordAudit(actor, "office_ops.daily_packet_generated", "workflow_run", workflow.id, {
      targetDate,
      unresolvedIssuesCount: openIssues.length
    });

    return this.buildOfficeOpsDashboard(targetDate);
  }

  async getOfficeOpsDashboard(targetDate: string): Promise<OfficeOpsDailyStatus> {
    return this.buildOfficeOpsDashboard(targetDate);
  }

  async updateChecklistItem(
    actor: ActorContext,
    checklistRunId: string,
    checklistItemId: string,
    input: unknown
  ): Promise<ChecklistItemRecord> {
    const command = checklistItemUpdateSchema.parse(input);
    const run = await this.repository.getChecklistRun(checklistRunId);
    if (!run) {
      notFound(`Checklist run not found: ${checklistRunId}`);
    }

    const item = await this.repository.getChecklistItem(checklistItemId);
    if (!item || item.checklistRunId !== checklistRunId) {
      notFound(`Checklist item not found: ${checklistItemId}`);
    }

    if (!["office_manager", "medical_director", "quality_lead"].includes(actor.role)) {
      forbidden(`Role ${actor.role} cannot update checklist items.`);
    }

    const now = new Date().toISOString();
    const closeoutDueAt = buildClinicDateTime(run.targetDate, 18, 0);
    let reviewActionItemId = item.reviewActionItemId;

    if (command.status === "blocked") {
      const reviewActionTitle = `Checklist block: ${item.areaLabel} - ${item.label}`;
      if (reviewActionItemId) {
        await this.updateActionItem(actor, reviewActionItemId, {
          status: "open",
          resolutionNote: command.note ?? item.note ?? `Checklist item blocked for ${run.targetDate}.`
        });
      } else {
        const reviewActionItem = await this.createActionItem(actor, {
          kind: "review",
          title: reviewActionTitle,
          description: `Blocked checklist item for ${run.targetDate}: ${command.note ?? item.label}`,
          ownerRole: "office_manager",
          sourceWorkflowRunId: run.workflowRunId,
          dueDate: closeoutDueAt
        });
        reviewActionItemId = reviewActionItem.id;
      }
    }

    if (["complete", "waived"].includes(command.status) && reviewActionItemId) {
      await this.updateActionItem(actor, reviewActionItemId, {
        status: "done",
        resolutionNote: command.note ?? item.note ?? "Checklist item resolved."
      });
    }

    const updated = await this.repository.updateChecklistItem(checklistItemId, {
      status: command.status,
      note: command.note ?? item.note ?? null,
      completedAt: ["complete", "waived"].includes(command.status) ? now : null,
      completedBy: ["complete", "waived"].includes(command.status) ? actor.actorId : null,
      reviewActionItemId,
      updatedAt: now
    });

    await this.recordAudit(actor, "office_ops.checklist_item_updated", "checklist_item", updated.id, {
      checklistRunId,
      status: updated.status,
      reviewActionItemId: updated.reviewActionItemId
    });

    return updated;
  }

  async reconcilePlannerTasks(actor: ActorContext): Promise<{ enqueued: number; actionItemIds: string[] }> {
    const eligibleActionItems = await this.listPlannerEligibleActionItems();
    const enqueued: string[] = [];

    for (const item of eligibleActionItems) {
      const existingJobs = await this.repository.listWorkerJobs({
        type: "planner.task.reconcile",
        sourceEntityId: item.id,
        sourceEntityType: "action_item"
      });
      if (existingJobs.some((job) => ["queued", "processing"].includes(job.status))) {
        continue;
      }

      await this.enqueueWorkerJob(actor, createWorkerJob({
        type: "planner.task.reconcile",
        payload: {
          actor: actorSnapshot(actor),
          actionItemId: item.id
        },
        sourceEntityType: "action_item",
        sourceEntityId: item.id
      }));
      enqueued.push(item.id);
    }

    await this.recordAudit(actor, "planner.reconciliation_requested", "planner_sync", actor.actorId, {
      enqueued: enqueued.length
    });

    return {
      enqueued: enqueued.length,
      actionItemIds: enqueued
    };
  }

  async submitOfficeOpsDailyCloseout(actor: ActorContext, input: unknown): Promise<OfficeOpsDailyStatus> {
    const command = officeOpsCloseoutCommandSchema.parse(input);
    const workflow = await this.findOfficeOpsWorkflowRun(command.targetDate);
    if (!workflow) {
      notFound(`No office-manager workflow exists for ${command.targetDate}.`);
    }

    const dashboard = await this.buildOfficeOpsDashboard(command.targetDate);
    if (dashboard.closeoutDocument) {
      return dashboard;
    }

    if (!dashboard.dailyPacket) {
      badRequest(`Daily packet is missing for ${command.targetDate}.`);
    }
    if (dashboard.checklist.requiredRemaining > 0) {
      badRequest("Daily closeout cannot be submitted until all required checklist items are complete or waived.");
    }

    const openEscalations = dashboard.escalations.filter((item) => isOpenActionStatus(item.status));
    const openIssues = dashboard.issues.filter((item) => isOpenActionStatus(item.status));
    const openRoutineItems = dashboard.routineItems.filter((item) => isOpenActionStatus(item.status));
    const closeoutDocument = await this.createDocument(actor, {
      title: `Daily Closeout ${command.targetDate}`,
      ownerRole: "office_manager",
      approvalClass: "action_request",
      artifactType: "daily_closeout_packet",
      workflowRunId: workflow.id,
      serviceLines: [],
      summary: `Closeout for ${command.targetDate}`,
      body: [
        `# Daily Closeout ${command.targetDate}`,
        "",
        `Closeout submitted by ${actor.name ?? actor.actorId}.`,
        "",
        "## Open issues",
        ...(openIssues.length ? openIssues.map((item) => `- ${item.title} (${item.status})`) : ["- None"]),
        "",
        "## Open follow-through items",
        ...(openRoutineItems.length ? openRoutineItems.map((item) => `- ${item.title} (${item.status})`) : ["- None"]),
        "",
        "## Escalations",
        ...(openEscalations.length ? openEscalations.map((item) => `- ${item.title} (${item.status})`) : ["- None"]),
        "",
        "## Checklist summary",
        `- Completed: ${dashboard.checklist.completedItems}`,
        `- Waived: ${dashboard.checklist.waivedItems}`,
        `- Blocked: ${dashboard.checklist.blockedItems}`,
        `- Pending: ${dashboard.checklist.pendingItems}`,
        "",
        "## Notes",
        command.notes ?? "No additional closeout notes."
      ].join("\n")
    });

    const definition = workflowRegistry.get(workflow.workflowDefinitionId);
    if (definition && canTransition(definition, workflow.state, "quality_checked")) {
      await this.transitionWorkflowRun(actor, workflow.id, {
        nextState: "quality_checked",
        note: "Daily closeout submitted."
      });
    }

    await this.recordAudit(actor, "office_ops.closeout_submitted", "document", closeoutDocument.id, {
      targetDate: command.targetDate,
      workflowRunId: workflow.id
    });

    return this.buildOfficeOpsDashboard(command.targetDate);
  }

  async submitDocument(actor: ActorContext, documentId: string): Promise<{ document: DocumentRecord; approvals: ApprovalTask[] }> {
    const document = await this.repository.getDocument(documentId);
    if (!document) {
      notFound(`Document not found: ${documentId}`);
    }
    if (document.status !== "draft" && document.status !== "rejected") {
      badRequest("Only draft or rejected documents can be submitted for review.");
    }

    const existingApprovals = await this.repository.listApprovalTasks({
      targetId: documentId,
      status: "requested"
    });
    if (existingApprovals.length > 0) {
      badRequest("Document already has active approval requests.");
    }

    const approvals = reviewersForApprovalClass(document.approvalClass).map((reviewerRole) => ({
      id: randomId("approval"),
      targetType: "document" as const,
      targetId: document.id,
      reviewerRole,
      approvalClass: document.approvalClass,
      requestedBy: actor.actorId,
      requestedAt: new Date().toISOString(),
      status: "requested" as const,
      decidedAt: null,
      decisionNotes: null
    }));

    await this.repository.createApprovalTasks(approvals);
    const updatedDocument = await this.repository.updateDocument(document.id, {
      status: "in_review",
      updatedAt: new Date().toISOString(),
      version: document.version + 1
    });

    await this.recordAudit(actor, "approval.requested", "document", document.id, {
      reviewerRoles: approvals.map((approval) => approval.reviewerRole)
    });

    await Promise.all(
      approvals.map((approval) =>
        this.enqueueWorkerJob(actor, createWorkerJob({
          type: "approval.reminder",
          payload: {
            actor: actorSnapshot(actor),
            approvalTaskId: approval.id,
            reviewerRole: approval.reviewerRole,
            documentId: document.id,
            documentTitle: document.title
          },
          sourceEntityType: "approval_task",
          sourceEntityId: approval.id
        }))
      )
    );

    return {
      document: updatedDocument,
      approvals
    };
  }

  async listApprovals(filters?: { reviewerRole?: string; status?: string; targetId?: string }) {
    return this.repository.listApprovalTasks(filters);
  }

  async decideApproval(actor: ActorContext, approvalTaskId: string, input: unknown) {
    const command = approvalDecisionCommandSchema.parse(input);
    const approval = await this.repository.getApprovalTask(approvalTaskId);
    if (!approval) {
      notFound(`Approval task not found: ${approvalTaskId}`);
    }
    if (approval.reviewerRole !== actor.role) {
      forbidden(`Approval is assigned to ${approval.reviewerRole}.`);
    }
    if (approval.status !== "requested") {
      badRequest("Approval task has already been decided.");
    }

    const updatedApproval = await this.repository.updateApprovalTask(approvalTaskId, {
      status: command.decision,
      decisionNotes: command.notes ?? null,
      decidedAt: new Date().toISOString()
    });

    const approvals = await this.repository.listApprovalTasks({ targetId: approval.targetId });
    const document = await this.repository.getDocument(approval.targetId);
    if (!document) {
      notFound(`Document not found: ${approval.targetId}`);
    }

    let nextDocumentStatus = document.status;
    if (approvals.some((item) => item.status === "rejected")) {
      nextDocumentStatus = "rejected";
    } else if (approvals.some((item) => item.status === "sent_back")) {
      nextDocumentStatus = "draft";
    } else if (approvals.every((item) => item.status === "approved")) {
      nextDocumentStatus = "approved";
    }

    const updatedDocument = await this.repository.updateDocument(document.id, {
      status: nextDocumentStatus,
      updatedAt: new Date().toISOString()
    });

    if (document.workflowRunId) {
      const workflowRun = await this.repository.getWorkflowRun(document.workflowRunId);
      const definition = workflowRun ? workflowRegistry.get(workflowRun.workflowDefinitionId) : null;

      if (workflowRun && definition) {
        if (nextDocumentStatus === "approved" && canTransition(definition, workflowRun.state, "approved")) {
          await this.repository.updateWorkflowRun(workflowRun.id, {
            state: "approved",
            updatedAt: new Date().toISOString(),
            lastTransitionNote: "Workflow auto-advanced after all approvals completed."
          });
        }

        if (nextDocumentStatus === "rejected" && canTransition(definition, workflowRun.state, "rejected")) {
          await this.repository.updateWorkflowRun(workflowRun.id, {
            state: "rejected",
            updatedAt: new Date().toISOString(),
            lastTransitionNote: "Workflow marked rejected after review decision."
          });
        }
      }
    }

    await this.recordAudit(actor, "approval.decided", "approval_task", approvalTaskId, {
      decision: command.decision,
      targetId: approval.targetId
    });

    return {
      approval: updatedApproval,
      document: updatedDocument
    };
  }

  async publishDocument(actor: ActorContext, documentId: string) {
    const document = await this.repository.getDocument(documentId);
    if (!document) {
      notFound(`Document not found: ${documentId}`);
    }
    if (!reviewersForApprovalClass(document.approvalClass).includes(actor.role)) {
      forbidden(`Role ${actor.role} cannot publish ${document.approvalClass} documents.`);
    }
    if (!publicationAllowed(document.approvalClass, document.status === "approved")) {
      badRequest("Document is not eligible for publication.");
    }

    const updatedDocument = await this.repository.updateDocument(document.id, {
      status: "publish_pending",
      updatedAt: new Date().toISOString()
    });

    await this.enqueueWorkerJob(actor, createWorkerJob({
      type: "document.publish",
      payload: {
        actor: actorSnapshot(actor),
        documentId: document.id
      },
      sourceEntityType: "document",
      sourceEntityId: document.id
    }));

    await this.recordAudit(actor, "artifact.publish_requested", "document", document.id, {
      workflowRunId: document.workflowRunId
    });

    return updatedDocument;
  }

  async getApprovedDocumentContext(documentId: string): Promise<string> {
    const document = await this.repository.getDocument(documentId);
    if (!document) {
      notFound(`Document not found: ${documentId}`);
    }
    if (!["approved", "published"].includes(document.status)) {
      badRequest("Document context is only available for approved or published artifacts.");
    }

    return `# ${document.title}\nstatus=${document.status}\nowner=${document.ownerRole}\n\n${document.body}`;
  }

  async createActionItem(actor: ActorContext, input: unknown) {
    const command = actionItemCreateSchema.parse(input);
    const item = createActionItemRecord({
      ...command,
      createdBy: actor.actorId,
      syncStatus: command.kind === "issue" ? "not_synced" : "pending_create"
    });
    const created = await this.repository.createActionItem(item);
    await this.recordAudit(actor, "action_item.created", "action_item", created.id, {
      kind: created.kind,
      ownerRole: created.ownerRole
    });

    if (created.kind === "issue") {
      await this.enqueueWorkerJob(actor, createWorkerJob({
        type: "lists.issue.upsert",
        payload: {
          actor: actorSnapshot(actor),
          actionItemId: created.id
        },
        sourceEntityType: "action_item",
        sourceEntityId: created.id
      }));
    } else {
      await Promise.all([
        this.enqueueWorkerJob(actor, createWorkerJob({
          type: "planner.task.create",
          payload: {
            actor: actorSnapshot(actor),
            actionItemId: created.id
          },
          sourceEntityType: "action_item",
          sourceEntityId: created.id
        })),
        this.enqueueWorkerJob(actor, createWorkerJob({
          type: "lists.action-item.upsert",
          payload: {
            actor: actorSnapshot(actor),
            actionItemId: created.id
          },
          sourceEntityType: "action_item",
          sourceEntityId: created.id
        }))
      ]);
    }

    return created;
  }

  async updateActionItem(actor: ActorContext, actionItemId: string, input: unknown) {
    const command = actionItemUpdateSchema.parse(input);
    const item = await this.repository.getActionItem(actionItemId);
    if (!item) {
      notFound(`Action item not found: ${actionItemId}`);
    }
    if (![item.ownerRole, item.escalatedToRole, "medical_director"].includes(actor.role)) {
      forbidden(`Role ${actor.role} cannot update action item ${actionItemId}.`);
    }

    return this.applyActionItemUpdate(actor, item, {
      title: command.title,
      description: command.description,
      dueDate: command.dueDate,
      status: command.status,
      resolutionNote: command.resolutionNote
    });
  }

  async listActionItems(filters?: {
    ownerRole?: string;
    status?: string;
    kind?: string;
    escalationStatus?: string;
    sourceWorkflowRunId?: string;
  }) {
    return this.repository.listActionItems(filters);
  }

  async listAuditEvents(filters?: {
    entityType?: string;
    entityId?: string;
    eventTypePrefix?: string;
  }): Promise<AuditEvent[]> {
    const events = await this.repository.listAuditEvents({
      entityType: filters?.entityType,
      entityId: filters?.entityId
    });
    const eventTypePrefix = filters?.eventTypePrefix;
    if (!eventTypePrefix) {
      return events;
    }

    return events.filter((event) => event.eventType.startsWith(eventTypePrefix));
  }

  async listWorkerJobs(filters?: {
    status?: string;
    type?: string;
    sourceEntityId?: string;
    sourceEntityType?: string;
  }): Promise<WorkerJobRecord[]> {
    return this.repository.listWorkerJobs(filters);
  }

  async getWorkerJobSummary(): Promise<WorkerJobSummary> {
    const jobs = await this.repository.listWorkerJobs();
    return {
      queued: jobs.filter((job) => job.status === "queued").length,
      processing: jobs.filter((job) => job.status === "processing").length,
      failed: jobs.filter((job) => job.status === "failed").length,
      deadLetter: jobs.filter((job) => job.status === "dead_letter").length,
      succeeded: jobs.filter((job) => job.status === "succeeded").length
    };
  }

  getRoleCapabilities(): RoleCapabilityRecord[] {
    return listRoleCapabilities();
  }

  async retryWorkerJob(actor: ActorContext, jobId: string): Promise<WorkerJobRecord> {
    const job = await this.repository.getWorkerJob(jobId);
    if (!job) {
      notFound(`Worker job not found: ${jobId}`);
    }
    if (!["failed", "dead_letter"].includes(job.status)) {
      badRequest("Only failed or dead-letter jobs can be retried.");
    }

    const retried = await this.repository.retryWorkerJob(jobId, new Date().toISOString());
    await this.recordAudit(actor, "worker_job.retried", "worker_job", jobId, {
      previousStatus: job.status,
      type: job.type
    });
    return retried;
  }

  async getMicrosoftIntegrationStatus(): Promise<MicrosoftIntegrationStatus> {
    const latestValidation = await this.repository.getLatestMicrosoftIntegrationValidationRecord();
    const missingConfigKeys = this.options.microsoftPreflight.getMissingConfigKeys();
    const configComplete = missingConfigKeys.length === 0;
    const publicationMode = getApprovedDocumentPublisherMode(this.publisher);

    return {
      provider: "microsoft",
      mode: this.options.integrationMode,
      configComplete,
      readyForLive: latestValidation?.readyForLive ?? false,
      pilotUsable: this.options.integrationMode === "stub" || Boolean(latestValidation?.readyForLive),
      publicationMode,
      missingConfigKeys,
      latestValidation
    };
  }

  async getOpsMaintenanceSummary(options?: {
    now?: string;
    authArtifactRetentionDays?: number;
    workerJobRetentionDays?: number;
    staleProcessingMinutes?: number;
  }): Promise<OpsMaintenanceSummary> {
    const now = options?.now ?? new Date().toISOString();
    const authArtifactRetentionDays = options?.authArtifactRetentionDays ?? 7;
    const workerJobRetentionDays = options?.workerJobRetentionDays ?? 14;
    const staleProcessingMinutes = options?.staleProcessingMinutes ?? 15;

    const [devices, sessions, enrollmentCodes, assignments, jobs, microsoft] = await Promise.all([
      this.repository.listEnrolledDevices(),
      this.repository.listDeviceSessions({ includeRevoked: true }),
      this.repository.listDeviceEnrollmentCodes({ includeConsumed: true }),
      this.repository.listDeviceAllowedProfiles(),
      this.repository.listWorkerJobs(),
      this.getMicrosoftIntegrationStatus()
    ]);

    const authRetentionCutoff = subtractDays(now, authArtifactRetentionDays);
    const workerRetentionCutoff = subtractDays(now, workerJobRetentionDays);
    const staleProcessingCutoff = subtractMinutes(now, staleProcessingMinutes);

    const expiredActiveSessions = sessions.filter((session) =>
      session.revokedAt === null
      && (session.idleExpiresAt < now || session.absoluteExpiresAt < now)
    );
    const purgeableRevokedSessions = sessions.filter((session) =>
      session.revokedAt !== null && session.revokedAt < authRetentionCutoff
    );
    const purgeableEnrollmentCodes = enrollmentCodes.filter((code) => {
      const terminalAt = code.consumedAt ?? code.expiresAt;
      return (Boolean(code.consumedAt) || code.expiresAt < now) && terminalAt < authRetentionCutoff;
    });
    const staleProcessingJobs = jobs.filter((job) =>
      job.status === "processing"
      && Boolean(job.lockedAt)
      && (job.lockedAt ?? now) < staleProcessingCutoff
    );
    const purgeableSucceededJobs = jobs.filter((job) =>
      job.status === "succeeded" && job.updatedAt < workerRetentionCutoff
    );
    const purgeableDeadLetterJobs = jobs.filter((job) =>
      job.status === "dead_letter" && job.updatedAt < workerRetentionCutoff
    );

    return {
      checkedAt: now,
      thresholds: {
        authArtifactRetentionDays,
        workerJobRetentionDays,
        staleProcessingMinutes
      },
      auth: {
        activeDevices: devices.filter((device) => device.status === "active" && device.trustExpiresAt >= now).length,
        activeSessions: sessions.filter((session) =>
          session.revokedAt === null
          && session.idleExpiresAt >= now
          && session.absoluteExpiresAt >= now
        ).length,
        expiredActiveSessions: expiredActiveSessions.length,
        purgeableRevokedSessions: purgeableRevokedSessions.length,
        activeEnrollmentCodes: enrollmentCodes.filter((code) => !code.consumedAt && code.expiresAt >= now).length,
        purgeableEnrollmentCodes: purgeableEnrollmentCodes.length,
        lockedProfileAssignments: assignments.filter((assignment) => assignment.lockedUntil && assignment.lockedUntil > now).length
      },
      worker: {
        queued: jobs.filter((job) => job.status === "queued").length,
        processing: jobs.filter((job) => job.status === "processing").length,
        staleProcessing: staleProcessingJobs.length,
        failed: jobs.filter((job) => job.status === "failed").length,
        deadLetter: jobs.filter((job) => job.status === "dead_letter").length,
        purgeableSucceeded: purgeableSucceededJobs.length,
        purgeableDeadLetter: purgeableDeadLetterJobs.length
      },
      microsoft: {
        mode: microsoft.mode,
        readyForLive: microsoft.readyForLive
      }
    };
  }

  async runOpsCleanup(actor: ActorContext, input: unknown): Promise<OpsCleanupResult> {
    const command = opsCleanupCommandSchema.parse(input);
    const now = new Date().toISOString();
    const authRetentionCutoff = subtractDays(now, command.authArtifactRetentionDays);
    const workerRetentionCutoff = subtractDays(now, command.workerJobRetentionDays);
    const staleProcessingCutoff = subtractMinutes(now, command.staleProcessingMinutes);
    const targets = new Set<OpsCleanupTarget>(command.targets);

    const [sessions, enrollmentCodes, jobs] = await Promise.all([
      this.repository.listDeviceSessions({ includeRevoked: true }),
      this.repository.listDeviceEnrollmentCodes({ includeConsumed: true }),
      this.repository.listWorkerJobs()
    ]);

    const expiredSessionsToRevoke = targets.has("expired_sessions")
      ? sessions.filter((session) =>
        session.revokedAt === null
        && (session.idleExpiresAt < now || session.absoluteExpiresAt < now)
      )
      : [];
    const revokedSessionsToPurge = targets.has("expired_sessions")
      ? sessions.filter((session) => session.revokedAt !== null && session.revokedAt < authRetentionCutoff)
      : [];
    const enrollmentCodesToPurge = targets.has("enrollment_codes")
      ? enrollmentCodes.filter((code) => {
        const terminalAt = code.consumedAt ?? code.expiresAt;
        return (Boolean(code.consumedAt) || code.expiresAt < now) && terminalAt < authRetentionCutoff;
      })
      : [];
    const staleProcessingJobs = targets.has("stale_processing_jobs")
      ? jobs.filter((job) =>
        job.status === "processing"
        && Boolean(job.lockedAt)
        && (job.lockedAt ?? now) < staleProcessingCutoff
      )
      : [];
    const succeededJobsToPurge = targets.has("succeeded_worker_jobs")
      ? jobs.filter((job) => job.status === "succeeded" && job.updatedAt < workerRetentionCutoff)
      : [];
    const deadLetterJobsToPurge = targets.has("dead_letter_worker_jobs")
      ? jobs.filter((job) => job.status === "dead_letter" && job.updatedAt < workerRetentionCutoff)
      : [];

    if (!command.dryRun) {
      await Promise.all(expiredSessionsToRevoke.map((session) =>
        this.repository.updateDeviceSession(session.id, {
          revokedAt: now,
          updatedAt: now
        })
      ));
      await this.repository.deleteDeviceSessions(revokedSessionsToPurge.map((session) => session.id));
      await this.repository.deleteDeviceEnrollmentCodes(enrollmentCodesToPurge.map((code) => code.id));
      await Promise.all(staleProcessingJobs.map((job) =>
        this.repository.updateWorkerJob(job.id, {
          status: "queued",
          lockedAt: null,
          lastError: "Requeued by operator cleanup after stale processing lock.",
          scheduledAt: now,
          updatedAt: now
        })
      ));
      await this.repository.deleteWorkerJobs(succeededJobsToPurge.map((job) => job.id));
      await this.repository.deleteWorkerJobs(deadLetterJobsToPurge.map((job) => job.id));
    }

    const result = opsCleanupResultSchema.parse({
      checkedAt: now,
      dryRun: command.dryRun,
      targets: command.targets,
      revokedExpiredSessions: expiredSessionsToRevoke.length,
      purgedRevokedSessions: revokedSessionsToPurge.length,
      purgedEnrollmentCodes: enrollmentCodesToPurge.length,
      requeuedStaleProcessingJobs: staleProcessingJobs.length,
      purgedSucceededWorkerJobs: succeededJobsToPurge.length,
      purgedDeadLetterWorkerJobs: deadLetterJobsToPurge.length
    });

    await this.recordAudit(actor, "ops.cleanup_ran", "ops_maintenance", actor.actorId, {
      dryRun: result.dryRun,
      targets: result.targets,
      revokedExpiredSessions: result.revokedExpiredSessions,
      purgedRevokedSessions: result.purgedRevokedSessions,
      purgedEnrollmentCodes: result.purgedEnrollmentCodes,
      requeuedStaleProcessingJobs: result.requeuedStaleProcessingJobs,
      purgedSucceededWorkerJobs: result.purgedSucceededWorkerJobs,
      purgedDeadLetterWorkerJobs: result.purgedDeadLetterWorkerJobs
    });

    return result;
  }

  async getRuntimeConfigStatus(input: {
    nodeEnv: string;
    publicAppOrigin: string | null;
    databaseReady: boolean;
  }): Promise<ApiRuntimeConfigStatus> {
    const [worker, microsoft] = await Promise.all([
      this.getWorkerJobSummary(),
      this.getMicrosoftIntegrationStatus()
    ]);

    const publicationMode: PublicationMode = microsoft.publicationMode;
    const blockingIssues: string[] = [];
    if (!input.databaseReady) {
      blockingIssues.push("Database connection is not ready.");
    }
    if (!input.publicAppOrigin) {
      blockingIssues.push("PUBLIC_APP_ORIGIN is not configured.");
    }
    if (this.options.authMode !== "device_profiles") {
      blockingIssues.push("AUTH_MODE should be device_profiles for the first pilot.");
    }
    if (input.nodeEnv === "production" && publicationMode !== "local_stub" && !microsoft.readyForLive) {
      blockingIssues.push("Microsoft live publication is selected but has not passed validation.");
    }

    const startupReady =
      input.databaseReady
      && (
        input.nodeEnv !== "production"
        || Boolean(input.publicAppOrigin)
      );

    const pilotUsable =
      input.databaseReady
      && this.options.authMode === "device_profiles"
      && Boolean(input.publicAppOrigin)
      && (
        this.options.integrationMode === "stub"
        || microsoft.readyForLive
      );

    return {
      service: "clinic-os-api",
      nodeEnv: input.nodeEnv,
      checkedAt: new Date().toISOString(),
      authMode: this.options.authMode,
      publicAppOrigin: input.publicAppOrigin,
      integrationMode: this.options.integrationMode,
      publicationMode,
      databaseReady: input.databaseReady,
      worker,
      microsoft,
      pilotUsable,
      startupReady,
      blockingIssues
    };
  }

  async validateMicrosoftIntegration(actor: ActorContext): Promise<MicrosoftIntegrationValidationRecord> {
    const result = await this.options.microsoftPreflight.validate();
    const record = createMicrosoftIntegrationValidationRecord({
      mode: result.mode,
      configComplete: result.configComplete,
      overallStatus: result.overallStatus,
      readyForLive: result.readyForLive,
      missingConfigKeys: result.missingConfigKeys,
      surfaces: result.surfaces,
      checkedById: actor.actorId,
      checkedByRole: actor.role
    });

    const created = await this.repository.createMicrosoftIntegrationValidationRecord(record);
    await this.recordAudit(actor, "integration.microsoft.validated", "integration_validation", created.id, {
      overallStatus: created.overallStatus,
      readyForLive: created.readyForLive
    });

    return created;
  }

  async importScorecards(actor: ActorContext, input: unknown) {
    const job = scorecardImportJobSchema.parse(input);
    const parsed = parse(job.csv, {
      columns: true,
      skip_empty_lines: true,
      trim: true
    }) as Record<string, string>[];

    if (parsed.length === 0) {
      badRequest("CSV import contained no rows.");
    }

    const rows = parsed.map((row) => deidentifiedOperationalRowSchema.parse(row));
    const scorecards = rows.map((row) => calculateRoleScorecard(row));
    const metricRuns = scorecards.flatMap((scorecard) => buildMetricRuns(scorecard));
    await this.repository.createMetricRuns(metricRuns);

    const workflow = await this.createWorkflowRun(actor, {
      workflowId: "staff_scorecard_generation",
      input: {
        periodStart: rows[0].period_start,
        periodEnd: rows[0].period_end,
        rowsImported: rows.length,
        requestedBy: actor.actorId
      }
    });
    await this.transitionWorkflowRun(actor, workflow.id, { nextState: "scoped" });

    const packet = await this.createDocument(actor, {
      title: `${job.filename} manager review packet`,
      ownerRole: "office_manager",
      approvalClass: "action_request",
      artifactType: "manager_review_packet",
      summary: `Imported ${rows.length} de-identified scorecards`,
      workflowRunId: workflow.id,
      body: serializeScorecards(scorecards),
      serviceLines: []
    });
    await this.transitionWorkflowRun(actor, workflow.id, { nextState: "drafted" });
    await this.transitionWorkflowRun(actor, workflow.id, { nextState: "quality_checked" });
    await this.transitionWorkflowRun(actor, workflow.id, { nextState: "awaiting_human_review" });

    const reviewDueDate = addDays(new Date().toISOString(), 7);
    const reviewItems = await Promise.all(scorecards.map((scorecard) =>
      this.createActionItem(actor, {
          kind: "review",
          title: `Review scorecard for ${scorecard.employeeId}`,
          description: `Review ${scorecard.employeeRole} scorecard for ${scorecard.periodStart} through ${scorecard.periodEnd}.`,
          ownerRole: "hr_lead",
          dueDate: reviewDueDate,
          sourceWorkflowRunId: workflow.id
      })
    ));

    const oversightItems = await Promise.all(scorecards.map((scorecard) => {
      const requiresMedicalDirectorReview = scorecard.overallScore < 80 || getBucketScore(scorecard, "safety_compliance") < 85;
      if (!requiresMedicalDirectorReview) {
        return Promise.resolve(null);
      }

      return this.createActionItem(actor, {
        kind: "review",
        title: `Medical director oversight for ${scorecard.employeeId}`,
        description: `Exception review for ${scorecard.employeeRole} scorecard (${scorecard.periodStart} through ${scorecard.periodEnd}).`,
        ownerRole: "medical_director",
        dueDate: reviewDueDate,
        sourceWorkflowRunId: workflow.id
      });
    }));

    const reviewRecords = scorecards.map((scorecard, index) =>
      createScorecardReviewRecord({
        workflowRunId: workflow.id,
        packetDocumentId: packet.id,
        actionItemId: reviewItems[index].id,
        medicalDirectorActionItemId: oversightItems[index]?.id ?? null,
        employeeId: scorecard.employeeId,
        employeeRole: scorecard.employeeRole,
        periodStart: scorecard.periodStart,
        periodEnd: scorecard.periodEnd,
        overallScore: scorecard.overallScore,
        safetyComplianceScore: getBucketScore(scorecard, "safety_compliance"),
        dueDate: reviewDueDate,
        requiresMedicalDirectorReview: Boolean(oversightItems[index])
      })
    );
    await this.repository.createScorecardReviews(reviewRecords);

    await this.recordAudit(actor, "scorecards.imported", "workflow_run", workflow.id, {
      filename: job.filename,
      rowsImported: rows.length
    });

    await Promise.all([
      this.enqueueWorkerJob(actor, createWorkerJob({
        type: "lists.import-status.upsert",
        payload: {
          actor: actorSnapshot(actor),
          workflowRunId: workflow.id,
          packetDocumentId: packet.id,
          filename: job.filename,
          rowsImported: rows.length
        },
        sourceEntityType: "workflow_run",
        sourceEntityId: workflow.id
      })),
      this.enqueueWorkerJob(actor, createWorkerJob({
        type: "teams.notification",
        payload: {
          actor: actorSnapshot(actor),
          title: "Scorecard import completed",
          body: `${rows.length} de-identified scorecards imported from ${job.filename}.`
        },
        sourceEntityType: "workflow_run",
        sourceEntityId: workflow.id
      }))
    ]);

    return {
      workflow,
      packet,
      rowsImported: rows.length,
      scorecards,
      reviewItems,
      reviewRecords
    };
  }

  async listScorecards(): Promise<RoleScorecard[]> {
    const metrics = await this.repository.listMetricRuns();
    const metricGroups = new Map<string, MetricRun[]>();
    for (const metric of metrics) {
      const key = `${metric.entityId}:${metric.periodStart}:${metric.periodEnd}`;
      const group = metricGroups.get(key) ?? [];
      group.push(metric);
      metricGroups.set(key, group);
    }

    const scorecards: Array<RoleScorecard | null> = Array.from(metricGroups.values()).map((group) => {
        const overall = group.find((metric) => metric.metricKey === "overall_score");
        if (!overall) return null;
        const [employeeRole, employeeId] = overall.entityId.split(":");
        const buckets = group
          .filter((metric) => metric.metricKey !== "overall_score")
          .map((metric) => ({
            name: metric.metricKey as "reliability" | "throughput" | "safety_compliance" | "team_behavior",
            score: metric.value,
            notes: []
          }));

        return {
          employeeId,
          employeeRole,
          periodStart: overall.periodStart,
          periodEnd: overall.periodEnd,
          overallScore: overall.value,
          buckets,
          recommendations: []
        };
      });

    return scorecards.filter((item): item is RoleScorecard => item !== null);
  }

  async listScorecardReviews(filters?: {
    status?: string;
    periodStart?: string;
    periodEnd?: string;
  }): Promise<ScorecardReviewRecord[]> {
    const reviews = await this.repository.listScorecardReviews({
      status: filters?.status
    });

    return reviews.filter((review) =>
      (!filters?.periodStart || review.periodStart === filters.periodStart)
      && (!filters?.periodEnd || review.periodEnd === filters.periodEnd)
    );
  }

  async getTrainingDashboard(employeeId: string, employeeRole: string): Promise<TrainingDashboard> {
    const query = trainingDashboardQuerySchema.parse({
      employeeId,
      employeeRole
    });
    const [requirements, completions, gapSummary] = await Promise.all([
      this.repository.listTrainingRequirements({
        employeeId: query.employeeId,
        employeeRole: query.employeeRole
      }),
      this.repository.listTrainingCompletions({
        employeeId: query.employeeId,
        employeeRole: query.employeeRole
      }),
      this.buildTrainingGapSummary(query.employeeId, query.employeeRole)
    ]);

    return {
      employeeId: query.employeeId,
      employeeRole: query.employeeRole,
      requirements,
      completions,
      gapSummary
    };
  }

  async createTrainingRequirement(actor: ActorContext, input: unknown): Promise<TrainingRequirement> {
    if (!["hr_lead", "medical_director"].includes(actor.role)) {
      forbidden(`Role ${actor.role} cannot create training requirements.`);
    }
    const command = trainingRequirementCreateSchema.parse(input);
    const requirement = createTrainingRequirement({
      ...command,
      createdBy: actor.actorId
    });
    const created = await this.repository.createTrainingRequirement(requirement);
    await this.recordAudit(actor, "training.requirement_created", "training_requirement", created.id, {
      employeeId: created.employeeId,
      employeeRole: created.employeeRole,
      requirementType: created.requirementType
    });
    await this.reconcileTrainingFollowUpsForEmployee(actor, created.employeeId, created.employeeRole);
    return created;
  }

  async createTrainingCompletion(actor: ActorContext, input: unknown): Promise<TrainingCompletionRecord> {
    if (!["hr_lead", "medical_director"].includes(actor.role)) {
      forbidden(`Role ${actor.role} cannot record training completions.`);
    }
    const command = trainingCompletionCreateSchema.parse(input);
    const requirement = await this.repository.getTrainingRequirement(command.requirementId);
    if (!requirement) {
      notFound(`Training requirement not found: ${command.requirementId}`);
    }

    const completion = createTrainingCompletionRecord({
      requirementId: requirement.id,
      employeeId: requirement.employeeId,
      employeeRole: requirement.employeeRole,
      completedAt: command.completedAt,
      validUntil: command.validUntil,
      note: command.note ?? requirement.notes,
      recordedBy: actor.actorId
    });

    const created = await this.repository.createTrainingCompletion(completion);
    await this.recordAudit(actor, "training.completion_recorded", "training_completion", created.id, {
      requirementId: created.requirementId,
      employeeId: created.employeeId,
      employeeRole: created.employeeRole
    });

    await this.reconcileTrainingFollowUpsForEmployee(actor, created.employeeId, created.employeeRole);
    return created;
  }

  async decideScorecardReview(actor: ActorContext, reviewId: string, input: unknown): Promise<ScorecardReviewRecord> {
    const command = scorecardReviewDecisionCommandSchema.parse(input);
    const review = await this.repository.getScorecardReview(reviewId);
    if (!review) {
      notFound(`Scorecard review not found: ${reviewId}`);
    }

    const now = new Date().toISOString();
    const hrActionItem = await this.repository.getActionItem(review.actionItemId);
    const medicalDirectorActionItem = review.medicalDirectorActionItemId
      ? await this.repository.getActionItem(review.medicalDirectorActionItemId)
      : null;
    const gapSummary = await this.buildTrainingGapSummary(review.employeeId, review.employeeRole);
    const hasOpenTrainingGaps = gapSummary.items.some((item) => isTrainingGapOpen(item.status));

    if (actor.role === "hr_lead") {
      if (command.decision === "signed_off") {
        let updatedReview = await this.repository.updateScorecardReview(review.id, {
          status: review.requiresMedicalDirectorReview ? "pending_medical_director_review" : "signed_off",
          hrSignedOffAt: now,
          resolutionNote: command.notes ?? review.resolutionNote,
          updatedAt: now
        });
        if (hrActionItem) {
          await this.applyActionItemUpdate(actor, hrActionItem, {
            status: "done",
            resolutionNote: command.notes ?? hrActionItem.resolutionNote
          });
        }
        await this.recordAudit(actor, "scorecard.review_decided", "scorecard_review", review.id, {
          decision: command.decision
        });
        if (hasOpenTrainingGaps) {
          updatedReview = await this.ensureTrainingFollowUpForReview(actor, updatedReview, gapSummary);
        } else {
          await this.reconcileTrainingFollowUpsForEmployee(actor, review.employeeId, review.employeeRole);
        }
        return this.reconcileScorecardWorkflow(actor, updatedReview.workflowRunId, updatedReview);
      }

      if (command.decision === "sent_back") {
        const updatedReview = await this.repository.updateScorecardReview(review.id, {
          status: "sent_back",
          resolutionNote: command.notes ?? review.resolutionNote,
          sentBackAt: now,
          updatedAt: now
        });
        if (hrActionItem) {
          await this.applyActionItemUpdate(actor, hrActionItem, {
            status: "blocked",
            resolutionNote: command.notes ?? hrActionItem.resolutionNote
          });
        }
        await this.recordAudit(actor, "scorecard.review_decided", "scorecard_review", review.id, {
          decision: command.decision
        });
        return updatedReview;
      }

      if (command.decision === "escalated") {
        let oversightTaskId = review.medicalDirectorActionItemId;
        if (!medicalDirectorActionItem) {
          const createdOversightTask = await this.createActionItem(actor, {
            kind: "review",
            title: `Medical director oversight for ${review.employeeId}`,
            description: `Escalated scorecard review for ${review.employeeRole} (${review.periodStart} through ${review.periodEnd}).`,
            ownerRole: "medical_director",
            dueDate: review.dueDate,
            sourceWorkflowRunId: review.workflowRunId
          });
          oversightTaskId = createdOversightTask.id;
        }

        if (hrActionItem) {
          await this.applyActionItemUpdate(actor, hrActionItem, {
            status: "done",
            resolutionNote: command.notes ?? hrActionItem.resolutionNote
          });
        }

        const updatedReview = await this.repository.updateScorecardReview(review.id, {
          status: "pending_medical_director_review",
          requiresMedicalDirectorReview: true,
          oversightStatus: "pending",
          medicalDirectorActionItemId: oversightTaskId,
          escalatedAt: now,
          resolutionNote: command.notes ?? review.resolutionNote,
          hrSignedOffAt: review.hrSignedOffAt ?? now,
          updatedAt: now
        });
        await this.recordAudit(actor, "scorecard.review_decided", "scorecard_review", review.id, {
          decision: command.decision
        });
        return updatedReview;
      }
    }

    if (actor.role === "medical_director") {
      if (!review.requiresMedicalDirectorReview) {
        forbidden("This review does not require medical-director oversight.");
      }
      if (command.decision === "escalated") {
        badRequest("Medical director cannot escalate a scorecard review again.");
      }

      if (command.decision === "signed_off") {
        let updatedReview = await this.repository.updateScorecardReview(review.id, {
          oversightStatus: "signed_off",
          medicalDirectorSignedOffAt: now,
          status: review.hrSignedOffAt ? "signed_off" : "pending_hr_review",
          resolutionNote: command.notes ?? review.resolutionNote,
          updatedAt: now
        });
        if (medicalDirectorActionItem && !hasOpenTrainingGaps) {
          await this.applyActionItemUpdate(actor, medicalDirectorActionItem, {
            status: "done",
            resolutionNote: command.notes ?? medicalDirectorActionItem.resolutionNote
          });
        } else if (medicalDirectorActionItem && hasOpenTrainingGaps) {
          await this.applyActionItemUpdate(actor, medicalDirectorActionItem, {
            status: "in_progress",
            resolutionNote: command.notes ?? "Awaiting training-gap resolution after review sign-off.",
            closedAt: null
          });
        }
        await this.recordAudit(actor, "scorecard.review_decided", "scorecard_review", review.id, {
          decision: command.decision
        });
        if (hasOpenTrainingGaps) {
          updatedReview = await this.ensureTrainingFollowUpForReview(actor, updatedReview, gapSummary);
        } else {
          await this.reconcileTrainingFollowUpsForEmployee(actor, review.employeeId, review.employeeRole);
        }
        return this.reconcileScorecardWorkflow(actor, updatedReview.workflowRunId, updatedReview);
      }

      const updatedReview = await this.repository.updateScorecardReview(review.id, {
        status: "sent_back",
        oversightStatus: "pending",
        resolutionNote: command.notes ?? review.resolutionNote,
        sentBackAt: now,
        updatedAt: now
      });
      if (medicalDirectorActionItem) {
        await this.applyActionItemUpdate(actor, medicalDirectorActionItem, {
          status: "blocked",
          resolutionNote: command.notes ?? medicalDirectorActionItem.resolutionNote
        });
      }
      await this.recordAudit(actor, "scorecard.review_decided", "scorecard_review", review.id, {
        decision: command.decision
      });
      return updatedReview;
    }

    forbidden(`Role ${actor.role} cannot decide scorecard reviews.`);
  }

  async getScorecardHistory(employeeId: string, employeeRole: string): Promise<ScorecardHistoryPoint[]> {
    const scorecards = (await this.listScorecards())
      .filter((scorecard) => scorecard.employeeId === employeeId && scorecard.employeeRole === employeeRole)
      .sort((left, right) => left.periodStart.localeCompare(right.periodStart));

    return Promise.all(scorecards.map(async (scorecard, index) => {
      const previous = index > 0 ? scorecards[index - 1] : null;
      const rollingWindow = scorecards.slice(Math.max(0, index - 2), index + 1);
      const trainingGapSummary = await this.buildTrainingGapSummary(employeeId, employeeRole, scorecard.periodEnd);
      return {
        employeeId: scorecard.employeeId,
        employeeRole: scorecard.employeeRole,
        periodStart: scorecard.periodStart,
        periodEnd: scorecard.periodEnd,
        overallScore: scorecard.overallScore,
        previousOverallScore: previous?.overallScore ?? null,
        overallDelta: previous ? scorecard.overallScore - previous.overallScore : null,
        rollingAverageOverallScore: rollingWindow.length > 0
          ? Math.round((rollingWindow.reduce((sum, item) => sum + item.overallScore, 0) / rollingWindow.length) * 10) / 10
          : null,
        openTrainingGapCount: trainingGapSummary.items.filter((item) => isTrainingGapOpen(item.status)).length,
        buckets: scorecard.buckets.map((bucket) => {
          const previousBucket = previous?.buckets.find((entry) => entry.name === bucket.name);
          return {
            name: bucket.name,
            score: bucket.score,
            previousScore: previousBucket?.score ?? null,
            delta: previousBucket ? bucket.score - previousBucket.score : null
          };
        }),
        trainingGapSummary
      };
    }));
  }

  async getOverviewStats(): Promise<OverviewStats> {
    const [approvals, documents, actionItems, reviews, metrics, jobSummary] = await Promise.all([
      this.repository.listApprovalTasks({ status: "requested" }),
      this.repository.listDocuments(),
      this.repository.listActionItems(),
      this.repository.listScorecardReviews(),
      this.repository.listMetricRuns(),
      this.getWorkerJobSummary()
    ]);
    const now = new Date().toISOString();
    const openActionItems = actionItems.filter((item) => isOpenActionStatus(item.status));
    const overdueActionItems = openActionItems.filter((item) => item.dueDate && item.dueDate < now).length;
    const overdueScorecardReviews = reviews.filter(
      (review) => review.status !== "signed_off" && review.status !== "sent_back" && review.dueDate < now
    ).length;

    return {
      openApprovals: approvals.length,
      publishedDocuments: documents.filter((document) => document.status === "published").length,
      publishPendingDocuments: documents.filter((document) => document.status === "publish_pending").length,
      openIssues: openActionItems.filter((item) => item.kind === "issue").length,
      overdueActionItems,
      overdueScorecardReviews,
      scorecardsImported: new Set(metrics.map((metric) => `${metric.periodStart}:${metric.periodEnd}`)).size,
      queuedJobs: jobSummary.queued + jobSummary.processing,
      failedJobs: jobSummary.failed + jobSummary.deadLetter
    };
  }

  private async findOfficeOpsWorkflowRun(targetDate: string): Promise<WorkflowRun | null> {
    const runs = await this.repository.listWorkflowRuns({ workflowDefinitionId: "office_manager_daily" });
    return runs.find((run) => typeof run.input.targetDate === "string" && run.input.targetDate === targetDate && run.state !== "archived") ?? null;
  }

  private async buildOfficeOpsDashboard(targetDate: string): Promise<OfficeOpsDailyStatus> {
    const workflowRun = await this.findOfficeOpsWorkflowRun(targetDate);
    const closeoutDueAt = buildClinicDateTime(targetDate, 18, 0);
    const [allDocuments, officeManagerItems, escalationItems, allJobs, checklistRun, checklistItems] = await Promise.all([
      this.repository.listDocuments(),
      this.repository.listActionItems({ ownerRole: "office_manager" }),
      this.repository.listActionItems({ ownerRole: "medical_director" }),
      this.repository.listWorkerJobs(),
      workflowRun
        ? this.repository.listChecklistRuns({ workflowRunId: workflowRun.id }).then((runs) => runs[0] ?? null)
        : Promise.resolve(null),
      workflowRun
        ? this.repository.listChecklistRuns({ workflowRunId: workflowRun.id }).then(async (runs) => {
            const run = runs[0];
            if (!run) {
              return [];
            }
            return this.repository.listChecklistItems({ checklistRunId: run.id });
          })
        : Promise.resolve([])
    ]);

    const workflowDocuments = workflowRun
      ? allDocuments.filter((document) => document.workflowRunId === workflowRun.id)
      : [];
    const dailyPacket = workflowDocuments.find((document) => document.artifactType === "huddle_packet") ?? null;
    const closeoutDocument = workflowDocuments.find((document) => document.artifactType === "daily_closeout_packet") ?? null;
    const issues = officeManagerItems.filter((item) => item.kind === "issue" && isOpenActionStatus(item.status));
    const routineItems = officeManagerItems.filter(
      (item) => item.kind !== "issue"
        && isOpenActionStatus(item.status)
        && (!workflowRun || item.sourceWorkflowRunId === workflowRun.id)
    );
    const escalations = escalationItems.filter(
      (item) => isOpenActionStatus(item.status)
        && (workflowRun ? item.sourceWorkflowRunId === workflowRun.id : false)
    );
    const relatedIds = new Set<string>([
      workflowRun?.id ?? "",
      ...workflowDocuments.map((document) => document.id),
      ...issues.map((item) => item.id),
      ...routineItems.map((item) => item.id),
      ...escalations.map((item) => item.id),
      ...checklistItems.map((item) => item.id)
    ]);
    const relatedJobs = allJobs.filter((job) => Boolean(job.sourceEntityId && relatedIds.has(job.sourceEntityId)));
    const overdueItems = [...issues, ...routineItems].filter((item) => item.dueDate && item.dueDate < new Date().toISOString());
    const checklist = {
      totalItems: checklistItems.length,
      completedItems: checklistItems.filter((item) => item.status === "complete").length,
      blockedItems: checklistItems.filter((item) => item.status === "blocked").length,
      waivedItems: checklistItems.filter((item) => item.status === "waived").length,
      pendingItems: checklistItems.filter((item) => item.status === "pending").length,
      requiredRemaining: checklistItems.filter((item) => item.required && !["complete", "waived"].includes(item.status)).length
    };
    const plannerSync = {
      pendingCreate: [...routineItems, ...escalations].filter((item) => item.syncStatus === "pending_create").length,
      synced: [...routineItems, ...escalations].filter((item) => item.syncStatus === "synced").length,
      syncErrors: [...routineItems, ...escalations].filter((item) => item.syncStatus === "sync_error").length,
      externallyCompleted: [...routineItems, ...escalations].filter((item) => item.syncStatus === "completed_external").length
    };

    return {
      targetDate,
      closeoutDueAt,
      closeoutCutoffStatus: getChecklistCutoffStatus(closeoutDueAt, new Date().toISOString()),
      closeoutSubmitted: Boolean(closeoutDocument),
      workflowRun,
      dailyPacket,
      closeoutDocument,
      checklistRun,
      checklistItems,
      issues,
      routineItems,
      escalations,
      relatedJobs,
      checklist,
      plannerSync,
      counts: {
        openIssues: issues.length,
        overdueItems: overdueItems.length,
        escalatedItems: [...issues, ...routineItems].filter((item) => item.escalationStatus === "escalated").length
      }
    };
  }

  private async getOrCreateActiveOfficeOpsChecklistTemplate(actor: ActorContext): Promise<ChecklistTemplate> {
    const existing = (await this.repository.listChecklistTemplates({
      workflowDefinitionId: "office_manager_daily",
      isActive: true
    }))[0];
    if (existing) {
      return existing;
    }

    const template = createChecklistTemplate({
      name: "Default office-ops room readiness checklist",
      workflowDefinitionId: "office_manager_daily",
      items: defaultOfficeOpsChecklistItems.map((item) => ({ ...item })),
      createdBy: actor.actorId
    });
    return this.repository.createChecklistTemplate(template);
  }

  private async ensureChecklistRunForWorkflow(
    actor: ActorContext,
    workflow: WorkflowRun,
    targetDate: string
  ): Promise<ChecklistRun> {
    const existing = (await this.repository.listChecklistRuns({
      workflowRunId: workflow.id
    })).find((run) => run.targetDate === targetDate);
    if (existing) {
      return existing;
    }

    const template = await this.getOrCreateActiveOfficeOpsChecklistTemplate(actor);
    const run = createChecklistRun({
      templateId: template.id,
      workflowRunId: workflow.id,
      targetDate
    });
    const createdRun = await this.repository.createChecklistRun(run);
    await this.repository.createChecklistItems(template.items.map((item) =>
      createChecklistItemRecord({
        checklistRunId: createdRun.id,
        templateItemId: item.id,
        label: item.label,
        areaLabel: item.areaLabel,
        required: item.required
      })
    ));

    await this.recordAudit(actor, "office_ops.checklist_created", "checklist_run", createdRun.id, {
      workflowRunId: workflow.id,
      targetDate,
      itemCount: template.items.length
    });

    return createdRun;
  }

  private async buildTrainingGapSummary(
    employeeId: string,
    employeeRole: string,
    referenceDate?: string
  ): Promise<TrainingGapSummary> {
    const generatedAt = referenceDate ?? new Date().toISOString();
    const [requirements, completions] = await Promise.all([
      this.repository.listTrainingRequirements({
        employeeId,
        employeeRole
      }),
      this.repository.listTrainingCompletions({
        employeeId,
        employeeRole
      })
    ]);
    const referenceTime = new Date(generatedAt).getTime();

    const latestCompletionByRequirement = new Map<string, TrainingCompletionRecord>();
    for (const completion of completions
      .filter((item) => new Date(item.completedAt).getTime() <= referenceTime)
      .sort((left, right) => right.completedAt.localeCompare(left.completedAt))) {
      if (!latestCompletionByRequirement.has(completion.requirementId)) {
        latestCompletionByRequirement.set(completion.requirementId, completion);
      }
    }

    const soonThreshold = new Date(referenceTime + 30 * 24 * 60 * 60 * 1000).toISOString();
    const items: TrainingGapItem[] = requirements.map((requirement) => {
      const latestCompletion = latestCompletionByRequirement.get(requirement.id) ?? null;
      let status: TrainingGapStatus;

      if (latestCompletion && latestCompletion.validUntil && latestCompletion.validUntil < generatedAt) {
        status = "overdue";
      } else if (latestCompletion && (!latestCompletion.validUntil || latestCompletion.validUntil >= generatedAt)) {
        status = latestCompletion.validUntil && latestCompletion.validUntil <= soonThreshold
          ? "expiring_soon"
          : "complete";
      } else if (requirement.dueDate && requirement.dueDate < generatedAt) {
        status = "overdue";
      } else {
        status = "missing";
      }

      return {
        requirementId: requirement.id,
        employeeId,
        employeeRole,
        requirementType: requirement.requirementType,
        title: requirement.title,
        status,
        dueDate: requirement.dueDate,
        latestCompletionAt: latestCompletion?.completedAt ?? null,
        validUntil: latestCompletion?.validUntil ?? null,
        notes: requirement.notes
      };
    });

    return {
      employeeId,
      employeeRole,
      generatedAt,
      counts: {
        complete: items.filter((item) => item.status === "complete").length,
        expiringSoon: items.filter((item) => item.status === "expiring_soon").length,
        overdue: items.filter((item) => item.status === "overdue").length,
        missing: items.filter((item) => item.status === "missing").length
      },
      items
    };
  }

  private async ensureTrainingFollowUpForReview(
    actor: ActorContext,
    review: ScorecardReviewRecord,
    gapSummary: TrainingGapSummary
  ): Promise<ScorecardReviewRecord> {
    const openGapCount = gapSummary.items.filter((item) => isTrainingGapOpen(item.status)).length;
    if (openGapCount === 0) {
      return review;
    }

    const description = `Resolve ${openGapCount} training or competency gap(s) for ${review.employeeRole} (${review.employeeId}).`;
    let trainingFollowUpActionItemId = review.trainingFollowUpActionItemId;
    if (trainingFollowUpActionItemId) {
      const existingFollowUp = await this.repository.getActionItem(trainingFollowUpActionItemId);
      if (existingFollowUp) {
        await this.applyActionItemUpdate(actor, existingFollowUp, {
          status: "in_progress",
          resolutionNote: description
        });
      }
    } else {
      const followUp = await this.createActionItem(actor, {
        kind: "review",
        title: `Resolve training gaps for ${review.employeeId}`,
        description,
        ownerRole: "hr_lead",
        dueDate: addDays(review.dueDate, 7),
        sourceWorkflowRunId: review.workflowRunId
      });
      trainingFollowUpActionItemId = followUp.id;
    }

    if (review.requiresMedicalDirectorReview && review.medicalDirectorActionItemId && review.medicalDirectorSignedOffAt) {
      const medicalDirectorActionItem = await this.repository.getActionItem(review.medicalDirectorActionItemId);
      if (medicalDirectorActionItem) {
        await this.applyActionItemUpdate(actor, medicalDirectorActionItem, {
          status: "in_progress",
          resolutionNote: "Awaiting training-gap resolution before oversight task can close.",
          closedAt: null
        });
      }
    }

    return this.repository.updateScorecardReview(review.id, {
      trainingFollowUpActionItemId,
      updatedAt: new Date().toISOString()
    });
  }

  private async reconcileTrainingFollowUpsForEmployee(
    actor: ActorContext,
    employeeId: string,
    employeeRole: string
  ): Promise<void> {
    const gapSummary = await this.buildTrainingGapSummary(employeeId, employeeRole);
    const hasOpenGaps = gapSummary.items.some((item) => isTrainingGapOpen(item.status));
    const reviews = (await this.repository.listScorecardReviews({ employeeId }))
      .filter((review) =>
        review.employeeRole === employeeRole
        && (Boolean(review.hrSignedOffAt) || Boolean(review.medicalDirectorSignedOffAt) || review.status === "signed_off")
      );

    for (const review of reviews) {
      if (hasOpenGaps) {
        await this.ensureTrainingFollowUpForReview(actor, review, gapSummary);
        continue;
      }

      if (review.trainingFollowUpActionItemId) {
        const actionItem = await this.repository.getActionItem(review.trainingFollowUpActionItemId);
        if (actionItem && isOpenActionStatus(actionItem.status)) {
          await this.applyActionItemUpdate(actor, actionItem, {
            status: "done",
            resolutionNote: "Training gaps resolved."
          });
        }
      }

      if (review.requiresMedicalDirectorReview && review.medicalDirectorSignedOffAt && review.medicalDirectorActionItemId) {
        const mdTask = await this.repository.getActionItem(review.medicalDirectorActionItemId);
        if (mdTask && isOpenActionStatus(mdTask.status)) {
          await this.applyActionItemUpdate(actor, mdTask, {
            status: "done",
            resolutionNote: "Medical-director oversight closed after training-gap resolution."
          });
        }
      }
    }
  }

  private async listPlannerEligibleActionItems(): Promise<ActionItemRecord[]> {
    const officeOpsWorkflowIds = new Set(
      (await this.repository.listWorkflowRuns({ workflowDefinitionId: "office_manager_daily" })).map((workflow) => workflow.id)
    );
    const items = await this.repository.listActionItems();
    return items.filter((item) =>
      Boolean(item.plannerTaskId)
      && isOpenActionStatus(item.status)
      && Boolean(item.sourceWorkflowRunId && officeOpsWorkflowIds.has(item.sourceWorkflowRunId))
      && isPlannerEligibleActionItem(item)
    );
  }

  private async reconcileScorecardWorkflow(
    actor: ActorContext,
    workflowRunId: string,
    review: ScorecardReviewRecord
  ): Promise<ScorecardReviewRecord> {
    const reviews = await this.repository.listScorecardReviews({ workflowRunId });
    const workflow = await this.repository.getWorkflowRun(workflowRunId);
    if (!workflow) {
      return review;
    }

    const allSignedOff = reviews.every((item) =>
      Boolean(item.hrSignedOffAt)
      && (!item.requiresMedicalDirectorReview || item.oversightStatus === "signed_off")
      && item.status === "signed_off"
    );

    if (!allSignedOff) {
      return (await this.repository.getScorecardReview(review.id)) ?? review;
    }

    const packetDocumentId = reviews[0]?.packetDocumentId ?? workflow.documentId;
    if (packetDocumentId) {
      const packet = await this.repository.getDocument(packetDocumentId);
      if (packet && packet.status !== "approved") {
        await this.repository.updateDocument(packet.id, {
          status: "approved",
          updatedAt: new Date().toISOString()
        });
      }
    }

    const definition = workflowRegistry.get(workflow.workflowDefinitionId);
    if (definition && canTransition(definition, workflow.state, "approved")) {
      await this.transitionWorkflowRun(actor, workflow.id, {
        nextState: "approved",
        note: "All scorecard reviews completed."
      });
    }

    return (await this.repository.getScorecardReview(review.id)) ?? review;
  }

  private async syncActionItemSideEffects(actor: ActorContext, item: ActionItemRecord): Promise<void> {
    if (item.kind === "issue") {
      await this.enqueueWorkerJob(actor, createWorkerJob({
        type: "lists.issue.upsert",
        payload: {
          actor: actorSnapshot(actor),
          actionItemId: item.id
        },
        sourceEntityType: "action_item",
        sourceEntityId: item.id
      }));
      return;
    }

    await this.enqueueWorkerJob(actor, createWorkerJob({
      type: "lists.action-item.upsert",
      payload: {
        actor: actorSnapshot(actor),
        actionItemId: item.id
      },
      sourceEntityType: "action_item",
      sourceEntityId: item.id
    }));
  }

  private async applyActionItemUpdate(
    actor: ActorContext,
    item: ActionItemRecord,
    input: {
      title?: string;
      description?: string | null;
      dueDate?: string | null;
      status?: ActionItemRecord["status"];
      resolutionNote?: string | null;
      closedAt?: string | null;
    }
  ): Promise<ActionItemRecord> {
    const nextStatus = input.status ?? item.status;
    const now = new Date().toISOString();
    const updated = await this.repository.updateActionItem(item.id, {
      title: input.title ?? item.title,
      description: input.description !== undefined ? input.description : item.description,
      dueDate: input.dueDate !== undefined ? input.dueDate : item.dueDate,
      status: nextStatus,
      resolutionNote: input.resolutionNote !== undefined ? input.resolutionNote : item.resolutionNote,
      closedAt: input.closedAt !== undefined
        ? input.closedAt
        : (nextStatus === "done" ? (item.closedAt ?? now) : null),
      updatedAt: now
    });

    await this.recordAudit(actor, "action_item.updated", "action_item", updated.id, {
      status: updated.status,
      escalationStatus: updated.escalationStatus
    });
    await this.syncActionItemSideEffects(actor, updated);
    return updated;
  }

  private async recordAudit(
    actor: ActorContext,
    eventType: string,
    entityType: string,
    entityId: string,
    payload: Record<string, unknown>
  ): Promise<AuditEvent> {
    const event = createAuditEvent({
      eventType,
      entityType,
      entityId,
      actorId: actor.actorId,
      actorRole: actor.role,
      actorName: actor.name,
      payload
    });

    return this.repository.createAuditEvent(event);
  }

  private async enqueueWorkerJob(actor: ActorContext, job: WorkerJobRecord): Promise<WorkerJobRecord> {
    const created = await this.repository.enqueueWorkerJob(job);
    await this.recordAudit(actor, "worker_job.enqueued", "worker_job", created.id, {
      type: created.type,
      sourceEntityType: created.sourceEntityType,
      sourceEntityId: created.sourceEntityId
    });
    return created;
  }
}
