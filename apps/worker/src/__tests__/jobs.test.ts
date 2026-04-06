import { describe, expect, it } from "vitest";
import {
  createActionItemRecord,
  createChecklistItemRecord,
  createChecklistRun,
  createChecklistTemplate,
  createScorecardReviewRecord,
  createTrainingRequirement,
  createWorkerJob
} from "@clinic-os/domain";
import { buildMicrosoftPilotOps, type MicrosoftPilotOps } from "@clinic-os/msgraph";
import { MemoryClinicRepository } from "../../../api/src/lib/repositories";
import { WorkerJobRunner } from "../jobs";

describe("WorkerJobRunner", () => {
  it("processes queued jobs and does not reprocess succeeded jobs", async () => {
    const repository = new MemoryClinicRepository();
    const item = createActionItemRecord({
      kind: "action_item",
      title: "Call lab vendor",
      ownerRole: "office_manager",
      createdBy: "office-manager"
    });

    await repository.createActionItem(item);
    await repository.enqueueWorkerJob(createWorkerJob({
      type: "planner.task.create",
      payload: {
        actor: {
          actorId: "office-manager",
          role: "office_manager",
          name: "Office Manager"
        },
        actionItemId: item.id
      },
      sourceEntityType: "action_item",
      sourceEntityId: item.id
    }));

    const runner = new WorkerJobRunner(repository, buildMicrosoftPilotOps({ mode: "stub" }));
    const firstRun = await runner.runOnce();
    expect(firstRun.processed).toBe(1);
    expect(firstRun.succeeded).toBe(1);
    const actionItemAfterFirstRun = await repository.getActionItem(item.id);
    expect(actionItemAfterFirstRun?.plannerTaskId).toBeTruthy();
    expect(repository.workerJobs.filter((job) => job.type === "planner.task.create")).toHaveLength(1);

    const secondRun = await runner.runOnce();
    expect(secondRun.failed).toBe(0);
    expect(repository.workerJobs.filter((job) => job.type === "planner.task.create")).toHaveLength(1);
    const actionItemAfterSecondRun = await repository.getActionItem(item.id);
    expect(actionItemAfterSecondRun?.plannerTaskId).toBe(actionItemAfterFirstRun?.plannerTaskId);
  });

  it("retries failed jobs with backoff and moves them to dead-letter after max attempts", async () => {
    const repository = new MemoryClinicRepository();
    const failingOps: MicrosoftPilotOps = {
      ...buildMicrosoftPilotOps({ mode: "stub" }),
      async sendApprovalReminder() {
        throw new Error("Synthetic reminder failure");
      }
    };

    await repository.createDocument({
      id: "doc_approval_test",
      title: "Reminder target",
      ownerRole: "quality_lead",
      approvalClass: "policy_effective",
      artifactType: "policy",
      summary: "",
      workflowRunId: null,
      serviceLines: [],
      createdBy: "quality-user",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: "in_review",
      body: "# Draft",
      version: 1,
      publishedAt: null,
      publishedPath: null,
      reviewDueAt: null
    });

    await repository.createApprovalTasks([
      {
        id: "approval_fail_test",
        targetType: "document",
        targetId: "doc_approval_test",
        reviewerRole: "medical_director",
        approvalClass: "policy_effective",
        requestedBy: "quality-user",
        requestedAt: new Date().toISOString(),
        status: "requested",
        decidedAt: null,
        decisionNotes: null
      }
    ]);

    const job = createWorkerJob({
      type: "approval.reminder",
      payload: {
        actor: {
          actorId: "quality-user",
          role: "quality_lead",
          name: "Quality Lead"
        },
        approvalTaskId: "approval_fail_test",
        reviewerRole: "medical_director",
        documentId: "doc_approval_test",
        documentTitle: "Reminder target"
      },
      sourceEntityType: "approval_task",
      sourceEntityId: "approval_fail_test",
      maxAttempts: 2
    });

    await repository.enqueueWorkerJob(job);

    const runner = new WorkerJobRunner(repository, failingOps);
    await runner.runOnce();
    const firstFailure = await repository.getWorkerJob(job.id);
    expect(firstFailure?.status).toBe("failed");

    await repository.updateWorkerJob(job.id, {
      scheduledAt: new Date(Date.now() - 1_000).toISOString(),
      updatedAt: new Date().toISOString()
    });

    await runner.runOnce();
    const finalFailure = await repository.getWorkerJob(job.id);
    expect(finalFailure?.status).toBe("dead_letter");
    expect(finalFailure?.attempts).toBe(2);
  });

  it("runs maintenance for overdue office ops and scorecard reviews", async () => {
    const repository = new MemoryClinicRepository();
    const overdueDate = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    const workflowId = "workflow_office_ops";

    await repository.createWorkflowRun({
      id: workflowId,
      workflowDefinitionId: "office_manager_daily",
      requestedBy: "office-manager",
      requestedByRole: "office_manager",
      state: "drafted",
      createdAt: overdueDate,
      updatedAt: overdueDate,
      documentId: null,
      lastTransitionNote: null,
      input: {
        targetDate: "2026-03-27",
        requestedBy: "office-manager",
        unresolvedIssuesCount: 1,
        huddleTemplateId: "default"
      }
    });

    const officeItem = createActionItemRecord({
      kind: "action_item",
      title: "Close the front-desk follow-up",
      ownerRole: "office_manager",
      createdBy: "office-manager",
      dueDate: overdueDate,
      sourceWorkflowRunId: workflowId
    });
    await repository.createActionItem(officeItem);

    const reviewAction = createActionItemRecord({
      kind: "review",
      title: "Review scorecard for E-100",
      ownerRole: "hr_lead",
      createdBy: "office-manager",
      dueDate: overdueDate,
      sourceWorkflowRunId: "workflow_scorecards"
    });
    await repository.createActionItem(reviewAction);
    await repository.createScorecardReviews([
      createScorecardReviewRecord({
        workflowRunId: "workflow_scorecards",
        packetDocumentId: "packet_scorecards",
        actionItemId: reviewAction.id,
        employeeId: "E-100",
        employeeRole: "front_desk",
        periodStart: "2026-03-01",
        periodEnd: "2026-03-31",
        overallScore: 78,
        safetyComplianceScore: 70,
        dueDate: overdueDate
      })
    ]);

    const runner = new WorkerJobRunner(repository, buildMicrosoftPilotOps({ mode: "stub" }));
    const summary = await runner.runOnce();

    expect(summary.processed).toBeGreaterThan(0);
    const updatedOfficeItem = await repository.getActionItem(officeItem.id);
    expect(updatedOfficeItem?.escalationStatus).toBe("needs_review");

    const updatedReview = repository.scorecardReviews[0];
    expect(updatedReview?.reminderSentAt).not.toBeNull();
    expect(repository.workerJobs.some((job) => job.type === "office_ops.closeout.reminder")).toBe(true);
    expect(repository.workerJobs.some((job) => job.type === "scorecard.review.reminder")).toBe(true);
  });

  it("reconciles Planner completion back into Clinic OS action items", async () => {
    const repository = new MemoryClinicRepository();
    await repository.createWorkflowRun({
      id: "workflow_office_ops_reconcile",
      workflowDefinitionId: "office_manager_daily",
      requestedBy: "office-manager",
      requestedByRole: "office_manager",
      state: "drafted",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      documentId: null,
      lastTransitionNote: null,
      input: {
        targetDate: "2026-03-27",
        requestedBy: "office-manager",
        unresolvedIssuesCount: 0,
        huddleTemplateId: "default"
      }
    });

    const item = createActionItemRecord({
      kind: "action_item",
      title: "Call lab vendor",
      ownerRole: "office_manager",
      createdBy: "office-manager",
      plannerTaskId: "planner-task-123",
      syncStatus: "synced",
      sourceWorkflowRunId: "workflow_office_ops_reconcile"
    });
    await repository.createActionItem(item);
    await repository.enqueueWorkerJob(createWorkerJob({
      type: "planner.task.reconcile",
      payload: {
        actor: {
          actorId: "office-manager",
          role: "office_manager",
          name: "Office Manager"
        },
        actionItemId: item.id
      },
      sourceEntityType: "action_item",
      sourceEntityId: item.id
    }));

    const reconcilingOps: MicrosoftPilotOps = {
      ...buildMicrosoftPilotOps({ mode: "stub" }),
      async getPlannerTaskState() {
        return {
          taskId: "planner-task-123",
          status: "completed",
          completedAt: "2026-03-28T12:00:00.000Z",
          dueDateTime: "2026-03-28T10:00:00.000Z"
        };
      }
    };

    const runner = new WorkerJobRunner(repository, reconcilingOps);
    const summary = await runner.runOnce();
    expect(summary.succeeded).toBe(1);

    const updatedItem = await repository.getActionItem(item.id);
    expect(updatedItem?.status).toBe("done");
    expect(updatedItem?.syncStatus).toBe("completed_external");
    expect(updatedItem?.completedExternallyAt).toBe("2026-03-28T12:00:00.000Z");
  });

  it("enqueues checklist and training reminders during maintenance sweeps", async () => {
    const repository = new MemoryClinicRepository();
    const overdueDate = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    const targetDate = "2026-03-27";
    const workflowId = "workflow_office_ops_checklist";

    await repository.createWorkflowRun({
      id: workflowId,
      workflowDefinitionId: "office_manager_daily",
      requestedBy: "office-manager",
      requestedByRole: "office_manager",
      state: "drafted",
      createdAt: overdueDate,
      updatedAt: overdueDate,
      documentId: null,
      lastTransitionNote: null,
      input: {
        targetDate,
        requestedBy: "office-manager",
        unresolvedIssuesCount: 0,
        huddleTemplateId: "default"
      }
    });

    const template = createChecklistTemplate({
      name: "Office ops checklist",
      workflowDefinitionId: "office_manager_daily",
      createdBy: "office-manager",
      items: [{ label: "Room readiness", areaLabel: "Room 1", required: true }]
    });
    await repository.createChecklistTemplate(template);
    const run = createChecklistRun({
      templateId: template.id,
      workflowRunId: workflowId,
      targetDate
    });
    await repository.createChecklistRun(run);
    await repository.createChecklistItems([
      createChecklistItemRecord({
        checklistRunId: run.id,
        templateItemId: template.items[0]?.id,
        label: "Room readiness",
        areaLabel: "Room 1",
        required: true
      })
    ]);

    const requirement = createTrainingRequirement({
      employeeId: "E-200",
      employeeRole: "medical_assistant",
      requirementType: "training",
      title: "Room readiness refresher",
      dueDate: overdueDate,
      createdBy: "hr-lead"
    });
    await repository.createTrainingRequirement(requirement);

    const runner = new WorkerJobRunner(repository, buildMicrosoftPilotOps({ mode: "stub" }));
    await runner.runOnce();

    expect(repository.workerJobs.some((job) => job.type === "office_ops.checklist.reminder")).toBe(true);
    expect(repository.workerJobs.some((job) => job.type === "office_ops.checklist.escalation")).toBe(true);
    expect(repository.workerJobs.some((job) => job.type === "training.requirement.reminder")).toBe(true);
  });
});
