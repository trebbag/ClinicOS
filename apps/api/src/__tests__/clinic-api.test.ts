import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import {
  createAuditEvent,
  createDeviceEnrollmentCode,
  createDeviceSession,
  createEnrolledDevice,
  createUserProfile,
  createWorkerJob
} from "@clinic-os/domain";
import { buildMicrosoftPilotOps } from "@clinic-os/msgraph";
import { buildApp } from "../app";
import { buildIdentityResolver, signTrustedProxyRequest } from "../lib/auth";
import { DeviceProfileAuthService } from "../lib/deviceAuth";
import { env } from "../env";
import { ClinicApiService } from "../lib/services";
import { LocalApprovedDocumentPublisher } from "../lib/publishing";
import { MemoryClinicRepository } from "../lib/repositories";
import { WorkerJobRunner } from "../../../worker/src/jobs";

function headers(role: string, actorId = `${role}-user`) {
  return {
    "x-clinic-user-id": actorId,
    "x-clinic-user-role": role,
    "x-clinic-user-name": actorId
  };
}

function signedHeaders(input: {
  role: string;
  actorId?: string;
  timestamp: string;
  method: string;
  path: string;
  sharedSecret: string;
}) {
  const actorId = input.actorId ?? `${input.role}-user`;
  return {
    ...headers(input.role, actorId),
    "x-clinic-auth-ts": input.timestamp,
    "x-clinic-auth-signature": signTrustedProxyRequest({
      actorId,
      role: input.role,
      name: actorId,
      timestamp: input.timestamp,
      method: input.method,
      path: input.path,
      sharedSecret: input.sharedSecret
    })
  };
}

function originHeaders() {
  return {
    origin: new URL(env.publicAppOrigin).origin
  };
}

function cookieValue(response: Awaited<ReturnType<FastifyInstance["inject"]>>, name: string): string | null {
  const header = response.headers["set-cookie"];
  const values = Array.isArray(header) ? header : header ? [header] : [];
  for (const value of values) {
    const match = value.match(new RegExp(`${name}=([^;]*)`));
    if (match) {
      return decodeURIComponent(match[1]);
    }
  }
  return null;
}

describe("Clinic API", () => {
  let app: FastifyInstance;
  let repository: MemoryClinicRepository;

  beforeEach(() => {
    repository = new MemoryClinicRepository();
    const service = new ClinicApiService(repository, new LocalApprovedDocumentPublisher(), {
      authMode: "dev_headers",
      integrationMode: "stub",
      microsoftPreflight: {
        getMissingConfigKeys: () => ["MICROSOFT_TENANT_ID"],
        validate: async () => ({
          mode: "stub",
          configComplete: false,
          overallStatus: "missing_config",
          readyForLive: false,
          missingConfigKeys: ["MICROSOFT_TENANT_ID"],
          surfaces: []
        })
      }
    });
    app = buildApp({
      authMode: "dev_headers",
      service,
      repository
    });
  });

  afterEach(async () => {
    await app.close();
  });

  it("moves a policy draft through submit, approve, queue publish, and worker publication", async () => {
    const workflow = await app.inject({
      method: "POST",
      url: "/workflow-runs",
      headers: headers("quality_lead"),
      payload: {
        workflowId: "policy_lifecycle",
        input: {
          title: "Medication safety policy",
          ownerRole: "quality_lead",
          approvalClass: "policy_effective",
          serviceLines: [],
          requestedBy: "quality_lead-user",
          objective: "Refresh controlled-substance stewardship guidance."
        }
      }
    });

    expect(workflow.statusCode).toBe(200);
    const workflowRun = workflow.json<{ id: string }>();

    const documentResponse = await app.inject({
      method: "POST",
      url: "/documents",
      headers: headers("quality_lead"),
      payload: {
        title: "Medication safety policy",
        ownerRole: "quality_lead",
        approvalClass: "policy_effective",
        artifactType: "policy",
        summary: "Refresh controlled-substance stewardship guidance.",
        workflowRunId: workflowRun.id,
        serviceLines: [],
        body: "# Policy draft"
      }
    });

    expect(documentResponse.statusCode).toBe(200);
    const document = documentResponse.json<{ id: string }>();

    for (const nextState of ["scoped", "drafted", "quality_checked", "compliance_checked", "awaiting_human_review"] as const) {
      const transition = await app.inject({
        method: "POST",
        url: `/workflow-runs/${workflowRun.id}/transitions`,
        headers: headers("quality_lead"),
        payload: { nextState }
      });

      expect(transition.statusCode).toBe(200);
    }

    const submit = await app.inject({
      method: "POST",
      url: `/documents/${document.id}/submit`,
      headers: headers("quality_lead")
    });

    expect(submit.statusCode).toBe(200);
    const submitBody = submit.json<{ approvals: Array<{ id: string; reviewerRole: string }> }>();
    expect(submitBody.approvals).toHaveLength(2);
    expect(repository.workerJobs.filter((job) => job.type === "approval.reminder")).toHaveLength(2);

    const medicalDirectorApproval = submitBody.approvals.find((approval) => approval.reviewerRole === "medical_director");
    const cfoApproval = submitBody.approvals.find((approval) => approval.reviewerRole === "cfo");

    expect(medicalDirectorApproval).toBeDefined();
    expect(cfoApproval).toBeDefined();

    const firstDecision = await app.inject({
      method: "POST",
      url: `/approvals/${medicalDirectorApproval!.id}/decide`,
      headers: headers("medical_director"),
      payload: { decision: "approved" }
    });
    expect(firstDecision.statusCode).toBe(200);

    const secondDecision = await app.inject({
      method: "POST",
      url: `/approvals/${cfoApproval!.id}/decide`,
      headers: headers("cfo"),
      payload: { decision: "approved" }
    });
    expect(secondDecision.statusCode).toBe(200);

    const publish = await app.inject({
      method: "POST",
      url: `/documents/${document.id}/publish`,
      headers: headers("medical_director")
    });
    expect(publish.statusCode).toBe(200);
    expect(publish.json<{ status: string }>().status).toBe("publish_pending");

    const queuedPublishJob = repository.workerJobs.find((job) => job.type === "document.publish");
    expect(queuedPublishJob).toBeDefined();

    const runner = new WorkerJobRunner(repository, buildMicrosoftPilotOps({ mode: "stub" }));
    const summary = await runner.runOnce();
    expect(summary.succeeded).toBeGreaterThanOrEqual(1);

    const publishedDocument = repository.documents.find((item) => item.id === document.id);
    expect(publishedDocument?.status).toBe("published");
    expect(repository.workflows.find((item) => item.id === workflowRun.id)?.state).toBe("published");

    const approvedContext = await app.inject({
      method: "GET",
      url: `/documents/${document.id}/approved-context`,
      headers: headers("medical_director")
    });
    expect(approvedContext.statusCode).toBe(200);
    expect(approvedContext.json<{ context: string }>().context).toContain("# Policy draft");
  });

  it("rejects workflow creation for a role outside the workflow owner set", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/workflow-runs",
      headers: headers("front_desk"),
      payload: {
        workflowId: "policy_lifecycle",
        input: {
          title: "Unapproved attempt",
          ownerRole: "front_desk",
          approvalClass: "policy_effective",
          serviceLines: [],
          requestedBy: "front_desk-user",
          objective: "This should fail."
        }
      }
    });

    expect(response.statusCode).toBe(403);
  });

  it("imports scorecards and persists summary rows", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/scorecard-imports",
      headers: headers("office_manager"),
      payload: {
        filename: "march-operational-metrics.csv",
        csv: [
          "employee_id,employee_role,period_start,period_end,task_completion_rate,training_completion_rate,audit_pass_rate,issue_close_rate,complaint_count,note_lag_days,refill_turnaround_hours,schedule_fill_rate",
          "E-100,front_desk,2026-03-01,2026-03-31,0.96,1,0.98,0.91,0,0,0,0.88"
        ].join("\n")
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json<{ rowsImported: number }>().rowsImported).toBe(1);

    const scorecards = await app.inject({
      method: "GET",
      url: "/scorecards",
      headers: headers("office_manager")
    });

    expect(scorecards.statusCode).toBe(200);
    expect(scorecards.json<Array<{ employeeId: string; employeeRole: string }>>()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          employeeId: "E-100",
          employeeRole: "front_desk"
        })
      ])
    );

    expect(repository.workerJobs.some((job) => job.type === "lists.import-status.upsert")).toBe(true);
    expect(repository.workerJobs.some((job) => job.type === "teams.notification")).toBe(true);
  });

  it("generates office-manager daily packets and submits closeout", async () => {
    const packetResponse = await app.inject({
      method: "POST",
      url: "/office-ops/daily-packet",
      headers: headers("office_manager"),
      payload: {
        targetDate: "2026-03-27"
      }
    });

    expect(packetResponse.statusCode).toBe(200);
    const dashboard = packetResponse.json<{
      workflowRun: { state: string } | null;
      dailyPacket: { id: string } | null;
      checklistRun: { id: string } | null;
      checklistItems: Array<{ id: string }>;
    }>();
    expect(dashboard.workflowRun?.state).toBe("drafted");
    expect(dashboard.dailyPacket?.id).toBeDefined();
    expect(dashboard.checklistRun?.id).toBeDefined();
    expect(dashboard.checklistItems.length).toBeGreaterThan(0);

    const officeReviewItem = repository.actionItems.find(
      (item) => item.sourceWorkflowRunId === repository.workflows[0]?.id && item.ownerRole === "office_manager"
    );
    expect(officeReviewItem).toBeDefined();

    const progressResponse = await app.inject({
      method: "PATCH",
      url: `/action-items/${officeReviewItem!.id}`,
      headers: headers("office_manager"),
      payload: {
        status: "done"
      }
    });
    expect(progressResponse.statusCode).toBe(200);

    const blockedCloseout = await app.inject({
      method: "POST",
      url: "/office-ops/daily-closeout",
      headers: headers("office_manager"),
      payload: {
        targetDate: "2026-03-27",
        notes: "Attempt closeout before checklist completion."
      }
    });
    expect(blockedCloseout.statusCode).toBe(400);

    for (const checklistItem of dashboard.checklistItems) {
      const checklistUpdate = await app.inject({
        method: "PATCH",
        url: `/office-ops/checklist-runs/${dashboard.checklistRun!.id}/items/${checklistItem.id}`,
        headers: headers("office_manager"),
        payload: {
          status: "complete"
        }
      });
      expect(checklistUpdate.statusCode).toBe(200);
    }

    const closeoutResponse = await app.inject({
      method: "POST",
      url: "/office-ops/daily-closeout",
      headers: headers("office_manager"),
      payload: {
        targetDate: "2026-03-27",
        notes: "Daily packet reviewed and closeout submitted."
      }
    });

    expect(closeoutResponse.statusCode).toBe(200);
    expect(closeoutResponse.json<{
      closeoutSubmitted: boolean;
      workflowRun: { state: string } | null;
      checklist: { requiredRemaining: number };
    }>().closeoutSubmitted).toBe(true);
    expect(closeoutResponse.json<{
      closeoutSubmitted: boolean;
      workflowRun: { state: string } | null;
      checklist: { requiredRemaining: number };
    }>().workflowRun?.state).toBe("quality_checked");
    expect(closeoutResponse.json<{
      checklist: { requiredRemaining: number };
    }>().checklist.requiredRemaining).toBe(0);
  });

  it("creates scorecard reviews and completes the workflow after sign-off", async () => {
    const importResponse = await app.inject({
      method: "POST",
      url: "/scorecard-imports",
      headers: headers("office_manager"),
      payload: {
        filename: "april-operational-metrics.csv",
        csv: [
          "employee_id,employee_role,period_start,period_end,task_completion_rate,training_completion_rate,audit_pass_rate,issue_close_rate,complaint_count,note_lag_days,refill_turnaround_hours,schedule_fill_rate",
          "E-100,front_desk,2026-04-01,2026-04-30,0.96,1,0.98,0.91,0,0,0,0.88",
          "E-200,medical_assistant,2026-04-01,2026-04-30,0.75,0.8,0.7,0.7,2,0,0,0.7"
        ].join("\n")
      }
    });

    expect(importResponse.statusCode).toBe(200);
    const workflowId = importResponse.json<{ workflow: { id: string } }>().workflow.id;

    const reviews = await app.inject({
      method: "GET",
      url: "/scorecard-reviews?periodStart=2026-04-01&periodEnd=2026-04-30",
      headers: headers("office_manager")
    });
    expect(reviews.statusCode).toBe(200);
    const reviewRows = reviews.json<Array<{ id: string; status: string; requiresMedicalDirectorReview: boolean; employeeId: string }>>();
    expect(reviewRows).toHaveLength(2);

    const normalReview = reviewRows.find((review) => review.employeeId === "E-100");
    const exceptionReview = reviewRows.find((review) => review.employeeId === "E-200");
    expect(normalReview?.requiresMedicalDirectorReview).toBe(false);
    expect(exceptionReview?.requiresMedicalDirectorReview).toBe(true);

    const hrDecisionOne = await app.inject({
      method: "POST",
      url: `/scorecard-reviews/${normalReview!.id}/decision`,
      headers: headers("hr_lead"),
      payload: { decision: "signed_off" }
    });
    expect(hrDecisionOne.statusCode).toBe(200);

    const hrDecisionTwo = await app.inject({
      method: "POST",
      url: `/scorecard-reviews/${exceptionReview!.id}/decision`,
      headers: headers("hr_lead"),
      payload: { decision: "signed_off" }
    });
    expect(hrDecisionTwo.statusCode).toBe(200);

    const medicalDirectorDecision = await app.inject({
      method: "POST",
      url: `/scorecard-reviews/${exceptionReview!.id}/decision`,
      headers: headers("medical_director"),
      payload: { decision: "signed_off" }
    });
    expect(medicalDirectorDecision.statusCode).toBe(200);

    expect(repository.workflows.find((workflow) => workflow.id === workflowId)?.state).toBe("approved");
    const packetDocument = repository.documents.find((document) => document.workflowRunId === workflowId);
    expect(packetDocument?.status).toBe("approved");
  });

  it("returns scorecard history with prior-period deltas", async () => {
    for (const [filename, row] of [
      [
        "feb-metrics.csv",
        "E-100,front_desk,2026-02-01,2026-02-28,0.9,1,0.95,0.88,0,0,0,0.82"
      ],
      [
        "mar-metrics.csv",
        "E-100,front_desk,2026-03-01,2026-03-31,0.96,1,0.98,0.91,0,0,0,0.88"
      ]
    ] as const) {
      const response = await app.inject({
        method: "POST",
        url: "/scorecard-imports",
        headers: headers("office_manager"),
        payload: {
          filename,
          csv: [
            "employee_id,employee_role,period_start,period_end,task_completion_rate,training_completion_rate,audit_pass_rate,issue_close_rate,complaint_count,note_lag_days,refill_turnaround_hours,schedule_fill_rate",
            row
          ].join("\n")
        }
      });
      expect(response.statusCode).toBe(200);
    }

    const historyResponse = await app.inject({
      method: "GET",
      url: "/scorecards/history?employeeId=E-100&employeeRole=front_desk",
      headers: headers("office_manager")
    });

    expect(historyResponse.statusCode).toBe(200);
    const history = historyResponse.json<Array<{ overallDelta: number | null }>>();
    expect(history).toHaveLength(2);
    expect(history[0]?.overallDelta).toBeNull();
    expect(history[1]?.overallDelta).not.toBeNull();
    expect(history[1]).toEqual(expect.objectContaining({
      rollingAverageOverallScore: expect.any(Number),
      openTrainingGapCount: expect.any(Number)
    }));
  });

  it("tracks training requirements and resolves scorecard follow-up tasks after completion", async () => {
    const importResponse = await app.inject({
      method: "POST",
      url: "/scorecard-imports",
      headers: headers("office_manager"),
      payload: {
        filename: "may-operational-metrics.csv",
        csv: [
          "employee_id,employee_role,period_start,period_end,task_completion_rate,training_completion_rate,audit_pass_rate,issue_close_rate,complaint_count,note_lag_days,refill_turnaround_hours,schedule_fill_rate",
          "E-200,medical_assistant,2026-05-01,2026-05-31,0.75,0.8,0.7,0.7,2,0,0,0.7"
        ].join("\n")
      }
    });
    expect(importResponse.statusCode).toBe(200);

    const requirementResponse = await app.inject({
      method: "POST",
      url: "/training-requirements",
      headers: headers("hr_lead"),
      payload: {
        employeeId: "E-200",
        employeeRole: "medical_assistant",
        requirementType: "training",
        title: "Room readiness refresher",
        dueDate: "2026-05-15T12:00:00.000Z"
      }
    });
    expect(requirementResponse.statusCode).toBe(200);
    const requirement = requirementResponse.json<{ id: string }>();

    const reviews = await app.inject({
      method: "GET",
      url: "/scorecard-reviews?periodStart=2026-05-01&periodEnd=2026-05-31",
      headers: headers("office_manager")
    });
    const review = reviews.json<Array<{ id: string }>>()[0];

    const hrDecision = await app.inject({
      method: "POST",
      url: `/scorecard-reviews/${review!.id}/decision`,
      headers: headers("hr_lead"),
      payload: { decision: "signed_off" }
    });
    expect(hrDecision.statusCode).toBe(200);

    const mdDecision = await app.inject({
      method: "POST",
      url: `/scorecard-reviews/${review!.id}/decision`,
      headers: headers("medical_director"),
      payload: { decision: "signed_off" }
    });
    expect(mdDecision.statusCode).toBe(200);

    const updatedReview = repository.scorecardReviews.find((item) => item.id === review!.id);
    expect(updatedReview?.trainingFollowUpActionItemId).toBeTruthy();
    expect(
      repository.actionItems.find((item) => item.id === updatedReview?.trainingFollowUpActionItemId)?.status
    ).toBe("in_progress");
    expect(
      repository.actionItems.find((item) => item.id === updatedReview?.medicalDirectorActionItemId)?.status
    ).toBe("in_progress");

    const dashboardBeforeCompletion = await app.inject({
      method: "GET",
      url: "/training/dashboard?employeeId=E-200&employeeRole=medical_assistant",
      headers: headers("hr_lead")
    });
    expect(dashboardBeforeCompletion.statusCode).toBe(200);
    expect(dashboardBeforeCompletion.json<{ gapSummary: { counts: { missing: number; overdue: number } } }>().gapSummary.counts.missing
      + dashboardBeforeCompletion.json<{ gapSummary: { counts: { missing: number; overdue: number } } }>().gapSummary.counts.overdue)
      .toBeGreaterThan(0);

    const completionResponse = await app.inject({
      method: "POST",
      url: "/training-completions",
      headers: headers("hr_lead"),
      payload: {
        requirementId: requirement.id,
        validUntil: "2027-05-15T12:00:00.000Z",
        note: "Completed refresher"
      }
    });
    expect(completionResponse.statusCode).toBe(200);

    expect(
      repository.actionItems.find((item) => item.id === updatedReview?.trainingFollowUpActionItemId)?.status
    ).toBe("done");
    expect(
      repository.actionItems.find((item) => item.id === updatedReview?.medicalDirectorActionItemId)?.status
    ).toBe("done");
  });

  it("enqueues Microsoft sync jobs for office-manager actions and retries failed jobs", async () => {
    const issueResponse = await app.inject({
      method: "POST",
      url: "/action-items",
      headers: headers("office_manager"),
      payload: {
        kind: "issue",
        title: "Broken room tablet",
        description: "Tablet in room 2 is offline.",
        ownerRole: "office_manager"
      }
    });

    expect(issueResponse.statusCode).toBe(200);
    const issue = issueResponse.json<{ id: string }>();
    const issueJob = repository.workerJobs.find((job) => job.sourceEntityId === issue.id);
    expect(issueJob?.type).toBe("lists.issue.upsert");

    const reviewResponse = await app.inject({
      method: "POST",
      url: "/action-items",
      headers: headers("office_manager"),
      payload: {
        kind: "action_item",
        title: "Assign backup tablet",
        description: "Temporary workaround while room 2 tablet is repaired.",
        ownerRole: "office_manager",
        dueDate: new Date().toISOString()
      }
    });

    expect(reviewResponse.statusCode).toBe(200);
    const review = reviewResponse.json<{ id: string }>();
    expect(repository.workerJobs.some((job) => job.type === "planner.task.create" && job.sourceEntityId === review.id)).toBe(true);
    expect(repository.workerJobs.some((job) => job.type === "lists.action-item.upsert" && job.sourceEntityId === review.id)).toBe(true);

    const retryCandidate = issueJob!;
    await repository.updateWorkerJob(retryCandidate.id, {
      status: "failed",
      lastError: "Synthetic test failure",
      updatedAt: new Date().toISOString()
    });

    const retryResponse = await app.inject({
      method: "POST",
      url: `/worker-jobs/${retryCandidate.id}/retry`,
      headers: headers("quality_lead")
    });

    expect(retryResponse.statusCode).toBe(200);
    expect(retryResponse.json<{ status: string; attempts: number }>().status).toBe("queued");
    expect(retryResponse.json<{ status: string; attempts: number }>().attempts).toBe(0);
  });

  it("returns whoami and worker summary in dev header mode", async () => {
    await repository.enqueueWorkerJob({
      id: "job_summary_1",
      type: "document.publish",
      status: "queued",
      attempts: 0,
      maxAttempts: 3,
      scheduledAt: new Date().toISOString(),
      lockedAt: null,
      lastError: null,
      payload: {},
      resultJson: null,
      sourceEntityType: "document",
      sourceEntityId: "doc-1",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    await repository.enqueueWorkerJob({
      id: "job_summary_2",
      type: "approval.reminder",
      status: "dead_letter",
      attempts: 3,
      maxAttempts: 3,
      scheduledAt: new Date().toISOString(),
      lockedAt: null,
      lastError: "boom",
      payload: {},
      resultJson: null,
      sourceEntityType: "approval_task",
      sourceEntityId: "approval-1",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    const whoami = await app.inject({
      method: "GET",
      url: "/auth/whoami",
      headers: headers("medical_director")
    });

    expect(whoami.statusCode).toBe(200);
    expect(whoami.json<{ authMode: string; actor: { role: string } }>()).toMatchObject({
      authMode: "dev_headers",
      actor: {
        role: "medical_director"
      }
    });

    const summary = await app.inject({
      method: "GET",
      url: "/worker-jobs/summary",
      headers: headers("medical_director")
    });

    expect(summary.statusCode).toBe(200);
    expect(summary.json<{ queued: number; deadLetter: number }>().queued).toBe(1);
    expect(summary.json<{ queued: number; deadLetter: number }>().deadLetter).toBe(1);
  });

  it("persists Microsoft validation results for pilot status checks", async () => {
    const validationRepository = new MemoryClinicRepository();
    const service = new ClinicApiService(validationRepository, new LocalApprovedDocumentPublisher(), {
      authMode: "dev_headers",
      integrationMode: "live",
      microsoftPreflight: {
        getMissingConfigKeys: () => [],
        validate: async () => ({
          mode: "live",
          configComplete: true,
          overallStatus: "ready",
          readyForLive: true,
          missingConfigKeys: [],
          surfaces: [
            {
              key: "sharepoint",
              label: "SharePoint policy folder",
              status: "ready",
              verificationMode: "live_probe",
              configured: true,
              reachable: true,
              detail: null
            }
          ]
        })
      }
    });
    const validationApp = buildApp({
      authMode: "dev_headers",
      service,
      repository: validationRepository
    });

    const validateResponse = await validationApp.inject({
      method: "POST",
      url: "/integrations/microsoft/validate",
      headers: headers("quality_lead")
    });

    expect(validateResponse.statusCode).toBe(200);
    expect(validateResponse.json<{ overallStatus: string; readyForLive: boolean }>().overallStatus).toBe("ready");
    expect(validateResponse.json<{ overallStatus: string; readyForLive: boolean }>().readyForLive).toBe(true);

    const statusResponse = await validationApp.inject({
      method: "GET",
      url: "/integrations/microsoft/status",
      headers: headers("quality_lead")
    });

    expect(statusResponse.statusCode).toBe(200);
    expect(statusResponse.json<{ latestValidation: { overallStatus: string } | null }>().latestValidation?.overallStatus).toBe("ready");

    await validationApp.close();
  });

  it("bootstraps device-profile auth, enrolls a device, logs in, and ignores spoofed caller headers", async () => {
    const deviceRepository = new MemoryClinicRepository();
    const service = new ClinicApiService(deviceRepository, new LocalApprovedDocumentPublisher(), {
      authMode: "device_profiles",
      integrationMode: "stub",
      microsoftPreflight: {
        getMissingConfigKeys: () => [],
        validate: async () => ({
          mode: "stub",
          configComplete: true,
          overallStatus: "ready",
          readyForLive: true,
          missingConfigKeys: [],
          surfaces: []
        })
      }
    });
    const deviceAuthService = new DeviceProfileAuthService(deviceRepository, {
      mode: "device_profiles",
      secureCookies: false,
      cookieSameSite: "Strict",
      deviceTrustDays: 90,
      sessionIdleHours: 12,
      sessionAbsoluteDays: 7,
      failedPinLimit: 5,
      failedPinLockMinutes: 15,
      enrollmentTtlMinutes: 15
    });
    const bootstrap = await deviceAuthService.bootstrapFirstAdmin({
      displayName: "Pilot Admin",
      role: "medical_director",
      pin: "123456"
    });
    const deviceApp = buildApp({
      authMode: "device_profiles",
      service,
      repository: deviceRepository,
      deviceAuthService
    });

    const enrollResponse = await deviceApp.inject({
      method: "POST",
      url: "/auth/enroll-device",
      headers: originHeaders(),
      payload: {
        enrollmentCode: bootstrap.enrollmentCode.code,
        deviceLabel: "Front Desk iPad"
      }
    });

    expect(enrollResponse.statusCode).toBe(200);
    const deviceCookie = cookieValue(enrollResponse, "clinic_device");
    expect(deviceCookie).toBeTruthy();

    const loginResponse = await deviceApp.inject({
      method: "POST",
      url: "/auth/login",
      headers: {
        ...originHeaders(),
        cookie: `clinic_device=${deviceCookie}`
      },
      payload: {
        profileId: bootstrap.profile.id,
        pin: "123456"
      }
    });

    expect(loginResponse.statusCode).toBe(200);
    const sessionCookie = cookieValue(loginResponse, "clinic_session");
    expect(sessionCookie).toBeTruthy();

    const whoami = await deviceApp.inject({
      method: "GET",
      url: "/auth/whoami",
      headers: {
        cookie: `clinic_device=${deviceCookie}; clinic_session=${sessionCookie}`,
        "x-clinic-user-id": "spoofed",
        "x-clinic-user-role": "office_manager",
        "x-clinic-user-name": "Spoofed User"
      }
    });

    expect(whoami.statusCode).toBe(200);
    expect(whoami.json<{ actor: { actorId: string; role: string; name?: string } }>().actor).toEqual(
      expect.objectContaining({
        actorId: bootstrap.profile.id,
        role: "medical_director"
      })
    );

    const locked = await deviceApp.inject({
      method: "POST",
      url: "/auth/lock",
      headers: {
        ...originHeaders(),
        cookie: `clinic_device=${deviceCookie}; clinic_session=${sessionCookie}`
      }
    });

    expect(locked.statusCode).toBe(200);
    expect(locked.json<{ needsLogin: boolean }>().needsLogin).toBe(true);

    await deviceApp.close();
  });

  it("lets a multi-role admin profile switch acting roles on the same trusted account", async () => {
    const deviceRepository = new MemoryClinicRepository();
    const service = new ClinicApiService(deviceRepository, new LocalApprovedDocumentPublisher(), {
      authMode: "device_profiles",
      integrationMode: "stub",
      microsoftPreflight: {
        getMissingConfigKeys: () => [],
        validate: async () => ({
          mode: "stub",
          configComplete: true,
          overallStatus: "ready",
          readyForLive: true,
          missingConfigKeys: [],
          surfaces: []
        })
      }
    });
    const deviceAuthService = new DeviceProfileAuthService(deviceRepository, {
      mode: "device_profiles",
      secureCookies: false,
      cookieSameSite: "Strict",
      deviceTrustDays: 90,
      sessionIdleHours: 12,
      sessionAbsoluteDays: 7,
      failedPinLimit: 5,
      failedPinLockMinutes: 15,
      enrollmentTtlMinutes: 15
    });
    const bootstrap = await deviceAuthService.bootstrapFirstAdmin({
      displayName: "Pilot Admin",
      role: "medical_director",
      pin: "123456"
    });
    const deviceApp = buildApp({
      authMode: "device_profiles",
      service,
      repository: deviceRepository,
      deviceAuthService
    });

    const enrollResponse = await deviceApp.inject({
      method: "POST",
      url: "/auth/enroll-device",
      headers: originHeaders(),
      payload: {
        enrollmentCode: bootstrap.enrollmentCode.code,
        deviceLabel: "Admin Console"
      }
    });
    const deviceCookie = cookieValue(enrollResponse, "clinic_device");

    const loginResponse = await deviceApp.inject({
      method: "POST",
      url: "/auth/login",
      headers: {
        ...originHeaders(),
        cookie: `clinic_device=${deviceCookie}`
      },
      payload: {
        profileId: bootstrap.profile.id,
        role: "office_manager",
        pin: "123456"
      }
    });

    expect(loginResponse.statusCode).toBe(200);
    expect(loginResponse.json<{ currentProfile: { role: string; availableRoles: string[] } }>().currentProfile).toEqual(
      expect.objectContaining({
        role: "office_manager",
        availableRoles: expect.arrayContaining(["medical_director", "office_manager", "quality_lead", "hr_lead", "cfo"])
      })
    );
    const sessionCookie = cookieValue(loginResponse, "clinic_session");

    const whoami = await deviceApp.inject({
      method: "GET",
      url: "/auth/whoami",
      headers: {
        cookie: `clinic_device=${deviceCookie}; clinic_session=${sessionCookie}`
      }
    });
    expect(whoami.statusCode).toBe(200);
    expect(whoami.json<{ actor: { role: string }; grantedRoles: string[] }>().actor.role).toBe("office_manager");
    expect(whoami.json<{ actor: { role: string }; grantedRoles: string[] }>().grantedRoles).toEqual(
      expect.arrayContaining(["medical_director", "office_manager", "quality_lead", "hr_lead", "cfo"])
    );

    const packetResponse = await deviceApp.inject({
      method: "POST",
      url: "/office-ops/daily-packet",
      headers: {
        ...originHeaders(),
        cookie: `clinic_device=${deviceCookie}; clinic_session=${sessionCookie}`
      },
      payload: {
        targetDate: "2026-04-07"
      }
    });
    expect(packetResponse.statusCode).toBe(200);

    const switchResponse = await deviceApp.inject({
      method: "POST",
      url: "/auth/switch-profile",
      headers: {
        ...originHeaders(),
        cookie: `clinic_device=${deviceCookie}; clinic_session=${sessionCookie}`
      },
      payload: {
        profileId: bootstrap.profile.id,
        role: "quality_lead",
        pin: "123456"
      }
    });
    expect(switchResponse.statusCode).toBe(200);
    const switchedSessionCookie = cookieValue(switchResponse, "clinic_session");

    const qualityWhoami = await deviceApp.inject({
      method: "GET",
      url: "/auth/whoami",
      headers: {
        cookie: `clinic_device=${deviceCookie}; clinic_session=${switchedSessionCookie}`
      }
    });
    expect(qualityWhoami.statusCode).toBe(200);
    expect(qualityWhoami.json<{ actor: { role: string } }>().actor.role).toBe("quality_lead");

    const validateResponse = await deviceApp.inject({
      method: "POST",
      url: "/integrations/microsoft/validate",
      headers: {
        ...originHeaders(),
        cookie: `clinic_device=${deviceCookie}; clinic_session=${switchedSessionCookie}`
      }
    });
    expect(validateResponse.statusCode).toBe(200);

    await deviceApp.close();
  });

  it("reports stub-mode runtime readiness through readyz and config-status", async () => {
    const statusRepository = new MemoryClinicRepository();
    const service = new ClinicApiService(statusRepository, new LocalApprovedDocumentPublisher(), {
      authMode: "device_profiles",
      integrationMode: "stub",
      microsoftPreflight: {
        getMissingConfigKeys: () => ["MICROSOFT_TENANT_ID"],
        validate: async () => ({
          mode: "stub",
          configComplete: false,
          overallStatus: "missing_config",
          readyForLive: false,
          missingConfigKeys: ["MICROSOFT_TENANT_ID"],
          surfaces: []
        })
      }
    });
    const deviceAuthService = new DeviceProfileAuthService(statusRepository, {
      mode: "device_profiles",
      secureCookies: false,
      cookieSameSite: "Strict",
      deviceTrustDays: 90,
      sessionIdleHours: 12,
      sessionAbsoluteDays: 7,
      failedPinLimit: 5,
      failedPinLockMinutes: 15,
      enrollmentTtlMinutes: 15
    });
    const bootstrap = await deviceAuthService.bootstrapFirstAdmin({
      displayName: "Pilot Admin",
      role: "medical_director",
      pin: "123456"
    });
    const readyApp = buildApp({
      authMode: "device_profiles",
      service,
      repository: statusRepository,
      deviceAuthService,
      databaseReadyCheck: async () => true
    });

    const enrollResponse = await readyApp.inject({
      method: "POST",
      url: "/auth/enroll-device",
      headers: originHeaders(),
      payload: {
        enrollmentCode: bootstrap.enrollmentCode.code,
        deviceLabel: "Pilot Front Desk"
      }
    });
    const deviceCookie = cookieValue(enrollResponse, "clinic_device");
    const loginResponse = await readyApp.inject({
      method: "POST",
      url: "/auth/login",
      headers: {
        ...originHeaders(),
        cookie: `clinic_device=${deviceCookie}`
      },
      payload: {
        profileId: bootstrap.profile.id,
        pin: "123456"
      }
    });
    const sessionCookie = cookieValue(loginResponse, "clinic_session");

    const readyz = await readyApp.inject({
      method: "GET",
      url: "/readyz"
    });
    expect(readyz.statusCode).toBe(200);
    expect(readyz.json<{ publicationMode: string; pilotUsable: boolean }>().publicationMode).toBe("local_stub");
    expect(readyz.json<{ publicationMode: string; pilotUsable: boolean }>().pilotUsable).toBe(true);

    const configStatus = await readyApp.inject({
      method: "GET",
      url: "/ops/config-status",
      headers: {
        cookie: `clinic_device=${deviceCookie}; clinic_session=${sessionCookie}`
      }
    });
    expect(configStatus.statusCode).toBe(200);
    expect(configStatus.json<{ microsoft: { mode: string }; pilotUsable: boolean }>().microsoft.mode).toBe("stub");
    expect(configStatus.json<{ microsoft: { mode: string }; pilotUsable: boolean }>().pilotUsable).toBe(true);

    await readyApp.close();
  });

  it("enforces pilot-ops capabilities instead of broad shared admin role checks", async () => {
    const capabilityRepository = new MemoryClinicRepository();
    const capabilityService = new ClinicApiService(capabilityRepository, new LocalApprovedDocumentPublisher(), {
      authMode: "dev_headers",
      integrationMode: "stub",
      microsoftPreflight: {
        getMissingConfigKeys: () => [],
        validate: async () => ({
          mode: "stub",
          configComplete: true,
          overallStatus: "ready",
          readyForLive: true,
          missingConfigKeys: [],
          surfaces: []
        })
      }
    });
    const capabilityApp = buildApp({
      authMode: "dev_headers",
      service: capabilityService,
      repository: capabilityRepository,
      databaseReadyCheck: async () => true
    });

    const hrConfig = await capabilityApp.inject({
      method: "GET",
      url: "/ops/config-status",
      headers: headers("hr_lead")
    });
    expect(hrConfig.statusCode).toBe(200);

    const hrWorker = await capabilityApp.inject({
      method: "GET",
      url: "/worker-jobs",
      headers: headers("hr_lead")
    });
    expect(hrWorker.statusCode).toBe(403);

    const hrValidate = await capabilityApp.inject({
      method: "POST",
      url: "/integrations/microsoft/validate",
      headers: headers("hr_lead")
    });
    expect(hrValidate.statusCode).toBe(403);

    const hrAudit = await capabilityApp.inject({
      method: "GET",
      url: "/audit-events?eventTypePrefix=auth.",
      headers: headers("hr_lead")
    });
    expect(hrAudit.statusCode).toBe(200);

    await capabilityApp.close();
  });

  it("reports maintenance needs and cleans up expired auth artifacts plus stale worker locks", async () => {
    const cleanupRepository = new MemoryClinicRepository();
    const cleanupService = new ClinicApiService(cleanupRepository, new LocalApprovedDocumentPublisher(), {
      authMode: "dev_headers",
      integrationMode: "stub",
      microsoftPreflight: {
        getMissingConfigKeys: () => [],
        validate: async () => ({
          mode: "stub",
          configComplete: true,
          overallStatus: "ready",
          readyForLive: true,
          missingConfigKeys: [],
          surfaces: []
        })
      }
    });
    const cleanupApp = buildApp({
      authMode: "dev_headers",
      service: cleanupService,
      repository: cleanupRepository,
      databaseReadyCheck: async () => true
    });

    const profile = createUserProfile({
      displayName: "Ops Admin",
      role: "medical_director",
      pinHash: "hashed"
    });
    cleanupRepository.userProfiles.push(profile);
    cleanupRepository.enrolledDevices.push(createEnrolledDevice({
      deviceLabel: "Ops Console",
      deviceSecretHash: "device-secret",
      primaryProfileId: profile.id,
      trustExpiresAt: "2026-05-01T00:00:00.000Z",
      createdByProfileId: profile.id
    }));
    cleanupRepository.enrollmentCodes.push(createDeviceEnrollmentCode({
      codeHash: "expired-code",
      createdByProfileId: profile.id,
      primaryProfileId: profile.id,
      allowedProfileIds: [profile.id],
      expiresAt: "2026-03-20T00:00:00.000Z"
    }));
    cleanupRepository.deviceSessions.push(
      createDeviceSession({
        deviceId: cleanupRepository.enrolledDevices[0].id,
        profileId: profile.id,
        activeRole: profile.role,
        sessionSecretHash: "expired-active-session",
        idleExpiresAt: "2026-03-20T00:00:00.000Z",
        absoluteExpiresAt: "2026-03-25T00:00:00.000Z"
      }),
      {
        ...createDeviceSession({
          deviceId: cleanupRepository.enrolledDevices[0].id,
          profileId: profile.id,
          activeRole: profile.role,
          sessionSecretHash: "revoked-session",
          idleExpiresAt: "2026-03-01T00:00:00.000Z",
          absoluteExpiresAt: "2026-03-10T00:00:00.000Z"
        }),
        revokedAt: "2026-03-21T00:00:00.000Z",
        updatedAt: "2026-03-21T00:00:00.000Z"
      }
    );
    cleanupRepository.workerJobs.push(
      {
        ...createWorkerJob({
          type: "planner.task.create",
          payload: { smoke: true }
        }),
        status: "processing",
        lockedAt: "2026-04-05T00:00:00.000Z",
        attempts: 1,
        updatedAt: "2026-04-05T00:00:00.000Z"
      },
      {
        ...createWorkerJob({
          type: "teams.notification",
          payload: { smoke: true }
        }),
        status: "succeeded",
        updatedAt: "2026-03-01T00:00:00.000Z"
      }
    );
    cleanupRepository.auditEvents.push(createAuditEvent({
      eventType: "auth.pin_failed",
      entityType: "device_profile_assignment",
      entityId: "assignment_test",
      actorId: profile.id,
      actorRole: profile.role,
      actorName: profile.displayName,
      payload: {
        deviceId: cleanupRepository.enrolledDevices[0].id,
        profileId: profile.id
      }
    }));

    const summary = await cleanupApp.inject({
      method: "GET",
      url: "/ops/maintenance-summary",
      headers: headers("medical_director")
    });
    expect(summary.statusCode).toBe(200);
    expect(summary.json<{ auth: { expiredActiveSessions: number; purgeableEnrollmentCodes: number }; worker: { staleProcessing: number; purgeableSucceeded: number } }>().auth.expiredActiveSessions).toBe(1);
    expect(summary.json<{ auth: { expiredActiveSessions: number; purgeableEnrollmentCodes: number }; worker: { staleProcessing: number; purgeableSucceeded: number } }>().auth.purgeableEnrollmentCodes).toBe(1);
    expect(summary.json<{ auth: { expiredActiveSessions: number; purgeableEnrollmentCodes: number }; worker: { staleProcessing: number; purgeableSucceeded: number } }>().worker.staleProcessing).toBe(1);
    expect(summary.json<{ auth: { expiredActiveSessions: number; purgeableEnrollmentCodes: number }; worker: { staleProcessing: number; purgeableSucceeded: number } }>().worker.purgeableSucceeded).toBe(1);

    const alerts = await cleanupApp.inject({
      method: "GET",
      url: "/ops/alerts",
      headers: headers("medical_director")
    });
    expect(alerts.statusCode).toBe(200);
    const alertBody = alerts.json<{ criticalCount: number; warningCount: number; alerts: Array<{ key: string }> }>();
    expect(alertBody.criticalCount).toBeGreaterThan(0);
    expect(alertBody.warningCount).toBeGreaterThan(0);
    expect(alertBody.alerts.map((alert) => alert.key)).toEqual(expect.arrayContaining([
      "runtime.blocking_issues",
      "worker.stale_processing",
      "auth.recent_pin_failures"
    ]));

    const dryRun = await cleanupApp.inject({
      method: "POST",
      url: "/ops/cleanup",
      headers: headers("medical_director"),
      payload: {
        dryRun: true
      }
    });
    expect(dryRun.statusCode).toBe(200);
    expect(cleanupRepository.enrollmentCodes).toHaveLength(1);

    const cleanup = await cleanupApp.inject({
      method: "POST",
      url: "/ops/cleanup",
      headers: headers("medical_director"),
      payload: {
        dryRun: false
      }
    });
    expect(cleanup.statusCode).toBe(200);
    expect(cleanup.json<{ requeuedStaleProcessingJobs: number; purgedEnrollmentCodes: number; revokedExpiredSessions: number; purgedRevokedSessions: number }>().requeuedStaleProcessingJobs).toBe(1);
    expect(cleanup.json<{ requeuedStaleProcessingJobs: number; purgedEnrollmentCodes: number; revokedExpiredSessions: number; purgedRevokedSessions: number }>().purgedEnrollmentCodes).toBe(1);
    expect(cleanup.json<{ requeuedStaleProcessingJobs: number; purgedEnrollmentCodes: number; revokedExpiredSessions: number; purgedRevokedSessions: number }>().revokedExpiredSessions).toBe(1);
    expect(cleanup.json<{ requeuedStaleProcessingJobs: number; purgedEnrollmentCodes: number; revokedExpiredSessions: number; purgedRevokedSessions: number }>().purgedRevokedSessions).toBe(1);

    expect(cleanupRepository.enrollmentCodes).toHaveLength(0);
    expect(cleanupRepository.deviceSessions).toHaveLength(1);
    expect(cleanupRepository.deviceSessions[0].revokedAt).not.toBeNull();
    expect(cleanupRepository.workerJobs.find((job) => job.status === "queued")).toBeDefined();
    expect(cleanupRepository.workerJobs.some((job) => job.status === "succeeded")).toBe(true);

    await cleanupApp.close();
  });

  it("locks a profile after repeated bad PIN attempts and rejects mutating requests without Origin in device mode", async () => {
    const deviceRepository = new MemoryClinicRepository();
    const service = new ClinicApiService(deviceRepository, new LocalApprovedDocumentPublisher(), {
      authMode: "device_profiles",
      integrationMode: "stub",
      microsoftPreflight: {
        getMissingConfigKeys: () => [],
        validate: async () => ({
          mode: "stub",
          configComplete: true,
          overallStatus: "ready",
          readyForLive: true,
          missingConfigKeys: [],
          surfaces: []
        })
      }
    });
    const deviceAuthService = new DeviceProfileAuthService(deviceRepository, {
      mode: "device_profiles",
      secureCookies: false,
      cookieSameSite: "Strict",
      deviceTrustDays: 90,
      sessionIdleHours: 12,
      sessionAbsoluteDays: 7,
      failedPinLimit: 5,
      failedPinLockMinutes: 15,
      enrollmentTtlMinutes: 15
    });
    const bootstrap = await deviceAuthService.bootstrapFirstAdmin({
      displayName: "Office Lead",
      role: "office_manager",
      pin: "123456"
    });
    const deviceApp = buildApp({
      authMode: "device_profiles",
      service,
      repository: deviceRepository,
      deviceAuthService
    });

    const missingOrigin = await deviceApp.inject({
      method: "POST",
      url: "/auth/enroll-device",
      payload: {
        enrollmentCode: bootstrap.enrollmentCode.code,
        deviceLabel: "Back Office"
      }
    });
    expect(missingOrigin.statusCode).toBe(403);

    const enrollResponse = await deviceApp.inject({
      method: "POST",
      url: "/auth/enroll-device",
      headers: originHeaders(),
      payload: {
        enrollmentCode: bootstrap.enrollmentCode.code,
        deviceLabel: "Back Office"
      }
    });
    const deviceCookie = cookieValue(enrollResponse, "clinic_device");
    expect(deviceCookie).toBeTruthy();

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const badLogin = await deviceApp.inject({
        method: "POST",
        url: "/auth/login",
        headers: {
          ...originHeaders(),
          cookie: `clinic_device=${deviceCookie}`
        },
        payload: {
          profileId: bootstrap.profile.id,
          pin: "000000"
        }
      });
      expect(badLogin.statusCode).toBe(401);
    }

    const lockedLogin = await deviceApp.inject({
      method: "POST",
      url: "/auth/login",
      headers: {
        ...originHeaders(),
        cookie: `clinic_device=${deviceCookie}`
      },
      payload: {
        profileId: bootstrap.profile.id,
        pin: "123456"
      }
    });

    expect(lockedLogin.statusCode).toBe(401);
    expect(lockedLogin.json<{ message: string }>().message).toContain("temporarily locked");

    await deviceApp.close();
  });

  it("revokes enrolled devices and immediately removes session access", async () => {
    const deviceRepository = new MemoryClinicRepository();
    const service = new ClinicApiService(deviceRepository, new LocalApprovedDocumentPublisher(), {
      authMode: "device_profiles",
      integrationMode: "stub",
      microsoftPreflight: {
        getMissingConfigKeys: () => [],
        validate: async () => ({
          mode: "stub",
          configComplete: true,
          overallStatus: "ready",
          readyForLive: true,
          missingConfigKeys: [],
          surfaces: []
        })
      }
    });
    const deviceAuthService = new DeviceProfileAuthService(deviceRepository, {
      mode: "device_profiles",
      secureCookies: false,
      cookieSameSite: "Strict",
      deviceTrustDays: 90,
      sessionIdleHours: 12,
      sessionAbsoluteDays: 7,
      failedPinLimit: 5,
      failedPinLockMinutes: 15,
      enrollmentTtlMinutes: 15
    });
    const bootstrap = await deviceAuthService.bootstrapFirstAdmin({
      displayName: "Device Admin",
      role: "medical_director",
      pin: "123456"
    });
    const deviceApp = buildApp({
      authMode: "device_profiles",
      service,
      repository: deviceRepository,
      deviceAuthService
    });

    const enrollResponse = await deviceApp.inject({
      method: "POST",
      url: "/auth/enroll-device",
      headers: originHeaders(),
      payload: {
        enrollmentCode: bootstrap.enrollmentCode.code,
        deviceLabel: "Quality Station"
      }
    });
    const deviceCookie = cookieValue(enrollResponse, "clinic_device");
    expect(deviceCookie).toBeTruthy();

    const loginResponse = await deviceApp.inject({
      method: "POST",
      url: "/auth/login",
      headers: {
        ...originHeaders(),
        cookie: `clinic_device=${deviceCookie}`
      },
      payload: {
        profileId: bootstrap.profile.id,
        pin: "123456"
      }
    });
    const sessionCookie = cookieValue(loginResponse, "clinic_session");
    expect(sessionCookie).toBeTruthy();

    const devicesResponse = await deviceApp.inject({
      method: "GET",
      url: "/devices",
      headers: {
        cookie: `clinic_device=${deviceCookie}; clinic_session=${sessionCookie}`
      }
    });
    expect(devicesResponse.statusCode).toBe(200);
    const [device] = devicesResponse.json<Array<{ id: string }>>();

    const revokeResponse = await deviceApp.inject({
      method: "POST",
      url: `/devices/${device.id}/revoke`,
      headers: {
        ...originHeaders(),
        cookie: `clinic_device=${deviceCookie}; clinic_session=${sessionCookie}`
      }
    });
    expect(revokeResponse.statusCode).toBe(200);

    const denied = await deviceApp.inject({
      method: "GET",
      url: "/auth/whoami",
      headers: {
        cookie: `clinic_device=${deviceCookie}; clinic_session=${sessionCookie}`
      }
    });
    expect(denied.statusCode).toBe(401);

    const authState = await deviceApp.inject({
      method: "GET",
      url: "/auth/state",
      headers: {
        cookie: `clinic_device=${deviceCookie}`
      }
    });
    expect(authState.statusCode).toBe(200);
    expect(authState.json<{ needsEnrollment: boolean; deviceIssue: string | null }>().needsEnrollment).toBe(true);
    expect(authState.json<{ needsEnrollment: boolean; deviceIssue: string | null }>().deviceIssue).toBe("revoked");

    await deviceApp.close();
  });

  it("rejects unsigned requests and accepts signed requests in trusted proxy mode", async () => {
    const sharedSecret = "test-shared-secret";
    const fixedNow = new Date("2026-03-27T15:30:00.000Z");
    const proxyRepository = new MemoryClinicRepository();
    const service = new ClinicApiService(proxyRepository, new LocalApprovedDocumentPublisher(), {
      authMode: "trusted_proxy",
      integrationMode: "stub",
      microsoftPreflight: {
        getMissingConfigKeys: () => [],
        validate: async () => ({
          mode: "stub",
          configComplete: true,
          overallStatus: "ready",
          readyForLive: true,
          missingConfigKeys: [],
          surfaces: []
        })
      }
    });
    const proxyApp = buildApp({
      authMode: "trusted_proxy",
      service,
      repository: proxyRepository,
      identityResolver: buildIdentityResolver({
        mode: "trusted_proxy",
        sharedSecret,
        allowedSkewSeconds: 60,
        now: () => fixedNow
      })
    });

    const rejected = await proxyApp.inject({
      method: "GET",
      url: "/auth/whoami",
      headers: headers("medical_director")
    });
    expect(rejected.statusCode).toBe(401);

    const accepted = await proxyApp.inject({
      method: "GET",
      url: "/auth/whoami",
      headers: signedHeaders({
        role: "medical_director",
        timestamp: fixedNow.toISOString(),
        method: "GET",
        path: "/auth/whoami",
        sharedSecret
      })
    });

    expect(accepted.statusCode).toBe(200);
    expect(accepted.json<{ authMode: string }>().authMode).toBe("trusted_proxy");

    await proxyApp.close();
  });

  it("creates incidents, opens linked CAPAs, and closes both through the quality workflow", async () => {
    const incidentResponse = await app.inject({
      method: "POST",
      url: "/incidents",
      headers: headers("quality_lead"),
      payload: {
        title: "Temperature log variance",
        severity: "high",
        category: "environment",
        summary: "Vaccine refrigerator log showed an unexplained temperature gap.",
        immediateResponse: "Quarantined the affected range pending review.",
        ownerRole: "quality_lead",
        dueDate: "2026-04-10"
      }
    });

    expect(incidentResponse.statusCode).toBe(200);
    const incident = incidentResponse.json<{ id: string; workflowRunId: string | null; reviewActionItemId: string | null }>();
    expect(incident.workflowRunId).toBeTruthy();
    expect(incident.reviewActionItemId).toBeTruthy();

    const reviewResponse = await app.inject({
      method: "POST",
      url: `/incidents/${incident.id}/review`,
      headers: headers("quality_lead"),
      payload: {
        decision: "open_capa",
        ownerRole: "quality_lead",
        dueDate: "2026-04-20",
        correctiveAction: "Reconcile the temperature log and document disposition of affected stock.",
        preventiveAction: "Add a second daily validation step for refrigerator logging.",
        verificationPlan: "Quality lead audits the next 10 days of log entries."
      }
    });

    expect(reviewResponse.statusCode).toBe(200);
    const reviewed = reviewResponse.json<{ incident: { status: string; linkedCapaId: string | null }; capa: { id: string } | null }>();
    expect(reviewed.incident.status).toBe("capa_open");
    expect(reviewed.incident.linkedCapaId).toBeTruthy();
    expect(reviewed.capa?.id).toBeTruthy();

    const closeCapaResponse = await app.inject({
      method: "POST",
      url: `/capas/${reviewed.capa!.id}/resolve`,
      headers: headers("quality_lead"),
      payload: {
        decision: "close",
        notes: "Corrective action verified and preventive controls are in place."
      }
    });

    expect(closeCapaResponse.statusCode).toBe(200);
    expect(closeCapaResponse.json<{ status: string }>().status).toBe("closed");

    const incidentList = await app.inject({
      method: "GET",
      url: "/incidents",
      headers: headers("quality_lead")
    });
    expect(incidentList.statusCode).toBe(200);
    expect(incidentList.json<Array<{ id: string; status: string }>>().find((item) => item.id === incident.id)?.status).toBe("closed");

    const capaList = await app.inject({
      method: "GET",
      url: "/capas",
      headers: headers("quality_lead")
    });
    expect(capaList.statusCode).toBe(200);
    expect(capaList.json<Array<{ id: string; status: string }>>().find((item) => item.id === reviewed.capa!.id)?.status).toBe("closed");
  });
});
