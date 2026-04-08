import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import {
  createAuditEvent,
  createDeviceEnrollmentCode,
  createDeviceSession,
  createEnrolledDevice,
  createUserProfile,
  createWorkerJob
} from "@clinic-os/domain";
import { getRuntimeAgentById } from "@clinic-os/agents";
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
  let service: ClinicApiService;

  beforeEach(() => {
    repository = new MemoryClinicRepository();
    service = new ClinicApiService(repository, new LocalApprovedDocumentPublisher(), {
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

  it("routes a public asset through claims review, human approval, and controlled publication", async () => {
    const createResponse = await app.inject({
      method: "POST",
      url: "/public-assets",
      headers: headers("quality_lead"),
      payload: {
        title: "Weight-management landing page refresh",
        assetType: "landing_page",
        ownerRole: "quality_lead",
        serviceLine: "weight_management",
        audience: "Prospective patients",
        channelLabel: "Website",
        summary: "Refresh the service-line landing page and route every claim through review.",
        body: "# Draft\n\nA physician-led weight-management program with individualized plans.",
        claims: [
          { claimText: "Physician-led weight-management program" },
          { claimText: "Individualized plans" }
        ]
      }
    });

    expect(createResponse.statusCode).toBe(200);
    const created = createResponse.json<{ id: string; documentId: string | null }>();
    expect(created.documentId).toBeTruthy();

    const createdAsset = repository.publicAssets.find((asset) => asset.id === created.id);
    expect(createdAsset?.claims).toHaveLength(2);

    const claimsReview = await app.inject({
      method: "POST",
      url: `/public-assets/${created.id}/review-claims`,
      headers: headers("quality_lead"),
      payload: {
        claimDecisions: createdAsset!.claims.map((claim) => ({
          claimId: claim.id,
          decision: "approved"
        })),
        overallNotes: "Claims match approved service descriptions."
      }
    });

    expect(claimsReview.statusCode).toBe(200);
    expect(claimsReview.json<{ claimsReviewStatus: string; status: string }>().claimsReviewStatus).toBe("completed");
    expect(claimsReview.json<{ claimsReviewStatus: string; status: string }>().status).toBe("claims_reviewed");

    const submit = await app.inject({
      method: "POST",
      url: `/public-assets/${created.id}/submit`,
      headers: headers("quality_lead")
    });

    expect(submit.statusCode).toBe(200);
    expect(submit.json<{ approvals: Array<{ reviewerRole: string }> }>().approvals).toHaveLength(2);
    expect(repository.publicAssets.find((asset) => asset.id === created.id)?.status).toBe("approval_pending");

    const medApproval = repository.approvals.find((approval) =>
      approval.targetId === created.documentId && approval.reviewerRole === "medical_director"
    );
    const cfoApproval = repository.approvals.find((approval) =>
      approval.targetId === created.documentId && approval.reviewerRole === "cfo"
    );

    expect(medApproval).toBeDefined();
    expect(cfoApproval).toBeDefined();

    const firstDecision = await app.inject({
      method: "POST",
      url: `/approvals/${medApproval!.id}/decide`,
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
    expect(repository.publicAssets.find((asset) => asset.id === created.id)?.status).toBe("approved");

    const publish = await app.inject({
      method: "POST",
      url: `/public-assets/${created.id}/publish`,
      headers: headers("medical_director")
    });
    expect(publish.statusCode).toBe(200);
    expect(publish.json<{ status: string }>().status).toBe("publish_pending");

    const runner = new WorkerJobRunner(repository, buildMicrosoftPilotOps({ mode: "stub" }));
    const summary = await runner.runOnce();
    expect(summary.succeeded).toBeGreaterThanOrEqual(1);

    const published = repository.publicAssets.find((asset) => asset.id === created.id);
    expect(published?.status).toBe("published");
    expect(published?.publishedPath).toBeTruthy();
  });

  it("schedules a QAPI committee meeting, routes the packet for approval, and records follow-up decisions", async () => {
    const bootstrap = await app.inject({
      method: "POST",
      url: "/committees/bootstrap-defaults",
      headers: headers("quality_lead")
    });
    expect(bootstrap.statusCode).toBe(200);

    const qapiCommittee = repository.committees.find((committee) => committee.category === "qapi");
    expect(qapiCommittee).toBeDefined();

    const createMeeting = await app.inject({
      method: "POST",
      url: "/committee-meetings",
      headers: headers("quality_lead"),
      payload: {
        committeeId: qapiCommittee!.id,
        scheduledFor: "2026-04-20T14:00:00.000Z",
        notes: "Review recurring incident themes and overdue CAPAs.",
        qapiSummaryNote: "Emphasize repeated operational exceptions.",
        agendaItems: [
          {
            title: "Incident trends",
            ownerRole: "quality_lead",
            summary: "Review incident patterns from the last 30 days."
          },
          {
            title: "CAPA follow-through",
            ownerRole: "medical_director",
            summary: "Confirm verification steps for overdue CAPAs.",
            dueDate: "2026-04-25T00:00:00.000Z"
          }
        ]
      }
    });
    expect(createMeeting.statusCode).toBe(200);
    const meeting = createMeeting.json<{ id: string; status: string; qapiSnapshot: { openIncidents: number } | null }>();
    expect(meeting.status).toBe("planned");
    expect(meeting.qapiSnapshot).not.toBeNull();

    const generatePacket = await app.inject({
      method: "POST",
      url: `/committee-meetings/${meeting.id}/generate-packet`,
      headers: headers("quality_lead")
    });
    expect(generatePacket.statusCode).toBe(200);
    expect(generatePacket.json<{ committeeMeeting: { status: string }; document: { artifactType: string } }>().committeeMeeting.status).toBe("packet_ready");
    expect(generatePacket.json<{ committeeMeeting: { status: string }; document: { artifactType: string } }>().document.artifactType).toBe("qapi_committee_packet");

    const submitPacket = await app.inject({
      method: "POST",
      url: `/committee-meetings/${meeting.id}/submit`,
      headers: headers("quality_lead")
    });
    expect(submitPacket.statusCode).toBe(200);
    const approvalDocumentId = submitPacket.json<{ document: { id: string } }>().document.id;

    const medicalDirectorApproval = repository.approvals.find((approval) =>
      approval.targetId === approvalDocumentId && approval.reviewerRole === "medical_director"
    );
    const physicianApproval = repository.approvals.find((approval) =>
      approval.targetId === approvalDocumentId && approval.reviewerRole === "patient_care_team_physician"
    );
    expect(medicalDirectorApproval).toBeDefined();
    expect(physicianApproval).toBeDefined();

    const firstApproval = await app.inject({
      method: "POST",
      url: `/approvals/${medicalDirectorApproval!.id}/decide`,
      headers: headers("medical_director"),
      payload: { decision: "approved" }
    });
    expect(firstApproval.statusCode).toBe(200);

    const secondApproval = await app.inject({
      method: "POST",
      url: `/approvals/${physicianApproval!.id}/decide`,
      headers: headers("patient_care_team_physician")
      ,
      payload: { decision: "approved" }
    });
    expect(secondApproval.statusCode).toBe(200);
    expect(repository.committeeMeetings.find((record) => record.id === meeting.id)?.status).toBe("approved");

    const decisionResponse = await app.inject({
      method: "POST",
      url: `/committee-meetings/${meeting.id}/record-decisions`,
      headers: headers("medical_director"),
      payload: {
        decisions: [
          {
            summary: "Assign CAPA verification follow-up.",
            ownerRole: "quality_lead",
            dueDate: "2026-04-28T00:00:00.000Z",
            notes: "Return with verification evidence at the next QAPI review."
          }
        ]
      }
    });
    expect(decisionResponse.statusCode).toBe(200);
    expect(decisionResponse.json<{ decisions: Array<{ actionItemId: string | null }> }>().decisions[0]?.actionItemId).toBeTruthy();

    const completeMeeting = await app.inject({
      method: "POST",
      url: `/committee-meetings/${meeting.id}/complete`,
      headers: headers("medical_director"),
      payload: {
        notes: "Meeting completed with follow-up assigned."
      }
    });
    expect(completeMeeting.statusCode).toBe(200);
    expect(completeMeeting.json<{ status: string }>().status).toBe("completed");
    expect(repository.actionItems.some((item) => item.title.includes("Assign CAPA verification follow-up."))).toBe(true);
  });

  it("returns a QAPI dashboard summary with governance metrics", async () => {
    await app.inject({
      method: "POST",
      url: "/practice-agreements/bootstrap-defaults",
      headers: headers("medical_director")
    });

    await app.inject({
      method: "POST",
      url: "/controlled-substances/bootstrap-defaults",
      headers: headers("medical_director")
    });

    await app.inject({
      method: "POST",
      url: "/standards/bootstrap-defaults",
      headers: headers("quality_lead")
    });

    const response = await app.inject({
      method: "GET",
      url: "/committees/qapi-summary",
      headers: headers("quality_lead")
    });

    expect(response.statusCode).toBe(200);
    const summary = response.json<{
      openIncidents: number;
      openCapas: number;
      standardsAttentionNeeded: number;
      overdueStandardsReviews: number;
      evidenceBindersDraft: number;
      controlledSubstancePacketsPublished: number;
      telehealthPacketsNeedingReview: number;
      practiceAgreementsExpiringSoon: number;
    }>();
    expect(summary.openIncidents).toBeGreaterThanOrEqual(0);
    expect(summary.openCapas).toBeGreaterThanOrEqual(0);
    expect(summary.standardsAttentionNeeded).toBeGreaterThanOrEqual(0);
    expect(summary.overdueStandardsReviews).toBeGreaterThanOrEqual(0);
    expect(summary.evidenceBindersDraft).toBeGreaterThanOrEqual(0);
    expect(summary.controlledSubstancePacketsPublished).toBeGreaterThanOrEqual(0);
    expect(summary.telehealthPacketsNeedingReview).toBeGreaterThanOrEqual(0);
    expect(summary.practiceAgreementsExpiringSoon).toBeGreaterThanOrEqual(0);
  });

  it("manages revenue governance records and includes them in revenue committee packets", async () => {
    const bootstrapCommittees = await app.inject({
      method: "POST",
      url: "/committees/bootstrap-defaults",
      headers: headers("quality_lead")
    });
    expect(bootstrapCommittees.statusCode).toBe(200);

    const bootstrapServiceLines = await app.inject({
      method: "POST",
      url: "/service-lines/bootstrap-defaults",
      headers: headers("medical_director")
    });
    expect(bootstrapServiceLines.statusCode).toBe(200);

    const revenueCommittee = repository.committees.find((committee) => committee.category === "revenue_commercial");
    expect(revenueCommittee).toBeDefined();

    const payerIssueResponse = await app.inject({
      method: "POST",
      url: "/payer-issues",
      headers: headers("cfo"),
      payload: {
        title: "Telehealth reimbursement ambiguity",
        payerName: "Regional Commercial Plan",
        issueType: "coverage_policy",
        serviceLineId: "telehealth",
        ownerRole: "cfo",
        summary: "Clarify reimbursement posture for telehealth follow-up bundles before the next campaign launches.",
        financialImpactSummary: "Potential reimbursement leakage if commercial policy language stays unresolved.",
        dueDate: "2026-04-20T00:00:00.000Z"
      }
    });
    expect(payerIssueResponse.statusCode).toBe(200);
    const payerIssue = payerIssueResponse.json<{ id: string; actionItemId: string | null; status: string }>();
    expect(payerIssue.actionItemId).toBeNull();

    const escalatedIssue = await app.inject({
      method: "PATCH",
      url: `/payer-issues/${payerIssue.id}`,
      headers: headers("cfo"),
      payload: {
        status: "escalated"
      }
    });
    expect(escalatedIssue.statusCode).toBe(200);
    const escalatedBody = escalatedIssue.json<{ actionItemId: string | null; status: string }>();
    expect(escalatedBody.status).toBe("escalated");
    expect(escalatedBody.actionItemId).toBeTruthy();
    expect(repository.actionItems.find((item) => item.id === escalatedBody.actionItemId)).toBeDefined();

    const pricingResponse = await app.inject({
      method: "POST",
      url: "/pricing-governance",
      headers: headers("cfo"),
      payload: {
        title: "Telehealth pricing governance",
        serviceLineId: "telehealth",
        ownerRole: "cfo",
        pricingSummary: "Define telehealth pricing tiers and bundled follow-up boundaries.",
        marginGuardrailsSummary: "Maintain target gross margin guardrails unless a documented exception is approved.",
        discountGuardrailsSummary: "Limit discounts to approved campaigns and documented retention workflows.",
        payerAlignmentSummary: "Align self-pay rules with current payer coverage posture.",
        claimsConstraintSummary: "Do not promise reimbursement outcomes or unsupported clinical benefits.",
        reviewDueAt: "2026-07-01T00:00:00.000Z"
      }
    });
    expect(pricingResponse.statusCode).toBe(200);
    const pricing = pricingResponse.json<{
      pricingGovernance: { id: string; status: string };
      document: { id: string };
    }>();

    const submitPricing = await app.inject({
      method: "POST",
      url: `/pricing-governance/${pricing.pricingGovernance.id}/submit`,
      headers: headers("cfo")
    });
    expect(submitPricing.statusCode).toBe(200);
    const submitBody = submitPricing.json<{ approvals: Array<{ id: string; reviewerRole: string }> }>();
    expect(submitBody.approvals).toHaveLength(2);

    const medApproval = submitBody.approvals.find((approval) => approval.reviewerRole === "medical_director");
    const cfoApproval = submitBody.approvals.find((approval) => approval.reviewerRole === "cfo");
    expect(medApproval).toBeDefined();
    expect(cfoApproval).toBeDefined();

    const cfoDecision = await app.inject({
      method: "POST",
      url: `/approvals/${cfoApproval!.id}/decide`,
      headers: headers("cfo"),
      payload: { decision: "approved" }
    });
    expect(cfoDecision.statusCode).toBe(200);

    const medDecision = await app.inject({
      method: "POST",
      url: `/approvals/${medApproval!.id}/decide`,
      headers: headers("medical_director"),
      payload: { decision: "approved" }
    });
    expect(medDecision.statusCode).toBe(200);

    const publishPricing = await app.inject({
      method: "POST",
      url: `/pricing-governance/${pricing.pricingGovernance.id}/publish`,
      headers: headers("medical_director")
    });
    expect(publishPricing.statusCode).toBe(200);
    expect(publishPricing.json<{ status: string }>().status).toBe("publish_pending");

    const runner = new WorkerJobRunner(repository, buildMicrosoftPilotOps({ mode: "stub" }));
    const workerSummary = await runner.runOnce();
    expect(workerSummary.succeeded).toBeGreaterThanOrEqual(1);
    expect(repository.pricingGovernanceRecords.find((record) => record.id === pricing.pricingGovernance.id)?.status).toBe("published");

    const revenueReviewResponse = await app.inject({
      method: "POST",
      url: "/revenue-reviews",
      headers: headers("cfo"),
      payload: {
        title: "April revenue review",
        ownerRole: "cfo",
        serviceLineId: "telehealth",
        reviewWindowLabel: "April 2026",
        targetReviewDate: "2026-04-30T00:00:00.000Z",
        summaryNote: "Review payer friction, pricing posture, and commercial readiness together."
      }
    });
    expect(revenueReviewResponse.statusCode).toBe(200);
    const revenueReview = revenueReviewResponse.json<{ id: string; snapshot: { openPayerIssues: number; escalatedPayerIssues: number } }>();
    expect(revenueReview.snapshot.openPayerIssues).toBeGreaterThanOrEqual(1);
    expect(revenueReview.snapshot.escalatedPayerIssues).toBeGreaterThanOrEqual(1);

    const summaryResponse = await app.inject({
      method: "GET",
      url: "/revenue/summary?serviceLineId=telehealth",
      headers: headers("medical_director")
    });
    expect(summaryResponse.statusCode).toBe(200);
    expect(summaryResponse.json<{ openPayerIssues: number; pricingPendingApproval: number }>().openPayerIssues).toBeGreaterThanOrEqual(1);

    const createMeeting = await app.inject({
      method: "POST",
      url: "/committee-meetings",
      headers: headers("cfo"),
      payload: {
        committeeId: revenueCommittee!.id,
        scheduledFor: "2026-04-21T15:00:00.000Z",
        notes: "Review commercial readiness.",
        agendaItems: [
          {
            title: "Payer escalation follow-up",
            ownerRole: "cfo",
            summary: "Confirm next payer follow-up and timeline."
          },
          {
            title: "Pricing governance review",
            ownerRole: "medical_director",
            summary: "Confirm pricing governance and claims constraints are aligned."
          }
        ]
      }
    });
    expect(createMeeting.statusCode).toBe(200);
    const meeting = createMeeting.json<{ id: string }>();

    const generatePacket = await app.inject({
      method: "POST",
      url: `/committee-meetings/${meeting.id}/generate-packet`,
      headers: headers("cfo")
    });
    expect(generatePacket.statusCode).toBe(200);
    const packet = generatePacket.json<{ document: { id: string } }>();
    expect(repository.documents.find((document) => document.id === packet.document.id)?.body).toContain("Revenue / Commercial Snapshot");

    const forbiddenManage = await app.inject({
      method: "POST",
      url: "/payer-issues",
      headers: headers("hr_lead"),
      payload: {
        title: "Blocked attempt",
        payerName: "Payer",
        issueType: "other",
        ownerRole: "hr_lead",
        summary: "This should not be allowed."
      }
    });
    expect(forbiddenManage.statusCode).toBe(403);
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

  it("can run one worker batch on demand through the operator endpoint", async () => {
    const runRepository = new MemoryClinicRepository();
    const runService = new ClinicApiService(runRepository, new LocalApprovedDocumentPublisher(), {
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
    const runApp = buildApp({
      authMode: "dev_headers",
      service: runService,
      repository: runRepository,
      databaseReadyCheck: async () => true
    });

    runRepository.workerJobs.push(createWorkerJob({
      type: "teams.notification",
      payload: {
        actor: {
          actorId: "quality-lead",
          role: "quality_lead",
          name: "Quality Lead"
        },
        title: "Smoke notification",
        body: "Smoke notification body"
      },
      sourceEntityType: "worker_job",
      sourceEntityId: "smoke-job"
    }));

    const response = await runApp.inject({
      method: "POST",
      url: "/worker-jobs/run-once",
      headers: headers("medical_director")
    });

    expect(response.statusCode).toBe(200);
    expect(response.json<{ summary: { processed: number; succeeded: number; failed: number } }>().summary).toEqual({
      processed: 1,
      succeeded: 1,
      failed: 0
    });
    expect(runRepository.workerJobs[0]?.status).toBe("succeeded");
    expect(runRepository.auditEvents.some((event) => event.eventType === "worker.batch_run_requested")).toBe(true);

    await runApp.close();
  });

  it("lists runtime agents and runs them for authorized roles", async () => {
    vi.spyOn(service, "getRuntimeAgentStatus").mockReturnValue({
      enabled: true,
      reason: null,
      agents: [getRuntimeAgentById("office_manager_copilot")!]
    });

    vi.spyOn(service, "runRuntimeAgent").mockResolvedValue({
      agent: getRuntimeAgentById("office_manager_copilot")!,
      requestId: "req_runtime_agent",
      workflowId: "office_manager_daily",
      responseId: "resp_runtime_agent",
      startedAt: "2026-04-08T00:00:00.000Z",
      completedAt: "2026-04-08T00:00:01.000Z",
      finalText: "Created a follow-up action item.",
      toolCalls: [
        {
          callId: "call_action_item",
          name: "create_action_item",
          arguments: {
            title: "Follow up",
            ownerRole: "office_manager",
            dueDate: "2026-04-09"
          },
          status: "completed",
          output: {
            status: "action_item_created"
          },
          error: null
        }
      ],
      requiresApproval: false,
      reviewerRoles: ["office_manager", "medical_director"]
    });

    const listResponse = await app.inject({
      method: "GET",
      url: "/runtime-agents",
      headers: headers("medical_director")
    });

    expect(listResponse.statusCode).toBe(200);
    expect(listResponse.json<{ agents: Array<{ id: string }> }>().agents[0]?.id).toBe("office_manager_copilot");

    const runResponse = await app.inject({
      method: "POST",
      url: "/runtime-agents/run",
      headers: headers("medical_director"),
      payload: {
        agentId: "office_manager_copilot",
        payload: {
          objective: "Create a follow-up action item."
        }
      }
    });

    expect(runResponse.statusCode).toBe(200);
    expect(runResponse.json<{ responseId: string }>().responseId).toBe("resp_runtime_agent");
  });

  it("blocks runtime-agent routes for roles without the required capability", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/runtime-agents",
      headers: headers("front_desk")
    });

    expect(response.statusCode).toBe(403);
  });

  it("reports runtime agents as disabled when the API key exists but rollout is turned off", async () => {
    const runtimeRepository = new MemoryClinicRepository();
    const runtimeService = new ClinicApiService(runtimeRepository, new LocalApprovedDocumentPublisher(), {
      authMode: "dev_headers",
      integrationMode: "stub",
      openaiApiKey: "present-for-status-check",
      runtimeAgentsEnabled: false,
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
    const runtimeApp = buildApp({
      authMode: "dev_headers",
      service: runtimeService,
      repository: runtimeRepository
    });

    const response = await runtimeApp.inject({
      method: "GET",
      url: "/runtime-agents",
      headers: headers("medical_director")
    });

    expect(response.statusCode).toBe(200);
    expect(response.json<{ enabled: boolean; reason: string | null }>().enabled).toBe(false);
    expect(response.json<{ enabled: boolean; reason: string | null }>().reason).toContain("disabled by configuration");

    await runtimeApp.close();
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

  it("reports worker heartbeat, recent batch state, and queued-job age through ops surfaces", async () => {
    const runtimeRepository = new MemoryClinicRepository();
    const runtimeService = new ClinicApiService(runtimeRepository, new LocalApprovedDocumentPublisher(), {
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
    const runtimeApp = buildApp({
      authMode: "dev_headers",
      service: runtimeService,
      repository: runtimeRepository,
      databaseReadyCheck: async () => true
    });

    const now = Date.now();
    runtimeRepository.workerJobs.push(
      {
        ...createWorkerJob({
          type: "lists.issue.upsert",
          payload: { smoke: true },
          scheduledAt: new Date(now - 18 * 60_000).toISOString()
        }),
        updatedAt: new Date(now - 18 * 60_000).toISOString()
      },
      {
        ...createWorkerJob({
          type: "planner.task.create",
          payload: { smoke: true },
          scheduledAt: new Date(now - 6 * 60_000).toISOString()
        }),
        status: "processing",
        lockedAt: new Date(now - 3 * 60_000).toISOString(),
        attempts: 1,
        updatedAt: new Date(now - 3 * 60_000).toISOString()
      }
    );
    runtimeRepository.auditEvents.push(
      {
        ...createAuditEvent({
          eventType: "worker.started",
          entityType: "worker_runtime",
          entityId: "clinic-os-worker",
          actorId: "clinic-os-worker",
          actorRole: "office_manager",
          actorName: "Clinic OS Worker",
          payload: {
            pollIntervalMs: 5000,
            heartbeatIntervalMs: 300000,
            batchSize: 10
          }
        }),
        createdAt: new Date(now - 30 * 60_000).toISOString()
      },
      {
        ...createAuditEvent({
          eventType: "worker.batch.completed",
          entityType: "worker_runtime",
          entityId: "clinic-os-worker",
          actorId: "clinic-os-worker",
          actorRole: "office_manager",
          actorName: "Clinic OS Worker",
          payload: {
            summary: {
              processed: 3,
              succeeded: 3,
              failed: 0
            }
          }
        }),
        createdAt: new Date(now - 20 * 60_000).toISOString()
      }
    );

    const workerHealth = await runtimeApp.inject({
      method: "GET",
      url: "/ops/worker-health",
      headers: headers("medical_director")
    });

    expect(workerHealth.statusCode).toBe(200);
    const workerHealthBody = workerHealth.json<{
      health: string;
      thresholds: {
        stalledHeartbeatMinutes: number;
        staleProcessingMinutes: number;
      };
      lastCompletedBatch: { processed: number } | null;
      backlog: {
        queued: number;
        processing: number;
        oldestQueuedType: string | null;
        oldestQueuedMinutes: number | null;
      };
    }>();
    expect(workerHealthBody.health).toBe("critical");
    expect(workerHealthBody.thresholds.stalledHeartbeatMinutes).toBeGreaterThanOrEqual(2);
    expect(workerHealthBody.thresholds.staleProcessingMinutes).toBeGreaterThanOrEqual(15);
    expect(workerHealthBody.lastCompletedBatch?.processed).toBe(3);
    expect(workerHealthBody.backlog.queued).toBe(1);
    expect(workerHealthBody.backlog.processing).toBe(1);
    expect(workerHealthBody.backlog.oldestQueuedType).toBe("lists.issue.upsert");
    expect(workerHealthBody.backlog.oldestQueuedMinutes).toBeGreaterThanOrEqual(15);

    const alerts = await runtimeApp.inject({
      method: "GET",
      url: "/ops/alerts",
      headers: headers("medical_director")
    });
    expect(alerts.statusCode).toBe(200);
    expect(alerts.json<{ alerts: Array<{ key: string }> }>().alerts.map((alert) => alert.key)).toEqual(
      expect.arrayContaining(["worker.heartbeat_stalled"])
    );

    await runtimeApp.close();
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

  it("bootstraps service lines, routes a governance pack through approval, and publishes it", async () => {
    const bootstrapResponse = await app.inject({
      method: "POST",
      url: "/service-lines/bootstrap-defaults",
      headers: headers("medical_director")
    });

    expect(bootstrapResponse.statusCode).toBe(200);
    const bootstrap = bootstrapResponse.json<{ created: Array<{ id: string }>; existing: Array<{ id: string }> }>();
    expect(bootstrap.created.length + bootstrap.existing.length).toBeGreaterThanOrEqual(11);

    const generateResponse = await app.inject({
      method: "POST",
      url: "/service-lines/weight_management/generate-pack",
      headers: headers("medical_director"),
      payload: {
        ownerRole: "medical_director",
        charterSummary: "Weight management services are governed through documented scope, owner accountability, and explicit patient selection boundaries.",
        inclusionExclusionRules: "Adults seeking physician-led weight management may enroll, while unstable patients are escalated before care starts.",
        roleMatrixSummary: "Medical director owns protocols, NPs execute under approved guidance, and support staff escalate exceptions immediately.",
        competencyRequirements: "Initial onboarding, prescribing competency sign-off, and quarterly refreshers are required for all participating staff.",
        auditToolSummary: "Monthly chart audits review enrollment appropriateness, informed consent, and follow-up completion.",
        emergencyEscalation: "Acute symptoms, medication complications, or unexpected deterioration route to physician review the same day.",
        pricingModelSummary: "Pricing changes require CFO review, approved discount guardrails, and documented package boundaries.",
        claimsGovernanceSummary: "All public claims are inventoried, tied to approved evidence, and reviewed before publication.",
        notes: "Pilot governance pack for the weight-management service line."
      }
    });

    expect(generateResponse.statusCode).toBe(200);
    const generated = generateResponse.json<{
      serviceLine: { id: string; governanceStatus: string; latestPackId: string | null };
      pack: { id: string; status: string; documentId: string | null; workflowRunId: string | null };
      document: { id: string; status: string; artifactType: string };
    }>();
    expect(generated.serviceLine.id).toBe("weight_management");
    expect(generated.serviceLine.governanceStatus).toBe("drafting");
    expect(generated.pack.status).toBe("draft");
    expect(generated.pack.documentId).toBeTruthy();
    expect(generated.pack.workflowRunId).toBeTruthy();
    expect(generated.document.artifactType).toBe("service_line_pack");

    const submitResponse = await app.inject({
      method: "POST",
      url: "/service-lines/weight_management/submit-pack",
      headers: headers("medical_director")
    });

    expect(submitResponse.statusCode).toBe(200);
    const submitted = submitResponse.json<{
      serviceLine: { governanceStatus: string };
      pack: { id: string; status: string; documentId: string | null };
      document: { id: string; status: string };
      approvals: Array<{ id: string; reviewerRole: string }>;
    }>();
    expect(submitted.serviceLine.governanceStatus).toBe("review_pending");
    expect(submitted.pack.status).toBe("approval_pending");
    expect(submitted.document.status).toBe("in_review");
    expect(submitted.approvals.map((approval) => approval.reviewerRole).sort()).toEqual([
      "medical_director",
      "patient_care_team_physician"
    ]);

    for (const approval of submitted.approvals) {
      const reviewerRole = approval.reviewerRole === "patient_care_team_physician"
        ? "patient_care_team_physician"
        : "medical_director";
      const decision = await app.inject({
        method: "POST",
        url: `/approvals/${approval.id}/decide`,
        headers: headers(reviewerRole),
        payload: { decision: "approved" }
      });
      expect(decision.statusCode).toBe(200);
    }

    const approvedListResponse = await app.inject({
      method: "GET",
      url: "/service-lines",
      headers: headers("medical_director")
    });
    expect(approvedListResponse.statusCode).toBe(200);
    const approvedLine = approvedListResponse
      .json<Array<{ serviceLine: { id: string; governanceStatus: string }; latestPack: { status: string } | null }>>()
      .find((row) => row.serviceLine.id === "weight_management");
    expect(approvedLine?.serviceLine.governanceStatus).toBe("approved");
    expect(approvedLine?.latestPack?.status).toBe("approved");

    const publishResponse = await app.inject({
      method: "POST",
      url: "/service-lines/weight_management/publish-pack",
      headers: headers("medical_director")
    });

    expect(publishResponse.statusCode).toBe(200);
    expect(publishResponse.json<{ pack: { status: string } }>().pack.status).toBe("publish_pending");

    const runner = new WorkerJobRunner(repository, buildMicrosoftPilotOps({ mode: "stub" }));
    const summary = await runner.runOnce();
    expect(summary.succeeded).toBeGreaterThanOrEqual(1);

    const publishedLineResponse = await app.inject({
      method: "GET",
      url: "/service-lines",
      headers: headers("medical_director")
    });
    const publishedLine = publishedLineResponse
      .json<Array<{ serviceLine: { id: string; governanceStatus: string; latestPackId: string | null }; latestPack: { id: string; status: string; publishedPath: string | null } | null }>>()
      .find((row) => row.serviceLine.id === "weight_management");
    expect(publishedLine?.serviceLine.governanceStatus).toBe("published");
    expect(publishedLine?.latestPack?.status).toBe("published");
    expect(publishedLine?.latestPack?.publishedPath).toContain(generated.document.id);
  });

  it("bootstraps delegation rules, evaluates task permissions, and lets managers retire a rule", async () => {
    const serviceLineBootstrap = await app.inject({
      method: "POST",
      url: "/service-lines/bootstrap-defaults",
      headers: headers("medical_director")
    });
    expect(serviceLineBootstrap.statusCode).toBe(200);

    const bootstrapResponse = await app.inject({
      method: "POST",
      url: "/delegation-rules/bootstrap-defaults",
      headers: headers("medical_director")
    });
    expect(bootstrapResponse.statusCode).toBe(200);
    const bootstrap = bootstrapResponse.json<{
      created: Array<{ id: string }>;
      existing: Array<{ id: string }>;
    }>();
    expect(bootstrap.created.length + bootstrap.existing.length).toBeGreaterThanOrEqual(8);

    const listResponse = await app.inject({
      method: "GET",
      url: "/delegation-rules?serviceLineId=weight_management",
      headers: headers("office_manager")
    });
    expect(listResponse.statusCode).toBe(200);
    const weightManagementRules = listResponse.json<Array<{
      id: string;
      taskCode: string;
      performerRole: string;
      status: string;
    }>>();
    const intakeRule = weightManagementRules.find((rule) => rule.taskCode === "weigh_in_and_screen" && rule.performerRole === "medical_assistant");
    expect(intakeRule).toBeTruthy();

    const allowedEvaluation = await app.inject({
      method: "POST",
      url: "/delegation-rules/evaluate",
      headers: headers("medical_assistant"),
      payload: {
        serviceLineId: "weight_management",
        taskCode: "weigh_in_and_screen",
        performerRole: "medical_assistant"
      }
    });
    expect(allowedEvaluation.statusCode).toBe(200);
    expect(allowedEvaluation.json<{ allowed: boolean; matchedRule: { id: string } | null }>().allowed).toBe(true);
    expect(allowedEvaluation.json<{ allowed: boolean; matchedRule: { id: string } | null }>().matchedRule?.id).toBe(intakeRule?.id);

    const retireResponse = await app.inject({
      method: "PATCH",
      url: `/delegation-rules/${intakeRule!.id}`,
      headers: headers("quality_lead"),
      payload: {
        status: "retired",
        notes: "Paused pending physician review."
      }
    });
    expect(retireResponse.statusCode).toBe(200);
    expect(retireResponse.json<{ status: string }>().status).toBe("retired");

    const blockedEvaluation = await app.inject({
      method: "POST",
      url: "/delegation-rules/evaluate",
      headers: headers("medical_assistant"),
      payload: {
        serviceLineId: "weight_management",
        taskCode: "weigh_in_and_screen",
        performerRole: "medical_assistant"
      }
    });
    expect(blockedEvaluation.statusCode).toBe(200);
    expect(blockedEvaluation.json<{ allowed: boolean }>().allowed).toBe(false);

    const deniedCreate = await app.inject({
      method: "POST",
      url: "/delegation-rules",
      headers: headers("office_manager"),
      payload: {
        serviceLineId: "telehealth",
        taskCode: "virtual_triage",
        taskLabel: "Virtual triage script",
        performerRole: "front_desk",
        supervisingRole: "nurse_practitioner",
        supervisionLevel: "protocol",
        requiresCompetencyEvidence: true,
        requiresDocumentedOrder: false,
        requiresCosign: false,
        patientFacing: true,
        evidenceRequired: "Current call-flow competency."
      }
    });
    expect(deniedCreate.statusCode).toBe(403);
  });

  it("bootstraps practice agreements, routes them through approval, and publishes them", async () => {
    const bootstrapResponse = await app.inject({
      method: "POST",
      url: "/practice-agreements/bootstrap-defaults",
      headers: headers("medical_director")
    });

    expect(bootstrapResponse.statusCode).toBe(200);
    const bootstrap = bootstrapResponse.json<{ created: Array<{ id: string; title: string }>; existing: Array<{ id: string; title: string }> }>();
    expect(bootstrap.created.length + bootstrap.existing.length).toBeGreaterThanOrEqual(3);

    const listResponse = await app.inject({
      method: "GET",
      url: "/practice-agreements?serviceLineId=telehealth",
      headers: headers("patient_care_team_physician")
    });
    expect(listResponse.statusCode).toBe(200);
    const telehealthAgreement = listResponse
      .json<Array<{ id: string; title: string; status: string; documentId: string | null; notes: string | null }>>()
      .find((agreement) => agreement.title === "Telehealth physician oversight agreement");
    expect(telehealthAgreement).toBeTruthy();
    expect(telehealthAgreement?.status).toBe("draft");

    const updateResponse = await app.inject({
      method: "PATCH",
      url: `/practice-agreements/${telehealthAgreement!.id}`,
      headers: headers("medical_director"),
      payload: {
        notes: "Updated during API test.",
        cosignExpectation: "Physician cosign is required for new telehealth treatment plans, protocol exceptions, and charts selected for peer review."
      }
    });
    expect(updateResponse.statusCode).toBe(200);
    expect(updateResponse.json<{ practiceAgreement: { notes: string | null } }>().practiceAgreement.notes).toBe("Updated during API test.");

    const submitResponse = await app.inject({
      method: "POST",
      url: `/practice-agreements/${telehealthAgreement!.id}/submit`,
      headers: headers("medical_director")
    });
    expect(submitResponse.statusCode).toBe(200);
    const submitted = submitResponse.json<{
      practiceAgreement: { status: string; documentId: string | null };
      document: { id: string; status: string };
      approvals: Array<{ id: string; reviewerRole: string }>;
    }>();
    expect(submitted.practiceAgreement.status).toBe("approval_pending");
    expect(submitted.document.status).toBe("in_review");
    expect(submitted.approvals.map((approval) => approval.reviewerRole).sort()).toEqual([
      "medical_director",
      "patient_care_team_physician"
    ]);

    for (const approval of submitted.approvals) {
      const decision = await app.inject({
        method: "POST",
        url: `/approvals/${approval.id}/decide`,
        headers: headers(approval.reviewerRole as Parameters<typeof headers>[0]),
        payload: { decision: "approved" }
      });
      expect(decision.statusCode).toBe(200);
    }

    const publishResponse = await app.inject({
      method: "POST",
      url: `/practice-agreements/${telehealthAgreement!.id}/publish`,
      headers: headers("medical_director")
    });
    expect(publishResponse.statusCode).toBe(200);
    expect(publishResponse.json<{ practiceAgreement: { status: string } }>().practiceAgreement.status).toBe("publish_pending");

    const runner = new WorkerJobRunner(repository, buildMicrosoftPilotOps({ mode: "stub" }));
    const summary = await runner.runOnce();
    expect(summary.succeeded).toBeGreaterThanOrEqual(1);

    const publishedResponse = await app.inject({
      method: "GET",
      url: "/practice-agreements?serviceLineId=telehealth",
      headers: headers("medical_director")
    });
    expect(publishedResponse.statusCode).toBe(200);
    const published = publishedResponse
      .json<Array<{ id: string; status: string; publishedPath: string | null }>>()
      .find((agreement) => agreement.id === telehealthAgreement!.id);
    expect(published?.status).toBe("published");
    expect(published?.publishedPath).toContain(submitted.document.id);
  });

  it("bootstraps telehealth stewardship, routes it through approval, and publishes it", async () => {
    await app.inject({
      method: "POST",
      url: "/service-lines/bootstrap-defaults",
      headers: headers("medical_director")
    });
    await app.inject({
      method: "POST",
      url: "/practice-agreements/bootstrap-defaults",
      headers: headers("medical_director")
    });
    await app.inject({
      method: "POST",
      url: "/delegation-rules/bootstrap-defaults",
      headers: headers("medical_director")
    });

    const bootstrapResponse = await app.inject({
      method: "POST",
      url: "/telehealth-stewardship/bootstrap-defaults",
      headers: headers("medical_director")
    });
    expect(bootstrapResponse.statusCode).toBe(200);
    const bootstrap = bootstrapResponse.json<{ created: Array<{ id: string; title: string }>; existing: Array<{ id: string; title: string }> }>();
    expect(bootstrap.created.length + bootstrap.existing.length).toBeGreaterThan(0);

    const listResponse = await app.inject({
      method: "GET",
      url: "/telehealth-stewardship",
      headers: headers("patient_care_team_physician")
    });
    expect(listResponse.statusCode).toBe(200);
    const stewardship = listResponse
      .json<Array<{ id: string; title: string; status: string; documentId: string | null; delegatedTaskCodes: string[] }>>()
      .find((record) => record.title === "Telehealth stewardship packet");
    expect(stewardship).toBeTruthy();
    expect(stewardship?.status).toBe("draft");
    expect(stewardship?.delegatedTaskCodes.length).toBeGreaterThan(0);

    const updateResponse = await app.inject({
      method: "PATCH",
      url: `/telehealth-stewardship/${stewardship!.id}`,
      headers: headers("medical_director"),
      payload: {
        qaReviewSummary: "Updated during telehealth API test.",
        notes: "Telehealth test notes."
      }
    });
    expect(updateResponse.statusCode).toBe(200);
    expect(updateResponse.json<{ stewardship: { qaReviewSummary: string } }>().stewardship.qaReviewSummary).toBe("Updated during telehealth API test.");

    const submitResponse = await app.inject({
      method: "POST",
      url: `/telehealth-stewardship/${stewardship!.id}/submit`,
      headers: headers("medical_director")
    });
    expect(submitResponse.statusCode).toBe(200);
    const submitted = submitResponse.json<{
      stewardship: { status: string };
      document: { id: string; status: string };
      approvals: Array<{ id: string; reviewerRole: string }>;
    }>();
    expect(submitted.stewardship.status).toBe("approval_pending");
    expect(submitted.document.status).toBe("in_review");
    expect(submitted.approvals.map((approval) => approval.reviewerRole).sort()).toEqual([
      "medical_director",
      "patient_care_team_physician"
    ]);

    for (const approval of submitted.approvals) {
      const decision = await app.inject({
        method: "POST",
        url: `/approvals/${approval.id}/decide`,
        headers: headers(approval.reviewerRole as Parameters<typeof headers>[0]),
        payload: { decision: "approved" }
      });
      expect(decision.statusCode).toBe(200);
    }

    const publishResponse = await app.inject({
      method: "POST",
      url: `/telehealth-stewardship/${stewardship!.id}/publish`,
      headers: headers("medical_director")
    });
    expect(publishResponse.statusCode).toBe(200);
    expect(publishResponse.json<{ stewardship: { status: string } }>().stewardship.status).toBe("publish_pending");

    const runner = new WorkerJobRunner(repository, buildMicrosoftPilotOps({ mode: "stub" }));
    const summary = await runner.runOnce();
    expect(summary.succeeded).toBeGreaterThanOrEqual(1);

    const publishedResponse = await app.inject({
      method: "GET",
      url: "/telehealth-stewardship",
      headers: headers("medical_director")
    });
    expect(publishedResponse.statusCode).toBe(200);
    const published = publishedResponse
      .json<Array<{ id: string; status: string; publishedPath: string | null }>>()
      .find((record) => record.id === stewardship!.id);
    expect(published?.status).toBe("published");
    expect(published?.publishedPath).toContain(submitted.document.id);
  });

  it("bootstraps controlled-substance stewardship, routes it through approval, and publishes it", async () => {
    await app.inject({
      method: "POST",
      url: "/practice-agreements/bootstrap-defaults",
      headers: headers("medical_director")
    });

    const bootstrapResponse = await app.inject({
      method: "POST",
      url: "/controlled-substances/bootstrap-defaults",
      headers: headers("medical_director")
    });
    expect(bootstrapResponse.statusCode).toBe(200);
    const bootstrap = bootstrapResponse.json<{ created: Array<{ id: string; title: string }>; existing: Array<{ id: string; title: string }> }>();
    expect(bootstrap.created.length + bootstrap.existing.length).toBeGreaterThan(0);

    const listResponse = await app.inject({
      method: "GET",
      url: "/controlled-substances",
      headers: headers("patient_care_team_physician")
    });
    expect(listResponse.statusCode).toBe(200);
    const stewardship = listResponse
      .json<Array<{ id: string; title: string; status: string; documentId: string | null }>>()
      .find((record) => record.title === "Controlled-substance stewardship packet");
    expect(stewardship).toBeTruthy();
    expect(stewardship?.status).toBe("draft");

    const updateResponse = await app.inject({
      method: "PATCH",
      url: `/controlled-substances/${stewardship!.id}`,
      headers: headers("medical_director"),
      payload: {
        pdmpReviewSummary: "Updated during controlled-substance API test.",
        notes: "Controlled-substance test notes."
      }
    });
    expect(updateResponse.statusCode).toBe(200);
    expect(
      updateResponse.json<{ stewardship: { pdmpReviewSummary: string } }>().stewardship.pdmpReviewSummary
    ).toBe("Updated during controlled-substance API test.");

    const submitResponse = await app.inject({
      method: "POST",
      url: `/controlled-substances/${stewardship!.id}/submit`,
      headers: headers("medical_director")
    });
    expect(submitResponse.statusCode).toBe(200);
    const submitted = submitResponse.json<{
      stewardship: { status: string };
      document: { id: string; status: string };
      approvals: Array<{ id: string; reviewerRole: string }>;
    }>();
    expect(submitted.stewardship.status).toBe("approval_pending");
    expect(submitted.document.status).toBe("in_review");

    for (const approval of submitted.approvals) {
      const decision = await app.inject({
        method: "POST",
        url: `/approvals/${approval.id}/decide`,
        headers: headers(approval.reviewerRole as Parameters<typeof headers>[0]),
        payload: { decision: "approved" }
      });
      expect(decision.statusCode).toBe(200);
    }

    const publishResponse = await app.inject({
      method: "POST",
      url: `/controlled-substances/${stewardship!.id}/publish`,
      headers: headers("medical_director")
    });
    expect(publishResponse.statusCode).toBe(200);
    expect(publishResponse.json<{ stewardship: { status: string } }>().stewardship.status).toBe("publish_pending");

    const runner = new WorkerJobRunner(repository, buildMicrosoftPilotOps({ mode: "stub" }));
    const summary = await runner.runOnce();
    expect(summary.succeeded).toBeGreaterThanOrEqual(1);

    const publishedResponse = await app.inject({
      method: "GET",
      url: "/controlled-substances",
      headers: headers("medical_director")
    });
    expect(publishedResponse.statusCode).toBe(200);
    const published = publishedResponse
      .json<Array<{ id: string; status: string; publishedPath: string | null }>>()
      .find((record) => record.id === stewardship!.id);
    expect(published?.status).toBe("published");
    expect(published?.publishedPath).toContain(submitted.document.id);
  });

  it("bootstraps standards defaults, routes an evidence binder through approval, and publishes it", async () => {
    const standardsBootstrap = await app.inject({
      method: "POST",
      url: "/standards/bootstrap-defaults",
      headers: headers("quality_lead")
    });
    expect(standardsBootstrap.statusCode).toBe(200);

    const standardsResponse = await app.inject({
      method: "GET",
      url: "/standards",
      headers: headers("quality_lead")
    });
    expect(standardsResponse.statusCode).toBe(200);
    const standards = standardsResponse.json<Array<{ id: string; standardCode: string; status: string }>>();
    expect(standards.length).toBeGreaterThan(0);

    const binderCreate = await app.inject({
      method: "POST",
      url: "/evidence-binders",
      headers: headers("quality_lead"),
      payload: {
        title: "Mock survey evidence binder",
        ownerRole: "quality_lead",
        sourceAuthority: "Joint Commission Mock Survey",
        surveyWindowLabel: "Pilot readiness mock survey",
        standardIds: standards.slice(0, 3).map((standard) => standard.id),
        summary: "Assemble the core survey-readiness evidence trail across mapped standards.",
        evidenceReadinessSummary: "Each mapped standard should point to a current artifact and named owner.",
        openGapSummary: "Track stale signatures or missing review evidence before treating the binder as survey-ready.",
        reviewCadenceDays: 60,
        notes: "Evidence-binder API test notes."
      }
    });
    expect(binderCreate.statusCode).toBe(200);
    const created = binderCreate.json<{ binder: { id: string; status: string; documentId: string | null } }>();
    expect(created.binder.status).toBe("draft");
    expect(created.binder.documentId).toBeTruthy();

    const submitResponse = await app.inject({
      method: "POST",
      url: `/evidence-binders/${created.binder.id}/submit`,
      headers: headers("quality_lead")
    });
    expect(submitResponse.statusCode).toBe(200);
    const submitted = submitResponse.json<{
      binder: { status: string };
      document: { id: string; status: string };
      approvals: Array<{ id: string; reviewerRole: string }>;
    }>();
    expect(submitted.binder.status).toBe("approval_pending");
    expect(submitted.document.status).toBe("in_review");

    for (const approval of submitted.approvals) {
      const decision = await app.inject({
        method: "POST",
        url: `/approvals/${approval.id}/decide`,
        headers: headers(approval.reviewerRole as Parameters<typeof headers>[0]),
        payload: { decision: "approved" }
      });
      expect(decision.statusCode).toBe(200);
    }

    const publishResponse = await app.inject({
      method: "POST",
      url: `/evidence-binders/${created.binder.id}/publish`,
      headers: headers("medical_director")
    });
    expect(publishResponse.statusCode).toBe(200);
    expect(publishResponse.json<{ binder: { status: string } }>().binder.status).toBe("publish_pending");

    const runner = new WorkerJobRunner(repository, buildMicrosoftPilotOps({ mode: "stub" }));
    const summary = await runner.runOnce();
    expect(summary.succeeded).toBeGreaterThanOrEqual(1);

    const publishedBinders = await app.inject({
      method: "GET",
      url: "/evidence-binders",
      headers: headers("medical_director")
    });
    expect(publishedBinders.statusCode).toBe(200);
    const published = publishedBinders
      .json<Array<{ id: string; status: string; publishedPath: string | null }>>()
      .find((binder) => binder.id === created.binder.id);
    expect(published?.status).toBe("published");
    expect(published?.publishedPath).toContain(submitted.document.id);

    const refreshedStandards = await app.inject({
      method: "GET",
      url: "/standards",
      headers: headers("quality_lead")
    });
    expect(refreshedStandards.statusCode).toBe(200);
    expect(
      refreshedStandards
        .json<Array<{ id: string; status: string; latestBinderId: string | null }>>()
        .filter((standard) => created.binder.documentId && standards.slice(0, 3).some((entry) => entry.id === standard.id))
        .every((standard) => standard.status === "complete" && standard.latestBinderId === created.binder.id)
    ).toBe(true);
  });
});
