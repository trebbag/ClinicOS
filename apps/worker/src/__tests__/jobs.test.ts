import { describe, expect, it } from "vitest";
import {
  createActionItemRecord,
  createCapaRecord,
  createChecklistItemRecord,
  createChecklistRun,
  createChecklistTemplate,
  createControlledSubstanceStewardshipRecord,
  createIncidentRecord,
  createPracticeAgreementRecord,
  createPublicAssetRecord,
  createEvidenceBinderRecord,
  createServiceLinePackRecord,
  createServiceLineRecord,
  createScorecardReviewRecord,
  createStandardMappingRecord,
  createTelehealthStewardshipRecord,
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

  it("keeps linked public assets in sync when publication completes", async () => {
    const repository = new MemoryClinicRepository();
    await repository.createDocument({
      id: "doc_public_asset",
      title: "Public landing page",
      ownerRole: "quality_lead",
      approvalClass: "public_facing",
      artifactType: "public_asset",
      summary: "Approved public asset",
      workflowRunId: "workflow_public_asset",
      serviceLines: ["weight_management"],
      createdBy: "quality-user",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: "approved",
      body: "# Public draft",
      version: 1,
      publishedAt: null,
      publishedPath: null,
      reviewDueAt: null
    });
    await repository.createPublicAsset(createPublicAssetRecord({
      assetType: "landing_page",
      title: "Public landing page",
      ownerRole: "quality_lead",
      serviceLine: "weight_management",
      summary: "Approved public asset",
      body: "# Public draft",
      claims: [{ claimText: "Physician-led program" }],
      createdBy: "quality-user",
      documentId: "doc_public_asset",
      workflowRunId: "workflow_public_asset"
    }));
    await repository.updatePublicAsset(repository.publicAssets[0]!.id, {
      claimsReviewed: true,
      claimsReviewStatus: "completed",
      status: "approved",
      updatedAt: new Date().toISOString()
    });
    await repository.enqueueWorkerJob(createWorkerJob({
      type: "document.publish",
      payload: {
        actor: {
          actorId: "medical-director",
          role: "medical_director",
          name: "Medical Director"
        },
        documentId: "doc_public_asset"
      },
      sourceEntityType: "document",
      sourceEntityId: "doc_public_asset"
    }));

    const runner = new WorkerJobRunner(repository, buildMicrosoftPilotOps({ mode: "stub" }));
    const summary = await runner.runOnce();
    expect(summary.succeeded).toBeGreaterThanOrEqual(1);
    expect(repository.publicAssets[0]?.status).toBe("published");
    expect(repository.publicAssets[0]?.publishedPath).toContain("doc_public_asset");
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

  it("syncs incident and CAPA records through the Microsoft list wrappers", async () => {
    const repository = new MemoryClinicRepository();
    const incident = createIncidentRecord({
      title: "Temperature variance",
      severity: "high",
      category: "environment",
      summary: "Vaccine refrigerator log requires review.",
      detectedByRole: "quality_lead",
      ownerRole: "quality_lead"
    });
    const capa = createCapaRecord({
      title: "CAPA for temperature variance",
      summary: "Document the remediation and prevention plan.",
      sourceId: incident.id,
      sourceType: "incident",
      incidentId: incident.id,
      ownerRole: "quality_lead",
      dueDate: "2026-04-20T00:00:00.000Z",
      correctiveAction: "Reconcile the log and affected inventory.",
      preventiveAction: "Add a second daily refrigerator check."
    });

    await repository.createIncident(incident);
    await repository.createCapa(capa);
    await repository.enqueueWorkerJob(createWorkerJob({
      type: "lists.incident.upsert",
      payload: {
        actor: {
          actorId: "quality-user",
          role: "quality_lead",
          name: "Quality Lead"
        },
        incidentId: incident.id
      },
      sourceEntityType: "incident",
      sourceEntityId: incident.id
    }));
    await repository.enqueueWorkerJob(createWorkerJob({
      type: "lists.capa.upsert",
      payload: {
        actor: {
          actorId: "quality-user",
          role: "quality_lead",
          name: "Quality Lead"
        },
        capaId: capa.id
      },
      sourceEntityType: "capa",
      sourceEntityId: capa.id
    }));

    const runner = new WorkerJobRunner(repository, buildMicrosoftPilotOps({ mode: "stub" }));
    const summary = await runner.runOnce();

    expect(summary.succeeded).toBe(2);
    expect(repository.auditEvents.some((event) => event.eventType === "lists.incident_synced")).toBe(true);
    expect(repository.auditEvents.some((event) => event.eventType === "lists.capa_synced")).toBe(true);
  });

  it("keeps linked service-line packs in sync when publication completes", async () => {
    const repository = new MemoryClinicRepository();
    const serviceLine = createServiceLineRecord({
      id: "weight_management",
      ownerRole: "medical_director",
      reviewCadenceDays: 60
    });
    await repository.createServiceLine(serviceLine);
    await repository.createDocument({
      id: "doc_service_line_pack",
      title: "Weight management governance pack",
      ownerRole: "medical_director",
      approvalClass: "clinical_governance",
      artifactType: "service_line_pack",
      summary: "Approved service-line governance pack",
      workflowRunId: "workflow_service_line_pack",
      serviceLines: ["weight_management"],
      createdBy: "medical-director",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: "approved",
      body: "# Governance pack",
      version: 1,
      publishedAt: null,
      publishedPath: null,
      reviewDueAt: null
    });
    const pack = createServiceLinePackRecord({
      serviceLineId: "weight_management",
      title: "Weight management governance pack",
      ownerRole: "medical_director",
      charterSummary: "Charter summary for weight management governance.",
      inclusionExclusionRules: "Inclusion and exclusion rules for weight management participation.",
      roleMatrixSummary: "Role matrix for physician, NP, and support staff oversight.",
      competencyRequirements: "Competency requirements with onboarding and refresher checkpoints.",
      auditToolSummary: "Audit tool summary and monthly evidence review expectations.",
      emergencyEscalation: "Emergency escalation path for adverse events or clinical deterioration.",
      pricingModelSummary: "Pricing model summary with finance guardrails and discount boundaries.",
      claimsGovernanceSummary: "Claims governance summary tied to approved evidence inventory.",
      createdBy: "medical-director",
      documentId: "doc_service_line_pack",
      workflowRunId: "workflow_service_line_pack"
    });
    await repository.createServiceLinePack(pack);
    await repository.updateServiceLine(serviceLine.id, {
      latestPackId: pack.id,
      governanceStatus: "approved",
      updatedAt: new Date().toISOString()
    });
    await repository.enqueueWorkerJob(createWorkerJob({
      type: "document.publish",
      payload: {
        actor: {
          actorId: "medical-director",
          role: "medical_director",
          name: "Medical Director"
        },
        documentId: "doc_service_line_pack"
      },
      sourceEntityType: "document",
      sourceEntityId: "doc_service_line_pack"
    }));

    const runner = new WorkerJobRunner(repository, buildMicrosoftPilotOps({ mode: "stub" }));
    const summary = await runner.runOnce();

    expect(summary.succeeded).toBeGreaterThanOrEqual(1);
    expect(await repository.getServiceLinePack(pack.id)).toMatchObject({
      status: "published"
    });
    expect(await repository.getServiceLine(serviceLine.id)).toMatchObject({
      governanceStatus: "published",
      latestPackId: pack.id
    });
  });

  it("keeps linked practice agreements in sync when publication completes", async () => {
    const repository = new MemoryClinicRepository();
    await repository.createDocument({
      id: "doc_practice_agreement",
      title: "Telehealth physician oversight agreement",
      ownerRole: "medical_director",
      approvalClass: "clinical_governance",
      artifactType: "physician_oversight_plan",
      summary: "Approved oversight agreement",
      workflowRunId: "workflow_practice_agreement",
      serviceLines: ["telehealth"],
      createdBy: "medical-director",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: "approved",
      body: "# Oversight agreement",
      version: 1,
      publishedAt: null,
      publishedPath: null,
      reviewDueAt: null
    });
    const practiceAgreement = createPracticeAgreementRecord({
      title: "Telehealth physician oversight agreement",
      agreementType: "physician_oversight_plan",
      ownerRole: "medical_director",
      supervisingPhysicianName: "Assigned supervising physician",
      supervisingPhysicianRole: "patient_care_team_physician",
      supervisedRole: "nurse_practitioner",
      serviceLineIds: ["telehealth"],
      scopeSummary: "Telehealth scope summary for advanced practice oversight.",
      delegatedActivitiesSummary: "Protocol-based follow-up care under supervising physician oversight.",
      cosignExpectation: "Cosign new starts and protocol exceptions.",
      escalationProtocol: "Escalate same day for red-flag symptoms or protocol exceptions.",
      createdBy: "medical-director",
      documentId: "doc_practice_agreement",
      workflowRunId: "workflow_practice_agreement"
    });
    await repository.createPracticeAgreement(practiceAgreement);
    await repository.enqueueWorkerJob(createWorkerJob({
      type: "document.publish",
      payload: {
        actor: {
          actorId: "medical-director",
          role: "medical_director",
          name: "Medical Director"
        },
        documentId: "doc_practice_agreement"
      },
      sourceEntityType: "document",
      sourceEntityId: "doc_practice_agreement"
    }));

    const runner = new WorkerJobRunner(repository, buildMicrosoftPilotOps({ mode: "stub" }));
    const summary = await runner.runOnce();

    expect(summary.succeeded).toBeGreaterThanOrEqual(1);
    expect(await repository.getPracticeAgreement(practiceAgreement.id)).toMatchObject({
      status: "published",
      publishedPath: expect.stringContaining("doc_practice_agreement")
    });
  });

  it("keeps linked telehealth stewardship packets in sync when publication completes", async () => {
    const repository = new MemoryClinicRepository();
    await repository.createDocument({
      id: "doc_telehealth_stewardship",
      title: "Telehealth stewardship packet",
      ownerRole: "medical_director",
      approvalClass: "clinical_governance",
      artifactType: "telehealth_stewardship_packet",
      summary: "Approved telehealth stewardship packet",
      workflowRunId: "workflow_telehealth_stewardship",
      serviceLines: ["telehealth"],
      createdBy: "medical-director",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: "approved",
      body: "# Telehealth stewardship",
      version: 1,
      publishedAt: null,
      publishedPath: null,
      reviewDueAt: null
    });
    const stewardship = createTelehealthStewardshipRecord({
      title: "Telehealth stewardship packet",
      ownerRole: "medical_director",
      supervisingPhysicianRole: "patient_care_team_physician",
      linkedPracticeAgreementId: "practice_agreement_telehealth",
      delegatedTaskCodes: ["virtual_triage", "refill_review"],
      modalityScopeSummary: "Synchronous and asynchronous telehealth follow-up scope.",
      stateCoverageSummary: "State coverage and licensure verification summary.",
      patientIdentitySummary: "Verify patient identity and location before treatment decisions.",
      consentWorkflowSummary: "Capture and reaffirm telehealth consent.",
      documentationStandardSummary: "Document modality, location, and escalation decisions.",
      emergencyRedirectSummary: "Redirect emergent symptoms to local in-person care.",
      qaReviewSummary: "Monthly chart review and protocol audit expectations.",
      createdBy: "medical-director",
      documentId: "doc_telehealth_stewardship",
      workflowRunId: "workflow_telehealth_stewardship"
    });
    await repository.createTelehealthStewardship(stewardship);
    await repository.enqueueWorkerJob(createWorkerJob({
      type: "document.publish",
      payload: {
        actor: {
          actorId: "medical-director",
          role: "medical_director",
          name: "Medical Director"
        },
        documentId: "doc_telehealth_stewardship"
      },
      sourceEntityType: "document",
      sourceEntityId: "doc_telehealth_stewardship"
    }));

    const runner = new WorkerJobRunner(repository, buildMicrosoftPilotOps({ mode: "stub" }));
    const summary = await runner.runOnce();

    expect(summary.succeeded).toBeGreaterThanOrEqual(1);
    expect(await repository.getTelehealthStewardship(stewardship.id)).toMatchObject({
      status: "published",
      publishedPath: expect.stringContaining("doc_telehealth_stewardship")
    });
  });

  it("keeps linked controlled-substance stewardship packets in sync when publication completes", async () => {
    const repository = new MemoryClinicRepository();
    await repository.createDocument({
      id: "doc_controlled_substance_stewardship",
      title: "Controlled-substance stewardship packet",
      ownerRole: "medical_director",
      approvalClass: "clinical_governance",
      artifactType: "controlled_substance_stewardship_packet",
      summary: "Approved controlled-substance stewardship packet",
      workflowRunId: "workflow_controlled_substance_stewardship",
      serviceLines: ["weight_management", "hrt"],
      createdBy: "medical-director",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: "approved",
      body: "# Controlled-substance stewardship",
      version: 1,
      publishedAt: null,
      publishedPath: null,
      reviewDueAt: null
    });
    const stewardship = createControlledSubstanceStewardshipRecord({
      title: "Controlled-substance stewardship packet",
      ownerRole: "medical_director",
      supervisingPhysicianRole: "patient_care_team_physician",
      serviceLineIds: ["weight_management", "hrt"],
      linkedPracticeAgreementId: "practice_agreement_weight_management",
      prescribingScopeSummary: "Define controlled-substance prescribing scope.",
      pdmpReviewSummary: "Document PDMP review expectations.",
      screeningProtocolSummary: "Document screening and monitoring expectations.",
      refillEscalationSummary: "Escalate refill exceptions same day.",
      inventoryControlSummary: "Maintain locked storage and discrepancy review.",
      patientEducationSummary: "Reinforce patient expectations and safe storage.",
      adverseEventEscalationSummary: "Escalate suspected misuse or overdose risk immediately.",
      createdBy: "medical-director",
      documentId: "doc_controlled_substance_stewardship",
      workflowRunId: "workflow_controlled_substance_stewardship"
    });
    await repository.createControlledSubstanceStewardship(stewardship);
    await repository.enqueueWorkerJob(createWorkerJob({
      type: "document.publish",
      payload: {
        actor: {
          actorId: "medical-director",
          role: "medical_director",
          name: "Medical Director"
        },
        documentId: "doc_controlled_substance_stewardship"
      },
      sourceEntityType: "document",
      sourceEntityId: "doc_controlled_substance_stewardship"
    }));

    const runner = new WorkerJobRunner(repository, buildMicrosoftPilotOps({ mode: "stub" }));
    const summary = await runner.runOnce();

    expect(summary.succeeded).toBeGreaterThanOrEqual(1);
    expect(await repository.getControlledSubstanceStewardship(stewardship.id)).toMatchObject({
      status: "published",
      publishedPath: expect.stringContaining("doc_controlled_substance_stewardship")
    });
  });

  it("keeps linked evidence binders and mapped standards in sync when publication completes", async () => {
    const repository = new MemoryClinicRepository();
    const standardA = createStandardMappingRecord({
      standardCode: "MM.03.01.01",
      title: "Medication management oversight",
      domain: "medication_management",
      sourceAuthority: "Joint Commission Mock Survey",
      ownerRole: "quality_lead",
      requirementSummary: "Track medication-governance oversight evidence.",
      evidenceExpectation: "Current packet and recent review artifacts."
    });
    const standardB = createStandardMappingRecord({
      standardCode: "LD.04.01.05",
      title: "Leadership quality oversight",
      domain: "leadership",
      sourceAuthority: "Joint Commission Mock Survey",
      ownerRole: "medical_director",
      requirementSummary: "Track leadership review of safety-governance artifacts.",
      evidenceExpectation: "Current committee packet and documented follow-up."
    });
    await repository.createStandardMapping(standardA);
    await repository.createStandardMapping(standardB);
    await repository.createDocument({
      id: "doc_evidence_binder",
      title: "Mock survey evidence binder",
      ownerRole: "quality_lead",
      approvalClass: "clinical_governance",
      artifactType: "evidence_binder",
      summary: "Approved evidence binder",
      workflowRunId: "workflow_evidence_binder",
      serviceLines: [],
      createdBy: "quality-lead",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: "approved",
      body: "# Evidence binder",
      version: 1,
      publishedAt: null,
      publishedPath: null,
      reviewDueAt: null
    });
    const binder = createEvidenceBinderRecord({
      title: "Mock survey evidence binder",
      ownerRole: "quality_lead",
      sourceAuthority: "Joint Commission Mock Survey",
      surveyWindowLabel: "Pilot readiness mock survey",
      standardIds: [standardA.id, standardB.id],
      summary: "Survey-ready packet.",
      evidenceReadinessSummary: "Each standard has a mapped artifact.",
      openGapSummary: "Close remaining signature gaps.",
      createdBy: "quality-lead",
      documentId: "doc_evidence_binder",
      workflowRunId: "workflow_evidence_binder"
    });
    await repository.createEvidenceBinder(binder);
    await repository.enqueueWorkerJob(createWorkerJob({
      type: "document.publish",
      payload: {
        actor: {
          actorId: "quality-lead",
          role: "quality_lead",
          name: "Quality Lead"
        },
        documentId: "doc_evidence_binder"
      },
      sourceEntityType: "document",
      sourceEntityId: "doc_evidence_binder"
    }));

    const runner = new WorkerJobRunner(repository, buildMicrosoftPilotOps({ mode: "stub" }));
    const summary = await runner.runOnce();

    expect(summary.succeeded).toBeGreaterThanOrEqual(1);
    expect(await repository.getEvidenceBinder(binder.id)).toMatchObject({
      status: "published",
      publishedPath: expect.stringContaining("doc_evidence_binder")
    });
    expect(await repository.getStandardMapping(standardA.id)).toMatchObject({
      status: "complete",
      latestBinderId: binder.id
    });
  });
});
