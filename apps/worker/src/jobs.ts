import type { ClinicRepository } from "@clinic-os/db";
import {
  actorContextSchema,
  type ActionItemRecord,
  type CapaRecord,
  type IncidentRecord,
  createActionItemRecord,
  createAuditEvent,
  createWorkerJob,
  type ActorContext,
  type ScorecardReviewRecord,
  type WorkerJobRecord
} from "@clinic-os/domain";
import { type MicrosoftPilotOps } from "@clinic-os/msgraph";
import { canTransition, workflowRegistry } from "@clinic-os/workflows";
import { z } from "zod";

const actorPayloadSchema = z.object({
  actor: actorContextSchema
});

const approvalReminderPayloadSchema = actorPayloadSchema.extend({
  approvalTaskId: z.string(),
  reviewerRole: z.string(),
  documentId: z.string(),
  documentTitle: z.string()
});

const actionItemPayloadSchema = actorPayloadSchema.extend({
  actionItemId: z.string()
});

const incidentPayloadSchema = actorPayloadSchema.extend({
  incidentId: z.string()
});

const capaPayloadSchema = actorPayloadSchema.extend({
  capaId: z.string()
});

const officeOpsChecklistReminderPayloadSchema = actorPayloadSchema.extend({
  workflowRunId: z.string(),
  targetDate: z.string(),
  blockedItems: z.number().int().nonnegative(),
  pendingItems: z.number().int().nonnegative(),
  requiredRemaining: z.number().int().nonnegative()
});

const importStatusPayloadSchema = actorPayloadSchema.extend({
  workflowRunId: z.string(),
  packetDocumentId: z.string(),
  filename: z.string(),
  rowsImported: z.number()
});

const teamsNotificationPayloadSchema = actorPayloadSchema.extend({
  title: z.string(),
  body: z.string()
});

const officeOpsCloseoutReminderPayloadSchema = actorPayloadSchema.extend({
  workflowRunId: z.string(),
  targetDate: z.string()
});

const officeOpsEscalationPayloadSchema = actorPayloadSchema.extend({
  actionItemId: z.string(),
  severity: z.enum(["needs_review", "escalated"])
});

const scorecardReviewReminderPayloadSchema = actorPayloadSchema.extend({
  reviewId: z.string()
});

const scorecardReviewEscalationPayloadSchema = actorPayloadSchema.extend({
  reviewId: z.string()
});

const trainingRequirementReminderPayloadSchema = actorPayloadSchema.extend({
  requirementId: z.string(),
  employeeId: z.string(),
  employeeRole: z.string(),
  title: z.string(),
  status: z.enum(["expiring_soon", "overdue", "missing"])
});

const publishPayloadSchema = actorPayloadSchema.extend({
  documentId: z.string()
});

export type WorkerRunSummary = {
  processed: number;
  succeeded: number;
  failed: number;
};

function retryBackoffMs(attempts: number): number {
  return Math.min(30 * 60_000, 60_000 * 2 ** Math.max(0, attempts - 1));
}

const officeOpsSystemActor: ActorContext = {
  actorId: "office-ops-maintenance",
  role: "office_manager",
  name: "Office Ops Maintenance"
};

const scorecardSystemActor: ActorContext = {
  actorId: "scorecard-maintenance",
  role: "hr_lead",
  name: "Scorecard Maintenance"
};

function isOpenActionStatus(status: string): boolean {
  return status !== "done";
}

const clinicTimeZone = "America/New_York";

function addDays(input: string, days: number): string {
  const date = new Date(input);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString();
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

export class WorkerJobRunner {
  constructor(
    private readonly repository: ClinicRepository,
    private readonly pilotOps: MicrosoftPilotOps
  ) {}

  async runOnce(options?: { limit?: number }): Promise<WorkerRunSummary> {
    await this.performMaintenance();
    const jobs = await this.repository.leaseWorkerJobs({
      limit: options?.limit ?? 10
    });

    const summary: WorkerRunSummary = {
      processed: jobs.length,
      succeeded: 0,
      failed: 0
    };

    for (const job of jobs) {
      try {
        const result = await this.processJob(job);
        await this.repository.updateWorkerJob(job.id, {
          status: "succeeded",
          lockedAt: null,
          lastError: null,
          resultJson: result,
          updatedAt: new Date().toISOString()
        });
        summary.succeeded += 1;
      } catch (error) {
        await this.failJob(job, error);
        summary.failed += 1;
      }
    }

    return summary;
  }

  private async processJob(job: WorkerJobRecord): Promise<Record<string, unknown>> {
    switch (job.type) {
      case "approval.reminder":
        return this.processApprovalReminder(job);
      case "planner.task.create":
        return this.processPlannerTask(job);
      case "planner.task.reconcile":
        return this.processPlannerTaskReconciliation(job);
      case "lists.issue.upsert":
        return this.processIssueSync(job);
      case "lists.action-item.upsert":
        return this.processActionItemSync(job);
      case "lists.import-status.upsert":
        return this.processImportStatusSync(job);
      case "lists.incident.upsert":
        return this.processIncidentSync(job);
      case "lists.capa.upsert":
        return this.processCapaSync(job);
      case "office_ops.closeout.reminder":
        return this.processOfficeOpsCloseoutReminder(job);
      case "office_ops.checklist.reminder":
        return this.processOfficeOpsChecklistReminder(job);
      case "office_ops.checklist.escalation":
        return this.processOfficeOpsChecklistEscalation(job);
      case "office_ops.escalation.notice":
        return this.processOfficeOpsEscalationNotice(job);
      case "scorecard.review.reminder":
        return this.processScorecardReviewReminder(job);
      case "scorecard.review.escalation":
        return this.processScorecardReviewEscalation(job);
      case "training.requirement.reminder":
        return this.processTrainingRequirementReminder(job);
      case "teams.notification":
        return this.processTeamsNotification(job);
      case "document.publish":
        return this.processDocumentPublish(job);
      default:
        return {
          skipped: true,
          reason: `Unhandled job type: ${job.type}`
        };
    }
  }

  private async processApprovalReminder(job: WorkerJobRecord): Promise<Record<string, unknown>> {
    const payload = approvalReminderPayloadSchema.parse(job.payload);
    const approval = await this.repository.getApprovalTask(payload.approvalTaskId);
    if (!approval || approval.status !== "requested") {
      return {
        skipped: true,
        reason: "Approval no longer requires a reminder."
      };
    }

    const result = await this.pilotOps.sendApprovalReminder({
      reviewerRole: payload.reviewerRole,
      documentId: payload.documentId,
      documentTitle: payload.documentTitle
    });

    await this.recordAudit(payload.actor, "approval.reminder_sent", "approval_task", payload.approvalTaskId, {
      messageId: result.messageId
    });

    return {
      approvalTaskId: payload.approvalTaskId,
      messageId: result.messageId
    };
  }

  private async processPlannerTask(job: WorkerJobRecord): Promise<Record<string, unknown>> {
    const payload = actionItemPayloadSchema.parse(job.payload);
    const item = await this.repository.getActionItem(payload.actionItemId);
    if (!item) {
      return {
        skipped: true,
        reason: "Action item no longer exists."
      };
    }

    if (item.plannerTaskId) {
      return {
        actionItemId: item.id,
        taskId: item.plannerTaskId,
        skipped: true
      };
    }

    const result = await this.pilotOps.createPlannerTask({
      title: item.title,
      details: item.description ?? undefined,
      dueDateTime: item.dueDate
    });
    const now = new Date().toISOString();
    await this.repository.updateActionItem(item.id, {
      plannerTaskId: result.taskId,
      syncStatus: "synced",
      lastSyncedAt: now,
      lastSyncError: null,
      updatedAt: now
    });
    await this.enqueueWorkerJob(payload.actor, createWorkerJob({
      type: "lists.action-item.upsert",
      payload: {
        actor: payload.actor,
        actionItemId: item.id
      },
      sourceEntityType: "action_item",
      sourceEntityId: item.id
    }));

    await this.recordAudit(payload.actor, "planner.task_synced", "action_item", item.id, {
      taskId: result.taskId
    });

    return {
      actionItemId: item.id,
      taskId: result.taskId
    };
  }

  private async processPlannerTaskReconciliation(job: WorkerJobRecord): Promise<Record<string, unknown>> {
    const payload = actionItemPayloadSchema.parse(job.payload);
    const item = await this.repository.getActionItem(payload.actionItemId);
    if (!item || !item.plannerTaskId) {
      return {
        skipped: true,
        reason: "Planner-backed action item no longer exists."
      };
    }

    const task = await this.pilotOps.getPlannerTaskState({
      taskId: item.plannerTaskId
    });
    const now = new Date().toISOString();
    const nextStatus = task.status === "completed" ? "done" : item.status;
    await this.repository.updateActionItem(item.id, {
      status: nextStatus,
      dueDate: task.dueDateTime ?? item.dueDate,
      closedAt: task.completedAt ?? item.closedAt,
      completedExternallyAt: task.completedAt ?? item.completedExternallyAt,
      syncStatus: task.status === "completed" ? "completed_external" : "synced",
      lastSyncedAt: now,
      lastSyncError: null,
      updatedAt: now
    });
    await this.enqueueWorkerJob(payload.actor, createWorkerJob({
      type: "lists.action-item.upsert",
      payload: {
        actor: payload.actor,
        actionItemId: item.id
      },
      sourceEntityType: "action_item",
      sourceEntityId: item.id
    }));

    await this.recordAudit(payload.actor, "planner.task_reconciled", "action_item", item.id, {
      taskId: item.plannerTaskId,
      plannerStatus: task.status,
      completedAt: task.completedAt
    });

    return {
      actionItemId: item.id,
      taskId: item.plannerTaskId,
      plannerStatus: task.status
    };
  }

  private async processIssueSync(job: WorkerJobRecord): Promise<Record<string, unknown>> {
    const payload = actionItemPayloadSchema.parse(job.payload);
    const item = await this.repository.getActionItem(payload.actionItemId);
    if (!item) {
      return {
        skipped: true,
        reason: "Issue no longer exists."
      };
    }

    const result = await this.pilotOps.createIssueListItem({
      Title: item.title,
      Status: item.status,
      EscalationStatus: item.escalationStatus,
      ResolutionNote: item.resolutionNote ?? "",
      OwnerRole: item.ownerRole,
      Description: item.description ?? "",
      SourceWorkflowRunId: item.sourceWorkflowRunId ?? "",
      DueDate: item.dueDate ?? ""
    });

    await this.recordAudit(payload.actor, "lists.issue_synced", "action_item", item.id, {
      itemId: result.itemId
    });

    return {
      actionItemId: item.id,
      itemId: result.itemId
    };
  }

  private async processActionItemSync(job: WorkerJobRecord): Promise<Record<string, unknown>> {
    const payload = actionItemPayloadSchema.parse(job.payload);
    const item = await this.repository.getActionItem(payload.actionItemId);
    if (!item) {
      return {
        skipped: true,
        reason: "Action item no longer exists."
      };
    }

    const result = await this.pilotOps.createActionItemListItem({
      Title: item.title,
      Status: item.status,
      EscalationStatus: item.escalationStatus,
      Kind: item.kind,
      OwnerRole: item.ownerRole,
      ResolutionNote: item.resolutionNote ?? "",
      Description: item.description ?? "",
      SourceWorkflowRunId: item.sourceWorkflowRunId ?? "",
      DueDate: item.dueDate ?? ""
    });

    await this.recordAudit(payload.actor, "lists.action_item_synced", "action_item", item.id, {
      itemId: result.itemId
    });

    return {
      actionItemId: item.id,
      itemId: result.itemId
    };
  }

  private async processImportStatusSync(job: WorkerJobRecord): Promise<Record<string, unknown>> {
    const payload = importStatusPayloadSchema.parse(job.payload);
    const workflow = await this.repository.getWorkflowRun(payload.workflowRunId);
    const packet = await this.repository.getDocument(payload.packetDocumentId);

    const result = await this.pilotOps.createImportStatusListItem({
      Title: payload.filename,
      WorkflowRunId: payload.workflowRunId,
      PacketDocumentId: payload.packetDocumentId,
      RowsImported: payload.rowsImported,
      WorkflowState: workflow?.state ?? "unknown",
      PacketStatus: packet?.status ?? "unknown"
    });

    await this.recordAudit(payload.actor, "lists.import_status_synced", "workflow_run", payload.workflowRunId, {
      itemId: result.itemId
    });

    return {
      workflowRunId: payload.workflowRunId,
      itemId: result.itemId
    };
  }

  private async processIncidentSync(job: WorkerJobRecord): Promise<Record<string, unknown>> {
    const payload = incidentPayloadSchema.parse(job.payload);
    const incident = await this.repository.getIncident(payload.incidentId);
    if (!incident) {
      return {
        skipped: true,
        reason: "Incident no longer exists."
      };
    }

    const result = await this.pilotOps.createIncidentListItem(this.buildIncidentListFields(incident));
    await this.recordAudit(payload.actor, "lists.incident_synced", "incident", incident.id, {
      itemId: result.itemId
    });

    return {
      incidentId: incident.id,
      itemId: result.itemId
    };
  }

  private async processCapaSync(job: WorkerJobRecord): Promise<Record<string, unknown>> {
    const payload = capaPayloadSchema.parse(job.payload);
    const capa = await this.repository.getCapa(payload.capaId);
    if (!capa) {
      return {
        skipped: true,
        reason: "CAPA no longer exists."
      };
    }

    const result = await this.pilotOps.createCapaListItem(this.buildCapaListFields(capa));
    await this.recordAudit(payload.actor, "lists.capa_synced", "capa", capa.id, {
      itemId: result.itemId
    });

    return {
      capaId: capa.id,
      itemId: result.itemId
    };
  }

  private async processOfficeOpsCloseoutReminder(job: WorkerJobRecord): Promise<Record<string, unknown>> {
    const payload = officeOpsCloseoutReminderPayloadSchema.parse(job.payload);
    const workflow = await this.repository.getWorkflowRun(payload.workflowRunId);
    if (!workflow) {
      return {
        skipped: true,
        reason: "Office-ops workflow no longer exists."
      };
    }

    const closeoutDocuments = (await this.repository.listDocuments()).filter(
      (document) => document.workflowRunId === workflow.id && document.artifactType === "daily_closeout_packet"
    );
    if (closeoutDocuments.length > 0) {
      return {
        skipped: true,
        reason: "Daily closeout has already been submitted."
      };
    }

    const result = await this.pilotOps.sendOfficeOpsNotification({
      title: "Daily closeout overdue",
      body: `The office-manager closeout for ${payload.targetDate} is still missing.`
    });

    await this.recordAudit(payload.actor, "office_ops.closeout_reminder_sent", "workflow_run", payload.workflowRunId, {
      messageId: result.messageId,
      targetDate: payload.targetDate
    });

    return {
      workflowRunId: payload.workflowRunId,
      messageId: result.messageId
    };
  }

  private async processOfficeOpsChecklistReminder(job: WorkerJobRecord): Promise<Record<string, unknown>> {
    const payload = officeOpsChecklistReminderPayloadSchema.parse(job.payload);
    const result = await this.pilotOps.sendOfficeOpsNotification({
      title: "Checklist nearing closeout cutoff",
      body: `${payload.targetDate} still has ${payload.requiredRemaining} required checklist item(s) unresolved (${payload.blockedItems} blocked / ${payload.pendingItems} pending).`
    });

    await this.recordAudit(payload.actor, "office_ops.checklist_reminder_sent", "workflow_run", payload.workflowRunId, {
      messageId: result.messageId,
      targetDate: payload.targetDate,
      requiredRemaining: payload.requiredRemaining
    });

    return {
      workflowRunId: payload.workflowRunId,
      messageId: result.messageId
    };
  }

  private async processOfficeOpsChecklistEscalation(job: WorkerJobRecord): Promise<Record<string, unknown>> {
    const payload = officeOpsChecklistReminderPayloadSchema.parse(job.payload);
    const result = await this.pilotOps.sendOfficeOpsNotification({
      title: "Checklist escalation",
      body: `${payload.targetDate} missed closeout with ${payload.requiredRemaining} required checklist item(s) unresolved (${payload.blockedItems} blocked / ${payload.pendingItems} pending).`
    });

    await this.recordAudit(payload.actor, "office_ops.checklist_escalation_sent", "workflow_run", payload.workflowRunId, {
      messageId: result.messageId,
      targetDate: payload.targetDate,
      requiredRemaining: payload.requiredRemaining
    });

    return {
      workflowRunId: payload.workflowRunId,
      messageId: result.messageId
    };
  }

  private async processOfficeOpsEscalationNotice(job: WorkerJobRecord): Promise<Record<string, unknown>> {
    const payload = officeOpsEscalationPayloadSchema.parse(job.payload);
    const item = await this.repository.getActionItem(payload.actionItemId);
    if (!item) {
      return {
        skipped: true,
        reason: "Escalated action item no longer exists."
      };
    }

    const result = await this.pilotOps.sendOfficeOpsNotification({
      title: payload.severity === "escalated" ? "Office ops item escalated" : "Office ops item needs review",
      body: `${item.title} is ${payload.severity.replace("_", " ")}.`
    });

    await this.recordAudit(payload.actor, "office_ops.escalation_notice_sent", "action_item", item.id, {
      severity: payload.severity,
      messageId: result.messageId
    });

    return {
      actionItemId: item.id,
      messageId: result.messageId
    };
  }

  private async processScorecardReviewReminder(job: WorkerJobRecord): Promise<Record<string, unknown>> {
    const payload = scorecardReviewReminderPayloadSchema.parse(job.payload);
    const review = await this.repository.getScorecardReview(payload.reviewId);
    if (!review || ["signed_off", "sent_back"].includes(review.status)) {
      return {
        skipped: true,
        reason: "Scorecard review no longer needs a reminder."
      };
    }

    const result = await this.pilotOps.sendOfficeOpsNotification({
      title: "Scorecard review overdue",
      body: `${review.employeeId} (${review.employeeRole}) is waiting on ${review.assignedReviewerRole} review.`
    });

    await this.recordAudit(payload.actor, "scorecard.review_reminder_sent", "scorecard_review", review.id, {
      messageId: result.messageId
    });

    return {
      reviewId: review.id,
      messageId: result.messageId
    };
  }

  private async processScorecardReviewEscalation(job: WorkerJobRecord): Promise<Record<string, unknown>> {
    const payload = scorecardReviewEscalationPayloadSchema.parse(job.payload);
    const review = await this.repository.getScorecardReview(payload.reviewId);
    if (!review || review.status === "signed_off") {
      return {
        skipped: true,
        reason: "Scorecard review no longer needs escalation."
      };
    }

    const result = await this.pilotOps.sendOfficeOpsNotification({
      title: "Scorecard review escalated",
      body: `${review.employeeId} (${review.employeeRole}) now requires medical-director oversight.`
    });

    await this.recordAudit(payload.actor, "scorecard.review_escalation_sent", "scorecard_review", review.id, {
      messageId: result.messageId
    });

    return {
      reviewId: review.id,
      messageId: result.messageId
    };
  }

  private async processTrainingRequirementReminder(job: WorkerJobRecord): Promise<Record<string, unknown>> {
    const payload = trainingRequirementReminderPayloadSchema.parse(job.payload);
    const result = await this.pilotOps.sendOfficeOpsNotification({
      title: "Training requirement reminder",
      body: `${payload.employeeId} (${payload.employeeRole}) has a ${payload.status.replace("_", " ")} ${payload.title} requirement.`
    });

    await this.recordAudit(payload.actor, "training.requirement_reminder_sent", "training_requirement", payload.requirementId, {
      messageId: result.messageId,
      status: payload.status
    });

    return {
      requirementId: payload.requirementId,
      messageId: result.messageId
    };
  }

  private async processTeamsNotification(job: WorkerJobRecord): Promise<Record<string, unknown>> {
    const payload = teamsNotificationPayloadSchema.parse(job.payload);
    const result = await this.pilotOps.sendOfficeOpsNotification({
      title: payload.title,
      body: payload.body
    });

    await this.recordAudit(payload.actor, "teams.notification_sent", job.sourceEntityType ?? "worker_job", job.sourceEntityId ?? job.id, {
      messageId: result.messageId,
      title: payload.title
    });

    return {
      messageId: result.messageId
    };
  }

  private async processDocumentPublish(job: WorkerJobRecord): Promise<Record<string, unknown>> {
    const payload = publishPayloadSchema.parse(job.payload);
    const document = await this.repository.getDocument(payload.documentId);
    if (!document) {
      return {
        skipped: true,
        reason: "Document no longer exists."
      };
    }

    if (document.status === "published") {
      return {
        documentId: document.id,
        publishedPath: document.publishedPath
      };
    }

    if (!["approved", "publish_pending"].includes(document.status)) {
      throw new Error(`Document ${document.id} is not publishable from status ${document.status}.`);
    }

    const publishResult = await this.pilotOps.publishApprovedDocument(document);
    const now = new Date().toISOString();

    await this.repository.updateDocument(document.id, {
      status: "published",
      publishedAt: now,
      publishedPath: publishResult.path,
      reviewDueAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: now
    });

    if (document.workflowRunId) {
      const workflowRun = await this.repository.getWorkflowRun(document.workflowRunId);
      const definition = workflowRun ? workflowRegistry.get(workflowRun.workflowDefinitionId) : null;
      if (workflowRun && definition && canTransition(definition, workflowRun.state, "published")) {
        await this.repository.updateWorkflowRun(workflowRun.id, {
          state: "published",
          updatedAt: now,
          lastTransitionNote: "Published by worker through controlled document path."
        });
      }
    }

    const linkedPublicAsset = await this.repository.getPublicAssetByDocumentId(document.id);
    if (linkedPublicAsset) {
      await this.repository.updatePublicAsset(linkedPublicAsset.id, {
        status: "published",
        publishedAt: now,
        publishedPath: publishResult.path,
        updatedAt: now
      });
    }

    const linkedServiceLinePack = await this.repository.getServiceLinePackByDocumentId(document.id);
    if (linkedServiceLinePack) {
      await this.repository.updateServiceLinePack(linkedServiceLinePack.id, {
        status: "published",
        publishedAt: now,
        publishedPath: publishResult.path,
        updatedAt: now
      });
      const serviceLine = await this.repository.getServiceLine(linkedServiceLinePack.serviceLineId);
      if (serviceLine) {
        await this.repository.updateServiceLine(serviceLine.id, {
          governanceStatus: "published",
          latestPackId: linkedServiceLinePack.id,
          lastReviewedAt: now,
          nextReviewDueAt: addDays(now, serviceLine.reviewCadenceDays),
          updatedAt: now
        });
      }
    }

    const linkedPracticeAgreement = await this.repository.getPracticeAgreementByDocumentId(document.id);
    if (linkedPracticeAgreement) {
      await this.repository.updatePracticeAgreement(linkedPracticeAgreement.id, {
        status: "published",
        effectiveDate: linkedPracticeAgreement.effectiveDate ?? now,
        reviewDueAt: addDays(now, linkedPracticeAgreement.reviewCadenceDays),
        publishedAt: now,
        publishedPath: publishResult.path,
        updatedAt: now
      });
    }

    const linkedTelehealthStewardship = await this.repository.getTelehealthStewardshipByDocumentId(document.id);
    if (linkedTelehealthStewardship) {
      await this.repository.updateTelehealthStewardship(linkedTelehealthStewardship.id, {
        status: "published",
        effectiveDate: linkedTelehealthStewardship.effectiveDate ?? now,
        reviewDueAt: addDays(now, linkedTelehealthStewardship.reviewCadenceDays),
        publishedAt: now,
        publishedPath: publishResult.path,
        updatedAt: now
      });
    }

    const linkedControlledSubstanceStewardship =
      await this.repository.getControlledSubstanceStewardshipByDocumentId(document.id);
    if (linkedControlledSubstanceStewardship) {
      await this.repository.updateControlledSubstanceStewardship(linkedControlledSubstanceStewardship.id, {
        status: "published",
        effectiveDate: linkedControlledSubstanceStewardship.effectiveDate ?? now,
        reviewDueAt: addDays(now, linkedControlledSubstanceStewardship.reviewCadenceDays),
        publishedAt: now,
        publishedPath: publishResult.path,
        updatedAt: now
      });
    }

    const linkedEvidenceBinder = await this.repository.getEvidenceBinderByDocumentId(document.id);
    if (linkedEvidenceBinder) {
      await this.repository.updateEvidenceBinder(linkedEvidenceBinder.id, {
        status: "published",
        publishedAt: now,
        publishedPath: publishResult.path,
        updatedAt: now
      });
      for (const standardId of linkedEvidenceBinder.standardIds) {
        const standard = await this.repository.getStandardMapping(standardId);
        if (!standard) {
          continue;
        }
        await this.repository.updateStandardMapping(standard.id, {
          status: "complete",
          latestBinderId: linkedEvidenceBinder.id,
          evidenceDocumentIds: Array.from(new Set([...standard.evidenceDocumentIds, document.id])),
          lastReviewedAt: now,
          nextReviewDueAt: addDays(now, standard.reviewCadenceDays),
          updatedAt: now
        });
      }
    }

    await this.recordAudit(payload.actor, "artifact.published", "document", document.id, {
      publishedPath: publishResult.path,
      externalId: publishResult.externalId,
      workerMode: this.pilotOps.mode
    });

    return {
      documentId: document.id,
      publishedPath: publishResult.path,
      externalId: publishResult.externalId
    };
  }

  private async performMaintenance(): Promise<void> {
    const now = new Date().toISOString();
    await this.maintainOfficeOps(now);
    await this.maintainScorecardReviews(now);
    await this.maintainTrainingRequirements(now);
  }

  private buildIncidentListFields(incident: IncidentRecord): Record<string, unknown> {
    return {
      Title: incident.title,
      Severity: incident.severity,
      Status: incident.status,
      Category: incident.category,
      OwnerRole: incident.ownerRole,
      Summary: incident.summary,
      ImmediateResponse: incident.immediateResponse ?? "",
      ResolutionNote: incident.resolutionNote ?? "",
      DetectedAt: incident.detectedAt,
      DetectedByRole: incident.detectedByRole,
      LinkedCapaId: incident.linkedCapaId ?? "",
      DueDate: incident.dueDate ?? ""
    };
  }

  private buildCapaListFields(capa: CapaRecord): Record<string, unknown> {
    return {
      Title: capa.title,
      Status: capa.status,
      SourceType: capa.sourceType,
      SourceId: capa.sourceId,
      IncidentId: capa.incidentId ?? "",
      OwnerRole: capa.ownerRole,
      DueDate: capa.dueDate,
      Summary: capa.summary,
      CorrectiveAction: capa.correctiveAction,
      PreventiveAction: capa.preventiveAction,
      VerificationPlan: capa.verificationPlan ?? "",
      ResolutionNote: capa.resolutionNote ?? ""
    };
  }

  private async maintainOfficeOps(now: string): Promise<void> {
    const [actionItems, workflows, documents, checklistRuns, checklistItems] = await Promise.all([
      this.repository.listActionItems(),
      this.repository.listWorkflowRuns({ workflowDefinitionId: "office_manager_daily" }),
      this.repository.listDocuments(),
      this.repository.listChecklistRuns(),
      this.repository.listChecklistItems()
    ]);

    for (const item of actionItems.filter((candidate) =>
      candidate.ownerRole === "office_manager"
      && isOpenActionStatus(candidate.status)
      && candidate.dueDate
      && candidate.dueDate < now
    )) {
      if (item.escalationStatus === "none") {
        await this.repository.updateActionItem(item.id, {
          escalationStatus: "needs_review",
          needsReviewAt: now,
          updatedAt: now
        });
        await this.enqueueWorkerJob(officeOpsSystemActor, createWorkerJob({
          type: "office_ops.escalation.notice",
          payload: {
            actor: officeOpsSystemActor,
            actionItemId: item.id,
            severity: "needs_review"
          },
          sourceEntityType: "action_item",
          sourceEntityId: item.id
        }));
        continue;
      }

      if (
        item.escalationStatus === "needs_review"
        && item.needsReviewAt
        && new Date(item.needsReviewAt).getTime() + 24 * 60 * 60 * 1000 <= new Date(now).getTime()
      ) {
        await this.ensureOfficeOpsEscalationTask(item, now);
        await this.repository.updateActionItem(item.id, {
          escalationStatus: "escalated",
          escalatedToRole: "medical_director",
          escalatedAt: now,
          updatedAt: now
        });
        await this.enqueueWorkerJob(officeOpsSystemActor, createWorkerJob({
          type: "office_ops.escalation.notice",
          payload: {
            actor: officeOpsSystemActor,
            actionItemId: item.id,
            severity: "escalated"
          },
          sourceEntityType: "action_item",
          sourceEntityId: item.id
        }));
      }
    }

    for (const item of actionItems.filter((candidate) =>
      Boolean(candidate.plannerTaskId)
      && isOpenActionStatus(candidate.status)
      && workflows.some((workflow) => workflow.id === candidate.sourceWorkflowRunId)
    )) {
      const existingReconcileJobs = await this.repository.listWorkerJobs({
        type: "planner.task.reconcile",
        sourceEntityId: item.id,
        sourceEntityType: "action_item"
      });
      if (existingReconcileJobs.some((job) => ["queued", "processing"].includes(job.status))) {
        continue;
      }

      await this.enqueueWorkerJob(officeOpsSystemActor, createWorkerJob({
        type: "planner.task.reconcile",
        payload: {
          actor: officeOpsSystemActor,
          actionItemId: item.id
        },
        sourceEntityType: "action_item",
        sourceEntityId: item.id
      }));
    }

    for (const workflow of workflows) {
      const targetDate = typeof workflow.input.targetDate === "string" ? workflow.input.targetDate : null;
      if (!targetDate) {
        continue;
      }

      const closeoutDueAt = buildClinicDateTime(targetDate, 18, 0);
      const closeoutExists = documents.some(
        (document) => document.workflowRunId === workflow.id && document.artifactType === "daily_closeout_packet"
      );
      const checklistRun = checklistRuns.find((run) => run.workflowRunId === workflow.id);
      const runItems = checklistRun
        ? checklistItems.filter((item) => item.checklistRunId === checklistRun.id)
        : [];
      const requiredRemaining = runItems.filter((item) => item.required && !["complete", "waived"].includes(item.status)).length;
      const blockedItems = runItems.filter((item) => item.status === "blocked").length;
      const pendingItems = runItems.filter((item) => item.status === "pending").length;
      const reminderAt = buildClinicDateTime(targetDate, 16, 0);

      if (!closeoutExists && requiredRemaining > 0 && reminderAt <= now) {
        const existingChecklistReminderJobs = await this.repository.listWorkerJobs({
          type: "office_ops.checklist.reminder",
          sourceEntityId: workflow.id
        });
        if (!existingChecklistReminderJobs.some((job) => ["queued", "processing", "succeeded"].includes(job.status))) {
          await this.enqueueWorkerJob(officeOpsSystemActor, createWorkerJob({
            type: "office_ops.checklist.reminder",
            payload: {
              actor: officeOpsSystemActor,
              workflowRunId: workflow.id,
              targetDate,
              blockedItems,
              pendingItems,
              requiredRemaining
            },
            sourceEntityType: "workflow_run",
            sourceEntityId: workflow.id
          }));
        }
      }

      if (closeoutExists || closeoutDueAt > now) {
        continue;
      }

      const existingReminderJobs = await this.repository.listWorkerJobs({
        type: "office_ops.closeout.reminder",
        sourceEntityId: workflow.id
      });
      if (existingReminderJobs.some((job) => ["queued", "processing", "succeeded"].includes(job.status))) {
      } else {
        await this.enqueueWorkerJob(officeOpsSystemActor, createWorkerJob({
          type: "office_ops.closeout.reminder",
          payload: {
            actor: officeOpsSystemActor,
            workflowRunId: workflow.id,
            targetDate
          },
          sourceEntityType: "workflow_run",
          sourceEntityId: workflow.id
        }));
      }

      if (requiredRemaining > 0) {
        const existingChecklistEscalationJobs = await this.repository.listWorkerJobs({
          type: "office_ops.checklist.escalation",
          sourceEntityId: workflow.id
        });
        if (!existingChecklistEscalationJobs.some((job) => ["queued", "processing", "succeeded"].includes(job.status))) {
          await this.enqueueWorkerJob(officeOpsSystemActor, createWorkerJob({
            type: "office_ops.checklist.escalation",
            payload: {
              actor: officeOpsSystemActor,
              workflowRunId: workflow.id,
              targetDate,
              blockedItems,
              pendingItems,
              requiredRemaining
            },
            sourceEntityType: "workflow_run",
            sourceEntityId: workflow.id
          }));
        }
      }

      await this.ensureCloseoutEscalationTask(workflow.id, targetDate, {
        blockedItems,
        pendingItems,
        requiredRemaining
      }, now);
    }
  }

  private async maintainScorecardReviews(now: string): Promise<void> {
    const reviews = await this.repository.listScorecardReviews();

    for (const review of reviews.filter((candidate) => !["signed_off", "sent_back"].includes(candidate.status) && candidate.dueDate < now)) {
      if (!review.reminderSentAt) {
        await this.repository.updateScorecardReview(review.id, {
          reminderSentAt: now,
          updatedAt: now
        });
        await this.enqueueWorkerJob(scorecardSystemActor, createWorkerJob({
          type: "scorecard.review.reminder",
          payload: {
            actor: scorecardSystemActor,
            reviewId: review.id
          },
          sourceEntityType: "scorecard_review",
          sourceEntityId: review.id
        }));
      }

      if (review.escalatedAt) {
        continue;
      }

      if (new Date(review.dueDate).getTime() + 24 * 60 * 60 * 1000 > new Date(now).getTime()) {
        continue;
      }

      const medicalDirectorActionItemId = await this.ensureScorecardEscalationTask(review, now);
      await this.repository.updateScorecardReview(review.id, {
        requiresMedicalDirectorReview: true,
        oversightStatus: "pending",
        medicalDirectorActionItemId,
        escalatedAt: now,
        status: review.hrSignedOffAt ? "pending_medical_director_review" : review.status,
        updatedAt: now
      });
      await this.enqueueWorkerJob(scorecardSystemActor, createWorkerJob({
        type: "scorecard.review.escalation",
        payload: {
          actor: scorecardSystemActor,
          reviewId: review.id
        },
        sourceEntityType: "scorecard_review",
        sourceEntityId: review.id
      }));
    }
  }

  private async maintainTrainingRequirements(now: string): Promise<void> {
    const requirements = await this.repository.listTrainingRequirements();
    for (const requirement of requirements) {
      const completions = await this.repository.listTrainingCompletions({ requirementId: requirement.id });
      const latestCompletion = completions[0] ?? null;
      const soonThreshold = new Date(new Date(now).getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
      const status = latestCompletion && latestCompletion.validUntil && latestCompletion.validUntil < now
        ? "overdue"
        : latestCompletion && (!latestCompletion.validUntil || latestCompletion.validUntil >= now)
          ? latestCompletion.validUntil && latestCompletion.validUntil <= soonThreshold
            ? "expiring_soon"
            : "complete"
          : requirement.dueDate && requirement.dueDate < now
            ? "overdue"
            : "missing";
      if (status === "complete") {
        continue;
      }
      if (requirement.lastReminderSentAt && new Date(requirement.lastReminderSentAt).getTime() + 7 * 24 * 60 * 60 * 1000 > new Date(now).getTime()) {
        continue;
      }

      await this.repository.updateTrainingRequirement(requirement.id, {
        lastReminderSentAt: now,
        updatedAt: now
      });
      await this.enqueueWorkerJob(scorecardSystemActor, createWorkerJob({
        type: "training.requirement.reminder",
        payload: {
          actor: scorecardSystemActor,
          requirementId: requirement.id,
          employeeId: requirement.employeeId,
          employeeRole: requirement.employeeRole,
          title: requirement.title,
          status
        },
        sourceEntityType: "training_requirement",
        sourceEntityId: requirement.id
      }));
    }
  }

  private async ensureOfficeOpsEscalationTask(
    actionItem: ActionItemRecord,
    now: string
  ): Promise<string> {
    const existingEscalation = (await this.repository.listActionItems({
      ownerRole: "medical_director",
      sourceWorkflowRunId: actionItem.sourceWorkflowRunId ?? undefined
    })).find((candidate) => candidate.title === `Escalation: ${actionItem.title}`);
    if (existingEscalation) {
      return existingEscalation.id;
    }

    const escalationTask = createActionItemRecord({
      kind: "review",
      title: `Escalation: ${actionItem.title}`,
      description: `Medical-director escalation for ${actionItem.title}.`,
      ownerRole: "medical_director",
      createdBy: officeOpsSystemActor.actorId,
      dueDate: addDays(now, 1),
      syncStatus: "pending_create",
      sourceWorkflowRunId: actionItem.sourceWorkflowRunId
    });
    const created = await this.repository.createActionItem(escalationTask);
    await this.recordAudit(officeOpsSystemActor, "action_item.created", "action_item", created.id, {
      kind: created.kind,
      ownerRole: created.ownerRole
    });
    await this.enqueueWorkerJob(officeOpsSystemActor, createWorkerJob({
      type: "planner.task.create",
      payload: {
        actor: officeOpsSystemActor,
        actionItemId: created.id
      },
      sourceEntityType: "action_item",
      sourceEntityId: created.id
    }));
    await this.enqueueWorkerJob(officeOpsSystemActor, createWorkerJob({
      type: "lists.action-item.upsert",
      payload: {
        actor: officeOpsSystemActor,
        actionItemId: created.id
      },
      sourceEntityType: "action_item",
      sourceEntityId: created.id
    }));
    return created.id;
  }

  private async ensureCloseoutEscalationTask(
    workflowRunId: string,
    targetDate: string,
    checklistState: {
      blockedItems: number;
      pendingItems: number;
      requiredRemaining: number;
    },
    now: string
  ): Promise<string> {
    const title = `Closeout escalation: ${targetDate}`;
    const existingEscalation = (await this.repository.listActionItems({
      ownerRole: "medical_director",
      sourceWorkflowRunId: workflowRunId
    })).find((candidate) => candidate.title === title);
    if (existingEscalation) {
      return existingEscalation.id;
    }

    const escalationTask = createActionItemRecord({
      kind: "review",
      title,
      description: `Daily closeout missed for ${targetDate}. Required checklist remaining: ${checklistState.requiredRemaining} (${checklistState.blockedItems} blocked / ${checklistState.pendingItems} pending).`,
      ownerRole: "medical_director",
      createdBy: officeOpsSystemActor.actorId,
      dueDate: addDays(now, 1),
      syncStatus: "pending_create",
      sourceWorkflowRunId: workflowRunId
    });
    const created = await this.repository.createActionItem(escalationTask);
    await this.recordAudit(officeOpsSystemActor, "action_item.created", "action_item", created.id, {
      kind: created.kind,
      ownerRole: created.ownerRole
    });
    await this.enqueueWorkerJob(officeOpsSystemActor, createWorkerJob({
      type: "planner.task.create",
      payload: {
        actor: officeOpsSystemActor,
        actionItemId: created.id
      },
      sourceEntityType: "action_item",
      sourceEntityId: created.id
    }));
    await this.enqueueWorkerJob(officeOpsSystemActor, createWorkerJob({
      type: "lists.action-item.upsert",
      payload: {
        actor: officeOpsSystemActor,
        actionItemId: created.id
      },
      sourceEntityType: "action_item",
      sourceEntityId: created.id
    }));
    return created.id;
  }

  private async ensureScorecardEscalationTask(
    review: ScorecardReviewRecord,
    now: string
  ): Promise<string> {
    if (review.medicalDirectorActionItemId) {
      return review.medicalDirectorActionItemId;
    }

    const existingEscalation = (await this.repository.listActionItems({
      ownerRole: "medical_director",
      sourceWorkflowRunId: review.workflowRunId
    })).find((candidate) => candidate.title === `Medical director oversight for ${review.employeeId}`);
    if (existingEscalation) {
      return existingEscalation.id;
    }

    const oversightTask = createActionItemRecord({
      kind: "review",
      title: `Medical director oversight for ${review.employeeId}`,
      description: `Overdue scorecard review escalation for ${review.employeeRole}.`,
      ownerRole: "medical_director",
      createdBy: scorecardSystemActor.actorId,
      dueDate: addDays(now, 1),
      syncStatus: "pending_create",
      sourceWorkflowRunId: review.workflowRunId
    });
    const created = await this.repository.createActionItem(oversightTask);
    await this.recordAudit(scorecardSystemActor, "action_item.created", "action_item", created.id, {
      kind: created.kind,
      ownerRole: created.ownerRole
    });
    await this.enqueueWorkerJob(scorecardSystemActor, createWorkerJob({
      type: "planner.task.create",
      payload: {
        actor: scorecardSystemActor,
        actionItemId: created.id
      },
      sourceEntityType: "action_item",
      sourceEntityId: created.id
    }));
    await this.enqueueWorkerJob(scorecardSystemActor, createWorkerJob({
      type: "lists.action-item.upsert",
      payload: {
        actor: scorecardSystemActor,
        actionItemId: created.id
      },
      sourceEntityType: "action_item",
      sourceEntityId: created.id
    }));
    return created.id;
  }

  private async failJob(job: WorkerJobRecord, error: unknown): Promise<void> {
    const errorMessage = error instanceof Error ? error.message : "Unknown worker failure";
    const exhausted = job.attempts >= job.maxAttempts;
    const updatedAt = new Date().toISOString();
    await this.repository.updateWorkerJob(job.id, {
      status: exhausted ? "dead_letter" : "failed",
      lockedAt: null,
      lastError: errorMessage,
      scheduledAt: exhausted
        ? job.scheduledAt
        : new Date(Date.now() + retryBackoffMs(job.attempts)).toISOString(),
      updatedAt
    });

    if (job.sourceEntityType === "action_item" && ["planner.task.create", "planner.task.reconcile"].includes(job.type)) {
      const actionItem = job.sourceEntityId ? await this.repository.getActionItem(job.sourceEntityId) : null;
      if (actionItem) {
        await this.repository.updateActionItem(actionItem.id, {
          syncStatus: "sync_error",
          lastSyncError: errorMessage,
          updatedAt
        });
      }
    }
  }

  private async recordAudit(
    actor: ActorContext,
    eventType: string,
    entityType: string,
    entityId: string,
    payload: Record<string, unknown>
  ): Promise<void> {
    const event = createAuditEvent({
      eventType,
      entityType,
      entityId,
      actorId: actor.actorId,
      actorRole: actor.role,
      actorName: actor.name,
      payload
    });

    await this.repository.createAuditEvent(event);
  }

  private async enqueueWorkerJob(actor: ActorContext, job: WorkerJobRecord): Promise<void> {
    const created = await this.repository.enqueueWorkerJob(job);
    await this.recordAudit(actor, "worker_job.enqueued", "worker_job", created.id, {
      type: created.type,
      sourceEntityType: created.sourceEntityType,
      sourceEntityId: created.sourceEntityId
    });
  }
}
