import { parse } from "csv-parse/sync";
import { getRuntimeAgentById, listRuntimeAgents, runAgent, selectAgentForWorkflow } from "@clinic-os/agents";
import type { ClinicRepository } from "@clinic-os/db";
import { publicationAllowed, reviewersForApprovalClass } from "@clinic-os/approvals";
import type { MicrosoftPreflightResult } from "@clinic-os/msgraph";
import { z } from "zod";
import {
  actionItemCreateSchema,
  actionItemUpdateSchema,
  capaCreateSchema,
  capaResolutionCommandSchema,
  capaUpdateSchema,
  checklistItemUpdateSchema,
  committeeCreateSchema,
  committeeMeetingCompleteSchema,
  committeeMeetingCreateSchema,
  committeeMeetingDecisionCommandSchema,
  committeeUpdateSchema,
  createCommitteeMeetingRecord,
  createCommitteeRecord,
  createCapaRecord,
  createChecklistItemRecord,
  createChecklistRun,
  createChecklistTemplate,
  createControlledSubstanceStewardshipRecord,
  createDelegationRuleRecord,
  createEvidenceBinderRecord,
  createIncidentRecord,
  createMicrosoftIntegrationValidationRecord,
  createPublicAssetRecord,
  createActionItemRecord,
  createAuditEvent,
  createDraftDocument,
  createScorecardReviewRecord,
  createStandardMappingRecord,
  createTrainingCompletionRecord,
  createTrainingRequirement,
  createWorkerJob,
  createWorkflowRun,
  createServiceLinePackRecord,
  createServiceLineRecord,
  defaultWorkerHeartbeatIntervalMs,
  deidentifiedOperationalRowSchema,
  delegationEvaluationQuerySchema,
  delegationRuleCreateSchema,
  delegationRuleUpdateSchema,
  documentMetadataSchema,
  evaluateDelegationRule,
  evidenceBinderCreateSchema,
  evidenceBinderUpdateSchema,
  incidentCreateSchema,
  incidentReviewDecisionCommandSchema,
  incidentUpdateSchema,
  listRoleCapabilities,
  opsCleanupCommandSchema,
  opsCleanupResultSchema,
  publicAssetCreateSchema,
  publicAssetUpdateSchema,
  claimsReviewDecisionCommandSchema,
  controlledSubstanceStewardshipCreateSchema,
  controlledSubstanceStewardshipUpdateSchema,
  createPracticeAgreementRecord,
  createTelehealthStewardshipRecord,
  serviceLineCreateSchema,
  serviceLinePackCreateSchema,
  serviceLineUpdateSchema,
  practiceAgreementCreateSchema,
  practiceAgreementUpdateSchema,
  telehealthStewardshipCreateSchema,
  telehealthStewardshipUpdateSchema,
  scorecardImportJobSchema,
  scorecardReviewDecisionCommandSchema,
  standardMappingCreateSchema,
  standardMappingUpdateSchema,
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
  type CapaRecord,
  type CapaStatus,
  type DelegationEvaluationResult,
  type DelegationRuleRecord,
  type AuthMode,
  type ChecklistItemRecord,
  type ChecklistRun,
  type ChecklistTemplate,
  type CommitteeDecisionRecord,
  type CommitteeQapiDashboardSummary,
  type CommitteeMeetingRecord,
  type CommitteeQapiSnapshot,
  type CommitteeRecord,
  type ControlledSubstanceStewardshipRecord,
  type MetricRun,
  type MicrosoftIntegrationStatus,
  type MicrosoftIntegrationValidationRecord,
  type DocumentRecord,
  type EvidenceBinderRecord,
  type IncidentRecord,
  type OpsAlert,
  type OpsAlertSummary,
  type OpsCleanupResult,
  type OpsCleanupTarget,
  type OpsMaintenanceSummary,
  type OfficeOpsDailyStatus,
  type PublicationMode,
  type PublicAssetRecord,
  type PracticeAgreementRecord,
  type RoleCapabilityRecord,
  type RuntimeAgentRunCommand,
  type RuntimeAgentRunResult,
  type RuntimeAgentStatus,
  type ServiceLinePackRecord,
  type ServiceLineRecord,
  type StandardMappingRecord,
  type TelehealthStewardshipRecord,
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
  type WorkerBatchSummary,
  type WorkerJobSummary,
  type WorkerRuntimeStatus,
  type WorkerJobRecord,
  type WorkflowDefinition,
  type WorkflowRun,
  workerBatchSummarySchema,
  workerRuntimeEntityId
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

function ageMinutes(now: string, earlier: string | null): number | null {
  if (!earlier) {
    return null;
  }

  return Math.max(0, Math.round((new Date(now).getTime() - new Date(earlier).getTime()) / 60_000));
}

function parseWorkerBatchSummary(input: unknown): WorkerBatchSummary | null {
  const parsed = workerBatchSummarySchema.safeParse(input);
  return parsed.success ? parsed.data : null;
}

function derivePublicAssetStatus(input: {
  documentStatus: DocumentRecord["status"];
  claimsReviewStatus: PublicAssetRecord["claimsReviewStatus"];
}): PublicAssetRecord["status"] {
  switch (input.documentStatus) {
    case "in_review":
      return "approval_pending";
    case "approved":
      return "approved";
    case "publish_pending":
      return "publish_pending";
    case "published":
      return "published";
    case "rejected":
      return "sent_back";
    case "draft":
    default:
      if (input.claimsReviewStatus === "completed") {
        return "claims_reviewed";
      }
      if (input.claimsReviewStatus === "in_review" || input.claimsReviewStatus === "needs_revision") {
        return "claims_in_review";
      }
      return "draft";
  }
}

function derivePracticeAgreementStatus(input: {
  documentStatus: DocumentRecord["status"];
  currentStatus: PracticeAgreementRecord["status"];
}): PracticeAgreementRecord["status"] {
  if (["archived", "expired"].includes(input.currentStatus)) {
    return input.currentStatus;
  }

  switch (input.documentStatus) {
    case "in_review":
      return "approval_pending";
    case "approved":
      return "approved";
    case "publish_pending":
      return "publish_pending";
    case "published":
      return "published";
    case "rejected":
      return "sent_back";
    case "draft":
    default:
      return "draft";
  }
}

function deriveTelehealthStewardshipStatus(input: {
  documentStatus: DocumentRecord["status"];
  currentStatus: TelehealthStewardshipRecord["status"];
}): TelehealthStewardshipRecord["status"] {
  if (input.currentStatus === "archived") {
    return input.currentStatus;
  }

  switch (input.documentStatus) {
    case "in_review":
      return "approval_pending";
    case "approved":
      return "approved";
    case "publish_pending":
      return "publish_pending";
    case "published":
      return "published";
    case "rejected":
      return "sent_back";
    case "archived":
      return "archived";
    case "draft":
    default:
      return "draft";
  }
}

function deriveControlledSubstanceStewardshipStatus(input: {
  documentStatus: DocumentRecord["status"];
  currentStatus: ControlledSubstanceStewardshipRecord["status"];
}): ControlledSubstanceStewardshipRecord["status"] {
  if (input.currentStatus === "archived") {
    return input.currentStatus;
  }

  switch (input.documentStatus) {
    case "in_review":
      return "approval_pending";
    case "approved":
      return "approved";
    case "publish_pending":
      return "publish_pending";
    case "published":
      return "published";
    case "rejected":
      return "sent_back";
    case "archived":
      return "archived";
    case "draft":
    default:
      return "draft";
  }
}

function deriveEvidenceBinderStatus(input: {
  documentStatus: DocumentRecord["status"];
  currentStatus: EvidenceBinderRecord["status"];
}): EvidenceBinderRecord["status"] {
  if (input.currentStatus === "archived") {
    return input.currentStatus;
  }

  switch (input.documentStatus) {
    case "in_review":
      return "approval_pending";
    case "approved":
      return "approved";
    case "publish_pending":
      return "publish_pending";
    case "published":
      return "published";
    case "rejected":
      return "sent_back";
    case "archived":
      return "archived";
    case "draft":
    default:
      return "draft";
  }
}

function deriveCommitteeMeetingStatus(input: {
  documentStatus: DocumentRecord["status"];
  currentStatus: CommitteeMeetingRecord["status"];
}): CommitteeMeetingRecord["status"] {
  if (["completed", "cancelled"].includes(input.currentStatus)) {
    return input.currentStatus;
  }

  switch (input.documentStatus) {
    case "in_review":
      return "review_pending";
    case "approved":
    case "published":
      return "approved";
    case "rejected":
      return "sent_back";
    case "draft":
    case "publish_pending":
    case "archived":
    default:
      return "packet_ready";
  }
}

function deriveServiceLinePackStatus(input: {
  documentStatus: DocumentRecord["status"];
}): ServiceLinePackRecord["status"] {
  switch (input.documentStatus) {
    case "in_review":
      return "approval_pending";
    case "approved":
      return "approved";
    case "publish_pending":
      return "publish_pending";
    case "published":
      return "published";
    case "rejected":
      return "sent_back";
    case "archived":
      return "archived";
    case "draft":
    default:
      return "draft";
  }
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

const defaultDelegationRuleTemplates = [
  {
    serviceLineId: "weight_management" as const,
    taskCode: "weigh_in_and_screen",
    taskLabel: "Weigh-in, vitals capture, and scripted intake screening",
    performerRole: "medical_assistant" as const,
    supervisingRole: "nurse_practitioner" as const,
    supervisionLevel: "protocol" as const,
    requiresCompetencyEvidence: true,
    requiresDocumentedOrder: false,
    requiresCosign: false,
    patientFacing: true,
    evidenceRequired: "Current intake and vital-sign competency checklist plus the service-line onboarding attestation.",
    notes: "Draft clinic template only; confirm state delegation rules before live use."
  },
  {
    serviceLineId: "weight_management" as const,
    taskCode: "initiate_medication_protocol",
    taskLabel: "Initiate or adjust protocol-based weight-management medication plan",
    performerRole: "nurse_practitioner" as const,
    supervisingRole: "patient_care_team_physician" as const,
    supervisionLevel: "cosign" as const,
    requiresCompetencyEvidence: true,
    requiresDocumentedOrder: true,
    requiresCosign: true,
    patientFacing: true,
    evidenceRequired: "Prescribing competency, protocol sign-off, and supervising physician review requirements.",
    notes: "Keep tied to the active practice agreement and approved medication protocol."
  },
  {
    serviceLineId: "hrt" as const,
    taskCode: "injection_visit_support",
    taskLabel: "Support scheduled HRT injection visit under approved protocol",
    performerRole: "medical_assistant" as const,
    supervisingRole: "nurse_practitioner" as const,
    supervisionLevel: "protocol" as const,
    requiresCompetencyEvidence: true,
    requiresDocumentedOrder: true,
    requiresCosign: false,
    patientFacing: true,
    evidenceRequired: "Current injection competency validation and standing-order acknowledgement.",
    notes: "Verify route, medication, and standing-order requirements against the current service-line SOP."
  },
  {
    serviceLineId: "vaccines" as const,
    taskCode: "administer_vaccine",
    taskLabel: "Administer vaccine under approved standing order",
    performerRole: "medical_assistant" as const,
    supervisingRole: "nurse_practitioner" as const,
    supervisionLevel: "protocol" as const,
    requiresCompetencyEvidence: true,
    requiresDocumentedOrder: true,
    requiresCosign: false,
    patientFacing: true,
    evidenceRequired: "Current vaccine competency validation, emergency-response drill completion, and standing-order acknowledgment.",
    notes: "Use only with active standing orders and current vaccine storage/readiness controls."
  },
  {
    serviceLineId: "waived_testing" as const,
    taskCode: "perform_waived_test",
    taskLabel: "Perform approved waived test and document result in the approved workflow",
    performerRole: "medical_assistant" as const,
    supervisingRole: "nurse_practitioner" as const,
    supervisionLevel: "protocol" as const,
    requiresCompetencyEvidence: true,
    requiresDocumentedOrder: true,
    requiresCosign: false,
    patientFacing: true,
    evidenceRequired: "Current waived-testing competency evidence and signed acknowledgement of the quality-control procedure.",
    notes: "Retain QC evidence and escalation instructions with the service-line materials."
  },
  {
    serviceLineId: "iv_hydration" as const,
    taskCode: "start_iv_infusion",
    taskLabel: "Start IV hydration infusion after clinician assessment and order",
    performerRole: "nurse_practitioner" as const,
    supervisingRole: "medical_director" as const,
    supervisionLevel: "direct" as const,
    requiresCompetencyEvidence: true,
    requiresDocumentedOrder: true,
    requiresCosign: false,
    patientFacing: true,
    evidenceRequired: "Current IV competency sign-off, emergency escalation drill, and documented order for the specific visit.",
    notes: "Escalate any abnormal presentation or adverse symptom immediately."
  },
  {
    serviceLineId: "aesthetics" as const,
    taskCode: "cosmetic_injection",
    taskLabel: "Perform cosmetic injection visit under approved privilege set",
    performerRole: "nurse_practitioner" as const,
    supervisingRole: "patient_care_team_physician" as const,
    supervisionLevel: "cosign" as const,
    requiresCompetencyEvidence: true,
    requiresDocumentedOrder: true,
    requiresCosign: true,
    patientFacing: true,
    evidenceRequired: "Documented privilege approval, product-specific competency sign-off, and physician review expectations.",
    notes: "Tie scope to the current privilege grid and adverse-event escalation workflow."
  },
  {
    serviceLineId: "aesthetics" as const,
    taskCode: "cosmetic_injection",
    taskLabel: "Perform cosmetic injection visit under approved privilege set",
    performerRole: "medical_assistant" as const,
    supervisingRole: "medical_director" as const,
    supervisionLevel: "not_allowed" as const,
    requiresCompetencyEvidence: true,
    requiresDocumentedOrder: true,
    requiresCosign: true,
    patientFacing: true,
    evidenceRequired: "Task reserved for licensed clinicians with approved privileges; do not delegate to MA role.",
    notes: "Use this explicit block rule so schedule-builders and review packets show the restriction clearly."
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

function isCapaStillOpen(status: CapaStatus): boolean {
  return status !== "closed";
}

export class ClinicApiService {
  constructor(
    private readonly repository: ClinicRepository,
    private readonly publisher: ApprovedDocumentPublisher,
    private readonly options: {
      authMode: AuthMode;
      integrationMode: "stub" | "live";
      openaiApiKey?: string;
      runtimeAgentsEnabled?: boolean;
      pilotOps?: {
        readonly mode: "stub" | "live";
        sendOfficeOpsNotification(input: {
          title: string;
          body: string;
        }): Promise<{ messageId: string }>;
      };
      microsoftPreflight: MicrosoftPreflightService;
      incidentListSyncEnabled?: boolean;
      capaListSyncEnabled?: boolean;
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

    await this.syncPublicAssetFromDocument(updatedDocument);
    await this.syncPracticeAgreementFromDocument(updatedDocument);
    await this.syncTelehealthStewardshipFromDocument(updatedDocument);
    await this.syncControlledSubstanceStewardshipFromDocument(updatedDocument);
    await this.syncCommitteeMeetingFromDocument(updatedDocument);
    await this.syncServiceLinePackFromDocument(updatedDocument);
    await this.syncEvidenceBinderFromDocument(updatedDocument);

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

    await this.syncPublicAssetFromDocument(updatedDocument);
    await this.syncPracticeAgreementFromDocument(updatedDocument);
    await this.syncTelehealthStewardshipFromDocument(updatedDocument);
    await this.syncControlledSubstanceStewardshipFromDocument(updatedDocument);
    await this.syncCommitteeMeetingFromDocument(updatedDocument);
    await this.syncServiceLinePackFromDocument(updatedDocument);
    await this.syncEvidenceBinderFromDocument(updatedDocument);

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

  async createPublicAsset(actor: ActorContext, input: unknown): Promise<PublicAssetRecord> {
    const command = publicAssetCreateSchema.parse(input);
    const workflow = await this.createWorkflowRun(actor, {
      workflowId: "public_asset_claims_review",
      input: {
        title: command.title,
        ownerRole: command.ownerRole,
        assetType: command.assetType,
        serviceLine: command.serviceLine ?? null,
        requestedBy: actor.actorId,
        claimsCount: command.claims.length
      }
    });

    await this.advanceWorkflowIfPossible(actor, workflow.id, ["scoped", "drafted"], "Public asset draft created.");

    const document = await this.createDocument(actor, {
      title: command.title,
      ownerRole: command.ownerRole,
      approvalClass: "public_facing",
      artifactType: "public_asset",
      summary: command.summary,
      workflowRunId: workflow.id,
      serviceLines: command.serviceLine ? [command.serviceLine] : [],
      body: command.body
    });

    const asset = createPublicAssetRecord({
      assetType: command.assetType,
      title: command.title,
      ownerRole: command.ownerRole,
      serviceLine: command.serviceLine ?? null,
      audience: command.audience ?? null,
      channelLabel: command.channelLabel ?? null,
      summary: command.summary,
      body: command.body,
      claims: command.claims,
      createdBy: actor.actorId,
      documentId: document.id,
      workflowRunId: workflow.id
    });

    const created = await this.repository.createPublicAsset(asset);
    await this.recordAudit(actor, "public_asset.created", "public_asset", created.id, {
      documentId: created.documentId,
      workflowRunId: created.workflowRunId,
      claimsCount: created.claims.length,
      assetType: created.assetType
    });

    return created;
  }

  async listPublicAssets(filters?: {
    status?: string;
    ownerRole?: string;
    assetType?: string;
    serviceLine?: string;
  }): Promise<PublicAssetRecord[]> {
    return this.repository.listPublicAssets(filters);
  }

  async updatePublicAsset(actor: ActorContext, publicAssetId: string, input: unknown): Promise<PublicAssetRecord> {
    const command = publicAssetUpdateSchema.parse(input);
    const asset = await this.repository.getPublicAsset(publicAssetId);
    if (!asset) {
      notFound(`Public asset not found: ${publicAssetId}`);
    }
    if (["approval_pending", "approved", "publish_pending", "published", "archived"].includes(asset.status)) {
      badRequest("Public assets cannot be edited after approval routing begins.");
    }

    const document = asset.documentId ? await this.repository.getDocument(asset.documentId) : null;
    const claims = command.claims
      ? command.claims.map((claim) => ({
        id: randomId("claim"),
        claimText: claim.claimText,
        evidenceNote: claim.evidenceNote ?? null,
        reviewStatus: "pending" as const,
        reviewerNotes: null
      }))
      : asset.claims;
    const now = new Date().toISOString();
    const nextClaimsReviewStatus = command.claims ? "not_started" : asset.claimsReviewStatus;
    const nextClaimsReviewed = command.claims ? false : asset.claimsReviewed;

    const updated = await this.repository.updatePublicAsset(asset.id, {
      assetType: command.assetType ?? asset.assetType,
      title: command.title ?? asset.title,
      ownerRole: command.ownerRole ?? asset.ownerRole,
      serviceLine: command.serviceLine !== undefined ? command.serviceLine : asset.serviceLine,
      audience: command.audience !== undefined ? command.audience : asset.audience,
      channelLabel: command.channelLabel !== undefined ? command.channelLabel : asset.channelLabel,
      summary: command.summary ?? asset.summary,
      body: command.body ?? asset.body,
      claims,
      claimsReviewed: nextClaimsReviewed,
      claimsReviewStatus: nextClaimsReviewStatus,
      claimsReviewNotes: command.claims ? null : asset.claimsReviewNotes,
      claimsReviewedAt: command.claims ? null : asset.claimsReviewedAt,
      claimsReviewedByRole: command.claims ? null : asset.claimsReviewedByRole,
      status: command.claims ? "draft" : asset.status,
      updatedAt: now
    });

    if (document) {
      await this.repository.updateDocument(document.id, {
        title: updated.title,
        ownerRole: updated.ownerRole,
        summary: updated.summary,
        body: updated.body,
        serviceLines: updated.serviceLine ? [updated.serviceLine] : [],
        status: document.status === "rejected" ? "draft" : document.status,
        updatedAt: now,
        version: document.version + 1
      });
    }

    await this.recordAudit(actor, "public_asset.updated", "public_asset", updated.id, {
      documentId: updated.documentId,
      claimsCount: updated.claims.length
    });

    return updated;
  }

  async reviewPublicAssetClaims(actor: ActorContext, publicAssetId: string, input: unknown): Promise<PublicAssetRecord> {
    const command = claimsReviewDecisionCommandSchema.parse(input);
    const asset = await this.repository.getPublicAsset(publicAssetId);
    if (!asset) {
      notFound(`Public asset not found: ${publicAssetId}`);
    }
    if (!["quality_lead", "medical_director"].includes(actor.role)) {
      forbidden(`Role ${actor.role} cannot review public-asset claims.`);
    }

    const decisions = new Map(command.claimDecisions.map((entry) => [entry.claimId, entry]));
    const claims = asset.claims.map((claim) => {
      const decision = decisions.get(claim.id);
      if (!decision) {
        return claim;
      }
      return {
        ...claim,
        reviewStatus: decision.decision,
        reviewerNotes: decision.notes ?? null
      };
    });

    const allApproved = claims.length > 0 && claims.every((claim) => claim.reviewStatus === "approved");
    const hasRevision = claims.some((claim) => claim.reviewStatus === "needs_revision" || claim.reviewStatus === "unsupported");
    const now = new Date().toISOString();
    const updated = await this.repository.updatePublicAsset(asset.id, {
      claims,
      claimsReviewed: allApproved,
      claimsReviewStatus: allApproved ? "completed" : hasRevision ? "needs_revision" : "in_review",
      claimsReviewNotes: command.overallNotes ?? null,
      claimsReviewedAt: allApproved ? now : null,
      claimsReviewedByRole: allApproved ? actor.role : null,
      status: allApproved ? "claims_reviewed" : "claims_in_review",
      updatedAt: now
    });

    if (allApproved) {
      await this.advanceWorkflowIfPossible(actor, updated.workflowRunId, ["quality_checked"], "Claims review completed.");
    }

    await this.recordAudit(actor, "public_asset.claims_reviewed", "public_asset", updated.id, {
      claimsReviewStatus: updated.claimsReviewStatus,
      allApproved,
      reviewedClaims: command.claimDecisions.length
    });

    return updated;
  }

  async submitPublicAsset(actor: ActorContext, publicAssetId: string): Promise<{
    publicAsset: PublicAssetRecord;
    document: DocumentRecord;
    approvals: ApprovalTask[];
  }> {
    const asset = await this.repository.getPublicAsset(publicAssetId);
    if (!asset) {
      notFound(`Public asset not found: ${publicAssetId}`);
    }
    if (!asset.claimsReviewed || asset.claimsReviewStatus !== "completed") {
      badRequest("All public-facing claims must be reviewed before approval routing.");
    }
    if (!asset.documentId) {
      badRequest("Public asset is missing its linked document.");
    }

    await this.advanceWorkflowIfPossible(
      actor,
      asset.workflowRunId,
      ["quality_checked", "awaiting_human_review"],
      "Public asset routed for human approval."
    );

    const result = await this.submitDocument(actor, asset.documentId);
    const synced = await this.syncPublicAssetFromDocument(result.document);

    await this.recordAudit(actor, "public_asset.submitted", "public_asset", asset.id, {
      documentId: asset.documentId,
      approvalCount: result.approvals.length
    });

    return {
      publicAsset: synced ?? asset,
      document: result.document,
      approvals: result.approvals
    };
  }

  async publishPublicAsset(actor: ActorContext, publicAssetId: string): Promise<PublicAssetRecord> {
    const asset = await this.repository.getPublicAsset(publicAssetId);
    if (!asset) {
      notFound(`Public asset not found: ${publicAssetId}`);
    }
    if (!asset.documentId) {
      badRequest("Public asset is missing its linked document.");
    }

    const updatedDocument = await this.publishDocument(actor, asset.documentId);
    const synced = await this.syncPublicAssetFromDocument(updatedDocument);

    await this.recordAudit(actor, "public_asset.publish_requested", "public_asset", asset.id, {
      documentId: asset.documentId
    });

    return synced ?? asset;
  }

  async listCommittees(filters?: {
    category?: string;
    isActive?: boolean;
    qapiFocus?: boolean;
    serviceLine?: string;
  }): Promise<CommitteeRecord[]> {
    return this.repository.listCommittees(filters);
  }

  async createCommittee(actor: ActorContext, input: unknown): Promise<CommitteeRecord> {
    const command = committeeCreateSchema.parse(input);
    const created = await this.repository.createCommittee(createCommitteeRecord({
      name: command.name,
      category: command.category,
      cadence: command.cadence,
      chairRole: command.chairRole,
      recorderRole: command.recorderRole,
      scope: command.scope,
      serviceLine: command.serviceLine ?? null,
      qapiFocus: command.qapiFocus ?? command.category === "qapi"
    }));

    await this.recordAudit(actor, "committee.created", "committee", created.id, {
      category: created.category,
      cadence: created.cadence,
      qapiFocus: created.qapiFocus
    });

    return created;
  }

  async updateCommittee(actor: ActorContext, committeeId: string, input: unknown): Promise<CommitteeRecord> {
    const command = committeeUpdateSchema.parse(input);
    const committee = await this.repository.getCommittee(committeeId);
    if (!committee) {
      notFound(`Committee not found: ${committeeId}`);
    }

    const updated = await this.repository.updateCommittee(committee.id, {
      name: command.name ?? committee.name,
      category: command.category ?? committee.category,
      cadence: command.cadence ?? committee.cadence,
      chairRole: command.chairRole ?? committee.chairRole,
      recorderRole: command.recorderRole ?? committee.recorderRole,
      scope: command.scope ?? committee.scope,
      serviceLine: command.serviceLine !== undefined ? command.serviceLine : committee.serviceLine,
      qapiFocus: command.qapiFocus ?? committee.qapiFocus,
      isActive: command.isActive ?? committee.isActive,
      updatedAt: new Date().toISOString()
    });

    await this.recordAudit(actor, "committee.updated", "committee", updated.id, {
      category: updated.category,
      isActive: updated.isActive
    });

    return updated;
  }

  async bootstrapRecommendedCommittees(actor: ActorContext): Promise<{
    created: CommitteeRecord[];
    existing: CommitteeRecord[];
  }> {
    const existing = await this.repository.listCommittees();
    const recommended = [
      {
        name: "Leadership Committee",
        category: "leadership" as const,
        cadence: "monthly" as const,
        chairRole: "medical_director" as const,
        recorderRole: "office_manager" as const,
        scope: "Strategic priorities, staffing decisions, and high-risk escalations.",
        qapiFocus: false
      },
      {
        name: "QAPI Committee",
        category: "qapi" as const,
        cadence: "monthly" as const,
        chairRole: "medical_director" as const,
        recorderRole: "quality_lead" as const,
        scope: "Monthly quality review, incident themes, CAPA follow-through, and dashboard review.",
        qapiFocus: true
      },
      {
        name: "HR / Training Committee",
        category: "hr_training" as const,
        cadence: "monthly" as const,
        chairRole: "hr_lead" as const,
        recorderRole: "office_manager" as const,
        scope: "Onboarding status, competency gaps, and performance-review tracking.",
        qapiFocus: false
      },
      {
        name: "Revenue / Commercial Committee",
        category: "revenue_commercial" as const,
        cadence: "monthly" as const,
        chairRole: "cfo" as const,
        recorderRole: "office_manager" as const,
        scope: "Payer issues, service-line revenue review, pricing governance, and commercial risk.",
        qapiFocus: false
      }
    ];

    const created: CommitteeRecord[] = [];
    const alreadyPresent: CommitteeRecord[] = [];

    for (const template of recommended) {
      const match = existing.find((committee) => committee.name === template.name);
      if (match) {
        alreadyPresent.push(match);
        continue;
      }
      created.push(await this.createCommittee(actor, template));
    }

    return {
      created,
      existing: alreadyPresent
    };
  }

  async getCommitteeQapiDashboardSummary(): Promise<CommitteeQapiDashboardSummary> {
    return this.buildCommitteeQapiDashboardSummary();
  }

  async listCommitteeMeetings(filters?: {
    committeeId?: string;
    status?: string;
  }): Promise<CommitteeMeetingRecord[]> {
    return this.repository.listCommitteeMeetings(filters);
  }

  async createCommitteeMeeting(actor: ActorContext, input: unknown): Promise<CommitteeMeetingRecord> {
    const command = committeeMeetingCreateSchema.parse(input);
    const committee = await this.repository.getCommittee(command.committeeId);
    if (!committee || !committee.isActive) {
      badRequest(`Committee is not available for scheduling: ${command.committeeId}`);
    }

    const qapiSnapshot = committee.qapiFocus
      ? await this.buildCommitteeQapiSnapshot(command.qapiSummaryNote ?? null)
      : null;
    const created = await this.repository.createCommitteeMeeting(createCommitteeMeetingRecord({
      committeeId: committee.id,
      title: command.title ?? `${committee.name} - ${command.scheduledFor.slice(0, 10)}`,
      scheduledFor: command.scheduledFor,
      notes: command.notes ?? null,
      agendaItems: command.agendaItems,
      qapiSnapshot,
      createdBy: actor.actorId
    }));

    await this.recordAudit(actor, "committee.meeting_created", "committee_meeting", created.id, {
      committeeId: created.committeeId,
      scheduledFor: created.scheduledFor,
      agendaItemCount: created.agendaItems.length
    });

    return created;
  }

  async generateCommitteePacket(actor: ActorContext, committeeMeetingId: string): Promise<{
    committeeMeeting: CommitteeMeetingRecord;
    document: DocumentRecord;
  }> {
    const meeting = await this.repository.getCommitteeMeeting(committeeMeetingId);
    if (!meeting) {
      notFound(`Committee meeting not found: ${committeeMeetingId}`);
    }
    if (["review_pending", "approved", "completed", "cancelled"].includes(meeting.status)) {
      badRequest("Committee packet cannot be regenerated after review has started.");
    }

    const committee = await this.repository.getCommittee(meeting.committeeId);
    if (!committee || !committee.isActive) {
      badRequest(`Committee is not available for packet generation: ${meeting.committeeId}`);
    }

    const qapiSnapshot = committee.qapiFocus
      ? await this.buildCommitteeQapiSnapshot(meeting.qapiSnapshot?.summaryNote ?? null)
      : null;
    const packetBody = this.buildCommitteePacketBody(committee, {
      ...meeting,
      qapiSnapshot
    });

    const workflow = meeting.workflowRunId
      ? await this.repository.getWorkflowRun(meeting.workflowRunId)
      : await this.createWorkflowRun(actor, {
        workflowId: committee.qapiFocus ? "qapi_monthly_review" : "committee_packet_review",
        input: {
          committeeId: committee.id,
          committeeName: committee.name,
          scheduledFor: meeting.scheduledFor,
          requestedBy: actor.actorId,
          qapiFocus: committee.qapiFocus,
          agendaItemCount: meeting.agendaItems.length
        }
      });

    if (!workflow) {
      badRequest("Committee packet workflow could not be created.");
    }

    await this.advanceWorkflowIfPossible(actor, workflow.id, ["scoped", "drafted", "quality_checked"], "Committee packet drafted.");

    const now = new Date().toISOString();
    const artifactType = committee.qapiFocus ? "qapi_committee_packet" : "committee_packet";
    const summary = committee.qapiFocus
      ? "Monthly QAPI review packet generated from live clinic governance data."
      : `Committee packet for ${committee.name}.`;

    let document = meeting.packetDocumentId ? await this.repository.getDocument(meeting.packetDocumentId) : null;
    if (document && !["draft", "rejected"].includes(document.status)) {
      badRequest("Committee packet is already under review or approved.");
    }

    if (document) {
      document = await this.repository.updateDocument(document.id, {
        title: meeting.title,
        ownerRole: committee.chairRole,
        summary,
        body: packetBody,
        serviceLines: committee.serviceLine ? [committee.serviceLine] : [],
        status: "draft",
        updatedAt: now,
        version: document.version + 1
      });
    } else {
      document = await this.createDocument(actor, {
        title: meeting.title,
        ownerRole: committee.chairRole,
        approvalClass: "clinical_governance",
        artifactType,
        summary,
        workflowRunId: workflow.id,
        serviceLines: committee.serviceLine ? [committee.serviceLine] : [],
        body: packetBody
      });
    }

    const updatedMeeting = await this.repository.updateCommitteeMeeting(meeting.id, {
      status: "packet_ready",
      packetDocumentId: document.id,
      workflowRunId: workflow.id,
      qapiSnapshot,
      updatedAt: now
    });

    await this.recordAudit(actor, "committee.packet_generated", "committee_meeting", updatedMeeting.id, {
      committeeId: updatedMeeting.committeeId,
      packetDocumentId: updatedMeeting.packetDocumentId,
      workflowRunId: updatedMeeting.workflowRunId,
      qapiFocus: committee.qapiFocus
    });

    return {
      committeeMeeting: updatedMeeting,
      document
    };
  }

  async submitCommitteeMeeting(actor: ActorContext, committeeMeetingId: string): Promise<{
    committeeMeeting: CommitteeMeetingRecord;
    document: DocumentRecord;
    approvals: ApprovalTask[];
  }> {
    const meeting = await this.repository.getCommitteeMeeting(committeeMeetingId);
    if (!meeting) {
      notFound(`Committee meeting not found: ${committeeMeetingId}`);
    }
    if (!meeting.packetDocumentId) {
      badRequest("Generate the committee packet before routing it for review.");
    }
    if (!["packet_ready", "sent_back"].includes(meeting.status)) {
      badRequest("Committee packet is not ready for approval routing.");
    }

    await this.advanceWorkflowIfPossible(
      actor,
      meeting.workflowRunId,
      ["quality_checked", "awaiting_human_review"],
      "Committee packet routed for human review."
    );

    const result = await this.submitDocument(actor, meeting.packetDocumentId);
    const synced = await this.syncCommitteeMeetingFromDocument(result.document);

    await this.recordAudit(actor, "committee.packet_submitted", "committee_meeting", meeting.id, {
      packetDocumentId: meeting.packetDocumentId,
      approvalCount: result.approvals.length
    });

    return {
      committeeMeeting: synced ?? meeting,
      document: result.document,
      approvals: result.approvals
    };
  }

  async recordCommitteeDecisions(actor: ActorContext, committeeMeetingId: string, input: unknown): Promise<CommitteeMeetingRecord> {
    const command = committeeMeetingDecisionCommandSchema.parse(input);
    const meeting = await this.repository.getCommitteeMeeting(committeeMeetingId);
    if (!meeting) {
      notFound(`Committee meeting not found: ${committeeMeetingId}`);
    }
    if (!["approved", "completed"].includes(meeting.status)) {
      badRequest("Committee decisions can only be recorded after the packet is approved.");
    }

    const committee = await this.repository.getCommittee(meeting.committeeId);
    if (!committee) {
      notFound(`Committee not found: ${meeting.committeeId}`);
    }

    const now = new Date().toISOString();
    const nextDecisions: CommitteeDecisionRecord[] = [...meeting.decisions];
    let createdActionItems = 0;

    for (const decision of command.decisions) {
      let actionItemId: string | null = null;
      if (decision.dueDate) {
        const actionItem = await this.createActionItem(actor, {
          kind: "action_item",
          title: `${committee.name}: ${decision.summary}`,
          description: decision.notes ?? `Committee follow-up from ${meeting.title}.`,
          ownerRole: decision.ownerRole,
          dueDate: decision.dueDate,
          sourceWorkflowRunId: meeting.workflowRunId ?? undefined
        });
        actionItemId = actionItem.id;
        createdActionItems += 1;
      }

      nextDecisions.push({
        id: randomId("committee_decision"),
        summary: decision.summary,
        ownerRole: decision.ownerRole,
        dueDate: decision.dueDate ?? null,
        status: decision.status ?? "open",
        actionItemId,
        linkedIncidentId: decision.linkedIncidentId ?? null,
        linkedCapaId: decision.linkedCapaId ?? null,
        notes: decision.notes ?? null
      });
    }

    const updated = await this.repository.updateCommitteeMeeting(meeting.id, {
      decisions: nextDecisions,
      updatedAt: now
    });

    await this.recordAudit(actor, "committee.decisions_recorded", "committee_meeting", updated.id, {
      decisionCount: command.decisions.length,
      createdActionItems
    });

    return updated;
  }

  async completeCommitteeMeeting(actor: ActorContext, committeeMeetingId: string, input: unknown): Promise<CommitteeMeetingRecord> {
    const command = committeeMeetingCompleteSchema.parse(input);
    const meeting = await this.repository.getCommitteeMeeting(committeeMeetingId);
    if (!meeting) {
      notFound(`Committee meeting not found: ${committeeMeetingId}`);
    }
    if (!["approved", "completed"].includes(meeting.status)) {
      badRequest("Committee meetings can only be completed after the packet is approved.");
    }

    const now = new Date().toISOString();
    const updated = await this.repository.updateCommitteeMeeting(meeting.id, {
      status: "completed",
      notes: command.notes ?? meeting.notes,
      completedAt: meeting.completedAt ?? now,
      updatedAt: now
    });

    await this.advanceWorkflowIfPossible(actor, meeting.workflowRunId, ["approved", "archived"], "Committee meeting completed.");
    await this.recordAudit(actor, "committee.meeting_completed", "committee_meeting", updated.id, {
      completedAt: updated.completedAt,
      decisionCount: updated.decisions.length
    });

    return updated;
  }

  async listServiceLines(filters?: {
    governanceStatus?: string;
    ownerRole?: string;
  }): Promise<Array<{
    serviceLine: ServiceLineRecord;
    latestPack: ServiceLinePackRecord | null;
    linkedPublicAssetCount: number;
    publishedPublicAssetCount: number;
  }>> {
    const [serviceLines, packs, publicAssets] = await Promise.all([
      this.repository.listServiceLines(filters),
      this.repository.listServiceLinePacks(),
      this.repository.listPublicAssets()
    ]);

    return serviceLines.map((serviceLine) => {
      const serviceLinePacks = packs.filter((pack) => pack.serviceLineId === serviceLine.id);
      const serviceAssets = publicAssets.filter((asset) => asset.serviceLine === serviceLine.id);
      return {
        serviceLine,
        latestPack: serviceLinePacks[0] ?? null,
        linkedPublicAssetCount: serviceAssets.length,
        publishedPublicAssetCount: serviceAssets.filter((asset) => asset.status === "published").length
      };
    });
  }

  async createServiceLine(actor: ActorContext, input: unknown): Promise<ServiceLineRecord> {
    const command = serviceLineCreateSchema.parse(input);
    const existing = await this.repository.getServiceLine(command.id);
    if (existing) {
      badRequest(`Service line already exists: ${command.id}`);
    }

    const created = await this.repository.createServiceLine(createServiceLineRecord({
      id: command.id,
      ownerRole: command.ownerRole ?? null,
      reviewCadenceDays: command.reviewCadenceDays
    }));

    await this.recordAudit(actor, "service_line.created", "service_line", created.id, {
      ownerRole: created.ownerRole,
      reviewCadenceDays: created.reviewCadenceDays
    });

    return created;
  }

  async bootstrapServiceLines(actor: ActorContext): Promise<{
    created: ServiceLineRecord[];
    existing: ServiceLineRecord[];
  }> {
    const defaults: Array<{ id: ServiceLineRecord["id"]; ownerRole: ServiceLineRecord["ownerRole"]; reviewCadenceDays: number }> = [
      { id: "primary_care", ownerRole: "medical_director", reviewCadenceDays: 90 },
      { id: "women_health", ownerRole: "medical_director", reviewCadenceDays: 90 },
      { id: "telehealth", ownerRole: "medical_director", reviewCadenceDays: 60 },
      { id: "weight_management", ownerRole: "medical_director", reviewCadenceDays: 60 },
      { id: "hrt", ownerRole: "medical_director", reviewCadenceDays: 60 },
      { id: "vaccines", ownerRole: "quality_lead", reviewCadenceDays: 60 },
      { id: "waived_testing", ownerRole: "quality_lead", reviewCadenceDays: 60 },
      { id: "contracted_lab", ownerRole: "quality_lead", reviewCadenceDays: 60 },
      { id: "iv_hydration", ownerRole: "medical_director", reviewCadenceDays: 60 },
      { id: "aesthetics", ownerRole: "cfo", reviewCadenceDays: 90 },
      { id: "allergy_testing", ownerRole: "medical_director", reviewCadenceDays: 90 }
    ];

    const created: ServiceLineRecord[] = [];
    const existing: ServiceLineRecord[] = [];

    for (const entry of defaults) {
      const match = await this.repository.getServiceLine(entry.id);
      if (match) {
        existing.push(match);
        continue;
      }
      created.push(await this.createServiceLine(actor, entry));
    }

    return { created, existing };
  }

  async updateServiceLine(actor: ActorContext, serviceLineId: string, input: unknown): Promise<ServiceLineRecord> {
    const command = serviceLineUpdateSchema.parse(input);
    const record = await this.repository.getServiceLine(serviceLineId);
    if (!record) {
      notFound(`Service line not found: ${serviceLineId}`);
    }

    const updated = await this.repository.updateServiceLine(record.id, {
      ownerRole: command.ownerRole !== undefined ? command.ownerRole : record.ownerRole,
      governanceStatus: command.governanceStatus ?? record.governanceStatus,
      hasCharter: command.hasCharter ?? record.hasCharter,
      hasCompetencyMatrix: command.hasCompetencyMatrix ?? record.hasCompetencyMatrix,
      hasAuditTool: command.hasAuditTool ?? record.hasAuditTool,
      hasClaimsInventory: command.hasClaimsInventory ?? record.hasClaimsInventory,
      reviewCadenceDays: command.reviewCadenceDays ?? record.reviewCadenceDays,
      lastReviewedAt: command.lastReviewedAt !== undefined ? command.lastReviewedAt : record.lastReviewedAt,
      nextReviewDueAt: command.nextReviewDueAt !== undefined ? command.nextReviewDueAt : record.nextReviewDueAt,
      updatedAt: new Date().toISOString()
    });

    await this.recordAudit(actor, "service_line.updated", "service_line", updated.id, {
      governanceStatus: updated.governanceStatus,
      ownerRole: updated.ownerRole
    });

    return updated;
  }

  async generateServiceLinePack(actor: ActorContext, serviceLineId: string, input: unknown): Promise<{
    serviceLine: ServiceLineRecord;
    pack: ServiceLinePackRecord;
    document: DocumentRecord;
  }> {
    const command = serviceLinePackCreateSchema.parse(input);
    const record = await this.repository.getServiceLine(serviceLineId);
    if (!record) {
      notFound(`Service line not found: ${serviceLineId}`);
    }

    const publicAssets = await this.repository.listPublicAssets({ serviceLine: serviceLineId });
    const workflow = await this.createWorkflowRun(actor, {
      workflowId: "service_line_pack_review",
      input: {
        serviceLineId,
        ownerRole: command.ownerRole,
        requestedBy: actor.actorId,
        reviewCadenceDays: record.reviewCadenceDays,
        publicAssetCount: publicAssets.length
      }
    });

    await this.advanceWorkflowIfPossible(actor, workflow.id, ["scoped", "drafted"], "Service-line governance pack drafted.");

    const title = command.title ?? `${serviceLineId.replaceAll("_", " ")} governance pack`;
    const body = this.buildServiceLinePackBody(record.id, command, publicAssets.length);
    const document = await this.createDocument(actor, {
      title,
      ownerRole: command.ownerRole,
      approvalClass: "clinical_governance",
      artifactType: "service_line_pack",
      summary: `Governance pack for ${serviceLineId.replaceAll("_", " ")} service line.`,
      workflowRunId: workflow.id,
      serviceLines: [serviceLineId as DocumentRecord["serviceLines"][number]],
      body
    });
    const pack = await this.repository.createServiceLinePack(createServiceLinePackRecord({
      serviceLineId: record.id,
      title,
      ownerRole: command.ownerRole,
      charterSummary: command.charterSummary,
      inclusionExclusionRules: command.inclusionExclusionRules,
      roleMatrixSummary: command.roleMatrixSummary,
      competencyRequirements: command.competencyRequirements,
      auditToolSummary: command.auditToolSummary,
      emergencyEscalation: command.emergencyEscalation,
      pricingModelSummary: command.pricingModelSummary,
      claimsGovernanceSummary: command.claimsGovernanceSummary,
      notes: command.notes ?? null,
      documentId: document.id,
      workflowRunId: workflow.id,
      createdBy: actor.actorId
    }));

    const now = new Date().toISOString();
    const updatedServiceLine = await this.repository.updateServiceLine(record.id, {
      ownerRole: command.ownerRole,
      governanceStatus: "drafting",
      hasCharter: true,
      hasCompetencyMatrix: true,
      hasAuditTool: true,
      hasClaimsInventory: publicAssets.length > 0 || command.claimsGovernanceSummary.trim().length > 0,
      latestPackId: pack.id,
      updatedAt: now
    });

    await this.recordAudit(actor, "service_line.pack_generated", "service_line_pack", pack.id, {
      serviceLineId: record.id,
      workflowRunId: workflow.id,
      documentId: document.id
    });

    return {
      serviceLine: updatedServiceLine,
      pack,
      document
    };
  }

  async submitServiceLinePack(actor: ActorContext, serviceLineId: string): Promise<{
    serviceLine: ServiceLineRecord;
    pack: ServiceLinePackRecord;
    document: DocumentRecord;
    approvals: ApprovalTask[];
  }> {
    const serviceLine = await this.repository.getServiceLine(serviceLineId);
    if (!serviceLine) {
      notFound(`Service line not found: ${serviceLineId}`);
    }
    const pack = await this.getLatestServiceLinePack(serviceLineId);
    if (!pack || !pack.documentId) {
      badRequest("Generate a service-line pack before routing it for approval.");
    }

    await this.advanceWorkflowIfPossible(
      actor,
      pack.workflowRunId,
      ["drafted", "quality_checked", "awaiting_human_review"],
      "Service-line pack routed for human review."
    );

    const result = await this.submitDocument(actor, pack.documentId);
    const syncedPack = await this.syncServiceLinePackFromDocument(result.document);
    const updatedServiceLine = await this.repository.updateServiceLine(serviceLine.id, {
      governanceStatus: "review_pending",
      updatedAt: new Date().toISOString()
    });

    await this.recordAudit(actor, "service_line.pack_submitted", "service_line_pack", pack.id, {
      serviceLineId,
      approvalCount: result.approvals.length
    });

    return {
      serviceLine: updatedServiceLine,
      pack: syncedPack ?? pack,
      document: result.document,
      approvals: result.approvals
    };
  }

  async publishServiceLinePack(actor: ActorContext, serviceLineId: string): Promise<{
    serviceLine: ServiceLineRecord;
    pack: ServiceLinePackRecord;
  }> {
    const serviceLine = await this.repository.getServiceLine(serviceLineId);
    if (!serviceLine) {
      notFound(`Service line not found: ${serviceLineId}`);
    }
    const pack = await this.getLatestServiceLinePack(serviceLineId);
    if (!pack || !pack.documentId) {
      badRequest("Service-line pack is not available for publication.");
    }

    const document = await this.publishDocument(actor, pack.documentId);
    const syncedPack = await this.syncServiceLinePackFromDocument(document);
    const updatedServiceLine = await this.repository.updateServiceLine(serviceLine.id, {
      governanceStatus: "approved",
      updatedAt: new Date().toISOString()
    });

    await this.recordAudit(actor, "service_line.pack_publish_requested", "service_line_pack", pack.id, {
      serviceLineId
    });

    return {
      serviceLine: updatedServiceLine,
      pack: syncedPack ?? pack
    };
  }

  async listPracticeAgreements(filters?: {
    status?: string;
    ownerRole?: string;
    supervisingPhysicianRole?: string;
    supervisedRole?: string;
    agreementType?: string;
    serviceLineId?: string;
  }): Promise<PracticeAgreementRecord[]> {
    const { serviceLineId, ...repositoryFilters } = filters ?? {};
    const agreements = await this.repository.listPracticeAgreements(repositoryFilters);
    if (!serviceLineId) {
      return agreements;
    }
    return agreements.filter((agreement) => agreement.serviceLineIds.includes(serviceLineId as PracticeAgreementRecord["serviceLineIds"][number]));
  }

  async createPracticeAgreement(actor: ActorContext, input: unknown): Promise<{
    practiceAgreement: PracticeAgreementRecord;
    document: DocumentRecord;
  }> {
    const command = practiceAgreementCreateSchema.parse(input);
    const workflow = await this.createWorkflowRun(actor, {
      workflowId: "practice_agreement_review",
      input: {
        title: command.title,
        agreementType: command.agreementType,
        ownerRole: command.ownerRole,
        supervisingPhysicianRole: command.supervisingPhysicianRole,
        supervisedRole: command.supervisedRole,
        serviceLineIds: command.serviceLineIds,
        requestedBy: actor.actorId,
        reviewCadenceDays: command.reviewCadenceDays ?? 90
      }
    });

    await this.advanceWorkflowIfPossible(actor, workflow.id, ["scoped", "drafted"], "Practice agreement drafted.");

    const document = await this.createDocument(actor, {
      title: command.title,
      ownerRole: command.ownerRole,
      approvalClass: "clinical_governance",
      artifactType: command.agreementType,
      summary: `Physician oversight agreement for ${command.supervisedRole.replaceAll("_", " ")} across ${command.serviceLineIds.map((serviceLineId) => serviceLineId.replaceAll("_", " ")).join(", ")}.`,
      workflowRunId: workflow.id,
      serviceLines: command.serviceLineIds,
      body: this.buildPracticeAgreementBody(command)
    });

    const practiceAgreement = await this.repository.createPracticeAgreement(createPracticeAgreementRecord({
      ...command,
      reviewCadenceDays: command.reviewCadenceDays ?? 90,
      notes: command.notes ?? null,
      documentId: document.id,
      workflowRunId: workflow.id,
      createdBy: actor.actorId
    }));

    await this.recordAudit(actor, "practice_agreement.created", "practice_agreement", practiceAgreement.id, {
      workflowRunId: workflow.id,
      documentId: document.id,
      supervisedRole: practiceAgreement.supervisedRole,
      serviceLineIds: practiceAgreement.serviceLineIds
    });

    return {
      practiceAgreement,
      document
    };
  }

  async bootstrapPracticeAgreements(actor: ActorContext): Promise<{
    created: PracticeAgreementRecord[];
    existing: PracticeAgreementRecord[];
  }> {
    const defaults: Array<z.infer<typeof practiceAgreementCreateSchema>> = [
      {
        title: "Telehealth physician oversight agreement",
        agreementType: "physician_oversight_plan",
        ownerRole: "medical_director",
        supervisingPhysicianName: "Assigned supervising physician",
        supervisingPhysicianRole: "patient_care_team_physician",
        supervisedRole: "nurse_practitioner",
        serviceLineIds: ["telehealth"],
        scopeSummary: "Define synchronous and asynchronous telehealth oversight boundaries, escalation expectations, and chart-review cadence for advanced practice clinicians.",
        delegatedActivitiesSummary: "Covers protocol-guided follow-up visits, refill review, escalation thresholds, and physician availability for higher-acuity telehealth findings.",
        cosignExpectation: "Physician cosign is required for new treatment plans, protocol exceptions, and charts flagged through peer review or adverse-event monitoring.",
        escalationProtocol: "Escalate same-day for unstable symptoms, unexpected treatment response, or any protocol exception requiring physician review.",
        reviewCadenceDays: 60,
        notes: "Pair with the active telehealth service-line pack and delegation matrix."
      },
      {
        title: "Weight management NP practice agreement",
        agreementType: "practice_agreement",
        ownerRole: "medical_director",
        supervisingPhysicianName: "Assigned supervising physician",
        supervisingPhysicianRole: "patient_care_team_physician",
        supervisedRole: "nurse_practitioner",
        serviceLineIds: ["weight_management"],
        scopeSummary: "Define the advanced practice scope, physician oversight cadence, and medication-protocol guardrails for the weight-management program.",
        delegatedActivitiesSummary: "Covers intake review, protocol-based medication titration, follow-up documentation, escalation thresholds, and physician consultation triggers.",
        cosignExpectation: "Cosign is required for new medication starts outside approved pathways, protocol deviations, and charts escalated for physician review.",
        escalationProtocol: "Escalate immediately for contraindications, significant adverse effects, rapid deterioration, or any patient scenario outside the approved protocol.",
        reviewCadenceDays: 60,
        notes: "Keep aligned with the service-line governance pack and current delegation rules."
      },
      {
        title: "HRT physician oversight agreement",
        agreementType: "practice_agreement",
        ownerRole: "medical_director",
        supervisingPhysicianName: "Assigned supervising physician",
        supervisingPhysicianRole: "patient_care_team_physician",
        supervisedRole: "nurse_practitioner",
        serviceLineIds: ["hrt"],
        scopeSummary: "Define physician oversight boundaries for hormone-related evaluations, follow-up cadence, and documentation expectations in the HRT program.",
        delegatedActivitiesSummary: "Covers standing follow-up care, refill review, lab follow-up under approved protocols, and required physician consultation scenarios.",
        cosignExpectation: "Cosign is required for new-start treatment plans, exceptions to standing protocols, and any higher-risk chart selected for physician review.",
        escalationProtocol: "Escalate same-day for red-flag symptoms, out-of-range clinical findings, protocol exceptions, or any uncertainty about treatment appropriateness.",
        reviewCadenceDays: 60,
        notes: "Review alongside the HRT service-line governance pack and any active public-claims constraints."
      }
    ];

    const existingRecords = await this.repository.listPracticeAgreements();
    const created: PracticeAgreementRecord[] = [];
    const existing: PracticeAgreementRecord[] = [];

    for (const entry of defaults) {
      const match = existingRecords.find((record) =>
        record.title === entry.title
        && record.supervisedRole === entry.supervisedRole
        && record.serviceLineIds.join("|") === entry.serviceLineIds.join("|")
        && record.status !== "archived"
      );
      if (match) {
        existing.push(match);
        continue;
      }
      created.push((await this.createPracticeAgreement(actor, entry)).practiceAgreement);
    }

    return {
      created,
      existing
    };
  }

  async updatePracticeAgreement(actor: ActorContext, practiceAgreementId: string, input: unknown): Promise<{
    practiceAgreement: PracticeAgreementRecord;
    document: DocumentRecord | null;
  }> {
    const command = practiceAgreementUpdateSchema.parse(input);
    const practiceAgreement = await this.repository.getPracticeAgreement(practiceAgreementId);
    if (!practiceAgreement) {
      notFound(`Practice agreement not found: ${practiceAgreementId}`);
    }
    if (!["draft", "sent_back"].includes(practiceAgreement.status)) {
      badRequest("Only draft or sent-back practice agreements can be edited.");
    }

    const nextServiceLineIds = command.serviceLineIds ?? practiceAgreement.serviceLineIds;
    const nextOwnerRole = command.ownerRole ?? practiceAgreement.ownerRole;
    const updatedAt = new Date().toISOString();
    const updatedPracticeAgreement = await this.repository.updatePracticeAgreement(practiceAgreement.id, {
      title: command.title ?? practiceAgreement.title,
      agreementType: command.agreementType ?? practiceAgreement.agreementType,
      status: command.status ?? practiceAgreement.status,
      ownerRole: nextOwnerRole,
      supervisingPhysicianName: command.supervisingPhysicianName ?? practiceAgreement.supervisingPhysicianName,
      supervisingPhysicianRole: command.supervisingPhysicianRole ?? practiceAgreement.supervisingPhysicianRole,
      supervisedRole: command.supervisedRole ?? practiceAgreement.supervisedRole,
      serviceLineIds: nextServiceLineIds,
      scopeSummary: command.scopeSummary ?? practiceAgreement.scopeSummary,
      delegatedActivitiesSummary: command.delegatedActivitiesSummary ?? practiceAgreement.delegatedActivitiesSummary,
      cosignExpectation: command.cosignExpectation ?? practiceAgreement.cosignExpectation,
      escalationProtocol: command.escalationProtocol ?? practiceAgreement.escalationProtocol,
      reviewCadenceDays: command.reviewCadenceDays ?? practiceAgreement.reviewCadenceDays,
      effectiveDate: command.effectiveDate !== undefined ? command.effectiveDate : practiceAgreement.effectiveDate,
      expiresAt: command.expiresAt !== undefined ? command.expiresAt : practiceAgreement.expiresAt,
      notes: command.notes !== undefined ? command.notes : practiceAgreement.notes,
      updatedAt
    });

    let document: DocumentRecord | null = null;
    if (practiceAgreement.documentId) {
      const draftDocument = await this.repository.getDocument(practiceAgreement.documentId);
      if (!draftDocument) {
        notFound(`Practice-agreement document not found: ${practiceAgreement.documentId}`);
      }
      if (!["draft", "rejected"].includes(draftDocument.status)) {
        badRequest("Practice-agreement draft is already under review or published.");
      }

      document = await this.repository.updateDocument(draftDocument.id, {
        title: updatedPracticeAgreement.title,
        ownerRole: nextOwnerRole,
        summary: `Physician oversight agreement for ${updatedPracticeAgreement.supervisedRole.replaceAll("_", " ")} across ${updatedPracticeAgreement.serviceLineIds.map((serviceLineId) => serviceLineId.replaceAll("_", " ")).join(", ")}.`,
        body: this.buildPracticeAgreementBody(updatedPracticeAgreement),
        serviceLines: updatedPracticeAgreement.serviceLineIds,
        status: "draft",
        updatedAt,
        version: draftDocument.version + 1
      });
    }

    await this.recordAudit(actor, "practice_agreement.updated", "practice_agreement", updatedPracticeAgreement.id, {
      status: updatedPracticeAgreement.status,
      supervisedRole: updatedPracticeAgreement.supervisedRole,
      serviceLineIds: updatedPracticeAgreement.serviceLineIds
    });

    return {
      practiceAgreement: updatedPracticeAgreement,
      document
    };
  }

  async submitPracticeAgreement(actor: ActorContext, practiceAgreementId: string): Promise<{
    practiceAgreement: PracticeAgreementRecord;
    document: DocumentRecord;
    approvals: ApprovalTask[];
  }> {
    const practiceAgreement = await this.repository.getPracticeAgreement(practiceAgreementId);
    if (!practiceAgreement) {
      notFound(`Practice agreement not found: ${practiceAgreementId}`);
    }
    if (!practiceAgreement.documentId) {
      badRequest("Create a practice-agreement draft before routing it for approval.");
    }
    if (!["draft", "sent_back"].includes(practiceAgreement.status)) {
      badRequest("Practice agreement is not ready for approval routing.");
    }

    await this.advanceWorkflowIfPossible(
      actor,
      practiceAgreement.workflowRunId,
      ["drafted", "quality_checked", "awaiting_human_review"],
      "Practice agreement routed for human review."
    );

    const result = await this.submitDocument(actor, practiceAgreement.documentId);
    const synced = await this.syncPracticeAgreementFromDocument(result.document);

    await this.recordAudit(actor, "practice_agreement.submitted", "practice_agreement", practiceAgreement.id, {
      approvalCount: result.approvals.length,
      documentId: practiceAgreement.documentId
    });

    return {
      practiceAgreement: synced ?? practiceAgreement,
      document: result.document,
      approvals: result.approvals
    };
  }

  async publishPracticeAgreement(actor: ActorContext, practiceAgreementId: string): Promise<{
    practiceAgreement: PracticeAgreementRecord;
    document: DocumentRecord;
  }> {
    const practiceAgreement = await this.repository.getPracticeAgreement(practiceAgreementId);
    if (!practiceAgreement) {
      notFound(`Practice agreement not found: ${practiceAgreementId}`);
    }
    if (!practiceAgreement.documentId) {
      badRequest("Practice agreement is not available for publication.");
    }

    const document = await this.publishDocument(actor, practiceAgreement.documentId);
    const synced = await this.syncPracticeAgreementFromDocument(document);

    await this.recordAudit(actor, "practice_agreement.publish_requested", "practice_agreement", practiceAgreement.id, {
      documentId: practiceAgreement.documentId
    });

    return {
      practiceAgreement: synced ?? practiceAgreement,
      document
    };
  }

  async listTelehealthStewardship(filters?: {
    status?: string;
    ownerRole?: string;
    supervisingPhysicianRole?: string;
  }): Promise<TelehealthStewardshipRecord[]> {
    return this.repository.listTelehealthStewardship(filters);
  }

  async createTelehealthStewardship(actor: ActorContext, input: unknown): Promise<{
    stewardship: TelehealthStewardshipRecord;
    document: DocumentRecord;
  }> {
    const command = telehealthStewardshipCreateSchema.parse(input);
    const linkedPracticeAgreement = command.linkedPracticeAgreementId
      ? await this.repository.getPracticeAgreement(command.linkedPracticeAgreementId)
      : null;
    if (command.linkedPracticeAgreementId && !linkedPracticeAgreement) {
      notFound(`Linked practice agreement not found: ${command.linkedPracticeAgreementId}`);
    }

    const workflow = await this.createWorkflowRun(actor, {
      workflowId: "telehealth_stewardship_review",
      input: {
        title: command.title,
        ownerRole: command.ownerRole,
        supervisingPhysicianRole: command.supervisingPhysicianRole,
        linkedPracticeAgreementId: command.linkedPracticeAgreementId ?? null,
        delegatedTaskCodes: command.delegatedTaskCodes,
        requestedBy: actor.actorId,
        reviewCadenceDays: command.reviewCadenceDays ?? 60
      }
    });

    await this.advanceWorkflowIfPossible(actor, workflow.id, ["scoped", "drafted"], "Telehealth stewardship packet drafted.");

    const document = await this.createDocument(actor, {
      title: command.title,
      ownerRole: command.ownerRole,
      approvalClass: "clinical_governance",
      artifactType: "telehealth_stewardship_packet",
      summary: "Telehealth stewardship packet covering scope, identity, consent, documentation, QA, and emergency redirects.",
      workflowRunId: workflow.id,
      serviceLines: ["telehealth"],
      body: this.buildTelehealthStewardshipBody(command)
    });

    const stewardship = await this.repository.createTelehealthStewardship(createTelehealthStewardshipRecord({
      ...command,
      linkedPracticeAgreementId: command.linkedPracticeAgreementId ?? null,
      delegatedTaskCodes: command.delegatedTaskCodes,
      reviewCadenceDays: command.reviewCadenceDays ?? 60,
      notes: command.notes ?? null,
      documentId: document.id,
      workflowRunId: workflow.id,
      createdBy: actor.actorId
    }));

    await this.recordAudit(actor, "telehealth_stewardship.created", "telehealth_stewardship", stewardship.id, {
      documentId: document.id,
      workflowRunId: workflow.id,
      linkedPracticeAgreementId: stewardship.linkedPracticeAgreementId,
      delegatedTaskCodeCount: stewardship.delegatedTaskCodes.length
    });

    return {
      stewardship,
      document
    };
  }

  async bootstrapTelehealthStewardship(actor: ActorContext): Promise<{
    created: TelehealthStewardshipRecord[];
    existing: TelehealthStewardshipRecord[];
  }> {
    const existing = await this.repository.listTelehealthStewardship();
    if (existing.length > 0) {
      return {
        created: [],
        existing
      };
    }

    const [serviceLine, practiceAgreements, delegationRules] = await Promise.all([
      this.repository.getServiceLine("telehealth"),
      this.repository.listPracticeAgreements({ ownerRole: "medical_director" }),
      this.repository.listDelegationRules({ serviceLineId: "telehealth", status: "active" })
    ]);

    const linkedPracticeAgreement = practiceAgreements.find((agreement) => agreement.serviceLineIds.includes("telehealth"))
      ?? null;
    const ownerRole = serviceLine?.ownerRole ?? linkedPracticeAgreement?.ownerRole ?? "medical_director";
    const supervisingPhysicianRole = linkedPracticeAgreement?.supervisingPhysicianRole ?? "patient_care_team_physician";
    const delegatedTaskCodes = delegationRules.length > 0
      ? delegationRules.map((rule) => rule.taskCode)
      : ["virtual_triage", "refill_review", "asynchronous_follow_up"];

    const created = await this.createTelehealthStewardship(actor, {
      title: "Telehealth stewardship packet",
      ownerRole,
      supervisingPhysicianRole,
      linkedPracticeAgreementId: linkedPracticeAgreement?.id ?? null,
      delegatedTaskCodes,
      modalityScopeSummary: "Cover synchronous visits, asynchronous refill review, secure messaging follow-up, and after-hours escalation boundaries for telehealth care.",
      stateCoverageSummary: "Maintain a current licensure-and-service-state matrix, route out-of-state requests through approved escalation, and pause scheduling when coverage assumptions change.",
      patientIdentitySummary: "Verify patient identity, current location, callback number, and emergency contact before clinical decision-making or medication changes.",
      consentWorkflowSummary: "Capture telehealth consent at intake, reaffirm on material workflow changes, and document interpreter or caregiver participation when present.",
      documentationStandardSummary: "Document modality, patient location, supervising availability, escalation decision points, and any protocol deviations in every telehealth encounter note.",
      emergencyRedirectSummary: "Escalate emergent symptoms to local EMS or urgent in-person evaluation immediately, with documented warm handoff and same-day physician notification.",
      qaReviewSummary: "Review telehealth charts monthly for documentation completeness, consent capture, protocol adherence, and escalation timeliness.",
      reviewCadenceDays: serviceLine?.reviewCadenceDays ?? linkedPracticeAgreement?.reviewCadenceDays ?? 60,
      effectiveDate: linkedPracticeAgreement?.effectiveDate ?? null,
      notes: "Pair this packet with the current telehealth service-line pack, practice agreement, and delegation matrix."
    });

    return {
      created: [created.stewardship],
      existing: []
    };
  }

  async updateTelehealthStewardship(actor: ActorContext, stewardshipId: string, input: unknown): Promise<{
    stewardship: TelehealthStewardshipRecord;
    document: DocumentRecord | null;
  }> {
    const command = telehealthStewardshipUpdateSchema.parse(input);
    const stewardship = await this.repository.getTelehealthStewardship(stewardshipId);
    if (!stewardship) {
      notFound(`Telehealth stewardship packet not found: ${stewardshipId}`);
    }
    if (!["draft", "sent_back"].includes(stewardship.status)) {
      badRequest("Only draft or sent-back telehealth stewardship packets can be edited.");
    }

    const linkedPracticeAgreement = command.linkedPracticeAgreementId
      ? await this.repository.getPracticeAgreement(command.linkedPracticeAgreementId)
      : null;
    if (command.linkedPracticeAgreementId && !linkedPracticeAgreement) {
      notFound(`Linked practice agreement not found: ${command.linkedPracticeAgreementId}`);
    }

    const updated = await this.repository.updateTelehealthStewardship(stewardship.id, {
      title: command.title ?? stewardship.title,
      ownerRole: command.ownerRole ?? stewardship.ownerRole,
      supervisingPhysicianRole: command.supervisingPhysicianRole ?? stewardship.supervisingPhysicianRole,
      linkedPracticeAgreementId: command.linkedPracticeAgreementId !== undefined
        ? command.linkedPracticeAgreementId
        : stewardship.linkedPracticeAgreementId,
      delegatedTaskCodes: command.delegatedTaskCodes ?? stewardship.delegatedTaskCodes,
      modalityScopeSummary: command.modalityScopeSummary ?? stewardship.modalityScopeSummary,
      stateCoverageSummary: command.stateCoverageSummary ?? stewardship.stateCoverageSummary,
      patientIdentitySummary: command.patientIdentitySummary ?? stewardship.patientIdentitySummary,
      consentWorkflowSummary: command.consentWorkflowSummary ?? stewardship.consentWorkflowSummary,
      documentationStandardSummary: command.documentationStandardSummary ?? stewardship.documentationStandardSummary,
      emergencyRedirectSummary: command.emergencyRedirectSummary ?? stewardship.emergencyRedirectSummary,
      qaReviewSummary: command.qaReviewSummary ?? stewardship.qaReviewSummary,
      reviewCadenceDays: command.reviewCadenceDays ?? stewardship.reviewCadenceDays,
      effectiveDate: command.effectiveDate !== undefined ? command.effectiveDate : stewardship.effectiveDate,
      notes: command.notes !== undefined ? command.notes : stewardship.notes,
      status: command.status ?? stewardship.status,
      updatedAt: new Date().toISOString()
    });

    let updatedDocument: DocumentRecord | null = null;
    if (stewardship.documentId) {
      const draftDocument = await this.repository.getDocument(stewardship.documentId);
      if (!draftDocument) {
        notFound(`Telehealth stewardship document not found: ${stewardship.documentId}`);
      }
      if (!["draft", "rejected"].includes(draftDocument.status)) {
        badRequest("Telehealth stewardship draft is already under review or published.");
      }

      updatedDocument = await this.repository.updateDocument(draftDocument.id, {
        title: updated.title,
        ownerRole: updated.ownerRole,
        summary: "Telehealth stewardship packet covering scope, identity, consent, documentation, QA, and emergency redirects.",
        body: this.buildTelehealthStewardshipBody(updated),
        serviceLines: ["telehealth"],
        status: "draft",
        updatedAt: updated.updatedAt,
        version: draftDocument.version + 1
      });
    }

    await this.recordAudit(actor, "telehealth_stewardship.updated", "telehealth_stewardship", updated.id, {
      documentId: stewardship.documentId,
      linkedPracticeAgreementId: updated.linkedPracticeAgreementId
    });

    return {
      stewardship: updated,
      document: updatedDocument
    };
  }

  async submitTelehealthStewardship(actor: ActorContext, stewardshipId: string): Promise<{
    stewardship: TelehealthStewardshipRecord;
    document: DocumentRecord;
    approvals: ApprovalTask[];
  }> {
    const stewardship = await this.repository.getTelehealthStewardship(stewardshipId);
    if (!stewardship) {
      notFound(`Telehealth stewardship packet not found: ${stewardshipId}`);
    }
    if (!stewardship.documentId) {
      badRequest("Create a telehealth stewardship draft before routing it for approval.");
    }
    if (!["draft", "sent_back"].includes(stewardship.status)) {
      badRequest("Telehealth stewardship packet is not ready for approval routing.");
    }

    await this.advanceWorkflowIfPossible(
      actor,
      stewardship.workflowRunId,
      ["drafted", "quality_checked", "awaiting_human_review"],
      "Telehealth stewardship packet routed for human review."
    );

    const result = await this.submitDocument(actor, stewardship.documentId);
    const synced = await this.syncTelehealthStewardshipFromDocument(result.document);

    await this.recordAudit(actor, "telehealth_stewardship.submitted", "telehealth_stewardship", stewardship.id, {
      documentId: stewardship.documentId,
      approvalCount: result.approvals.length
    });

    return {
      stewardship: synced ?? stewardship,
      document: result.document,
      approvals: result.approvals
    };
  }

  async publishTelehealthStewardship(actor: ActorContext, stewardshipId: string): Promise<{
    stewardship: TelehealthStewardshipRecord;
    document: DocumentRecord;
  }> {
    const stewardship = await this.repository.getTelehealthStewardship(stewardshipId);
    if (!stewardship) {
      notFound(`Telehealth stewardship packet not found: ${stewardshipId}`);
    }
    if (!stewardship.documentId) {
      badRequest("Telehealth stewardship packet is not available for publication.");
    }

    const document = await this.publishDocument(actor, stewardship.documentId);
    const synced = await this.syncTelehealthStewardshipFromDocument(document);

    await this.recordAudit(actor, "telehealth_stewardship.publish_requested", "telehealth_stewardship", stewardship.id, {
      documentId: stewardship.documentId
    });

    return {
      stewardship: synced ?? stewardship,
      document
    };
  }

  async listControlledSubstanceStewardship(filters?: {
    status?: string;
    ownerRole?: string;
    supervisingPhysicianRole?: string;
    serviceLineId?: string;
  }): Promise<ControlledSubstanceStewardshipRecord[]> {
    const { serviceLineId, ...repositoryFilters } = filters ?? {};
    const records = await this.repository.listControlledSubstanceStewardship(repositoryFilters);
    if (!serviceLineId) {
      return records;
    }
    return records.filter((record) =>
      record.serviceLineIds.includes(serviceLineId as ControlledSubstanceStewardshipRecord["serviceLineIds"][number])
    );
  }

  async createControlledSubstanceStewardship(actor: ActorContext, input: unknown): Promise<{
    stewardship: ControlledSubstanceStewardshipRecord;
    document: DocumentRecord;
  }> {
    const command = controlledSubstanceStewardshipCreateSchema.parse(input);
    const linkedPracticeAgreement = command.linkedPracticeAgreementId
      ? await this.repository.getPracticeAgreement(command.linkedPracticeAgreementId)
      : null;
    if (command.linkedPracticeAgreementId && !linkedPracticeAgreement) {
      notFound(`Linked practice agreement not found: ${command.linkedPracticeAgreementId}`);
    }

    const workflow = await this.createWorkflowRun(actor, {
      workflowId: "controlled_substance_stewardship_review",
      input: {
        title: command.title,
        ownerRole: command.ownerRole,
        supervisingPhysicianRole: command.supervisingPhysicianRole,
        serviceLineIds: command.serviceLineIds,
        linkedPracticeAgreementId: command.linkedPracticeAgreementId ?? null,
        requestedBy: actor.actorId,
        reviewCadenceDays: command.reviewCadenceDays ?? 45
      }
    });

    await this.advanceWorkflowIfPossible(actor, workflow.id, ["scoped", "drafted"], "Controlled-substance stewardship packet drafted.");

    const document = await this.createDocument(actor, {
      title: command.title,
      ownerRole: command.ownerRole,
      approvalClass: "clinical_governance",
      artifactType: "controlled_substance_stewardship_packet",
      summary: `Controlled-substance stewardship packet for ${command.serviceLineIds.map((serviceLineId) => serviceLineId.replaceAll("_", " ")).join(", ")} guardrails.`,
      workflowRunId: workflow.id,
      serviceLines: command.serviceLineIds,
      body: this.buildControlledSubstanceStewardshipBody(command)
    });

    const stewardship = await this.repository.createControlledSubstanceStewardship(
      createControlledSubstanceStewardshipRecord({
        ...command,
        linkedPracticeAgreementId: command.linkedPracticeAgreementId ?? null,
        reviewCadenceDays: command.reviewCadenceDays ?? 45,
        notes: command.notes ?? null,
        documentId: document.id,
        workflowRunId: workflow.id,
        createdBy: actor.actorId
      })
    );

    await this.recordAudit(actor, "controlled_substance_stewardship.created", "controlled_substance_stewardship", stewardship.id, {
      documentId: document.id,
      workflowRunId: workflow.id,
      serviceLineIds: stewardship.serviceLineIds,
      linkedPracticeAgreementId: stewardship.linkedPracticeAgreementId
    });

    return {
      stewardship,
      document
    };
  }

  async bootstrapControlledSubstanceStewardship(actor: ActorContext): Promise<{
    created: ControlledSubstanceStewardshipRecord[];
    existing: ControlledSubstanceStewardshipRecord[];
  }> {
    const existing = await this.repository.listControlledSubstanceStewardship();
    if (existing.length > 0) {
      return {
        created: [],
        existing
      };
    }

    const practiceAgreements = await this.repository.listPracticeAgreements({ ownerRole: "medical_director" });
    const linkedPracticeAgreement = practiceAgreements.find((agreement) =>
      agreement.serviceLineIds.some((serviceLineId) => ["weight_management", "hrt", "primary_care", "telehealth"].includes(serviceLineId))
    ) ?? null;
    const serviceLineIds = linkedPracticeAgreement?.serviceLineIds.filter((serviceLineId) =>
      ["weight_management", "hrt", "primary_care", "telehealth"].includes(serviceLineId)
    ) ?? ["weight_management", "hrt", "primary_care"];

    const created = await this.createControlledSubstanceStewardship(actor, {
      title: "Controlled-substance stewardship packet",
      ownerRole: linkedPracticeAgreement?.ownerRole ?? "medical_director",
      supervisingPhysicianRole: linkedPracticeAgreement?.supervisingPhysicianRole ?? "patient_care_team_physician",
      serviceLineIds,
      linkedPracticeAgreementId: linkedPracticeAgreement?.id ?? null,
      prescribingScopeSummary: "Define which controlled-substance workflows remain inside protocol-guided clinic scope, which require supervising-physician review, and which are out of scope for this pilot clinic.",
      pdmpReviewSummary: "Require documented PDMP review before new controlled-substance starts, dose escalation, early refill consideration, or transfer-of-care continuation decisions.",
      screeningProtocolSummary: "Document the standardized risk-screening, toxicology, contraindication, and monitoring checkpoints that must be completed before prescribing or renewing controlled medications.",
      refillEscalationSummary: "Escalate early refill requests, lost-medication reports, dose exceptions, outside-prescriber overlap, and missed-monitoring events to supervising physician review the same day.",
      inventoryControlSummary: "For any on-site stock or samples, define locked storage, access logging, discrepancy review, and immediate escalation expectations for suspected diversion or count variance.",
      patientEducationSummary: "Provide consistent patient education covering controlled-substance expectations, refill timing, safe storage, no-sharing guidance, and the conditions that trigger reassessment or discontinuation.",
      adverseEventEscalationSummary: "Escalate suspected misuse, overdose risk, sedation, withdrawal concern, or red-flag adverse effects immediately with documented warm handoff and physician notification.",
      reviewCadenceDays: linkedPracticeAgreement?.reviewCadenceDays ?? 45,
      effectiveDate: linkedPracticeAgreement?.effectiveDate ?? null,
      notes: "Keep aligned with the current practice agreement, service-line governance packs, and any active delegation restrictions."
    });

    return {
      created: [created.stewardship],
      existing: []
    };
  }

  async updateControlledSubstanceStewardship(
    actor: ActorContext,
    stewardshipId: string,
    input: unknown
  ): Promise<{
    stewardship: ControlledSubstanceStewardshipRecord;
    document: DocumentRecord | null;
  }> {
    const command = controlledSubstanceStewardshipUpdateSchema.parse(input);
    const stewardship = await this.repository.getControlledSubstanceStewardship(stewardshipId);
    if (!stewardship) {
      notFound(`Controlled-substance stewardship packet not found: ${stewardshipId}`);
    }
    if (!["draft", "sent_back"].includes(stewardship.status)) {
      badRequest("Only draft or sent-back controlled-substance stewardship packets can be edited.");
    }

    const linkedPracticeAgreement = command.linkedPracticeAgreementId
      ? await this.repository.getPracticeAgreement(command.linkedPracticeAgreementId)
      : null;
    if (command.linkedPracticeAgreementId && !linkedPracticeAgreement) {
      notFound(`Linked practice agreement not found: ${command.linkedPracticeAgreementId}`);
    }

    const updatedAt = new Date().toISOString();
    const updated = await this.repository.updateControlledSubstanceStewardship(stewardship.id, {
      title: command.title ?? stewardship.title,
      ownerRole: command.ownerRole ?? stewardship.ownerRole,
      supervisingPhysicianRole: command.supervisingPhysicianRole ?? stewardship.supervisingPhysicianRole,
      serviceLineIds: command.serviceLineIds ?? stewardship.serviceLineIds,
      linkedPracticeAgreementId: command.linkedPracticeAgreementId !== undefined
        ? command.linkedPracticeAgreementId
        : stewardship.linkedPracticeAgreementId,
      prescribingScopeSummary: command.prescribingScopeSummary ?? stewardship.prescribingScopeSummary,
      pdmpReviewSummary: command.pdmpReviewSummary ?? stewardship.pdmpReviewSummary,
      screeningProtocolSummary: command.screeningProtocolSummary ?? stewardship.screeningProtocolSummary,
      refillEscalationSummary: command.refillEscalationSummary ?? stewardship.refillEscalationSummary,
      inventoryControlSummary: command.inventoryControlSummary ?? stewardship.inventoryControlSummary,
      patientEducationSummary: command.patientEducationSummary ?? stewardship.patientEducationSummary,
      adverseEventEscalationSummary: command.adverseEventEscalationSummary ?? stewardship.adverseEventEscalationSummary,
      reviewCadenceDays: command.reviewCadenceDays ?? stewardship.reviewCadenceDays,
      effectiveDate: command.effectiveDate !== undefined ? command.effectiveDate : stewardship.effectiveDate,
      notes: command.notes !== undefined ? command.notes : stewardship.notes,
      status: command.status ?? stewardship.status,
      updatedAt
    });

    let document: DocumentRecord | null = null;
    if (stewardship.documentId) {
      const draftDocument = await this.repository.getDocument(stewardship.documentId);
      if (!draftDocument) {
        notFound(`Controlled-substance stewardship document not found: ${stewardship.documentId}`);
      }
      if (!["draft", "rejected"].includes(draftDocument.status)) {
        badRequest("Controlled-substance stewardship draft is already under review or published.");
      }

      document = await this.repository.updateDocument(draftDocument.id, {
        title: updated.title,
        ownerRole: updated.ownerRole,
        summary: `Controlled-substance stewardship packet for ${updated.serviceLineIds.map((serviceLineId) => serviceLineId.replaceAll("_", " ")).join(", ")} guardrails.`,
        body: this.buildControlledSubstanceStewardshipBody(updated),
        serviceLines: updated.serviceLineIds,
        status: "draft",
        updatedAt,
        version: draftDocument.version + 1
      });
    }

    await this.recordAudit(actor, "controlled_substance_stewardship.updated", "controlled_substance_stewardship", updated.id, {
      documentId: stewardship.documentId,
      serviceLineIds: updated.serviceLineIds,
      linkedPracticeAgreementId: updated.linkedPracticeAgreementId
    });

    return {
      stewardship: updated,
      document
    };
  }

  async submitControlledSubstanceStewardship(
    actor: ActorContext,
    stewardshipId: string
  ): Promise<{
    stewardship: ControlledSubstanceStewardshipRecord;
    document: DocumentRecord;
    approvals: ApprovalTask[];
  }> {
    const stewardship = await this.repository.getControlledSubstanceStewardship(stewardshipId);
    if (!stewardship) {
      notFound(`Controlled-substance stewardship packet not found: ${stewardshipId}`);
    }
    if (!stewardship.documentId) {
      badRequest("Create a controlled-substance stewardship draft before routing it for approval.");
    }
    if (!["draft", "sent_back"].includes(stewardship.status)) {
      badRequest("Controlled-substance stewardship packet is not ready for approval routing.");
    }

    await this.advanceWorkflowIfPossible(
      actor,
      stewardship.workflowRunId,
      ["drafted", "quality_checked", "awaiting_human_review"],
      "Controlled-substance stewardship packet routed for human review."
    );

    const result = await this.submitDocument(actor, stewardship.documentId);
    const synced = await this.syncControlledSubstanceStewardshipFromDocument(result.document);

    await this.recordAudit(actor, "controlled_substance_stewardship.submitted", "controlled_substance_stewardship", stewardship.id, {
      documentId: stewardship.documentId,
      approvalCount: result.approvals.length
    });

    return {
      stewardship: synced ?? stewardship,
      document: result.document,
      approvals: result.approvals
    };
  }

  async publishControlledSubstanceStewardship(
    actor: ActorContext,
    stewardshipId: string
  ): Promise<{
    stewardship: ControlledSubstanceStewardshipRecord;
    document: DocumentRecord;
  }> {
    const stewardship = await this.repository.getControlledSubstanceStewardship(stewardshipId);
    if (!stewardship) {
      notFound(`Controlled-substance stewardship packet not found: ${stewardshipId}`);
    }
    if (!stewardship.documentId) {
      badRequest("Controlled-substance stewardship packet is not available for publication.");
    }

    const document = await this.publishDocument(actor, stewardship.documentId);
    const synced = await this.syncControlledSubstanceStewardshipFromDocument(document);

    await this.recordAudit(actor, "controlled_substance_stewardship.publish_requested", "controlled_substance_stewardship", stewardship.id, {
      documentId: stewardship.documentId
    });

    return {
      stewardship: synced ?? stewardship,
      document
    };
  }

  async listStandardMappings(filters?: {
    domain?: string;
    ownerRole?: string;
    status?: string;
    sourceAuthority?: string;
  }): Promise<StandardMappingRecord[]> {
    return this.repository.listStandardMappings(filters);
  }

  async createStandardMapping(actor: ActorContext, input: unknown): Promise<StandardMappingRecord> {
    const command = standardMappingCreateSchema.parse(input);
    const existing = await this.repository.listStandardMappings({
      sourceAuthority: command.sourceAuthority
    });
    if (existing.some((record) => record.standardCode === command.standardCode)) {
      badRequest(`A standards mapping already exists for ${command.sourceAuthority} ${command.standardCode}.`);
    }

    const created = await this.repository.createStandardMapping(createStandardMappingRecord({
      ...command,
      evidenceDocumentIds: command.evidenceDocumentIds,
      reviewCadenceDays: command.reviewCadenceDays ?? 90,
      notes: command.notes ?? null
    }));

    await this.recordAudit(actor, "standard_mapping.created", "standard_mapping", created.id, {
      standardCode: created.standardCode,
      sourceAuthority: created.sourceAuthority,
      domain: created.domain
    });

    return created;
  }

  async bootstrapStandards(actor: ActorContext): Promise<{
    created: StandardMappingRecord[];
    existing: StandardMappingRecord[];
  }> {
    const existingRecords = await this.repository.listStandardMappings({ sourceAuthority: "Joint Commission Mock Survey" });
    const defaults = [
      {
        standardCode: "MM.03.01.01",
        title: "Medication management oversight",
        domain: "medication_management",
        ownerRole: "quality_lead",
        requirementSummary: "Define how the clinic governs medication handling, review cadence, escalation, and documentation for higher-risk medication workflows.",
        evidenceExpectation: "Current stewardship policy, approval trail, recent review packet, and follow-up actions tied to medication-management oversight.",
        reviewCadenceDays: 60,
        notes: "Anchor medication-management survey prep with the controlled-substance stewardship packet."
      },
      {
        standardCode: "HR.01.06.01",
        title: "Staff competency oversight",
        domain: "staff_competency",
        ownerRole: "hr_lead",
        requirementSummary: "Maintain evidence that staff performing regulated tasks have current competency expectations, review cadence, and remediation follow-up.",
        evidenceExpectation: "Competency matrix, latest review packet, remediation tracking, and role-specific competency artifacts.",
        reviewCadenceDays: 90,
        notes: "Tie to delegation matrix and scorecard follow-up evidence."
      },
      {
        standardCode: "IC.02.02.01",
        title: "Infection prevention controls",
        domain: "infection_prevention",
        ownerRole: "quality_lead",
        requirementSummary: "Document current infection-prevention expectations, escalation routines, and periodic review of compliance evidence.",
        evidenceExpectation: "Current policy set, training proof, issue escalation records, and recent committee review references.",
        reviewCadenceDays: 90,
        notes: "Use committee/QAPI packets as evidence anchors."
      },
      {
        standardCode: "EC.02.03.05",
        title: "Environment and emergency readiness",
        domain: "environment_of_care",
        ownerRole: "office_manager",
        requirementSummary: "Show that emergency equipment, closeout routines, and escalation pathways are documented, reviewed, and acted on.",
        evidenceExpectation: "Daily packet artifacts, checklist evidence, action items, and recent committee follow-up.",
        reviewCadenceDays: 90,
        notes: "Pair with office-ops closeout evidence for survey readiness."
      },
      {
        standardCode: "LD.04.01.05",
        title: "Leadership quality oversight",
        domain: "leadership",
        ownerRole: "medical_director",
        requirementSummary: "Demonstrate leadership review of incidents, CAPAs, committees, and other safety-governance artifacts on a defined cadence.",
        evidenceExpectation: "QAPI meeting packets, leadership decisions, incident/CAPA summaries, and documented follow-up actions.",
        reviewCadenceDays: 30,
        notes: "Pair with the committee/QAPI engine for recurring evidence."
      }
    ] as const;

    const created: StandardMappingRecord[] = [];
    const existing: StandardMappingRecord[] = [];
    for (const entry of defaults) {
      const match = existingRecords.find((record) => record.standardCode === entry.standardCode);
      if (match) {
        existing.push(match);
        continue;
      }
      created.push(await this.createStandardMapping(actor, {
        ...entry,
        sourceAuthority: "Joint Commission Mock Survey"
      }));
    }

    return {
      created,
      existing
    };
  }

  async updateStandardMapping(actor: ActorContext, standardId: string, input: unknown): Promise<StandardMappingRecord> {
    const command = standardMappingUpdateSchema.parse(input);
    const standard = await this.repository.getStandardMapping(standardId);
    if (!standard) {
      notFound(`Standard mapping not found: ${standardId}`);
    }

    const updated = await this.repository.updateStandardMapping(standard.id, {
      standardCode: command.standardCode ?? standard.standardCode,
      title: command.title ?? standard.title,
      domain: command.domain ?? standard.domain,
      sourceAuthority: command.sourceAuthority ?? standard.sourceAuthority,
      ownerRole: command.ownerRole ?? standard.ownerRole,
      status: command.status ?? standard.status,
      requirementSummary: command.requirementSummary ?? standard.requirementSummary,
      evidenceExpectation: command.evidenceExpectation ?? standard.evidenceExpectation,
      evidenceDocumentIds: command.evidenceDocumentIds ?? standard.evidenceDocumentIds,
      latestBinderId: command.latestBinderId !== undefined ? command.latestBinderId : standard.latestBinderId,
      reviewCadenceDays: command.reviewCadenceDays ?? standard.reviewCadenceDays,
      lastReviewedAt: command.lastReviewedAt !== undefined ? command.lastReviewedAt : standard.lastReviewedAt,
      nextReviewDueAt: command.nextReviewDueAt !== undefined ? command.nextReviewDueAt : standard.nextReviewDueAt,
      notes: command.notes !== undefined ? command.notes : standard.notes,
      updatedAt: new Date().toISOString()
    });

    await this.recordAudit(actor, "standard_mapping.updated", "standard_mapping", updated.id, {
      standardCode: updated.standardCode,
      status: updated.status
    });

    return updated;
  }

  async listEvidenceBinders(filters?: {
    status?: string;
    ownerRole?: string;
    sourceAuthority?: string;
  }): Promise<EvidenceBinderRecord[]> {
    return this.repository.listEvidenceBinders(filters);
  }

  async createEvidenceBinder(actor: ActorContext, input: unknown): Promise<{
    binder: EvidenceBinderRecord;
    document: DocumentRecord;
  }> {
    const command = evidenceBinderCreateSchema.parse(input);
    const standards = await Promise.all(command.standardIds.map((standardId) => this.repository.getStandardMapping(standardId)));
    const missingStandardId = command.standardIds.find((_id, index) => !standards[index]);
    if (missingStandardId) {
      notFound(`Standard mapping not found: ${missingStandardId}`);
    }

    const workflow = await this.createWorkflowRun(actor, {
      workflowId: "evidence_binder_review",
      input: {
        title: command.title,
        ownerRole: command.ownerRole,
        sourceAuthority: command.sourceAuthority,
        standardIds: command.standardIds,
        surveyWindowLabel: command.surveyWindowLabel ?? null,
        requestedBy: actor.actorId,
        reviewCadenceDays: command.reviewCadenceDays ?? 90
      }
    });

    await this.advanceWorkflowIfPossible(actor, workflow.id, ["scoped", "drafted"], "Evidence binder drafted.");

    const mappedStandards = standards.filter(Boolean) as StandardMappingRecord[];
    const document = await this.createDocument(actor, {
      title: command.title,
      ownerRole: command.ownerRole,
      approvalClass: "clinical_governance",
      artifactType: "evidence_binder",
      summary: `Evidence binder covering ${command.standardIds.length} mapped standards for ${command.sourceAuthority}.`,
      workflowRunId: workflow.id,
      serviceLines: [],
      body: this.buildEvidenceBinderBody(command, mappedStandards)
    });

    const binder = await this.repository.createEvidenceBinder(createEvidenceBinderRecord({
      ...command,
      surveyWindowLabel: command.surveyWindowLabel ?? null,
      reviewCadenceDays: command.reviewCadenceDays ?? 90,
      notes: command.notes ?? null,
      documentId: document.id,
      workflowRunId: workflow.id,
      createdBy: actor.actorId
    }));

    await Promise.all(mappedStandards.map((standard) =>
      this.repository.updateStandardMapping(standard.id, {
        status: "evidence_ready",
        latestBinderId: binder.id,
        updatedAt: new Date().toISOString()
      })
    ));

    await this.recordAudit(actor, "evidence_binder.created", "evidence_binder", binder.id, {
      documentId: document.id,
      workflowRunId: workflow.id,
      standardCount: binder.standardIds.length,
      sourceAuthority: binder.sourceAuthority
    });

    return {
      binder,
      document
    };
  }

  async bootstrapEvidenceBinders(actor: ActorContext): Promise<{
    created: EvidenceBinderRecord[];
    existing: EvidenceBinderRecord[];
  }> {
    const existingBinders = await this.repository.listEvidenceBinders({ sourceAuthority: "Joint Commission Mock Survey" });
    if (existingBinders.length > 0) {
      return {
        created: [],
        existing: existingBinders
      };
    }

    const standards = await this.bootstrapStandards(actor);
    const available = [...standards.existing, ...standards.created];
    const selected = available
      .filter((standard) => ["medication_management", "staff_competency", "leadership", "environment_of_care"].includes(standard.domain))
      .slice(0, 4);
    const created = await this.createEvidenceBinder(actor, {
      title: "Mock survey evidence binder",
      ownerRole: "quality_lead",
      sourceAuthority: "Joint Commission Mock Survey",
      surveyWindowLabel: "Pilot readiness mock survey",
      standardIds: selected.map((standard) => standard.id),
      summary: "Assemble the core survey-readiness evidence trail across medication oversight, competency, leadership review, and environment-of-care controls.",
      evidenceReadinessSummary: "Each mapped standard should point to a current artifact, recent review evidence, and a named owner responsible for keeping the binder current.",
      openGapSummary: "Track any missing signatures, stale policy versions, delayed committee review artifacts, or competency follow-up gaps before treating the binder as survey-ready.",
      reviewCadenceDays: 60,
      notes: "Use this binder as the mock-survey packet until broader standards coverage is needed."
    });

    return {
      created: [created.binder],
      existing: []
    };
  }

  async updateEvidenceBinder(actor: ActorContext, binderId: string, input: unknown): Promise<{
    binder: EvidenceBinderRecord;
    document: DocumentRecord | null;
  }> {
    const command = evidenceBinderUpdateSchema.parse(input);
    const binder = await this.repository.getEvidenceBinder(binderId);
    if (!binder) {
      notFound(`Evidence binder not found: ${binderId}`);
    }
    if (!["draft", "sent_back"].includes(binder.status)) {
      badRequest("Only draft or sent-back evidence binders can be edited.");
    }

    const standardIds = command.standardIds ?? binder.standardIds;
    const standards = await Promise.all(standardIds.map((standardId) => this.repository.getStandardMapping(standardId)));
    const missingStandardId = standardIds.find((_id, index) => !standards[index]);
    if (missingStandardId) {
      notFound(`Standard mapping not found: ${missingStandardId}`);
    }

    const updatedAt = new Date().toISOString();
    const updated = await this.repository.updateEvidenceBinder(binder.id, {
      title: command.title ?? binder.title,
      ownerRole: command.ownerRole ?? binder.ownerRole,
      status: command.status ?? binder.status,
      sourceAuthority: command.sourceAuthority ?? binder.sourceAuthority,
      surveyWindowLabel: command.surveyWindowLabel !== undefined ? command.surveyWindowLabel : binder.surveyWindowLabel,
      standardIds,
      summary: command.summary ?? binder.summary,
      evidenceReadinessSummary: command.evidenceReadinessSummary ?? binder.evidenceReadinessSummary,
      openGapSummary: command.openGapSummary ?? binder.openGapSummary,
      reviewCadenceDays: command.reviewCadenceDays ?? binder.reviewCadenceDays,
      notes: command.notes !== undefined ? command.notes : binder.notes,
      updatedAt
    });

    let document: DocumentRecord | null = null;
    if (binder.documentId) {
      const draftDocument = await this.repository.getDocument(binder.documentId);
      if (!draftDocument) {
        notFound(`Evidence-binder document not found: ${binder.documentId}`);
      }
      if (!["draft", "rejected"].includes(draftDocument.status)) {
        badRequest("Evidence-binder draft is already under review or published.");
      }

      document = await this.repository.updateDocument(draftDocument.id, {
        title: updated.title,
        ownerRole: updated.ownerRole,
        summary: `Evidence binder covering ${updated.standardIds.length} mapped standards for ${updated.sourceAuthority}.`,
        body: this.buildEvidenceBinderBody(updated, standards.filter(Boolean) as StandardMappingRecord[]),
        serviceLines: [],
        status: "draft",
        updatedAt,
        version: draftDocument.version + 1
      });
    }

    await Promise.all((standards.filter(Boolean) as StandardMappingRecord[]).map((standard) =>
      this.repository.updateStandardMapping(standard.id, {
        latestBinderId: updated.id,
        status: "evidence_ready",
        updatedAt
      })
    ));

    await this.recordAudit(actor, "evidence_binder.updated", "evidence_binder", updated.id, {
      standardCount: updated.standardIds.length,
      documentId: binder.documentId
    });

    return {
      binder: updated,
      document
    };
  }

  async submitEvidenceBinder(actor: ActorContext, binderId: string): Promise<{
    binder: EvidenceBinderRecord;
    document: DocumentRecord;
    approvals: ApprovalTask[];
  }> {
    const binder = await this.repository.getEvidenceBinder(binderId);
    if (!binder) {
      notFound(`Evidence binder not found: ${binderId}`);
    }
    if (!binder.documentId) {
      badRequest("Create an evidence binder draft before routing it for approval.");
    }
    if (!["draft", "sent_back"].includes(binder.status)) {
      badRequest("Evidence binder is not ready for approval routing.");
    }

    await this.advanceWorkflowIfPossible(
      actor,
      binder.workflowRunId,
      ["drafted", "quality_checked", "awaiting_human_review"],
      "Evidence binder routed for human review."
    );

    const result = await this.submitDocument(actor, binder.documentId);
    const synced = await this.syncEvidenceBinderFromDocument(result.document);

    const now = new Date().toISOString();
    await Promise.all(binder.standardIds.map(async (standardId) => {
      const standard = await this.repository.getStandardMapping(standardId);
      if (!standard) return;
      await this.repository.updateStandardMapping(standard.id, {
        status: "review_pending",
        latestBinderId: binder.id,
        updatedAt: now
      });
    }));

    await this.recordAudit(actor, "evidence_binder.submitted", "evidence_binder", binder.id, {
      documentId: binder.documentId,
      approvalCount: result.approvals.length
    });

    return {
      binder: synced ?? binder,
      document: result.document,
      approvals: result.approvals
    };
  }

  async publishEvidenceBinder(actor: ActorContext, binderId: string): Promise<{
    binder: EvidenceBinderRecord;
    document: DocumentRecord;
  }> {
    const binder = await this.repository.getEvidenceBinder(binderId);
    if (!binder) {
      notFound(`Evidence binder not found: ${binderId}`);
    }
    if (!binder.documentId) {
      badRequest("Evidence binder is not available for publication.");
    }

    const document = await this.publishDocument(actor, binder.documentId);
    const synced = await this.syncEvidenceBinderFromDocument(document);

    await this.recordAudit(actor, "evidence_binder.publish_requested", "evidence_binder", binder.id, {
      documentId: binder.documentId
    });

    return {
      binder: synced ?? binder,
      document
    };
  }

  async listDelegationRules(filters?: {
    serviceLineId?: string;
    performerRole?: string;
    status?: string;
    taskCode?: string;
  }): Promise<DelegationRuleRecord[]> {
    return this.repository.listDelegationRules(filters);
  }

  async createDelegationRule(actor: ActorContext, input: unknown): Promise<DelegationRuleRecord> {
    const command = delegationRuleCreateSchema.parse(input);
    const existing = await this.repository.listDelegationRules({
      serviceLineId: command.serviceLineId,
      performerRole: command.performerRole,
      taskCode: command.taskCode
    });
    if (existing.some((rule) => rule.status !== "retired")) {
      badRequest("A delegation rule already exists for this service line, task, and performer role.");
    }

    const created = await this.repository.createDelegationRule(createDelegationRuleRecord({
      ...command,
      createdBy: actor.actorId
    }));

    await this.recordAudit(actor, "delegation_rule.created", "delegation_rule", created.id, {
      serviceLineId: created.serviceLineId,
      taskCode: created.taskCode,
      performerRole: created.performerRole,
      supervisionLevel: created.supervisionLevel
    });

    return created;
  }

  async bootstrapDelegationRules(actor: ActorContext): Promise<{
    created: DelegationRuleRecord[];
    existing: DelegationRuleRecord[];
  }> {
    const created: DelegationRuleRecord[] = [];
    const existing: DelegationRuleRecord[] = [];

    for (const entry of defaultDelegationRuleTemplates) {
      const matches = await this.repository.listDelegationRules({
        serviceLineId: entry.serviceLineId,
        performerRole: entry.performerRole,
        taskCode: entry.taskCode
      });
      const match = matches[0];
      if (match) {
        existing.push(match);
        continue;
      }
      created.push(await this.createDelegationRule(actor, entry));
    }

    return {
      created,
      existing
    };
  }

  async updateDelegationRule(actor: ActorContext, delegationRuleId: string, input: unknown): Promise<DelegationRuleRecord> {
    const command = delegationRuleUpdateSchema.parse(input);
    const rule = await this.repository.getDelegationRule(delegationRuleId);
    if (!rule) {
      notFound(`Delegation rule not found: ${delegationRuleId}`);
    }

    const updated = await this.repository.updateDelegationRule(rule.id, {
      taskLabel: command.taskLabel ?? rule.taskLabel,
      supervisingRole: command.supervisingRole !== undefined ? command.supervisingRole : rule.supervisingRole,
      status: command.status ?? rule.status,
      supervisionLevel: command.supervisionLevel ?? rule.supervisionLevel,
      requiresCompetencyEvidence: command.requiresCompetencyEvidence ?? rule.requiresCompetencyEvidence,
      requiresDocumentedOrder: command.requiresDocumentedOrder ?? rule.requiresDocumentedOrder,
      requiresCosign: command.requiresCosign ?? rule.requiresCosign,
      patientFacing: command.patientFacing ?? rule.patientFacing,
      evidenceRequired: command.evidenceRequired ?? rule.evidenceRequired,
      notes: command.notes !== undefined ? command.notes : rule.notes,
      updatedAt: new Date().toISOString()
    });

    await this.recordAudit(actor, "delegation_rule.updated", "delegation_rule", updated.id, {
      status: updated.status,
      supervisionLevel: updated.supervisionLevel,
      performerRole: updated.performerRole
    });

    return updated;
  }

  async evaluateDelegation(input: unknown): Promise<DelegationEvaluationResult> {
    const query = delegationEvaluationQuerySchema.parse(input);
    const matches = await this.repository.listDelegationRules({
      serviceLineId: query.serviceLineId,
      performerRole: query.performerRole,
      taskCode: query.taskCode
    });
    return evaluateDelegationRule(matches[0] ?? null);
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

  async createIncident(actor: ActorContext, input: unknown): Promise<IncidentRecord> {
    const command = incidentCreateSchema.parse(input);
    const workflow = await this.createWorkflowRun(actor, {
      workflowId: "incident_review",
      input: {
        title: command.title,
        severity: command.severity,
        category: command.category,
        requestedBy: actor.actorId,
        detectedAt: command.detectedAt ?? new Date().toISOString(),
        detectedByRole: actor.role
      }
    });
    const reviewTask = await this.createActionItem(actor, {
      kind: "review",
      title: `Review incident: ${command.title}`,
      description: command.summary,
      ownerRole: command.ownerRole,
      dueDate: command.dueDate ?? addDays(new Date().toISOString(), 2),
      sourceWorkflowRunId: workflow.id
    });
    const record = createIncidentRecord({
      title: command.title,
      severity: command.severity,
      category: command.category,
      summary: command.summary,
      detectedAt: command.detectedAt,
      detectedByRole: actor.role,
      ownerRole: command.ownerRole,
      immediateResponse: command.immediateResponse,
      workflowRunId: workflow.id,
      reviewActionItemId: reviewTask.id,
      dueDate: command.dueDate ?? reviewTask.dueDate
    });
    const created = await this.repository.createIncident(record);

    if (canTransition(workflowRegistry.get("incident_review")!, workflow.state, "scoped")) {
      await this.transitionWorkflowRun(actor, workflow.id, {
        nextState: "scoped",
        note: "Incident intake captured."
      });
    }

    await this.recordAudit(actor, "incident.created", "incident", created.id, {
      workflowRunId: created.workflowRunId,
      reviewActionItemId: created.reviewActionItemId,
      severity: created.severity
    });
    await this.syncIncidentSideEffects(actor, created);
    return created;
  }

  async listIncidents(filters?: {
    status?: string;
    severity?: string;
    ownerRole?: string;
    linkedCapaId?: string;
  }): Promise<IncidentRecord[]> {
    return this.repository.listIncidents(filters);
  }

  async updateIncident(actor: ActorContext, incidentId: string, input: unknown): Promise<IncidentRecord> {
    const command = incidentUpdateSchema.parse(input);
    const incident = await this.repository.getIncident(incidentId);
    if (!incident) {
      notFound(`Incident not found: ${incidentId}`);
    }
    if (![incident.ownerRole, "medical_director"].includes(actor.role)) {
      forbidden(`Role ${actor.role} cannot update incident ${incidentId}.`);
    }

    const updated = await this.repository.updateIncident(incident.id, {
      title: command.title ?? incident.title,
      severity: command.severity ?? incident.severity,
      category: command.category ?? incident.category,
      summary: command.summary ?? incident.summary,
      immediateResponse: command.immediateResponse !== undefined ? command.immediateResponse : incident.immediateResponse,
      resolutionNote: command.resolutionNote !== undefined ? command.resolutionNote : incident.resolutionNote,
      ownerRole: command.ownerRole ?? incident.ownerRole,
      dueDate: command.dueDate !== undefined ? command.dueDate : incident.dueDate,
      updatedAt: new Date().toISOString()
    });
    await this.recordAudit(actor, "incident.updated", "incident", updated.id, {
      status: updated.status,
      ownerRole: updated.ownerRole
    });
    await this.syncIncidentSideEffects(actor, updated);
    return updated;
  }

  async reviewIncident(actor: ActorContext, incidentId: string, input: unknown): Promise<{
    incident: IncidentRecord;
    capa: CapaRecord | null;
  }> {
    const command = incidentReviewDecisionCommandSchema.parse(input);
    const incident = await this.repository.getIncident(incidentId);
    if (!incident) {
      notFound(`Incident not found: ${incidentId}`);
    }
    if (![incident.ownerRole, "medical_director"].includes(actor.role)) {
      forbidden(`Role ${actor.role} cannot review incident ${incidentId}.`);
    }

    const now = new Date().toISOString();
    let updatedIncident = incident;
    let createdCapa: CapaRecord | null = null;

    if (command.decision === "log_review") {
      updatedIncident = await this.repository.updateIncident(incident.id, {
        status: "under_review",
        resolutionNote: command.notes ?? incident.resolutionNote,
        updatedAt: now
      });
      if (incident.reviewActionItemId) {
        const reviewAction = await this.repository.getActionItem(incident.reviewActionItemId);
        if (reviewAction && reviewAction.status !== "done") {
          await this.applyActionItemUpdate(actor, reviewAction, {
            status: "in_progress",
            resolutionNote: command.notes ?? reviewAction.resolutionNote
          });
        }
      }
      await this.advanceWorkflowIfPossible(actor, incident.workflowRunId, ["drafted", "quality_checked"], "Incident reviewed.");
    } else if (command.decision === "open_capa") {
      if (incident.linkedCapaId) {
        badRequest("Incident already has a linked CAPA.");
      }
      createdCapa = await this.createCapa(actor, {
        title: command.capaTitle ?? `CAPA for ${incident.title}`,
        summary: command.capaSummary ?? incident.summary,
        sourceId: incident.id,
        sourceType: "incident",
        incidentId: incident.id,
        ownerRole: command.ownerRole!,
        dueDate: command.dueDate!,
        correctiveAction: command.correctiveAction!,
        preventiveAction: command.preventiveAction!,
        verificationPlan: command.verificationPlan
      });
      updatedIncident = await this.repository.updateIncident(incident.id, {
        status: "capa_open",
        linkedCapaId: createdCapa.id,
        resolutionNote: command.notes ?? incident.resolutionNote,
        updatedAt: now
      });
      if (incident.reviewActionItemId) {
        const reviewAction = await this.repository.getActionItem(incident.reviewActionItemId);
        if (reviewAction && reviewAction.status !== "done") {
          await this.applyActionItemUpdate(actor, reviewAction, {
            status: "done",
            resolutionNote: command.notes ?? "Linked CAPA opened."
          });
        }
      }
      await this.advanceWorkflowIfPossible(actor, incident.workflowRunId, ["drafted", "quality_checked", "approved"], "Incident escalated to CAPA.");
    } else {
      if (incident.linkedCapaId) {
        const linkedCapa = await this.repository.getCapa(incident.linkedCapaId);
        if (linkedCapa && linkedCapa.status !== "closed") {
          badRequest("Cannot close an incident while the linked CAPA remains open.");
        }
      }
      updatedIncident = await this.repository.updateIncident(incident.id, {
        status: "closed",
        resolutionNote: command.notes ?? incident.resolutionNote,
        closedAt: incident.closedAt ?? now,
        updatedAt: now
      });
      if (incident.reviewActionItemId) {
        const reviewAction = await this.repository.getActionItem(incident.reviewActionItemId);
        if (reviewAction && reviewAction.status !== "done") {
          await this.applyActionItemUpdate(actor, reviewAction, {
            status: "done",
            resolutionNote: command.notes ?? "Incident closed."
          });
        }
      }
      await this.advanceWorkflowIfPossible(actor, incident.workflowRunId, ["drafted", "quality_checked", "approved", "archived"], "Incident closed.");
    }

    await this.recordAudit(actor, "incident.reviewed", "incident", updatedIncident.id, {
      decision: command.decision,
      linkedCapaId: updatedIncident.linkedCapaId
    });
    await this.syncIncidentSideEffects(actor, updatedIncident);
    return {
      incident: updatedIncident,
      capa: createdCapa
    };
  }

  async createCapa(actor: ActorContext, input: unknown): Promise<CapaRecord> {
    const command = capaCreateSchema.parse(input);
    const workflow = await this.createWorkflowRun(actor, {
      workflowId: "capa_lifecycle",
      input: {
        title: command.title,
        sourceId: command.sourceId,
        sourceType: command.sourceType,
        ownerRole: command.ownerRole,
        dueDate: command.dueDate,
        requestedBy: actor.actorId
      }
    });
    const actionItem = await this.createActionItem(actor, {
      kind: "action_item",
      title: `CAPA: ${command.title}`,
      description: command.summary,
      ownerRole: command.ownerRole,
      dueDate: command.dueDate,
      sourceWorkflowRunId: workflow.id
    });
    const created = await this.repository.createCapa(createCapaRecord({
      title: command.title,
      summary: command.summary,
      sourceId: command.sourceId,
      sourceType: command.sourceType,
      incidentId: command.incidentId,
      ownerRole: command.ownerRole,
      dueDate: command.dueDate,
      correctiveAction: command.correctiveAction,
      preventiveAction: command.preventiveAction,
      verificationPlan: command.verificationPlan,
      workflowRunId: workflow.id,
      actionItemId: actionItem.id
    }));

    if (command.incidentId) {
      const incident = await this.repository.getIncident(command.incidentId);
      if (incident) {
        await this.repository.updateIncident(incident.id, {
          status: "capa_open",
          linkedCapaId: created.id,
          updatedAt: new Date().toISOString()
        });
      }
    }

    if (canTransition(workflowRegistry.get("capa_lifecycle")!, workflow.state, "scoped")) {
      await this.transitionWorkflowRun(actor, workflow.id, {
        nextState: "scoped",
        note: "CAPA opened."
      });
    }

    await this.recordAudit(actor, "capa.created", "capa", created.id, {
      workflowRunId: created.workflowRunId,
      actionItemId: created.actionItemId,
      sourceType: created.sourceType,
      incidentId: created.incidentId
    });
    await this.syncCapaSideEffects(actor, created);
    return created;
  }

  async listCapas(filters?: {
    status?: string;
    sourceType?: string;
    ownerRole?: string;
    incidentId?: string;
  }): Promise<CapaRecord[]> {
    const capas = await this.repository.listCapas(filters);
    return Promise.all(capas.map((capa) => this.refreshCapaStatus(capa)));
  }

  async updateCapa(actor: ActorContext, capaId: string, input: unknown): Promise<CapaRecord> {
    const command = capaUpdateSchema.parse(input);
    const capa = await this.repository.getCapa(capaId);
    if (!capa) {
      notFound(`CAPA not found: ${capaId}`);
    }
    if (![capa.ownerRole, "medical_director"].includes(actor.role)) {
      forbidden(`Role ${actor.role} cannot update CAPA ${capaId}.`);
    }

    const updated = await this.repository.updateCapa(capa.id, {
      title: command.title ?? capa.title,
      summary: command.summary ?? capa.summary,
      ownerRole: command.ownerRole ?? capa.ownerRole,
      dueDate: command.dueDate ?? capa.dueDate,
      correctiveAction: command.correctiveAction ?? capa.correctiveAction,
      preventiveAction: command.preventiveAction ?? capa.preventiveAction,
      verificationPlan: command.verificationPlan !== undefined ? command.verificationPlan : capa.verificationPlan,
      resolutionNote: command.resolutionNote !== undefined ? command.resolutionNote : capa.resolutionNote,
      updatedAt: new Date().toISOString()
    });
    await this.recordAudit(actor, "capa.updated", "capa", updated.id, {
      status: updated.status,
      ownerRole: updated.ownerRole
    });
    await this.syncCapaSideEffects(actor, updated);
    return this.refreshCapaStatus(updated);
  }

  async resolveCapa(actor: ActorContext, capaId: string, input: unknown): Promise<CapaRecord> {
    const command = capaResolutionCommandSchema.parse(input);
    const capa = await this.repository.getCapa(capaId);
    if (!capa) {
      notFound(`CAPA not found: ${capaId}`);
    }
    if (![capa.ownerRole, "medical_director"].includes(actor.role)) {
      forbidden(`Role ${actor.role} cannot resolve CAPA ${capaId}.`);
    }

    const now = new Date().toISOString();
    let nextStatus: CapaStatus;
    if (command.decision === "start") {
      nextStatus = "in_progress";
    } else if (command.decision === "request_verification") {
      nextStatus = "pending_verification";
    } else if (command.decision === "close") {
      nextStatus = "closed";
    } else {
      nextStatus = "in_progress";
    }

    let updated = await this.repository.updateCapa(capa.id, {
      status: nextStatus,
      resolutionNote: command.notes ?? capa.resolutionNote,
      closedAt: command.decision === "close" ? now : null,
      updatedAt: now
    });

    if (capa.actionItemId) {
      const actionItem = await this.repository.getActionItem(capa.actionItemId);
      if (actionItem) {
        await this.applyActionItemUpdate(actor, actionItem, {
          status: nextStatus === "closed" ? "done" : nextStatus === "in_progress" ? "in_progress" : actionItem.status,
          resolutionNote: command.notes ?? actionItem.resolutionNote,
          closedAt: nextStatus === "closed" ? now : null
        });
      }
    }

    if (command.decision === "close" && capa.incidentId) {
      const incident = await this.repository.getIncident(capa.incidentId);
      if (incident && incident.status !== "closed") {
        await this.repository.updateIncident(incident.id, {
          status: "closed",
          resolutionNote: command.notes ?? incident.resolutionNote ?? "Closed after linked CAPA completion.",
          closedAt: now,
          updatedAt: now
        });
        await this.syncIncidentSideEffects(actor, {
          ...incident,
          status: "closed",
          resolutionNote: command.notes ?? incident.resolutionNote ?? "Closed after linked CAPA completion.",
          closedAt: now,
          updatedAt: now
        });
      }
    }

    await this.advanceWorkflowIfPossible(
      actor,
      capa.workflowRunId,
      command.decision === "close"
        ? ["drafted", "quality_checked", "compliance_checked", "approved", "archived"]
        : command.decision === "request_verification"
          ? ["drafted", "quality_checked", "compliance_checked"]
          : ["drafted", "quality_checked"],
      `CAPA ${command.decision.replace("_", " ")}.`
    );

    updated = await this.refreshCapaStatus(updated);
    await this.recordAudit(actor, "capa.resolved", "capa", updated.id, {
      decision: command.decision,
      status: updated.status
    });
    await this.syncCapaSideEffects(actor, updated);
    return updated;
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

  async getWorkerRuntimeStatus(input?: {
    now?: string;
    pollIntervalMs?: number;
    heartbeatIntervalMs?: number;
    staleProcessingMinutes?: number;
  }): Promise<WorkerRuntimeStatus> {
    const checkedAt = input?.now ?? new Date().toISOString();
    const pollIntervalMs = input?.pollIntervalMs ?? Number(process.env.WORKER_POLL_INTERVAL_MS ?? 5_000);
    const heartbeatIntervalMs = input?.heartbeatIntervalMs ?? Number(process.env.WORKER_HEARTBEAT_INTERVAL_MS ?? defaultWorkerHeartbeatIntervalMs);
    const staleProcessingMinutes = input?.staleProcessingMinutes ?? 15;

    const [jobs, workerEvents] = await Promise.all([
      this.repository.listWorkerJobs(),
      this.repository.listAuditEvents({
        entityType: "worker_runtime",
        entityId: workerRuntimeEntityId
      })
    ]);

    const relevantEvents = workerEvents.filter((event) => event.eventType.startsWith("worker."));
    const latestStarted = relevantEvents.find((event) => event.eventType === "worker.started") ?? null;
    const latestCompleted = relevantEvents.find((event) => event.eventType === "worker.batch.completed") ?? null;
    const latestFailed = relevantEvents.find((event) => event.eventType === "worker.batch.failed") ?? null;
    const latestHeartbeat = latestCompleted ?? latestFailed ?? latestStarted;

    const queuedJobs = jobs
      .filter((job) => job.status === "queued")
      .sort((left, right) => left.scheduledAt.localeCompare(right.scheduledAt) || left.createdAt.localeCompare(right.createdAt));
    const processingJobs = jobs
      .filter((job) => job.status === "processing")
      .sort((left, right) => (left.lockedAt ?? left.updatedAt).localeCompare(right.lockedAt ?? right.updatedAt));

    const oldestQueued = queuedJobs[0] ?? null;
    const oldestProcessing = processingJobs[0] ?? null;
    const summary = await this.getWorkerJobSummary();
    const oldestQueuedMinutes = ageMinutes(checkedAt, oldestQueued?.scheduledAt ?? null);
    const oldestProcessingAt = oldestProcessing?.lockedAt ?? oldestProcessing?.updatedAt ?? null;
    const oldestProcessingMinutes = ageMinutes(checkedAt, oldestProcessingAt);
    const lastHeartbeatMinutes = ageMinutes(checkedAt, latestHeartbeat?.createdAt ?? null);
    const lastFailedBatchMessage = typeof latestFailed?.payload?.message === "string"
      ? latestFailed.payload.message
      : latestFailed?.payload?.message == null
        ? null
        : String(latestFailed.payload.message);

    let health: WorkerRuntimeStatus["health"] = "unknown";
    if (latestHeartbeat) {
      health = "healthy";
    }
    if ((summary.failed + summary.deadLetter) > 0 || (oldestProcessingMinutes ?? 0) >= staleProcessingMinutes) {
      health = "warning";
    }

    const stalledHeartbeatMinutes = Math.max(
      Math.round((heartbeatIntervalMs * 2) / 60_000),
      Math.round((pollIntervalMs * 20) / 60_000),
      2
    );
    const queueStalled = summary.queued > 0 && (lastHeartbeatMinutes === null || lastHeartbeatMinutes >= stalledHeartbeatMinutes);
    const processingStalled = summary.processing > 0 && (oldestProcessingMinutes ?? 0) >= staleProcessingMinutes;
    if (queueStalled || processingStalled) {
      health = "critical";
    }

    return {
      checkedAt,
      health,
      pollIntervalMs,
      heartbeatIntervalMs,
      lastStartedAt: latestStarted?.createdAt ?? null,
      lastHeartbeatAt: latestHeartbeat?.createdAt ?? null,
      lastCompletedBatchAt: latestCompleted?.createdAt ?? null,
      lastCompletedBatch: parseWorkerBatchSummary(latestCompleted?.payload?.summary),
      lastFailedBatchAt: latestFailed?.createdAt ?? null,
      lastFailedBatchMessage,
      backlog: {
        ...summary,
        oldestQueuedAt: oldestQueued?.scheduledAt ?? null,
        oldestQueuedType: oldestQueued?.type ?? null,
        oldestQueuedMinutes,
        oldestProcessingAt,
        oldestProcessingType: oldestProcessing?.type ?? null,
        oldestProcessingMinutes
      }
    };
  }

  getRoleCapabilities(): RoleCapabilityRecord[] {
    return listRoleCapabilities();
  }

  getRuntimeAgentStatus(): RuntimeAgentStatus {
    const enabled = Boolean(this.options.runtimeAgentsEnabled && this.options.openaiApiKey);
    const reason = enabled
      ? null
      : this.options.openaiApiKey
        ? "Runtime agents are disabled by configuration."
        : "OPENAI_API_KEY is not configured for runtime-agent execution.";

    return {
      enabled,
      reason,
      agents: listRuntimeAgents()
    };
  }

  async runRuntimeAgent(actor: ActorContext, input: unknown): Promise<RuntimeAgentRunResult> {
    const command = z.object({
      agentId: z.string().min(1).optional(),
      workflowId: z.string().min(1).optional(),
      requestId: z.string().min(1).optional(),
      payload: z.record(z.string(), z.unknown()).default({})
    }).refine((value) => Boolean(value.agentId || value.workflowId), {
      message: "Either agentId or workflowId is required."
    }).parse(input) as RuntimeAgentRunCommand;

    const runtimeAgentStatus = this.getRuntimeAgentStatus();
    if (!runtimeAgentStatus.enabled || !this.options.openaiApiKey) {
      badRequest(runtimeAgentStatus.reason ?? "Runtime agents are not enabled.");
    }

    const agent = command.agentId
      ? getRuntimeAgentById(command.agentId)
      : command.workflowId
        ? selectAgentForWorkflow(command.workflowId)
        : null;

    if (!agent) {
      badRequest(`Unknown runtime agent: ${command.agentId}`);
    }

    const result = await runAgent(
      agent,
      {
        requestId: command.requestId ?? randomId("agent"),
        workflowId: command.workflowId ?? agent.id,
        payload: command.payload
      },
      this.options.openaiApiKey,
      {
        toolContext: {
          actor,
          service: this
        }
      }
    );

    await this.recordAudit(actor, "runtime_agent.executed", "runtime_agent", result.responseId, {
      agentId: result.agent.id,
      workflowId: result.workflowId,
      requestId: result.requestId,
      toolCalls: result.toolCalls.map((call) => ({
        callId: call.callId,
        name: call.name,
        status: call.status
      }))
    });

    return result;
  }

  async sendTeamsNotification(actor: ActorContext, input: {
    channel: string;
    message: string;
  }): Promise<{
    channel: string;
    messageId: string | null;
    status: "queued" | "skipped";
  }> {
    const command = z.object({
      channel: z.enum(["office_ops", "approvals"]),
      message: z.string().min(1)
    }).parse(input);

    if (!this.options.pilotOps) {
      return {
        channel: command.channel,
        messageId: null,
        status: "skipped"
      };
    }

    const result = await this.options.pilotOps.sendOfficeOpsNotification({
      title: command.channel === "approvals" ? "Runtime agent approval note" : "Runtime agent office-ops note",
      body: command.message
    });

    await this.recordAudit(actor, "runtime_agent.notification_queued", "runtime_agent", actor.actorId, {
      channel: command.channel,
      messageId: result.messageId
    });

    return {
      channel: command.channel,
      messageId: result.messageId,
      status: "queued"
    };
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

  async runWorkerBatch(actor: ActorContext, runner: () => Promise<WorkerBatchSummary>): Promise<{
    triggeredAt: string;
    summary: WorkerBatchSummary;
  }> {
    const summary = await runner();
    const triggeredAt = new Date().toISOString();
    await this.recordAudit(actor, "worker.batch_run_requested", "worker_runtime", workerRuntimeEntityId, {
      triggeredAt,
      summary
    });
    return {
      triggeredAt,
      summary
    };
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

  async getOpsAlertSummary(input?: {
    nodeEnv?: string;
    publicAppOrigin?: string | null;
    databaseReady?: boolean;
  }): Promise<OpsAlertSummary> {
    const checkedAt = new Date().toISOString();
    const [runtime, maintenance, workerRuntime, overview, authEvents] = await Promise.all([
      this.getRuntimeConfigStatus({
        nodeEnv: input?.nodeEnv ?? process.env.NODE_ENV ?? "development",
        publicAppOrigin: input?.publicAppOrigin ?? process.env.PUBLIC_APP_ORIGIN ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? null,
        databaseReady: input?.databaseReady ?? true
      }),
      this.getOpsMaintenanceSummary({ now: checkedAt }),
      this.getWorkerRuntimeStatus({ now: checkedAt }),
      this.getOverviewStats(),
      this.listAuditEvents({ eventTypePrefix: "auth." })
    ]);

    const alerts: OpsAlert[] = [];

    const pushAlert = (alert: Omit<OpsAlert, "createdAt">): void => {
      alerts.push({
        ...alert,
        createdAt: checkedAt
      });
    };

    if (runtime.blockingIssues.length > 0) {
      pushAlert({
        key: "runtime.blocking_issues",
        scope: "runtime",
        severity: "critical",
        title: "Runtime configuration is blocking pilot use",
        detail: runtime.blockingIssues.join(" "),
        action: "Review deployment env and readiness blockers before continuing pilot operations.",
        count: runtime.blockingIssues.length
      });
    }

    if (runtime.integrationMode === "live" && !runtime.microsoft.readyForLive) {
      pushAlert({
        key: "microsoft.live_not_ready",
        scope: "microsoft",
        severity: "critical",
        title: "Microsoft live mode is not validated",
        detail: "The deployment is configured for Microsoft live mode but the latest validation is not ready for live use.",
        action: "Run Microsoft validation and resolve any failing surfaces before relying on publish or sync operations.",
        count: null
      });
    }

    if (maintenance.worker.failed + maintenance.worker.deadLetter > 0) {
      pushAlert({
        key: "worker.failed_jobs",
        scope: "worker",
        severity: "critical",
        title: "Worker jobs need operator attention",
        detail: `${maintenance.worker.failed} failed and ${maintenance.worker.deadLetter} dead-letter jobs are waiting.`,
        action: "Review worker jobs, retry recoverable items, and use cleanup only after understanding the underlying failures.",
        count: maintenance.worker.failed + maintenance.worker.deadLetter
      });
    }

    if (maintenance.worker.staleProcessing > 0) {
      pushAlert({
        key: "worker.stale_processing",
        scope: "worker",
        severity: "warning",
        title: "Worker jobs are stuck in processing",
        detail: `${maintenance.worker.staleProcessing} processing jobs are older than the stale-processing threshold.`,
        action: "Run pilot cleanup or retry after confirming the worker is healthy.",
        count: maintenance.worker.staleProcessing
      });
    }

    if (workerRuntime.health === "critical" && maintenance.worker.queued > 0) {
      pushAlert({
        key: "worker.heartbeat_stalled",
        scope: "worker",
        severity: "critical",
        title: "Worker heartbeat is stale while jobs are queued",
        detail: workerRuntime.lastHeartbeatAt
          ? `The oldest queued job has been waiting ${workerRuntime.backlog.oldestQueuedMinutes ?? 0} minutes, and the worker last reported activity at ${workerRuntime.lastHeartbeatAt}.`
          : "No worker heartbeat has been recorded yet even though queued jobs exist.",
        action: "Check the Render worker service logs and confirm the worker loop is polling and claiming jobs on schedule.",
        count: maintenance.worker.queued
      });
    } else if (workerRuntime.health === "warning" && workerRuntime.lastFailedBatchAt) {
      pushAlert({
        key: "worker.recent_batch_failure",
        scope: "worker",
        severity: "warning",
        title: "The worker recently failed a batch",
        detail: workerRuntime.lastFailedBatchMessage ?? "A recent batch failure was recorded by the worker runtime.",
        action: "Review the latest worker failure, then confirm the queue is draining afterward.",
        count: null
      });
    }

    if (maintenance.auth.lockedProfileAssignments > 0) {
      pushAlert({
        key: "auth.locked_profiles",
        scope: "auth",
        severity: "warning",
        title: "Profiles are currently locked on enrolled devices",
        detail: `${maintenance.auth.lockedProfileAssignments} device/profile assignments are locked due to recent failed PIN attempts.`,
        action: "Check recent auth events for failed PIN attempts and confirm the right user is on the right enrolled device.",
        count: maintenance.auth.lockedProfileAssignments
      });
    }

    if (maintenance.auth.expiredActiveSessions > 0) {
      pushAlert({
        key: "auth.expired_sessions",
        scope: "auth",
        severity: "info",
        title: "Expired sessions can be cleaned up",
        detail: `${maintenance.auth.expiredActiveSessions} active sessions are now beyond their expiry window.`,
        action: "Run pilot cleanup to revoke expired sessions and keep auth state tidy.",
        count: maintenance.auth.expiredActiveSessions
      });
    }

    if (overview.overdueActionItems > 0) {
      pushAlert({
        key: "office_ops.overdue_action_items",
        scope: "office_ops",
        severity: "warning",
        title: "Action items are overdue",
        detail: `${overview.overdueActionItems} action items are overdue across office operations and follow-through work.`,
        action: "Review the action item queue and reconcile the most overdue operational commitments.",
        count: overview.overdueActionItems
      });
    }

    if (overview.overdueScorecardReviews > 0) {
      pushAlert({
        key: "scorecards.overdue_reviews",
        scope: "scorecards",
        severity: "warning",
        title: "Scorecard reviews are overdue",
        detail: `${overview.overdueScorecardReviews} scorecard reviews are past due and still waiting for human action.`,
        action: "Use the scorecards queue to resolve HR or medical-director reviews before they age further.",
        count: overview.overdueScorecardReviews
      });
    }

    if (overview.openIssues > 0) {
      pushAlert({
        key: "office_ops.open_issues",
        scope: "office_ops",
        severity: "info",
        title: "Open office issues remain in the queue",
        detail: `${overview.openIssues} operational issues are still open.`,
        action: "Use the office manager cockpit to review open issues and escalate anything blocking closeout or patient operations.",
        count: overview.openIssues
      });
    }

    const recentFailedPins = authEvents.filter((event) =>
      event.eventType === "auth.pin_failed"
      && new Date(event.createdAt).getTime() >= Date.now() - 24 * 60 * 60 * 1000
    );
    if (recentFailedPins.length > 0) {
      pushAlert({
        key: "auth.recent_pin_failures",
        scope: "auth",
        severity: "warning",
        title: "Recent failed PIN attempts were detected",
        detail: `${recentFailedPins.length} failed PIN attempts were recorded in the last 24 hours.`,
        action: "Review recent auth events, confirm profile assignments, and rotate or reset PINs if the attempts were unexpected.",
        count: recentFailedPins.length
      });
    }

    const sortedAlerts = alerts.sort((left, right) => {
      const severityRank = { critical: 0, warning: 1, info: 2 } as const;
      return severityRank[left.severity] - severityRank[right.severity] || left.title.localeCompare(right.title);
    });

    return {
      checkedAt,
      criticalCount: sortedAlerts.filter((alert) => alert.severity === "critical").length,
      warningCount: sortedAlerts.filter((alert) => alert.severity === "warning").length,
      infoCount: sortedAlerts.filter((alert) => alert.severity === "info").length,
      alerts: sortedAlerts
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

  private async refreshCapaStatus(capa: CapaRecord): Promise<CapaRecord> {
    if (!isCapaStillOpen(capa.status)) {
      return capa;
    }
    if (new Date(capa.dueDate).getTime() >= Date.now() || capa.status === "overdue") {
      return capa;
    }

    return this.repository.updateCapa(capa.id, {
      status: "overdue",
      updatedAt: new Date().toISOString()
    });
  }

  private async advanceWorkflowIfPossible(
    actor: ActorContext,
    workflowRunId: string | null,
    states: ReadonlyArray<WorkflowRun["state"]>,
    note: string
  ): Promise<void> {
    if (!workflowRunId) {
      return;
    }

    const workflow = await this.repository.getWorkflowRun(workflowRunId);
    if (!workflow) {
      return;
    }
    const definition = workflowRegistry.get(workflow.workflowDefinitionId);
    if (!definition) {
      return;
    }

    let current = workflow;
    for (const state of states) {
      if (!canTransition(definition, current.state, state)) {
        continue;
      }
      current = await this.transitionWorkflowRun(actor, current.id, {
        nextState: state,
        note
      });
    }
  }

  private async buildCommitteeQapiDashboardSummary(): Promise<CommitteeQapiDashboardSummary> {
    const now = new Date().toISOString();
    const practiceAgreementExpiryThreshold = addDays(now, 45);
    const [
      overview,
      incidents,
      capas,
      workerSummary,
      standards,
      binders,
      controlledSubstancePackets,
      telehealthPackets,
      practiceAgreements
    ] = await Promise.all([
      this.getOverviewStats(),
      this.repository.listIncidents(),
      this.repository.listCapas(),
      this.getWorkerJobSummary(),
      this.repository.listStandardMappings(),
      this.repository.listEvidenceBinders(),
      this.repository.listControlledSubstanceStewardship(),
      this.repository.listTelehealthStewardship(),
      this.repository.listPracticeAgreements()
    ]);

    const openIncidents = incidents.filter((incident) => incident.status !== "closed");
    const openCapas = capas.filter((capa) => capa.status !== "closed");
    const overdueStandardsReviews = standards.filter((standard) =>
      standard.nextReviewDueAt !== null && standard.nextReviewDueAt < now
    );
    const evidenceBindersInReview = binders.filter((binder) =>
      ["approval_pending", "approved", "publish_pending"].includes(binder.status)
    );
    const controlledSubstancePacketsNeedingReview = controlledSubstancePackets.filter((packet) =>
      ["approval_pending", "approved", "publish_pending"].includes(packet.status)
    );
    const telehealthPacketsNeedingReview = telehealthPackets.filter((packet) =>
      ["approval_pending", "approved", "publish_pending"].includes(packet.status)
    );
    const practiceAgreementsExpiringSoon = practiceAgreements.filter((agreement) =>
      agreement.expiresAt !== null && agreement.expiresAt <= practiceAgreementExpiryThreshold
    );

    return {
      openIncidents: openIncidents.length,
      criticalIncidents: openIncidents.filter((incident) => incident.severity === "critical").length,
      openCapas: openCapas.length,
      overdueCapas: openCapas.filter((capa) => capa.dueDate < now).length,
      overdueActionItems: overview.overdueActionItems,
      pendingApprovals: overview.openApprovals,
      overdueScorecardReviews: overview.overdueScorecardReviews,
      queuedJobs: workerSummary.queued + workerSummary.processing,
      standardsAttentionNeeded: standards.filter((standard) => standard.status === "attention_needed").length,
      standardsReviewPending: standards.filter((standard) => standard.status === "review_pending").length,
      overdueStandardsReviews: overdueStandardsReviews.length,
      evidenceBindersDraft: binders.filter((binder) => binder.status === "draft").length,
      evidenceBindersInReview: evidenceBindersInReview.length,
      controlledSubstancePacketsNeedingReview: controlledSubstancePacketsNeedingReview.length,
      controlledSubstancePacketsPublished: controlledSubstancePackets.filter((packet) => packet.status === "published").length,
      telehealthPacketsNeedingReview: telehealthPacketsNeedingReview.length,
      practiceAgreementsExpiringSoon: practiceAgreementsExpiringSoon.length
    };
  }

  private async buildCommitteeQapiSnapshot(summaryNote: string | null): Promise<CommitteeQapiSnapshot> {
    const dashboard = await this.buildCommitteeQapiDashboardSummary();

    return {
      openIncidents: dashboard.openIncidents,
      criticalIncidents: dashboard.criticalIncidents,
      openCapas: dashboard.openCapas,
      overdueCapas: dashboard.overdueCapas,
      overdueActionItems: dashboard.overdueActionItems,
      pendingApprovals: dashboard.pendingApprovals,
      overdueScorecardReviews: dashboard.overdueScorecardReviews,
      queuedJobs: dashboard.queuedJobs,
      summaryNote
    };
  }

  private buildCommitteePacketBody(
    committee: CommitteeRecord,
    meeting: CommitteeMeetingRecord
  ): string {
    const agenda = meeting.agendaItems.map((item, index) => [
      `${index + 1}. ${item.title}`,
      `   owner role: ${item.ownerRole}`,
      `   status: ${item.status}`,
      `   due date: ${item.dueDate ?? "n/a"}`,
      `   summary: ${item.summary}`,
      item.linkedIncidentId ? `   linked incident: ${item.linkedIncidentId}` : null,
      item.linkedCapaId ? `   linked CAPA: ${item.linkedCapaId}` : null
    ].filter(Boolean).join("\n")).join("\n\n");

    const decisions = meeting.decisions.length > 0
      ? meeting.decisions.map((decision, index) => [
          `${index + 1}. ${decision.summary}`,
          `   owner role: ${decision.ownerRole}`,
          `   status: ${decision.status}`,
          `   due date: ${decision.dueDate ?? "n/a"}`,
          decision.actionItemId ? `   linked action item: ${decision.actionItemId}` : null,
          decision.linkedIncidentId ? `   linked incident: ${decision.linkedIncidentId}` : null,
          decision.linkedCapaId ? `   linked CAPA: ${decision.linkedCapaId}` : null,
          decision.notes ? `   notes: ${decision.notes}` : null
        ].filter(Boolean).join("\n")).join("\n\n")
      : "No decisions recorded yet.";

    const qapiSection = meeting.qapiSnapshot
      ? [
          "## QAPI Snapshot",
          `- Open incidents: ${meeting.qapiSnapshot.openIncidents}`,
          `- Critical incidents: ${meeting.qapiSnapshot.criticalIncidents}`,
          `- Open CAPAs: ${meeting.qapiSnapshot.openCapas}`,
          `- Overdue CAPAs: ${meeting.qapiSnapshot.overdueCapas}`,
          `- Overdue action items: ${meeting.qapiSnapshot.overdueActionItems}`,
          `- Pending approvals: ${meeting.qapiSnapshot.pendingApprovals}`,
          `- Overdue scorecard reviews: ${meeting.qapiSnapshot.overdueScorecardReviews}`,
          `- Queued jobs: ${meeting.qapiSnapshot.queuedJobs}`,
          meeting.qapiSnapshot.summaryNote ? `- Note: ${meeting.qapiSnapshot.summaryNote}` : null
        ].filter(Boolean).join("\n")
      : null;

    return [
      `# ${meeting.title}`,
      "",
      `Committee: ${committee.name}`,
      `Category: ${committee.category}`,
      `Cadence: ${committee.cadence}`,
      `Chair role: ${committee.chairRole}`,
      `Recorder role: ${committee.recorderRole}`,
      `Scheduled for: ${meeting.scheduledFor}`,
      committee.serviceLine ? `Service line: ${committee.serviceLine}` : null,
      "",
      "## Scope",
      committee.scope,
      "",
      "## Meeting Notes",
      meeting.notes ?? "No meeting notes recorded.",
      "",
      "## Agenda",
      agenda,
      "",
      qapiSection,
      qapiSection ? "" : null,
      "## Decisions",
      decisions
    ].filter((line): line is string => line !== null).join("\n");
  }

  private buildServiceLinePackBody(
    serviceLineId: ServiceLineRecord["id"],
    input: z.infer<typeof serviceLinePackCreateSchema>,
    publicAssetCount: number
  ): string {
    return [
      `# ${serviceLineId.replaceAll("_", " ")} governance pack`,
      "",
      `Owner role: ${input.ownerRole}`,
      "",
      "## Service charter",
      input.charterSummary,
      "",
      "## Inclusion / exclusion rules",
      input.inclusionExclusionRules,
      "",
      "## Role matrix",
      input.roleMatrixSummary,
      "",
      "## Competency requirements",
      input.competencyRequirements,
      "",
      "## Audit tool",
      input.auditToolSummary,
      "",
      "## Emergency escalation",
      input.emergencyEscalation,
      "",
      "## Pricing model",
      input.pricingModelSummary,
      "",
      "## Claims governance",
      input.claimsGovernanceSummary,
      "",
      "## Public asset inventory signal",
      `Linked public assets currently tracked for this service line: ${publicAssetCount}`,
      input.notes ? "" : null,
      input.notes ? "## Notes" : null,
      input.notes ?? null
    ].filter((line): line is string => line !== null).join("\n");
  }

  private buildPracticeAgreementBody(
    input:
      | z.infer<typeof practiceAgreementCreateSchema>
      | PracticeAgreementRecord
  ): string {
    return [
      `# ${input.title}`,
      "",
      `Agreement type: ${input.agreementType.replaceAll("_", " ")}`,
      `Owner role: ${input.ownerRole}`,
      `Supervising physician: ${input.supervisingPhysicianName} (${input.supervisingPhysicianRole.replaceAll("_", " ")})`,
      `Supervised role: ${input.supervisedRole.replaceAll("_", " ")}`,
      "",
      "## Service lines",
      ...input.serviceLineIds.map((serviceLineId) => `- ${serviceLineId.replaceAll("_", " ")}`),
      "",
      "## Scope summary",
      input.scopeSummary,
      "",
      "## Delegated activities",
      input.delegatedActivitiesSummary,
      "",
      "## Cosign expectation",
      input.cosignExpectation,
      "",
      "## Escalation protocol",
      input.escalationProtocol,
      "",
      "## Review cadence",
      `Review every ${input.reviewCadenceDays ?? 90} days.`,
      input.effectiveDate ? "" : null,
      input.effectiveDate ? `Effective date: ${input.effectiveDate}` : null,
      input.expiresAt ? `Expiration date: ${input.expiresAt}` : null,
      input.notes ? "" : null,
      input.notes ? "## Notes" : null,
      input.notes ?? null
    ].filter((line): line is string => line !== null).join("\n");
  }

  private buildTelehealthStewardshipBody(
    input:
      | z.infer<typeof telehealthStewardshipCreateSchema>
      | TelehealthStewardshipRecord
  ): string {
    return [
      `# ${input.title}`,
      "",
      "Service line: telehealth",
      `Owner role: ${input.ownerRole}`,
      `Supervising physician role: ${input.supervisingPhysicianRole.replaceAll("_", " ")}`,
      `Linked practice agreement: ${input.linkedPracticeAgreementId ?? "None linked"}`,
      "",
      "## Delegated task coverage",
      ...(input.delegatedTaskCodes.length > 0
        ? input.delegatedTaskCodes.map((taskCode) => `- ${taskCode}`)
        : ["- No delegated telehealth tasks are currently linked."]),
      "",
      "## Modality scope",
      input.modalityScopeSummary,
      "",
      "## State coverage",
      input.stateCoverageSummary,
      "",
      "## Patient identity and location verification",
      input.patientIdentitySummary,
      "",
      "## Consent workflow",
      input.consentWorkflowSummary,
      "",
      "## Documentation standards",
      input.documentationStandardSummary,
      "",
      "## Emergency redirect workflow",
      input.emergencyRedirectSummary,
      "",
      "## QA review expectations",
      input.qaReviewSummary,
      "",
      "## Review cadence",
      `Review every ${input.reviewCadenceDays ?? 60} days.`,
      input.effectiveDate ? "" : null,
      input.effectiveDate ? `Effective date: ${input.effectiveDate}` : null,
      input.notes ? "" : null,
      input.notes ? "## Notes" : null,
      input.notes ?? null
    ].filter((line): line is string => line !== null).join("\n");
  }

  private buildControlledSubstanceStewardshipBody(
    input:
      | z.infer<typeof controlledSubstanceStewardshipCreateSchema>
      | ControlledSubstanceStewardshipRecord
  ): string {
    return [
      `# ${input.title}`,
      "",
      `Owner role: ${input.ownerRole}`,
      `Supervising physician role: ${input.supervisingPhysicianRole.replaceAll("_", " ")}`,
      `Linked practice agreement: ${input.linkedPracticeAgreementId ?? "None linked"}`,
      "",
      "## Service lines",
      ...input.serviceLineIds.map((serviceLineId) => `- ${serviceLineId.replaceAll("_", " ")}`),
      "",
      "## Prescribing scope",
      input.prescribingScopeSummary,
      "",
      "## PDMP review",
      input.pdmpReviewSummary,
      "",
      "## Screening and monitoring protocol",
      input.screeningProtocolSummary,
      "",
      "## Refill escalation",
      input.refillEscalationSummary,
      "",
      "## Inventory and diversion controls",
      input.inventoryControlSummary,
      "",
      "## Patient education expectations",
      input.patientEducationSummary,
      "",
      "## Adverse-event escalation",
      input.adverseEventEscalationSummary,
      "",
      "## Review cadence",
      `Review every ${input.reviewCadenceDays ?? 45} days.`,
      input.effectiveDate ? "" : null,
      input.effectiveDate ? `Effective date: ${input.effectiveDate}` : null,
      input.notes ? "" : null,
      input.notes ? "## Notes" : null,
      input.notes ?? null
    ].filter((line): line is string => line !== null).join("\n");
  }

  private buildEvidenceBinderBody(
    input:
      | z.infer<typeof evidenceBinderCreateSchema>
      | EvidenceBinderRecord,
    standards: StandardMappingRecord[]
  ): string {
    const mappedStandards = standards.length > 0
      ? standards.map((standard, index) => [
        `${index + 1}. ${standard.standardCode} - ${standard.title}`,
        `   domain: ${standard.domain}`,
        `   owner role: ${standard.ownerRole}`,
        `   status: ${standard.status}`,
        `   requirement: ${standard.requirementSummary}`,
        `   evidence expectation: ${standard.evidenceExpectation}`
      ].join("\n")).join("\n\n")
      : "No standards are currently linked.";

    return [
      `# ${input.title}`,
      "",
      `Owner role: ${input.ownerRole}`,
      `Source authority: ${input.sourceAuthority}`,
      input.surveyWindowLabel ? `Survey window: ${input.surveyWindowLabel}` : null,
      "",
      "## Binder summary",
      input.summary,
      "",
      "## Evidence-readiness summary",
      input.evidenceReadinessSummary,
      "",
      "## Open gaps",
      input.openGapSummary,
      "",
      "## Standards included",
      mappedStandards,
      "",
      "## Review cadence",
      `Review every ${input.reviewCadenceDays ?? 90} days.`,
      input.notes ? "" : null,
      input.notes ? "## Notes" : null,
      input.notes ?? null
    ].filter((line): line is string => line !== null).join("\n");
  }

  private async syncPublicAssetFromDocument(document: DocumentRecord): Promise<PublicAssetRecord | null> {
    const asset = await this.repository.getPublicAssetByDocumentId(document.id);
    if (!asset) {
      return null;
    }

    return this.repository.updatePublicAsset(asset.id, {
      title: document.title,
      ownerRole: document.ownerRole as PublicAssetRecord["ownerRole"],
      summary: document.summary,
      body: document.body,
      serviceLine: document.serviceLines[0] ?? null,
      status: derivePublicAssetStatus({
        documentStatus: document.status,
        claimsReviewStatus: asset.claimsReviewStatus
      }),
      publishedAt: document.publishedAt,
      publishedPath: document.publishedPath,
      updatedAt: new Date().toISOString()
    });
  }

  private async syncPracticeAgreementFromDocument(document: DocumentRecord): Promise<PracticeAgreementRecord | null> {
    const agreement = await this.repository.getPracticeAgreementByDocumentId(document.id);
    if (!agreement) {
      return null;
    }

    const now = new Date().toISOString();
    return this.repository.updatePracticeAgreement(agreement.id, {
      title: document.title,
      ownerRole: document.ownerRole as PracticeAgreementRecord["ownerRole"],
      serviceLineIds: document.serviceLines.length > 0
        ? document.serviceLines as PracticeAgreementRecord["serviceLineIds"]
        : agreement.serviceLineIds,
      status: derivePracticeAgreementStatus({
        documentStatus: document.status,
        currentStatus: agreement.status
      }),
      effectiveDate: document.publishedAt ?? agreement.effectiveDate,
      reviewDueAt: document.publishedAt ? addDays(document.publishedAt, agreement.reviewCadenceDays) : agreement.reviewDueAt,
      publishedAt: document.publishedAt,
      publishedPath: document.publishedPath,
      updatedAt: now
    });
  }

  private async syncTelehealthStewardshipFromDocument(document: DocumentRecord): Promise<TelehealthStewardshipRecord | null> {
    const stewardship = await this.repository.getTelehealthStewardshipByDocumentId(document.id);
    if (!stewardship) {
      return null;
    }

    const now = new Date().toISOString();
    return this.repository.updateTelehealthStewardship(stewardship.id, {
      title: document.title,
      ownerRole: document.ownerRole as TelehealthStewardshipRecord["ownerRole"],
      status: deriveTelehealthStewardshipStatus({
        documentStatus: document.status,
        currentStatus: stewardship.status
      }),
      effectiveDate: document.publishedAt ?? stewardship.effectiveDate,
      reviewDueAt: document.publishedAt ? addDays(document.publishedAt, stewardship.reviewCadenceDays) : stewardship.reviewDueAt,
      publishedAt: document.publishedAt,
      publishedPath: document.publishedPath,
      updatedAt: now
    });
  }

  private async syncControlledSubstanceStewardshipFromDocument(
    document: DocumentRecord
  ): Promise<ControlledSubstanceStewardshipRecord | null> {
    const stewardship = await this.repository.getControlledSubstanceStewardshipByDocumentId(document.id);
    if (!stewardship) {
      return null;
    }

    const now = new Date().toISOString();
    return this.repository.updateControlledSubstanceStewardship(stewardship.id, {
      title: document.title,
      ownerRole: document.ownerRole as ControlledSubstanceStewardshipRecord["ownerRole"],
      serviceLineIds: document.serviceLines.length > 0
        ? document.serviceLines as ControlledSubstanceStewardshipRecord["serviceLineIds"]
        : stewardship.serviceLineIds,
      status: deriveControlledSubstanceStewardshipStatus({
        documentStatus: document.status,
        currentStatus: stewardship.status
      }),
      effectiveDate: document.publishedAt ?? stewardship.effectiveDate,
      reviewDueAt: document.publishedAt ? addDays(document.publishedAt, stewardship.reviewCadenceDays) : stewardship.reviewDueAt,
      publishedAt: document.publishedAt,
      publishedPath: document.publishedPath,
      updatedAt: now
    });
  }

  private async syncCommitteeMeetingFromDocument(document: DocumentRecord): Promise<CommitteeMeetingRecord | null> {
    const meeting = await this.repository.getCommitteeMeetingByPacketDocumentId(document.id);
    if (!meeting) {
      return null;
    }

    return this.repository.updateCommitteeMeeting(meeting.id, {
      status: deriveCommitteeMeetingStatus({
        documentStatus: document.status,
        currentStatus: meeting.status
      }),
      updatedAt: new Date().toISOString()
    });
  }

  private async getLatestServiceLinePack(serviceLineId: string): Promise<ServiceLinePackRecord | null> {
    const packs = await this.repository.listServiceLinePacks({ serviceLineId });
    return packs[0] ?? null;
  }

  private async syncServiceLinePackFromDocument(document: DocumentRecord): Promise<ServiceLinePackRecord | null> {
    const pack = await this.repository.getServiceLinePackByDocumentId(document.id);
    if (!pack) {
      return null;
    }

    const updatedPack = await this.repository.updateServiceLinePack(pack.id, {
      title: document.title,
      ownerRole: document.ownerRole as ServiceLinePackRecord["ownerRole"],
      status: deriveServiceLinePackStatus({ documentStatus: document.status }),
      publishedAt: document.publishedAt,
      publishedPath: document.publishedPath,
      updatedAt: new Date().toISOString()
    });

    const serviceLine = await this.repository.getServiceLine(pack.serviceLineId);
    if (serviceLine) {
      const nextGovernanceStatus =
        updatedPack.status === "published"
          ? "published"
          : updatedPack.status === "approved"
            ? "approved"
            : updatedPack.status === "approval_pending"
              ? "review_pending"
              : updatedPack.status === "sent_back"
                ? "attention_needed"
                : "drafting";
      await this.repository.updateServiceLine(serviceLine.id, {
        governanceStatus: nextGovernanceStatus,
        latestPackId: updatedPack.id,
        lastReviewedAt: updatedPack.status === "approved" || updatedPack.status === "published"
          ? new Date().toISOString()
          : serviceLine.lastReviewedAt,
        nextReviewDueAt: updatedPack.status === "published"
          ? addDays(new Date().toISOString(), serviceLine.reviewCadenceDays)
          : serviceLine.nextReviewDueAt,
        updatedAt: new Date().toISOString()
      });
    }

    return updatedPack;
  }

  private async syncEvidenceBinderFromDocument(document: DocumentRecord): Promise<EvidenceBinderRecord | null> {
    const binder = await this.repository.getEvidenceBinderByDocumentId(document.id);
    if (!binder) {
      return null;
    }

    const updatedAt = new Date().toISOString();
    const updatedBinder = await this.repository.updateEvidenceBinder(binder.id, {
      title: document.title,
      ownerRole: document.ownerRole as EvidenceBinderRecord["ownerRole"],
      status: deriveEvidenceBinderStatus({
        documentStatus: document.status,
        currentStatus: binder.status
      }),
      publishedAt: document.publishedAt,
      publishedPath: document.publishedPath,
      updatedAt
    });

    const standardStatus =
      document.status === "published"
        ? "complete"
        : document.status === "in_review" || document.status === "approved" || document.status === "publish_pending"
          ? "review_pending"
          : document.status === "rejected"
            ? "attention_needed"
            : "evidence_ready";

    for (const standardId of binder.standardIds) {
      const standard = await this.repository.getStandardMapping(standardId);
      if (!standard) {
        continue;
      }

      const nextEvidenceDocumentIds = document.status === "published"
        ? Array.from(new Set([...standard.evidenceDocumentIds, document.id]))
        : standard.evidenceDocumentIds;
      await this.repository.updateStandardMapping(standard.id, {
        status: standardStatus,
        latestBinderId: binder.id,
        evidenceDocumentIds: nextEvidenceDocumentIds,
        lastReviewedAt: document.publishedAt ?? standard.lastReviewedAt,
        nextReviewDueAt: document.publishedAt
          ? addDays(document.publishedAt, standard.reviewCadenceDays)
          : standard.nextReviewDueAt,
        updatedAt
      });
    }

    return updatedBinder;
  }

  private async syncIncidentSideEffects(actor: ActorContext, incident: IncidentRecord): Promise<void> {
    if (!this.options.incidentListSyncEnabled) {
      return;
    }

    await this.enqueueWorkerJob(actor, createWorkerJob({
      type: "lists.incident.upsert",
      payload: {
        actor: actorSnapshot(actor),
        incidentId: incident.id
      },
      sourceEntityType: "incident",
      sourceEntityId: incident.id
    }));
  }

  private async syncCapaSideEffects(actor: ActorContext, capa: CapaRecord): Promise<void> {
    if (!this.options.capaListSyncEnabled) {
      return;
    }

    await this.enqueueWorkerJob(actor, createWorkerJob({
      type: "lists.capa.upsert",
      payload: {
        actor: actorSnapshot(actor),
        capaId: capa.id
      },
      sourceEntityType: "capa",
      sourceEntityId: capa.id
    }));
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
