import type {
  ActionItemRecord,
  ApprovalTask,
  AuditEvent,
  CapaRecord,
  ChecklistItemRecord,
  ChecklistRun,
  ChecklistTemplate,
  CommitteeMeetingRecord,
  CommitteeRecord,
  DeviceAllowedProfile,
  DeviceEnrollmentCode,
  DeviceSession,
  DocumentRecord,
  EnrolledDevice,
  IncidentRecord,
  MetricRun,
  MicrosoftIntegrationValidationRecord,
  PublicAssetRecord,
  ScorecardReviewRecord,
  TrainingCompletionRecord,
  TrainingRequirement,
  UserProfile,
  WorkerJobRecord,
  WorkflowRun
} from "@clinic-os/domain";
import {
  actionItemRecordSchema,
  approvalTaskSchema,
  auditEventSchema,
  capaRecordSchema,
  checklistItemRecordSchema,
  checklistRunSchema,
  checklistTemplateSchema,
  committeeMeetingRecordSchema,
  committeeRecordSchema,
  deviceAllowedProfileSchema,
  deviceEnrollmentCodeSchema,
  deviceSessionSchema,
  documentRecordSchema,
  enrolledDeviceSchema,
  incidentRecordSchema,
  metricRunSchema,
  microsoftIntegrationValidationRecordSchema,
  publicAssetRecordSchema,
  scorecardReviewRecordSchema,
  trainingCompletionRecordSchema,
  trainingRequirementSchema,
  userProfileSchema,
  workerJobRecordSchema,
  workflowRunSchema
} from "@clinic-os/domain";
import { Prisma, type PrismaClient } from "@prisma/client";

type ListFilters = Record<string, string | undefined>;

export type ClinicRepository = {
  createWorkflowRun(run: WorkflowRun): Promise<WorkflowRun>;
  updateWorkflowRun(id: string, patch: Partial<WorkflowRun>): Promise<WorkflowRun>;
  getWorkflowRun(id: string): Promise<WorkflowRun | null>;
  listWorkflowRuns(filters?: { workflowDefinitionId?: string }): Promise<WorkflowRun[]>;
  createDocument(document: DocumentRecord): Promise<DocumentRecord>;
  updateDocument(id: string, patch: Partial<DocumentRecord>): Promise<DocumentRecord>;
  getDocument(id: string): Promise<DocumentRecord | null>;
  listDocuments(filters?: { status?: string; approvalClass?: string }): Promise<DocumentRecord[]>;
  createApprovalTasks(tasks: ApprovalTask[]): Promise<ApprovalTask[]>;
  updateApprovalTask(id: string, patch: Partial<ApprovalTask>): Promise<ApprovalTask>;
  getApprovalTask(id: string): Promise<ApprovalTask | null>;
  listApprovalTasks(filters?: { reviewerRole?: string; status?: string; targetId?: string }): Promise<ApprovalTask[]>;
  createActionItem(item: ActionItemRecord): Promise<ActionItemRecord>;
  updateActionItem(id: string, patch: Partial<ActionItemRecord>): Promise<ActionItemRecord>;
  getActionItem(id: string): Promise<ActionItemRecord | null>;
  listActionItems(filters?: {
    ownerRole?: string;
    status?: string;
    kind?: string;
    escalationStatus?: string;
    sourceWorkflowRunId?: string;
  }): Promise<ActionItemRecord[]>;
  createIncident(record: IncidentRecord): Promise<IncidentRecord>;
  updateIncident(id: string, patch: Partial<IncidentRecord>): Promise<IncidentRecord>;
  getIncident(id: string): Promise<IncidentRecord | null>;
  listIncidents(filters?: {
    status?: string;
    severity?: string;
    ownerRole?: string;
    linkedCapaId?: string;
  }): Promise<IncidentRecord[]>;
  createCapa(record: CapaRecord): Promise<CapaRecord>;
  updateCapa(id: string, patch: Partial<CapaRecord>): Promise<CapaRecord>;
  getCapa(id: string): Promise<CapaRecord | null>;
  listCapas(filters?: {
    status?: string;
    sourceType?: string;
    ownerRole?: string;
    incidentId?: string;
  }): Promise<CapaRecord[]>;
  createPublicAsset(record: PublicAssetRecord): Promise<PublicAssetRecord>;
  updatePublicAsset(id: string, patch: Partial<PublicAssetRecord>): Promise<PublicAssetRecord>;
  getPublicAsset(id: string): Promise<PublicAssetRecord | null>;
  getPublicAssetByDocumentId(documentId: string): Promise<PublicAssetRecord | null>;
  listPublicAssets(filters?: {
    status?: string;
    ownerRole?: string;
    assetType?: string;
    serviceLine?: string;
  }): Promise<PublicAssetRecord[]>;
  createCommittee(record: CommitteeRecord): Promise<CommitteeRecord>;
  updateCommittee(id: string, patch: Partial<CommitteeRecord>): Promise<CommitteeRecord>;
  getCommittee(id: string): Promise<CommitteeRecord | null>;
  listCommittees(filters?: {
    category?: string;
    isActive?: boolean;
    qapiFocus?: boolean;
    serviceLine?: string;
  }): Promise<CommitteeRecord[]>;
  createCommitteeMeeting(record: CommitteeMeetingRecord): Promise<CommitteeMeetingRecord>;
  updateCommitteeMeeting(id: string, patch: Partial<CommitteeMeetingRecord>): Promise<CommitteeMeetingRecord>;
  getCommitteeMeeting(id: string): Promise<CommitteeMeetingRecord | null>;
  getCommitteeMeetingByPacketDocumentId(packetDocumentId: string): Promise<CommitteeMeetingRecord | null>;
  listCommitteeMeetings(filters?: {
    committeeId?: string;
    status?: string;
  }): Promise<CommitteeMeetingRecord[]>;
  createChecklistTemplate(template: ChecklistTemplate): Promise<ChecklistTemplate>;
  updateChecklistTemplate(id: string, patch: Partial<ChecklistTemplate>): Promise<ChecklistTemplate>;
  getChecklistTemplate(id: string): Promise<ChecklistTemplate | null>;
  listChecklistTemplates(filters?: {
    workflowDefinitionId?: string;
    isActive?: boolean;
  }): Promise<ChecklistTemplate[]>;
  createChecklistRun(run: ChecklistRun): Promise<ChecklistRun>;
  updateChecklistRun(id: string, patch: Partial<ChecklistRun>): Promise<ChecklistRun>;
  getChecklistRun(id: string): Promise<ChecklistRun | null>;
  listChecklistRuns(filters?: {
    workflowRunId?: string;
    templateId?: string;
  }): Promise<ChecklistRun[]>;
  createChecklistItems(items: ChecklistItemRecord[]): Promise<ChecklistItemRecord[]>;
  updateChecklistItem(id: string, patch: Partial<ChecklistItemRecord>): Promise<ChecklistItemRecord>;
  getChecklistItem(id: string): Promise<ChecklistItemRecord | null>;
  listChecklistItems(filters?: {
    checklistRunId?: string;
    status?: string;
    reviewActionItemId?: string;
  }): Promise<ChecklistItemRecord[]>;
  createScorecardReviews(records: ScorecardReviewRecord[]): Promise<ScorecardReviewRecord[]>;
  updateScorecardReview(id: string, patch: Partial<ScorecardReviewRecord>): Promise<ScorecardReviewRecord>;
  getScorecardReview(id: string): Promise<ScorecardReviewRecord | null>;
  listScorecardReviews(filters?: {
    status?: string;
    assignedReviewerRole?: string;
    workflowRunId?: string;
    employeeId?: string;
  }): Promise<ScorecardReviewRecord[]>;
  createMetricRuns(metricRuns: MetricRun[]): Promise<MetricRun[]>;
  listMetricRuns(filters?: { entityId?: string }): Promise<MetricRun[]>;
  createTrainingRequirement(requirement: TrainingRequirement): Promise<TrainingRequirement>;
  updateTrainingRequirement(id: string, patch: Partial<TrainingRequirement>): Promise<TrainingRequirement>;
  getTrainingRequirement(id: string): Promise<TrainingRequirement | null>;
  listTrainingRequirements(filters?: {
    employeeId?: string;
    employeeRole?: string;
    requirementType?: string;
  }): Promise<TrainingRequirement[]>;
  createTrainingCompletion(record: TrainingCompletionRecord): Promise<TrainingCompletionRecord>;
  listTrainingCompletions(filters?: {
    requirementId?: string;
    employeeId?: string;
    employeeRole?: string;
  }): Promise<TrainingCompletionRecord[]>;
  createAuditEvent(event: AuditEvent): Promise<AuditEvent>;
  listAuditEvents(filters?: { entityType?: string; entityId?: string }): Promise<AuditEvent[]>;
  createUserProfile(profile: UserProfile): Promise<UserProfile>;
  updateUserProfile(id: string, patch: Partial<UserProfile>): Promise<UserProfile>;
  getUserProfile(id: string): Promise<UserProfile | null>;
  listUserProfiles(filters?: { status?: string; role?: string }): Promise<UserProfile[]>;
  createEnrolledDevice(device: EnrolledDevice): Promise<EnrolledDevice>;
  updateEnrolledDevice(id: string, patch: Partial<EnrolledDevice>): Promise<EnrolledDevice>;
  getEnrolledDevice(id: string): Promise<EnrolledDevice | null>;
  getEnrolledDeviceBySecretHash(secretHash: string): Promise<EnrolledDevice | null>;
  listEnrolledDevices(filters?: { status?: string; primaryProfileId?: string }): Promise<EnrolledDevice[]>;
  replaceDeviceAllowedProfiles(deviceId: string, records: DeviceAllowedProfile[]): Promise<DeviceAllowedProfile[]>;
  updateDeviceAllowedProfile(id: string, patch: Partial<DeviceAllowedProfile>): Promise<DeviceAllowedProfile>;
  listDeviceAllowedProfiles(filters?: { deviceId?: string; profileId?: string }): Promise<DeviceAllowedProfile[]>;
  createDeviceEnrollmentCode(code: DeviceEnrollmentCode): Promise<DeviceEnrollmentCode>;
  updateDeviceEnrollmentCode(id: string, patch: Partial<DeviceEnrollmentCode>): Promise<DeviceEnrollmentCode>;
  getDeviceEnrollmentCodeByCodeHash(codeHash: string): Promise<DeviceEnrollmentCode | null>;
  listDeviceEnrollmentCodes(filters?: { createdByProfileId?: string; primaryProfileId?: string; includeConsumed?: boolean }): Promise<DeviceEnrollmentCode[]>;
  deleteDeviceEnrollmentCodes(ids: string[]): Promise<number>;
  createDeviceSession(session: DeviceSession): Promise<DeviceSession>;
  updateDeviceSession(id: string, patch: Partial<DeviceSession>): Promise<DeviceSession>;
  getDeviceSession(id: string): Promise<DeviceSession | null>;
  getDeviceSessionBySecretHash(secretHash: string): Promise<DeviceSession | null>;
  listDeviceSessions(filters?: { deviceId?: string; profileId?: string; includeRevoked?: boolean }): Promise<DeviceSession[]>;
  deleteDeviceSessions(ids: string[]): Promise<number>;
  enqueueWorkerJob(job: WorkerJobRecord): Promise<WorkerJobRecord>;
  getWorkerJob(id: string): Promise<WorkerJobRecord | null>;
  listWorkerJobs(filters?: {
    status?: string;
    type?: string;
    sourceEntityId?: string;
    sourceEntityType?: string;
  }): Promise<WorkerJobRecord[]>;
  updateWorkerJob(id: string, patch: Partial<WorkerJobRecord>): Promise<WorkerJobRecord>;
  leaseWorkerJobs(options?: {
    limit?: number;
    now?: string;
    lockTimeoutMinutes?: number;
  }): Promise<WorkerJobRecord[]>;
  retryWorkerJob(id: string, now?: string): Promise<WorkerJobRecord>;
  deleteWorkerJobs(ids: string[]): Promise<number>;
  createMicrosoftIntegrationValidationRecord(
    record: MicrosoftIntegrationValidationRecord
  ): Promise<MicrosoftIntegrationValidationRecord>;
  getLatestMicrosoftIntegrationValidationRecord(): Promise<MicrosoftIntegrationValidationRecord | null>;
};

function isoToDate(value?: string | null): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  return new Date(value);
}

function isoToRequiredDate(value?: string): Date | undefined {
  if (value === undefined) return undefined;
  return new Date(value);
}

function asJsonValue(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function asNullableJsonValue(
  value: unknown | null | undefined
): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput | undefined {
  if (value === undefined) return undefined;
  if (value === null) return Prisma.JsonNull;
  return value as Prisma.InputJsonValue;
}

function mapListFilters(filters?: ListFilters): Record<string, string> | undefined {
  if (!filters) return undefined;
  return Object.fromEntries(
    Object.entries(filters).filter((entry): entry is [string, string] => Boolean(entry[1]))
  );
}

export class PrismaClinicRepository implements ClinicRepository {
  constructor(private readonly client: PrismaClient) {}

  private mapUserProfile(record: {
    id: string;
    displayName: string;
    role: string;
    grantedRoles: Prisma.JsonValue;
    status: string;
    pinHash: string;
    createdAt: Date;
    updatedAt: Date;
  }): UserProfile {
    return userProfileSchema.parse({
      ...record,
      grantedRoles: record.grantedRoles,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString()
    });
  }

  private mapEnrolledDevice(record: {
    id: string;
    deviceLabel: string;
    status: string;
    deviceSecretHash: string;
    primaryProfileId: string;
    trustExpiresAt: Date;
    lastSeenAt: Date | null;
    createdByProfileId: string;
    createdAt: Date;
    updatedAt: Date;
  }): EnrolledDevice {
    return enrolledDeviceSchema.parse({
      ...record,
      trustExpiresAt: record.trustExpiresAt.toISOString(),
      lastSeenAt: record.lastSeenAt?.toISOString() ?? null,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString()
    });
  }

  private mapDeviceAllowedProfile(record: {
    id: string;
    deviceId: string;
    profileId: string;
    isPrimary: boolean;
    failedPinAttempts: number;
    lockedUntil: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }): DeviceAllowedProfile {
    return deviceAllowedProfileSchema.parse({
      ...record,
      lockedUntil: record.lockedUntil?.toISOString() ?? null,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString()
    });
  }

  private mapDeviceEnrollmentCode(record: {
    id: string;
    codeHash: string;
    createdByProfileId: string;
    primaryProfileId: string;
    allowedProfileIds: Prisma.JsonValue;
    expiresAt: Date;
    consumedAt: Date | null;
    consumedByDeviceId: string | null;
    createdAt: Date;
  }): DeviceEnrollmentCode {
    return deviceEnrollmentCodeSchema.parse({
      ...record,
      expiresAt: record.expiresAt.toISOString(),
      consumedAt: record.consumedAt?.toISOString() ?? null,
      createdAt: record.createdAt.toISOString()
    });
  }

  private mapDeviceSession(record: {
    id: string;
    deviceId: string;
    profileId: string;
    activeRole: string;
    sessionSecretHash: string;
    idleExpiresAt: Date;
    absoluteExpiresAt: Date;
    lastSeenAt: Date;
    revokedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }): DeviceSession {
    return deviceSessionSchema.parse({
      ...record,
      idleExpiresAt: record.idleExpiresAt.toISOString(),
      absoluteExpiresAt: record.absoluteExpiresAt.toISOString(),
      lastSeenAt: record.lastSeenAt.toISOString(),
      revokedAt: record.revokedAt?.toISOString() ?? null,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString()
    });
  }

  private mapActionItemRecord(record: {
    id: string;
    kind: string;
    title: string;
    description: string | null;
    ownerRole: string;
    createdBy: string;
    status: string;
    resolutionNote: string | null;
    dueDate: Date | null;
    closedAt: Date | null;
    escalationStatus: string;
    escalatedToRole: string | null;
    needsReviewAt: Date | null;
    escalatedAt: Date | null;
    plannerTaskId: string | null;
    syncStatus: string;
    lastSyncedAt: Date | null;
    lastSyncError: string | null;
    completedExternallyAt: Date | null;
    sourceWorkflowRunId: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): ActionItemRecord {
    return actionItemRecordSchema.parse({
      ...record,
      dueDate: record.dueDate?.toISOString() ?? null,
      closedAt: record.closedAt?.toISOString() ?? null,
      needsReviewAt: record.needsReviewAt?.toISOString() ?? null,
      escalatedAt: record.escalatedAt?.toISOString() ?? null,
      plannerTaskId: record.plannerTaskId ?? null,
      syncStatus: record.syncStatus,
      lastSyncedAt: record.lastSyncedAt?.toISOString() ?? null,
      lastSyncError: record.lastSyncError ?? null,
      completedExternallyAt: record.completedExternallyAt?.toISOString() ?? null,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString()
    });
  }

  private mapIncidentRecord(record: {
    id: string;
    title: string;
    severity: string;
    category: string;
    detectedAt: Date;
    detectedByRole: string;
    ownerRole: string;
    status: string;
    summary: string;
    immediateResponse: string | null;
    resolutionNote: string | null;
    workflowRunId: string | null;
    reviewActionItemId: string | null;
    linkedCapaId: string | null;
    dueDate: Date | null;
    closedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }): IncidentRecord {
    return incidentRecordSchema.parse({
      ...record,
      detectedAt: record.detectedAt.toISOString(),
      immediateResponse: record.immediateResponse ?? null,
      resolutionNote: record.resolutionNote ?? null,
      workflowRunId: record.workflowRunId ?? null,
      reviewActionItemId: record.reviewActionItemId ?? null,
      linkedCapaId: record.linkedCapaId ?? null,
      dueDate: record.dueDate?.toISOString() ?? null,
      closedAt: record.closedAt?.toISOString() ?? null,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString()
    });
  }

  private mapCapaRecord(record: {
    id: string;
    title: string;
    summary: string;
    sourceId: string;
    sourceType: string;
    incidentId: string | null;
    ownerRole: string;
    dueDate: Date;
    status: string;
    correctiveAction: string;
    preventiveAction: string;
    verificationPlan: string | null;
    resolutionNote: string | null;
    workflowRunId: string | null;
    actionItemId: string | null;
    closedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }): CapaRecord {
    return capaRecordSchema.parse({
      ...record,
      incidentId: record.incidentId ?? null,
      dueDate: record.dueDate.toISOString(),
      verificationPlan: record.verificationPlan ?? null,
      resolutionNote: record.resolutionNote ?? null,
      workflowRunId: record.workflowRunId ?? null,
      actionItemId: record.actionItemId ?? null,
      closedAt: record.closedAt?.toISOString() ?? null,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString()
    });
  }

  private mapPublicAssetRecord(record: {
    id: string;
    assetType: string;
    title: string;
    status: string;
    ownerRole: string;
    serviceLine: string | null;
    audience: string | null;
    channelLabel: string | null;
    summary: string;
    body: string;
    claimsReviewed: boolean;
    claimsJson: Prisma.JsonValue;
    claimsReviewStatus: string;
    claimsReviewNotes: string | null;
    claimsReviewedAt: Date | null;
    claimsReviewedByRole: string | null;
    documentId: string | null;
    workflowRunId: string | null;
    createdBy: string;
    createdAt: Date;
    updatedAt: Date;
    publishedAt: Date | null;
    publishedPath: string | null;
  }): PublicAssetRecord {
    return publicAssetRecordSchema.parse({
      ...record,
      claims: record.claimsJson,
      claimsReviewedAt: record.claimsReviewedAt?.toISOString() ?? null,
      documentId: record.documentId ?? null,
      workflowRunId: record.workflowRunId ?? null,
      publishedAt: record.publishedAt?.toISOString() ?? null,
      publishedPath: record.publishedPath ?? null,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString()
    });
  }

  private mapCommitteeRecord(record: {
    id: string;
    name: string;
    category: string;
    cadence: string;
    chairRole: string;
    recorderRole: string;
    scope: string;
    serviceLine: string | null;
    qapiFocus: boolean;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
  }): CommitteeRecord {
    return committeeRecordSchema.parse({
      ...record,
      serviceLine: record.serviceLine ?? null,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString()
    });
  }

  private mapCommitteeMeetingRecord(record: {
    id: string;
    committeeId: string;
    title: string;
    scheduledFor: Date;
    status: string;
    packetDocumentId: string | null;
    workflowRunId: string | null;
    notes: string | null;
    agendaItemsJson: Prisma.JsonValue;
    decisionsJson: Prisma.JsonValue;
    qapiSnapshotJson: Prisma.JsonValue | null;
    createdBy: string;
    createdAt: Date;
    updatedAt: Date;
    completedAt: Date | null;
  }): CommitteeMeetingRecord {
    return committeeMeetingRecordSchema.parse({
      ...record,
      scheduledFor: record.scheduledFor.toISOString(),
      packetDocumentId: record.packetDocumentId ?? null,
      workflowRunId: record.workflowRunId ?? null,
      notes: record.notes ?? null,
      agendaItems: record.agendaItemsJson,
      decisions: record.decisionsJson,
      qapiSnapshot: record.qapiSnapshotJson ?? null,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
      completedAt: record.completedAt?.toISOString() ?? null
    });
  }

  private mapChecklistTemplate(record: {
    id: string;
    name: string;
    workflowDefinitionId: string;
    isActive: boolean;
    itemsJson: Prisma.JsonValue;
    createdBy: string;
    createdAt: Date;
    updatedAt: Date;
  }): ChecklistTemplate {
    return checklistTemplateSchema.parse({
      id: record.id,
      name: record.name,
      workflowDefinitionId: record.workflowDefinitionId,
      isActive: record.isActive,
      items: record.itemsJson,
      createdBy: record.createdBy,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString()
    });
  }

  private mapChecklistRun(record: {
    id: string;
    templateId: string;
    workflowRunId: string;
    targetDate: Date;
    createdAt: Date;
    updatedAt: Date;
  }): ChecklistRun {
    return checklistRunSchema.parse({
      ...record,
      targetDate: record.targetDate.toISOString().slice(0, 10),
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString()
    });
  }

  private mapChecklistItemRecord(record: {
    id: string;
    checklistRunId: string;
    templateItemId: string | null;
    label: string;
    areaLabel: string;
    required: boolean;
    status: string;
    note: string | null;
    completedAt: Date | null;
    completedBy: string | null;
    reviewActionItemId: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): ChecklistItemRecord {
    return checklistItemRecordSchema.parse({
      ...record,
      completedAt: record.completedAt?.toISOString() ?? null,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString()
    });
  }

  private mapWorkerJobRecord(record: {
    id: string;
    type: string;
    status: string;
    attempts: number;
    maxAttempts: number;
    scheduledAt: Date;
    lockedAt: Date | null;
    lastError: string | null;
    payload: Prisma.JsonValue;
    resultJson: Prisma.JsonValue | null;
    sourceEntityType: string | null;
    sourceEntityId: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): WorkerJobRecord {
    return workerJobRecordSchema.parse({
      ...record,
      scheduledAt: record.scheduledAt.toISOString(),
      lockedAt: record.lockedAt?.toISOString() ?? null,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString()
    });
  }

  private mapMicrosoftIntegrationValidationRecord(record: {
    id: string;
    provider: string;
    mode: string;
    configComplete: boolean;
    overallStatus: string;
    readyForLive: boolean;
    missingConfigKeys: Prisma.JsonValue;
    surfacesJson: Prisma.JsonValue;
    checkedAt: Date;
    checkedById: string;
    checkedByRole: string;
  }): MicrosoftIntegrationValidationRecord {
    return microsoftIntegrationValidationRecordSchema.parse({
      ...record,
      missingConfigKeys: record.missingConfigKeys,
      surfaces: record.surfacesJson,
      checkedAt: record.checkedAt.toISOString()
    });
  }

  private mapScorecardReviewRecord(record: {
    id: string;
    workflowRunId: string;
    packetDocumentId: string;
    actionItemId: string;
    medicalDirectorActionItemId: string | null;
    trainingFollowUpActionItemId: string | null;
    employeeId: string;
    employeeRole: string;
    periodStart: Date;
    periodEnd: Date;
    overallScore: number;
    safetyComplianceScore: number;
    assignedReviewerRole: string;
    status: string;
    oversightStatus: string;
    requiresMedicalDirectorReview: boolean;
    dueDate: Date;
    resolutionNote: string | null;
    hrSignedOffAt: Date | null;
    medicalDirectorSignedOffAt: Date | null;
    escalatedAt: Date | null;
    sentBackAt: Date | null;
    reminderSentAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }): ScorecardReviewRecord {
    return scorecardReviewRecordSchema.parse({
      ...record,
      periodStart: record.periodStart.toISOString(),
      periodEnd: record.periodEnd.toISOString(),
      dueDate: record.dueDate.toISOString(),
      hrSignedOffAt: record.hrSignedOffAt?.toISOString() ?? null,
      medicalDirectorSignedOffAt: record.medicalDirectorSignedOffAt?.toISOString() ?? null,
      escalatedAt: record.escalatedAt?.toISOString() ?? null,
      sentBackAt: record.sentBackAt?.toISOString() ?? null,
      reminderSentAt: record.reminderSentAt?.toISOString() ?? null,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString()
    });
  }

  private mapTrainingRequirement(record: {
    id: string;
    employeeId: string;
    employeeRole: string;
    requirementType: string;
    title: string;
    dueDate: Date | null;
    notes: string | null;
    lastReminderSentAt: Date | null;
    createdBy: string;
    createdAt: Date;
    updatedAt: Date;
  }): TrainingRequirement {
    return trainingRequirementSchema.parse({
      ...record,
      dueDate: record.dueDate?.toISOString() ?? null,
      lastReminderSentAt: record.lastReminderSentAt?.toISOString() ?? null,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString()
    });
  }

  private mapTrainingCompletion(record: {
    id: string;
    requirementId: string;
    employeeId: string;
    employeeRole: string;
    completedAt: Date;
    validUntil: Date | null;
    recordedBy: string;
    note: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): TrainingCompletionRecord {
    return trainingCompletionRecordSchema.parse({
      ...record,
      completedAt: record.completedAt.toISOString(),
      validUntil: record.validUntil?.toISOString() ?? null,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString()
    });
  }

  async createWorkflowRun(run: WorkflowRun): Promise<WorkflowRun> {
    const record = await this.client.workflowRun.create({
      data: {
        id: run.id,
        workflowDefinitionId: run.workflowDefinitionId,
        requestedBy: run.requestedBy,
        requestedByRole: run.requestedByRole,
        state: run.state,
        createdAt: new Date(run.createdAt),
        updatedAt: new Date(run.updatedAt),
        documentId: run.documentId,
        lastTransitionNote: run.lastTransitionNote,
        inputJson: asJsonValue(run.input)
      }
    });

    return workflowRunSchema.parse({
      ...record,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
      input: record.inputJson
    });
  }

  async updateWorkflowRun(id: string, patch: Partial<WorkflowRun>): Promise<WorkflowRun> {
    const record = await this.client.workflowRun.update({
      where: { id },
      data: {
        workflowDefinitionId: patch.workflowDefinitionId,
        requestedBy: patch.requestedBy,
        requestedByRole: patch.requestedByRole,
        state: patch.state,
        updatedAt: isoToRequiredDate(patch.updatedAt),
        documentId: patch.documentId,
        lastTransitionNote: patch.lastTransitionNote
      }
    });

    return workflowRunSchema.parse({
      ...record,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
      input: record.inputJson
    });
  }

  async getWorkflowRun(id: string): Promise<WorkflowRun | null> {
    const record = await this.client.workflowRun.findUnique({ where: { id } });
    if (!record) return null;
    return workflowRunSchema.parse({
      ...record,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
      input: record.inputJson
    });
  }

  async listWorkflowRuns(filters?: { workflowDefinitionId?: string }): Promise<WorkflowRun[]> {
    const records = await this.client.workflowRun.findMany({
      where: mapListFilters(filters),
      orderBy: { createdAt: "desc" }
    });

    return records.map((record) =>
      workflowRunSchema.parse({
        ...record,
        createdAt: record.createdAt.toISOString(),
        updatedAt: record.updatedAt.toISOString(),
        input: record.inputJson
      })
    );
  }

  async createDocument(document: DocumentRecord): Promise<DocumentRecord> {
    const record = await this.client.documentRecord.create({
      data: {
        id: document.id,
        title: document.title,
        ownerRole: document.ownerRole,
        approvalClass: document.approvalClass,
        artifactType: document.artifactType,
        summary: document.summary,
        workflowRunId: document.workflowRunId,
        createdBy: document.createdBy,
        status: document.status,
        body: document.body,
        version: document.version,
        publishedPath: document.publishedPath,
        serviceLines: asJsonValue(document.serviceLines),
        createdAt: new Date(document.createdAt),
        updatedAt: new Date(document.updatedAt),
        publishedAt: isoToDate(document.publishedAt),
        reviewDueAt: isoToDate(document.reviewDueAt)
      }
    });

    return documentRecordSchema.parse({
      ...record,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
      publishedAt: record.publishedAt?.toISOString() ?? null,
      reviewDueAt: record.reviewDueAt?.toISOString() ?? null
    });
  }

  async updateDocument(id: string, patch: Partial<DocumentRecord>): Promise<DocumentRecord> {
    const record = await this.client.documentRecord.update({
      where: { id },
      data: {
        title: patch.title,
        ownerRole: patch.ownerRole,
        approvalClass: patch.approvalClass,
        artifactType: patch.artifactType,
        summary: patch.summary,
        workflowRunId: patch.workflowRunId,
        serviceLines: patch.serviceLines ? asJsonValue(patch.serviceLines) : undefined,
        createdBy: patch.createdBy,
        updatedAt: isoToRequiredDate(patch.updatedAt),
        status: patch.status,
        body: patch.body,
        version: patch.version,
        publishedAt: isoToDate(patch.publishedAt),
        publishedPath: patch.publishedPath,
        reviewDueAt: isoToDate(patch.reviewDueAt)
      }
    });

    return documentRecordSchema.parse({
      ...record,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
      publishedAt: record.publishedAt?.toISOString() ?? null,
      reviewDueAt: record.reviewDueAt?.toISOString() ?? null
    });
  }

  async getDocument(id: string): Promise<DocumentRecord | null> {
    const record = await this.client.documentRecord.findUnique({ where: { id } });
    if (!record) return null;
    return documentRecordSchema.parse({
      ...record,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
      publishedAt: record.publishedAt?.toISOString() ?? null,
      reviewDueAt: record.reviewDueAt?.toISOString() ?? null
    });
  }

  async listDocuments(filters?: { status?: string; approvalClass?: string }): Promise<DocumentRecord[]> {
    const records = await this.client.documentRecord.findMany({
      where: mapListFilters(filters),
      orderBy: { updatedAt: "desc" }
    });

    return records.map((record) =>
      documentRecordSchema.parse({
        ...record,
        createdAt: record.createdAt.toISOString(),
        updatedAt: record.updatedAt.toISOString(),
        publishedAt: record.publishedAt?.toISOString() ?? null,
        reviewDueAt: record.reviewDueAt?.toISOString() ?? null
      })
    );
  }

  async createApprovalTasks(tasks: ApprovalTask[]): Promise<ApprovalTask[]> {
    await this.client.approvalTask.createMany({
      data: tasks.map((task) => ({
        ...task,
        requestedAt: new Date(task.requestedAt),
        decidedAt: isoToDate(task.decidedAt)
      }))
    });

    return tasks;
  }

  async updateApprovalTask(id: string, patch: Partial<ApprovalTask>): Promise<ApprovalTask> {
    const record = await this.client.approvalTask.update({
      where: { id },
      data: {
        status: patch.status,
        decidedAt: isoToDate(patch.decidedAt),
        decisionNotes: patch.decisionNotes
      }
    });

    return approvalTaskSchema.parse({
      ...record,
      requestedAt: record.requestedAt.toISOString(),
      decidedAt: record.decidedAt?.toISOString() ?? null
    });
  }

  async getApprovalTask(id: string): Promise<ApprovalTask | null> {
    const record = await this.client.approvalTask.findUnique({ where: { id } });
    if (!record) return null;
    return approvalTaskSchema.parse({
      ...record,
      requestedAt: record.requestedAt.toISOString(),
      decidedAt: record.decidedAt?.toISOString() ?? null
    });
  }

  async listApprovalTasks(filters?: { reviewerRole?: string; status?: string; targetId?: string }): Promise<ApprovalTask[]> {
    const records = await this.client.approvalTask.findMany({
      where: mapListFilters(filters),
      orderBy: { requestedAt: "asc" }
    });

    return records.map((record) =>
      approvalTaskSchema.parse({
        ...record,
        requestedAt: record.requestedAt.toISOString(),
        decidedAt: record.decidedAt?.toISOString() ?? null
      })
    );
  }

  async createActionItem(item: ActionItemRecord): Promise<ActionItemRecord> {
    const record = await this.client.actionItem.create({
      data: {
        id: item.id,
        kind: item.kind,
        title: item.title,
        description: item.description,
        ownerRole: item.ownerRole,
        createdBy: item.createdBy,
        status: item.status,
        resolutionNote: item.resolutionNote,
        sourceWorkflowRunId: item.sourceWorkflowRunId,
        dueDate: isoToDate(item.dueDate),
        closedAt: isoToDate(item.closedAt),
        escalationStatus: item.escalationStatus,
        escalatedToRole: item.escalatedToRole,
        needsReviewAt: isoToDate(item.needsReviewAt),
        escalatedAt: isoToDate(item.escalatedAt),
        plannerTaskId: item.plannerTaskId,
        syncStatus: item.syncStatus,
        lastSyncedAt: isoToDate(item.lastSyncedAt),
        lastSyncError: item.lastSyncError,
        completedExternallyAt: isoToDate(item.completedExternallyAt),
        createdAt: new Date(item.createdAt),
        updatedAt: new Date(item.updatedAt)
      }
    });

    return this.mapActionItemRecord(record);
  }

  async updateActionItem(id: string, patch: Partial<ActionItemRecord>): Promise<ActionItemRecord> {
    const record = await this.client.actionItem.update({
      where: { id },
      data: {
        title: patch.title,
        description: patch.description,
        ownerRole: patch.ownerRole,
        status: patch.status,
        resolutionNote: patch.resolutionNote,
        dueDate: isoToDate(patch.dueDate),
        closedAt: isoToDate(patch.closedAt),
        escalationStatus: patch.escalationStatus,
        escalatedToRole: patch.escalatedToRole,
        needsReviewAt: isoToDate(patch.needsReviewAt),
        escalatedAt: isoToDate(patch.escalatedAt),
        plannerTaskId: patch.plannerTaskId,
        syncStatus: patch.syncStatus,
        lastSyncedAt: isoToDate(patch.lastSyncedAt),
        lastSyncError: patch.lastSyncError,
        completedExternallyAt: isoToDate(patch.completedExternallyAt),
        sourceWorkflowRunId: patch.sourceWorkflowRunId,
        updatedAt: isoToRequiredDate(patch.updatedAt)
      }
    });

    return this.mapActionItemRecord(record);
  }

  async getActionItem(id: string): Promise<ActionItemRecord | null> {
    const record = await this.client.actionItem.findUnique({ where: { id } });
    return record ? this.mapActionItemRecord(record) : null;
  }

  async listActionItems(filters?: {
    ownerRole?: string;
    status?: string;
    kind?: string;
    escalationStatus?: string;
    sourceWorkflowRunId?: string;
  }): Promise<ActionItemRecord[]> {
    const records = await this.client.actionItem.findMany({
      where: mapListFilters(filters),
      orderBy: { createdAt: "desc" }
    });

    return records.map((record) => this.mapActionItemRecord(record));
  }

  async createIncident(record: IncidentRecord): Promise<IncidentRecord> {
    const created = await this.client.incident.create({
      data: {
        id: record.id,
        title: record.title,
        severity: record.severity,
        category: record.category,
        detectedAt: new Date(record.detectedAt),
        detectedByRole: record.detectedByRole,
        ownerRole: record.ownerRole,
        status: record.status,
        summary: record.summary,
        immediateResponse: record.immediateResponse,
        resolutionNote: record.resolutionNote,
        workflowRunId: record.workflowRunId,
        reviewActionItemId: record.reviewActionItemId,
        linkedCapaId: record.linkedCapaId,
        dueDate: isoToDate(record.dueDate),
        closedAt: isoToDate(record.closedAt),
        createdAt: new Date(record.createdAt),
        updatedAt: new Date(record.updatedAt)
      }
    });

    return this.mapIncidentRecord(created);
  }

  async updateIncident(id: string, patch: Partial<IncidentRecord>): Promise<IncidentRecord> {
    const updated = await this.client.incident.update({
      where: { id },
      data: {
        title: patch.title,
        severity: patch.severity,
        category: patch.category,
        detectedAt: isoToRequiredDate(patch.detectedAt),
        detectedByRole: patch.detectedByRole,
        ownerRole: patch.ownerRole,
        status: patch.status,
        summary: patch.summary,
        immediateResponse: patch.immediateResponse,
        resolutionNote: patch.resolutionNote,
        workflowRunId: patch.workflowRunId,
        reviewActionItemId: patch.reviewActionItemId,
        linkedCapaId: patch.linkedCapaId,
        dueDate: isoToDate(patch.dueDate),
        closedAt: isoToDate(patch.closedAt),
        createdAt: isoToRequiredDate(patch.createdAt),
        updatedAt: isoToRequiredDate(patch.updatedAt)
      }
    });

    return this.mapIncidentRecord(updated);
  }

  async getIncident(id: string): Promise<IncidentRecord | null> {
    const record = await this.client.incident.findUnique({ where: { id } });
    return record ? this.mapIncidentRecord(record) : null;
  }

  async listIncidents(filters?: {
    status?: string;
    severity?: string;
    ownerRole?: string;
    linkedCapaId?: string;
  }): Promise<IncidentRecord[]> {
    const records = await this.client.incident.findMany({
      where: mapListFilters(filters),
      orderBy: { detectedAt: "desc" }
    });

    return records.map((record) => this.mapIncidentRecord(record));
  }

  async createCapa(record: CapaRecord): Promise<CapaRecord> {
    const created = await this.client.cAPA.create({
      data: {
        id: record.id,
        title: record.title,
        summary: record.summary,
        sourceId: record.sourceId,
        sourceType: record.sourceType,
        incidentId: record.incidentId,
        ownerRole: record.ownerRole,
        dueDate: new Date(record.dueDate),
        status: record.status,
        correctiveAction: record.correctiveAction,
        preventiveAction: record.preventiveAction,
        verificationPlan: record.verificationPlan,
        resolutionNote: record.resolutionNote,
        workflowRunId: record.workflowRunId,
        actionItemId: record.actionItemId,
        closedAt: isoToDate(record.closedAt),
        createdAt: new Date(record.createdAt),
        updatedAt: new Date(record.updatedAt)
      }
    });

    return this.mapCapaRecord(created);
  }

  async updateCapa(id: string, patch: Partial<CapaRecord>): Promise<CapaRecord> {
    const updated = await this.client.cAPA.update({
      where: { id },
      data: {
        title: patch.title,
        summary: patch.summary,
        sourceId: patch.sourceId,
        sourceType: patch.sourceType,
        incidentId: patch.incidentId,
        ownerRole: patch.ownerRole,
        dueDate: isoToRequiredDate(patch.dueDate),
        status: patch.status,
        correctiveAction: patch.correctiveAction,
        preventiveAction: patch.preventiveAction,
        verificationPlan: patch.verificationPlan,
        resolutionNote: patch.resolutionNote,
        workflowRunId: patch.workflowRunId,
        actionItemId: patch.actionItemId,
        closedAt: isoToDate(patch.closedAt),
        createdAt: isoToRequiredDate(patch.createdAt),
        updatedAt: isoToRequiredDate(patch.updatedAt)
      }
    });

    return this.mapCapaRecord(updated);
  }

  async getCapa(id: string): Promise<CapaRecord | null> {
    const record = await this.client.cAPA.findUnique({ where: { id } });
    return record ? this.mapCapaRecord(record) : null;
  }

  async listCapas(filters?: {
    status?: string;
    sourceType?: string;
    ownerRole?: string;
    incidentId?: string;
  }): Promise<CapaRecord[]> {
    const records = await this.client.cAPA.findMany({
      where: mapListFilters(filters),
      orderBy: { dueDate: "asc" }
    });

    return records.map((record) => this.mapCapaRecord(record));
  }

  async createPublicAsset(record: PublicAssetRecord): Promise<PublicAssetRecord> {
    const created = await this.client.publicAsset.create({
      data: {
        id: record.id,
        assetType: record.assetType,
        title: record.title,
        status: record.status,
        ownerRole: record.ownerRole,
        serviceLine: record.serviceLine,
        audience: record.audience,
        channelLabel: record.channelLabel,
        summary: record.summary,
        body: record.body,
        claimsReviewed: record.claimsReviewed,
        claimsJson: asJsonValue(record.claims),
        claimsReviewStatus: record.claimsReviewStatus,
        claimsReviewNotes: record.claimsReviewNotes,
        claimsReviewedAt: isoToDate(record.claimsReviewedAt),
        claimsReviewedByRole: record.claimsReviewedByRole,
        documentId: record.documentId,
        workflowRunId: record.workflowRunId,
        createdBy: record.createdBy,
        createdAt: new Date(record.createdAt),
        updatedAt: new Date(record.updatedAt),
        publishedAt: isoToDate(record.publishedAt),
        publishedPath: record.publishedPath
      } as any
    });

    return this.mapPublicAssetRecord(created as any);
  }

  async updatePublicAsset(id: string, patch: Partial<PublicAssetRecord>): Promise<PublicAssetRecord> {
    const updated = await this.client.publicAsset.update({
      where: { id },
      data: {
        assetType: patch.assetType,
        title: patch.title,
        status: patch.status,
        ownerRole: patch.ownerRole,
        serviceLine: patch.serviceLine,
        audience: patch.audience,
        channelLabel: patch.channelLabel,
        summary: patch.summary,
        body: patch.body,
        claimsReviewed: patch.claimsReviewed,
        claimsJson: patch.claims ? asJsonValue(patch.claims) : undefined,
        claimsReviewStatus: patch.claimsReviewStatus,
        claimsReviewNotes: patch.claimsReviewNotes,
        claimsReviewedAt: isoToDate(patch.claimsReviewedAt),
        claimsReviewedByRole: patch.claimsReviewedByRole,
        documentId: patch.documentId,
        workflowRunId: patch.workflowRunId,
        createdBy: patch.createdBy,
        createdAt: isoToRequiredDate(patch.createdAt),
        updatedAt: isoToRequiredDate(patch.updatedAt),
        publishedAt: isoToDate(patch.publishedAt),
        publishedPath: patch.publishedPath
      } as any
    });

    return this.mapPublicAssetRecord(updated as any);
  }

  async getPublicAsset(id: string): Promise<PublicAssetRecord | null> {
    const record = await this.client.publicAsset.findUnique({ where: { id } });
    return record ? this.mapPublicAssetRecord(record as any) : null;
  }

  async getPublicAssetByDocumentId(documentId: string): Promise<PublicAssetRecord | null> {
    const record = await this.client.publicAsset.findFirst({ where: { documentId } });
    return record ? this.mapPublicAssetRecord(record as any) : null;
  }

  async listPublicAssets(filters?: {
    status?: string;
    ownerRole?: string;
    assetType?: string;
    serviceLine?: string;
  }): Promise<PublicAssetRecord[]> {
    const records = await this.client.publicAsset.findMany({
      where: mapListFilters(filters) as any
    });

    return records.map((record) => this.mapPublicAssetRecord(record as any));
  }

  async createCommittee(record: CommitteeRecord): Promise<CommitteeRecord> {
    const created = await this.client.committee.create({
      data: {
        id: record.id,
        name: record.name,
        category: record.category,
        cadence: record.cadence,
        chairRole: record.chairRole,
        recorderRole: record.recorderRole,
        scope: record.scope,
        serviceLine: record.serviceLine,
        qapiFocus: record.qapiFocus,
        isActive: record.isActive,
        createdAt: new Date(record.createdAt),
        updatedAt: new Date(record.updatedAt)
      }
    });

    return this.mapCommitteeRecord(created);
  }

  async updateCommittee(id: string, patch: Partial<CommitteeRecord>): Promise<CommitteeRecord> {
    const updated = await this.client.committee.update({
      where: { id },
      data: {
        name: patch.name,
        category: patch.category,
        cadence: patch.cadence,
        chairRole: patch.chairRole,
        recorderRole: patch.recorderRole,
        scope: patch.scope,
        serviceLine: patch.serviceLine,
        qapiFocus: patch.qapiFocus,
        isActive: patch.isActive,
        createdAt: isoToRequiredDate(patch.createdAt),
        updatedAt: isoToRequiredDate(patch.updatedAt)
      }
    });

    return this.mapCommitteeRecord(updated);
  }

  async getCommittee(id: string): Promise<CommitteeRecord | null> {
    const record = await this.client.committee.findUnique({ where: { id } });
    return record ? this.mapCommitteeRecord(record) : null;
  }

  async listCommittees(filters?: {
    category?: string;
    isActive?: boolean;
    qapiFocus?: boolean;
    serviceLine?: string;
  }): Promise<CommitteeRecord[]> {
    const records = await this.client.committee.findMany({
      where: {
        category: filters?.category,
        isActive: filters?.isActive,
        qapiFocus: filters?.qapiFocus,
        serviceLine: filters?.serviceLine
      },
      orderBy: { name: "asc" }
    });

    return records.map((record) => this.mapCommitteeRecord(record));
  }

  async createCommitteeMeeting(record: CommitteeMeetingRecord): Promise<CommitteeMeetingRecord> {
    const created = await this.client.committeeMeeting.create({
      data: {
        id: record.id,
        committeeId: record.committeeId,
        title: record.title,
        scheduledFor: new Date(record.scheduledFor),
        status: record.status,
        packetDocumentId: record.packetDocumentId,
        workflowRunId: record.workflowRunId,
        notes: record.notes,
        agendaItemsJson: asJsonValue(record.agendaItems),
        decisionsJson: asJsonValue(record.decisions),
        qapiSnapshotJson: asNullableJsonValue(record.qapiSnapshot),
        createdBy: record.createdBy,
        createdAt: new Date(record.createdAt),
        updatedAt: new Date(record.updatedAt),
        completedAt: isoToDate(record.completedAt)
      }
    });

    return this.mapCommitteeMeetingRecord(created);
  }

  async updateCommitteeMeeting(id: string, patch: Partial<CommitteeMeetingRecord>): Promise<CommitteeMeetingRecord> {
    const updated = await this.client.committeeMeeting.update({
      where: { id },
      data: {
        committeeId: patch.committeeId,
        title: patch.title,
        scheduledFor: isoToRequiredDate(patch.scheduledFor),
        status: patch.status,
        packetDocumentId: patch.packetDocumentId,
        workflowRunId: patch.workflowRunId,
        notes: patch.notes,
        agendaItemsJson: patch.agendaItems ? asJsonValue(patch.agendaItems) : undefined,
        decisionsJson: patch.decisions ? asJsonValue(patch.decisions) : undefined,
        qapiSnapshotJson: asNullableJsonValue(patch.qapiSnapshot),
        createdBy: patch.createdBy,
        createdAt: isoToRequiredDate(patch.createdAt),
        updatedAt: isoToRequiredDate(patch.updatedAt),
        completedAt: isoToDate(patch.completedAt)
      }
    });

    return this.mapCommitteeMeetingRecord(updated);
  }

  async getCommitteeMeeting(id: string): Promise<CommitteeMeetingRecord | null> {
    const record = await this.client.committeeMeeting.findUnique({ where: { id } });
    return record ? this.mapCommitteeMeetingRecord(record) : null;
  }

  async getCommitteeMeetingByPacketDocumentId(packetDocumentId: string): Promise<CommitteeMeetingRecord | null> {
    const record = await this.client.committeeMeeting.findFirst({
      where: { packetDocumentId }
    });
    return record ? this.mapCommitteeMeetingRecord(record) : null;
  }

  async listCommitteeMeetings(filters?: {
    committeeId?: string;
    status?: string;
  }): Promise<CommitteeMeetingRecord[]> {
    const records = await this.client.committeeMeeting.findMany({
      where: mapListFilters(filters),
      orderBy: { scheduledFor: "desc" }
    });

    return records.map((record) => this.mapCommitteeMeetingRecord(record));
  }

  async createChecklistTemplate(template: ChecklistTemplate): Promise<ChecklistTemplate> {
    const record = await this.client.checklistTemplate.create({
      data: {
        id: template.id,
        name: template.name,
        workflowDefinitionId: template.workflowDefinitionId,
        isActive: template.isActive,
        itemsJson: asJsonValue(template.items),
        createdBy: template.createdBy,
        createdAt: new Date(template.createdAt),
        updatedAt: new Date(template.updatedAt)
      }
    });

    return this.mapChecklistTemplate(record);
  }

  async updateChecklistTemplate(id: string, patch: Partial<ChecklistTemplate>): Promise<ChecklistTemplate> {
    const record = await this.client.checklistTemplate.update({
      where: { id },
      data: {
        name: patch.name,
        workflowDefinitionId: patch.workflowDefinitionId,
        isActive: patch.isActive,
        itemsJson: patch.items ? asJsonValue(patch.items) : undefined,
        updatedAt: isoToRequiredDate(patch.updatedAt)
      }
    });

    return this.mapChecklistTemplate(record);
  }

  async getChecklistTemplate(id: string): Promise<ChecklistTemplate | null> {
    const record = await this.client.checklistTemplate.findUnique({ where: { id } });
    return record ? this.mapChecklistTemplate(record) : null;
  }

  async listChecklistTemplates(filters?: {
    workflowDefinitionId?: string;
    isActive?: boolean;
  }): Promise<ChecklistTemplate[]> {
    const records = await this.client.checklistTemplate.findMany({
      where: {
        workflowDefinitionId: filters?.workflowDefinitionId,
        isActive: filters?.isActive
      },
      orderBy: { updatedAt: "desc" }
    });

    return records.map((record) => this.mapChecklistTemplate(record));
  }

  async createChecklistRun(run: ChecklistRun): Promise<ChecklistRun> {
    const record = await this.client.checklistRun.create({
      data: {
        id: run.id,
        templateId: run.templateId,
        workflowRunId: run.workflowRunId,
        targetDate: new Date(`${run.targetDate}T00:00:00.000Z`),
        createdAt: new Date(run.createdAt),
        updatedAt: new Date(run.updatedAt)
      }
    });

    return this.mapChecklistRun(record);
  }

  async updateChecklistRun(id: string, patch: Partial<ChecklistRun>): Promise<ChecklistRun> {
    const record = await this.client.checklistRun.update({
      where: { id },
      data: {
        templateId: patch.templateId,
        workflowRunId: patch.workflowRunId,
        targetDate: patch.targetDate ? new Date(`${patch.targetDate}T00:00:00.000Z`) : undefined,
        updatedAt: isoToRequiredDate(patch.updatedAt)
      }
    });

    return this.mapChecklistRun(record);
  }

  async getChecklistRun(id: string): Promise<ChecklistRun | null> {
    const record = await this.client.checklistRun.findUnique({ where: { id } });
    return record ? this.mapChecklistRun(record) : null;
  }

  async listChecklistRuns(filters?: {
    workflowRunId?: string;
    templateId?: string;
  }): Promise<ChecklistRun[]> {
    const records = await this.client.checklistRun.findMany({
      where: mapListFilters(filters),
      orderBy: { createdAt: "desc" }
    });

    return records.map((record) => this.mapChecklistRun(record));
  }

  async createChecklistItems(items: ChecklistItemRecord[]): Promise<ChecklistItemRecord[]> {
    await this.client.checklistItemRecord.createMany({
      data: items.map((item) => ({
        id: item.id,
        checklistRunId: item.checklistRunId,
        templateItemId: item.templateItemId,
        label: item.label,
        areaLabel: item.areaLabel,
        required: item.required,
        status: item.status,
        note: item.note,
        completedAt: isoToDate(item.completedAt),
        completedBy: item.completedBy,
        reviewActionItemId: item.reviewActionItemId,
        createdAt: new Date(item.createdAt),
        updatedAt: new Date(item.updatedAt)
      }))
    });

    return items;
  }

  async updateChecklistItem(id: string, patch: Partial<ChecklistItemRecord>): Promise<ChecklistItemRecord> {
    const record = await this.client.checklistItemRecord.update({
      where: { id },
      data: {
        status: patch.status,
        note: patch.note,
        completedAt: isoToDate(patch.completedAt),
        completedBy: patch.completedBy,
        reviewActionItemId: patch.reviewActionItemId,
        updatedAt: isoToRequiredDate(patch.updatedAt)
      }
    });

    return this.mapChecklistItemRecord(record);
  }

  async getChecklistItem(id: string): Promise<ChecklistItemRecord | null> {
    const record = await this.client.checklistItemRecord.findUnique({ where: { id } });
    return record ? this.mapChecklistItemRecord(record) : null;
  }

  async listChecklistItems(filters?: {
    checklistRunId?: string;
    status?: string;
    reviewActionItemId?: string;
  }): Promise<ChecklistItemRecord[]> {
    const records = await this.client.checklistItemRecord.findMany({
      where: mapListFilters(filters),
      orderBy: { createdAt: "asc" }
    });

    return records.map((record) => this.mapChecklistItemRecord(record));
  }

  async createScorecardReviews(records: ScorecardReviewRecord[]): Promise<ScorecardReviewRecord[]> {
    await this.client.scorecardReviewRecord.createMany({
      data: records.map((record) => ({
        ...record,
        trainingFollowUpActionItemId: record.trainingFollowUpActionItemId,
        periodStart: new Date(record.periodStart),
        periodEnd: new Date(record.periodEnd),
        dueDate: new Date(record.dueDate),
        hrSignedOffAt: isoToDate(record.hrSignedOffAt),
        medicalDirectorSignedOffAt: isoToDate(record.medicalDirectorSignedOffAt),
        escalatedAt: isoToDate(record.escalatedAt),
        sentBackAt: isoToDate(record.sentBackAt),
        reminderSentAt: isoToDate(record.reminderSentAt),
        createdAt: new Date(record.createdAt),
        updatedAt: new Date(record.updatedAt)
      }))
    });

    return records;
  }

  async updateScorecardReview(id: string, patch: Partial<ScorecardReviewRecord>): Promise<ScorecardReviewRecord> {
    const record = await this.client.scorecardReviewRecord.update({
      where: { id },
      data: {
        packetDocumentId: patch.packetDocumentId,
        actionItemId: patch.actionItemId,
        medicalDirectorActionItemId: patch.medicalDirectorActionItemId,
        trainingFollowUpActionItemId: patch.trainingFollowUpActionItemId,
        overallScore: patch.overallScore,
        safetyComplianceScore: patch.safetyComplianceScore,
        assignedReviewerRole: patch.assignedReviewerRole,
        status: patch.status,
        oversightStatus: patch.oversightStatus,
        requiresMedicalDirectorReview: patch.requiresMedicalDirectorReview,
        dueDate: isoToRequiredDate(patch.dueDate),
        resolutionNote: patch.resolutionNote,
        hrSignedOffAt: isoToDate(patch.hrSignedOffAt),
        medicalDirectorSignedOffAt: isoToDate(patch.medicalDirectorSignedOffAt),
        escalatedAt: isoToDate(patch.escalatedAt),
        sentBackAt: isoToDate(patch.sentBackAt),
        reminderSentAt: isoToDate(patch.reminderSentAt),
        updatedAt: isoToRequiredDate(patch.updatedAt)
      }
    });

    return this.mapScorecardReviewRecord(record);
  }

  async getScorecardReview(id: string): Promise<ScorecardReviewRecord | null> {
    const record = await this.client.scorecardReviewRecord.findUnique({ where: { id } });
    return record ? this.mapScorecardReviewRecord(record) : null;
  }

  async listScorecardReviews(filters?: {
    status?: string;
    assignedReviewerRole?: string;
    workflowRunId?: string;
    employeeId?: string;
  }): Promise<ScorecardReviewRecord[]> {
    const records = await this.client.scorecardReviewRecord.findMany({
      where: mapListFilters(filters),
      orderBy: [{ periodStart: "desc" }, { employeeId: "asc" }]
    });

    return records.map((record) => this.mapScorecardReviewRecord(record));
  }

  async createMetricRuns(metricRuns: MetricRun[]): Promise<MetricRun[]> {
    await this.client.metricRun.createMany({
      data: metricRuns.map((metricRun) => ({
        ...metricRun,
        periodStart: new Date(metricRun.periodStart),
        periodEnd: new Date(metricRun.periodEnd),
        createdAt: new Date(metricRun.createdAt)
      }))
    });

    return metricRuns;
  }

  async listMetricRuns(filters?: { entityId?: string }): Promise<MetricRun[]> {
    const records = await this.client.metricRun.findMany({
      where: mapListFilters(filters),
      orderBy: { createdAt: "desc" }
    });

    return records.map((record) =>
      metricRunSchema.parse({
        ...record,
        periodStart: record.periodStart.toISOString(),
        periodEnd: record.periodEnd.toISOString(),
        createdAt: record.createdAt.toISOString()
      })
    );
  }

  async createTrainingRequirement(requirement: TrainingRequirement): Promise<TrainingRequirement> {
    const record = await this.client.trainingRequirement.create({
      data: {
        id: requirement.id,
        employeeId: requirement.employeeId,
        employeeRole: requirement.employeeRole,
        requirementType: requirement.requirementType,
        title: requirement.title,
        dueDate: isoToDate(requirement.dueDate),
        notes: requirement.notes,
        lastReminderSentAt: isoToDate(requirement.lastReminderSentAt),
        createdBy: requirement.createdBy,
        createdAt: new Date(requirement.createdAt),
        updatedAt: new Date(requirement.updatedAt)
      }
    });

    return this.mapTrainingRequirement(record);
  }

  async updateTrainingRequirement(id: string, patch: Partial<TrainingRequirement>): Promise<TrainingRequirement> {
    const record = await this.client.trainingRequirement.update({
      where: { id },
      data: {
        employeeId: patch.employeeId,
        employeeRole: patch.employeeRole,
        requirementType: patch.requirementType,
        title: patch.title,
        dueDate: isoToDate(patch.dueDate),
        notes: patch.notes,
        lastReminderSentAt: isoToDate(patch.lastReminderSentAt),
        updatedAt: isoToRequiredDate(patch.updatedAt)
      }
    });

    return this.mapTrainingRequirement(record);
  }

  async getTrainingRequirement(id: string): Promise<TrainingRequirement | null> {
    const record = await this.client.trainingRequirement.findUnique({ where: { id } });
    return record ? this.mapTrainingRequirement(record) : null;
  }

  async listTrainingRequirements(filters?: {
    employeeId?: string;
    employeeRole?: string;
    requirementType?: string;
  }): Promise<TrainingRequirement[]> {
    const records = await this.client.trainingRequirement.findMany({
      where: mapListFilters(filters),
      orderBy: [{ employeeId: "asc" }, { createdAt: "asc" }]
    });

    return records.map((record) => this.mapTrainingRequirement(record));
  }

  async createTrainingCompletion(record: TrainingCompletionRecord): Promise<TrainingCompletionRecord> {
    const created = await this.client.trainingCompletionRecord.create({
      data: {
        id: record.id,
        requirementId: record.requirementId,
        employeeId: record.employeeId,
        employeeRole: record.employeeRole,
        completedAt: new Date(record.completedAt),
        validUntil: isoToDate(record.validUntil),
        recordedBy: record.recordedBy,
        note: record.note,
        createdAt: new Date(record.createdAt),
        updatedAt: new Date(record.updatedAt)
      }
    });

    return this.mapTrainingCompletion(created);
  }

  async listTrainingCompletions(filters?: {
    requirementId?: string;
    employeeId?: string;
    employeeRole?: string;
  }): Promise<TrainingCompletionRecord[]> {
    const records = await this.client.trainingCompletionRecord.findMany({
      where: mapListFilters(filters),
      orderBy: [{ completedAt: "desc" }, { createdAt: "desc" }]
    });

    return records.map((record) => this.mapTrainingCompletion(record));
  }

  async createAuditEvent(event: AuditEvent): Promise<AuditEvent> {
    const record = await this.client.auditEvent.create({
      data: {
        id: event.id,
        eventType: event.eventType,
        entityType: event.entityType,
        entityId: event.entityId,
        actorId: event.actorId,
        actorRole: event.actorRole,
        actorName: event.actorName,
        payload: asJsonValue(event.payload),
        createdAt: new Date(event.createdAt)
      }
    });

    return auditEventSchema.parse({
      ...record,
      createdAt: record.createdAt.toISOString()
    });
  }

  async listAuditEvents(filters?: { entityType?: string; entityId?: string }): Promise<AuditEvent[]> {
    const records = await this.client.auditEvent.findMany({
      where: mapListFilters(filters),
      orderBy: { createdAt: "desc" },
      take: 100
    });

    return records.map((record) =>
      auditEventSchema.parse({
        ...record,
        createdAt: record.createdAt.toISOString()
      })
    );
  }

  async createUserProfile(profile: UserProfile): Promise<UserProfile> {
    const record = await this.client.userProfile.create({
      data: {
        id: profile.id,
        displayName: profile.displayName,
        role: profile.role,
        grantedRoles: asJsonValue(profile.grantedRoles),
        status: profile.status,
        pinHash: profile.pinHash,
        createdAt: new Date(profile.createdAt),
        updatedAt: new Date(profile.updatedAt)
      }
    });
    return this.mapUserProfile(record);
  }

  async updateUserProfile(id: string, patch: Partial<UserProfile>): Promise<UserProfile> {
    const record = await this.client.userProfile.update({
      where: { id },
      data: {
        displayName: patch.displayName,
        role: patch.role,
        grantedRoles: patch.grantedRoles ? asJsonValue(patch.grantedRoles) : undefined,
        status: patch.status,
        pinHash: patch.pinHash,
        createdAt: isoToRequiredDate(patch.createdAt),
        updatedAt: isoToRequiredDate(patch.updatedAt)
      }
    });
    return this.mapUserProfile(record);
  }

  async getUserProfile(id: string): Promise<UserProfile | null> {
    const record = await this.client.userProfile.findUnique({
      where: { id }
    });
    return record ? this.mapUserProfile(record) : null;
  }

  async listUserProfiles(filters?: { status?: string; role?: string }): Promise<UserProfile[]> {
    const records = await this.client.userProfile.findMany({
      where: mapListFilters(filters),
      orderBy: [{ status: "asc" }, { displayName: "asc" }]
    });
    return records.map((record) => this.mapUserProfile(record));
  }

  async createEnrolledDevice(device: EnrolledDevice): Promise<EnrolledDevice> {
    const record = await this.client.enrolledDevice.create({
      data: {
        id: device.id,
        deviceLabel: device.deviceLabel,
        status: device.status,
        deviceSecretHash: device.deviceSecretHash,
        primaryProfileId: device.primaryProfileId,
        trustExpiresAt: new Date(device.trustExpiresAt),
        lastSeenAt: isoToDate(device.lastSeenAt),
        createdByProfileId: device.createdByProfileId,
        createdAt: new Date(device.createdAt),
        updatedAt: new Date(device.updatedAt)
      }
    });
    return this.mapEnrolledDevice(record);
  }

  async updateEnrolledDevice(id: string, patch: Partial<EnrolledDevice>): Promise<EnrolledDevice> {
    const record = await this.client.enrolledDevice.update({
      where: { id },
      data: {
        deviceLabel: patch.deviceLabel,
        status: patch.status,
        deviceSecretHash: patch.deviceSecretHash,
        primaryProfileId: patch.primaryProfileId,
        trustExpiresAt: isoToRequiredDate(patch.trustExpiresAt),
        lastSeenAt: isoToDate(patch.lastSeenAt),
        createdByProfileId: patch.createdByProfileId,
        createdAt: isoToRequiredDate(patch.createdAt),
        updatedAt: isoToRequiredDate(patch.updatedAt)
      }
    });
    return this.mapEnrolledDevice(record);
  }

  async getEnrolledDevice(id: string): Promise<EnrolledDevice | null> {
    const record = await this.client.enrolledDevice.findUnique({
      where: { id }
    });
    return record ? this.mapEnrolledDevice(record) : null;
  }

  async getEnrolledDeviceBySecretHash(secretHash: string): Promise<EnrolledDevice | null> {
    const record = await this.client.enrolledDevice.findUnique({
      where: { deviceSecretHash: secretHash }
    });
    return record ? this.mapEnrolledDevice(record) : null;
  }

  async listEnrolledDevices(filters?: { status?: string; primaryProfileId?: string }): Promise<EnrolledDevice[]> {
    const records = await this.client.enrolledDevice.findMany({
      where: mapListFilters(filters),
      orderBy: [{ status: "asc" }, { deviceLabel: "asc" }]
    });
    return records.map((record) => this.mapEnrolledDevice(record));
  }

  async replaceDeviceAllowedProfiles(deviceId: string, records: DeviceAllowedProfile[]): Promise<DeviceAllowedProfile[]> {
    await this.client.$transaction(async (tx) => {
      await tx.deviceAllowedProfile.deleteMany({
        where: {
          deviceId
        }
      });
      if (records.length > 0) {
        await tx.deviceAllowedProfile.createMany({
          data: records.map((record) => ({
            id: record.id,
            deviceId: record.deviceId,
            profileId: record.profileId,
            isPrimary: record.isPrimary,
            failedPinAttempts: record.failedPinAttempts,
            lockedUntil: isoToDate(record.lockedUntil),
            createdAt: new Date(record.createdAt),
            updatedAt: new Date(record.updatedAt)
          }))
        });
      }
    });

    return this.listDeviceAllowedProfiles({ deviceId });
  }

  async updateDeviceAllowedProfile(id: string, patch: Partial<DeviceAllowedProfile>): Promise<DeviceAllowedProfile> {
    const record = await this.client.deviceAllowedProfile.update({
      where: { id },
      data: {
        deviceId: patch.deviceId,
        profileId: patch.profileId,
        isPrimary: patch.isPrimary,
        failedPinAttempts: patch.failedPinAttempts,
        lockedUntil: isoToDate(patch.lockedUntil),
        createdAt: isoToRequiredDate(patch.createdAt),
        updatedAt: isoToRequiredDate(patch.updatedAt)
      }
    });
    return this.mapDeviceAllowedProfile(record);
  }

  async listDeviceAllowedProfiles(filters?: { deviceId?: string; profileId?: string }): Promise<DeviceAllowedProfile[]> {
    const records = await this.client.deviceAllowedProfile.findMany({
      where: mapListFilters(filters),
      orderBy: [{ deviceId: "asc" }, { isPrimary: "desc" }, { profileId: "asc" }]
    });
    return records.map((record) => this.mapDeviceAllowedProfile(record));
  }

  async createDeviceEnrollmentCode(code: DeviceEnrollmentCode): Promise<DeviceEnrollmentCode> {
    const record = await this.client.deviceEnrollmentCode.create({
      data: {
        id: code.id,
        codeHash: code.codeHash,
        createdByProfileId: code.createdByProfileId,
        primaryProfileId: code.primaryProfileId,
        allowedProfileIds: asJsonValue(code.allowedProfileIds),
        expiresAt: new Date(code.expiresAt),
        consumedAt: isoToDate(code.consumedAt),
        consumedByDeviceId: code.consumedByDeviceId,
        createdAt: new Date(code.createdAt)
      }
    });
    return this.mapDeviceEnrollmentCode(record);
  }

  async updateDeviceEnrollmentCode(id: string, patch: Partial<DeviceEnrollmentCode>): Promise<DeviceEnrollmentCode> {
    const record = await this.client.deviceEnrollmentCode.update({
      where: { id },
      data: {
        codeHash: patch.codeHash,
        createdByProfileId: patch.createdByProfileId,
        primaryProfileId: patch.primaryProfileId,
        allowedProfileIds: patch.allowedProfileIds ? asJsonValue(patch.allowedProfileIds) : undefined,
        expiresAt: isoToRequiredDate(patch.expiresAt),
        consumedAt: isoToDate(patch.consumedAt),
        consumedByDeviceId: patch.consumedByDeviceId,
        createdAt: isoToRequiredDate(patch.createdAt)
      }
    });
    return this.mapDeviceEnrollmentCode(record);
  }

  async getDeviceEnrollmentCodeByCodeHash(codeHash: string): Promise<DeviceEnrollmentCode | null> {
    const record = await this.client.deviceEnrollmentCode.findUnique({
      where: { codeHash }
    });
    return record ? this.mapDeviceEnrollmentCode(record) : null;
  }

  async listDeviceEnrollmentCodes(filters?: {
    createdByProfileId?: string;
    primaryProfileId?: string;
    includeConsumed?: boolean;
  }): Promise<DeviceEnrollmentCode[]> {
    const records = await this.client.deviceEnrollmentCode.findMany({
      where: {
        ...(filters?.createdByProfileId ? { createdByProfileId: filters.createdByProfileId } : {}),
        ...(filters?.primaryProfileId ? { primaryProfileId: filters.primaryProfileId } : {}),
        ...(filters?.includeConsumed ? {} : { consumedAt: null })
      },
      orderBy: [{ createdAt: "desc" }, { expiresAt: "asc" }]
    });
    return records.map((record) => this.mapDeviceEnrollmentCode(record));
  }

  async deleteDeviceEnrollmentCodes(ids: string[]): Promise<number> {
    if (ids.length === 0) {
      return 0;
    }

    const result = await this.client.deviceEnrollmentCode.deleteMany({
      where: {
        id: {
          in: ids
        }
      }
    });

    return result.count;
  }

  async createDeviceSession(session: DeviceSession): Promise<DeviceSession> {
    const record = await this.client.deviceSession.create({
      data: {
        id: session.id,
        deviceId: session.deviceId,
        profileId: session.profileId,
        activeRole: session.activeRole,
        sessionSecretHash: session.sessionSecretHash,
        idleExpiresAt: new Date(session.idleExpiresAt),
        absoluteExpiresAt: new Date(session.absoluteExpiresAt),
        lastSeenAt: new Date(session.lastSeenAt),
        revokedAt: isoToDate(session.revokedAt),
        createdAt: new Date(session.createdAt),
        updatedAt: new Date(session.updatedAt)
      }
    });
    return this.mapDeviceSession(record);
  }

  async updateDeviceSession(id: string, patch: Partial<DeviceSession>): Promise<DeviceSession> {
    const record = await this.client.deviceSession.update({
      where: { id },
      data: {
        deviceId: patch.deviceId,
        profileId: patch.profileId,
        activeRole: patch.activeRole,
        sessionSecretHash: patch.sessionSecretHash,
        idleExpiresAt: isoToRequiredDate(patch.idleExpiresAt),
        absoluteExpiresAt: isoToRequiredDate(patch.absoluteExpiresAt),
        lastSeenAt: isoToRequiredDate(patch.lastSeenAt),
        revokedAt: isoToDate(patch.revokedAt),
        createdAt: isoToRequiredDate(patch.createdAt),
        updatedAt: isoToRequiredDate(patch.updatedAt)
      }
    });
    return this.mapDeviceSession(record);
  }

  async getDeviceSession(id: string): Promise<DeviceSession | null> {
    const record = await this.client.deviceSession.findUnique({
      where: { id }
    });
    return record ? this.mapDeviceSession(record) : null;
  }

  async getDeviceSessionBySecretHash(secretHash: string): Promise<DeviceSession | null> {
    const record = await this.client.deviceSession.findUnique({
      where: { sessionSecretHash: secretHash }
    });
    return record ? this.mapDeviceSession(record) : null;
  }

  async listDeviceSessions(filters?: { deviceId?: string; profileId?: string; includeRevoked?: boolean }): Promise<DeviceSession[]> {
    const records = await this.client.deviceSession.findMany({
      where: {
        ...(filters?.deviceId ? { deviceId: filters.deviceId } : {}),
        ...(filters?.profileId ? { profileId: filters.profileId } : {}),
        ...(filters?.includeRevoked ? {} : { revokedAt: null })
      },
      orderBy: [{ revokedAt: "asc" }, { updatedAt: "desc" }]
    });
    return records.map((record) => this.mapDeviceSession(record));
  }

  async deleteDeviceSessions(ids: string[]): Promise<number> {
    if (ids.length === 0) {
      return 0;
    }

    const result = await this.client.deviceSession.deleteMany({
      where: {
        id: {
          in: ids
        }
      }
    });

    return result.count;
  }

  async enqueueWorkerJob(job: WorkerJobRecord): Promise<WorkerJobRecord> {
    const record = await this.client.workerJobRecord.create({
      data: {
        id: job.id,
        type: job.type,
        status: job.status,
        attempts: job.attempts,
        maxAttempts: job.maxAttempts,
        scheduledAt: new Date(job.scheduledAt),
        lockedAt: isoToDate(job.lockedAt),
        lastError: job.lastError,
        payload: asJsonValue(job.payload),
        resultJson: asNullableJsonValue(job.resultJson),
        sourceEntityType: job.sourceEntityType,
        sourceEntityId: job.sourceEntityId,
        createdAt: new Date(job.createdAt),
        updatedAt: new Date(job.updatedAt)
      }
    });

    return this.mapWorkerJobRecord(record);
  }

  async getWorkerJob(id: string): Promise<WorkerJobRecord | null> {
    const record = await this.client.workerJobRecord.findUnique({ where: { id } });
    return record ? this.mapWorkerJobRecord(record) : null;
  }

  async listWorkerJobs(filters?: {
    status?: string;
    type?: string;
    sourceEntityId?: string;
    sourceEntityType?: string;
  }): Promise<WorkerJobRecord[]> {
    const records = await this.client.workerJobRecord.findMany({
      where: mapListFilters(filters),
      orderBy: [{ createdAt: "desc" }, { scheduledAt: "asc" }],
      take: 200
    });

    return records.map((record) => this.mapWorkerJobRecord(record));
  }

  async updateWorkerJob(id: string, patch: Partial<WorkerJobRecord>): Promise<WorkerJobRecord> {
    const record = await this.client.workerJobRecord.update({
      where: { id },
      data: {
        type: patch.type,
        status: patch.status,
        attempts: patch.attempts,
        maxAttempts: patch.maxAttempts,
        scheduledAt: isoToRequiredDate(patch.scheduledAt),
        lockedAt: isoToDate(patch.lockedAt),
        lastError: patch.lastError,
        payload: patch.payload ? asJsonValue(patch.payload) : undefined,
        resultJson: asNullableJsonValue(patch.resultJson),
        sourceEntityType: patch.sourceEntityType,
        sourceEntityId: patch.sourceEntityId,
        updatedAt: isoToRequiredDate(patch.updatedAt)
      }
    });

    return this.mapWorkerJobRecord(record);
  }

  async leaseWorkerJobs(options?: {
    limit?: number;
    now?: string;
    lockTimeoutMinutes?: number;
  }): Promise<WorkerJobRecord[]> {
    const now = new Date(options?.now ?? new Date().toISOString());
    const limit = Math.max(1, options?.limit ?? 10);
    const lockTimeoutMinutes = options?.lockTimeoutMinutes ?? 5;
    const staleThreshold = new Date(now.getTime() - lockTimeoutMinutes * 60_000);
    const candidates = await this.client.workerJobRecord.findMany({
      where: {
        status: {
          in: ["queued", "failed"]
        },
        scheduledAt: {
          lte: now
        },
        OR: [
          { lockedAt: null },
          { lockedAt: { lt: staleThreshold } }
        ]
      },
      orderBy: [{ scheduledAt: "asc" }, { createdAt: "asc" }],
      take: limit * 3
    });

    const leased: WorkerJobRecord[] = [];
    for (const candidate of candidates) {
      if (leased.length >= limit) {
        break;
      }

      const result = await this.client.workerJobRecord.updateMany({
        where: {
          id: candidate.id,
          status: candidate.status,
          scheduledAt: {
            lte: now
          },
          OR: [
            { lockedAt: null },
            { lockedAt: { lt: staleThreshold } }
          ]
        },
        data: {
          status: "processing",
          attempts: candidate.attempts + 1,
          lockedAt: now,
          updatedAt: now
        }
      });

      if (result.count === 0) {
        continue;
      }

      const leasedRecord = await this.client.workerJobRecord.findUnique({
        where: { id: candidate.id }
      });

      if (leasedRecord) {
        leased.push(this.mapWorkerJobRecord(leasedRecord));
      }
    }

    return leased;
  }

  async retryWorkerJob(id: string, nowInput?: string): Promise<WorkerJobRecord> {
    const now = new Date(nowInput ?? new Date().toISOString());
    const record = await this.client.workerJobRecord.update({
      where: { id },
      data: {
        status: "queued",
        attempts: 0,
        lockedAt: null,
        lastError: null,
        resultJson: Prisma.JsonNull,
        scheduledAt: now,
        updatedAt: now
      }
    });

    return this.mapWorkerJobRecord(record);
  }

  async deleteWorkerJobs(ids: string[]): Promise<number> {
    if (ids.length === 0) {
      return 0;
    }

    const result = await this.client.workerJobRecord.deleteMany({
      where: {
        id: {
          in: ids
        }
      }
    });

    return result.count;
  }

  async createMicrosoftIntegrationValidationRecord(
    integrationRecord: MicrosoftIntegrationValidationRecord
  ): Promise<MicrosoftIntegrationValidationRecord> {
    const record = await this.client.microsoftIntegrationValidationRecord.create({
      data: {
        id: integrationRecord.id,
        provider: integrationRecord.provider,
        mode: integrationRecord.mode,
        configComplete: integrationRecord.configComplete,
        overallStatus: integrationRecord.overallStatus,
        readyForLive: integrationRecord.readyForLive,
        missingConfigKeys: asJsonValue(integrationRecord.missingConfigKeys),
        surfacesJson: asJsonValue(integrationRecord.surfaces),
        checkedAt: new Date(integrationRecord.checkedAt),
        checkedById: integrationRecord.checkedById,
        checkedByRole: integrationRecord.checkedByRole
      }
    });

    return this.mapMicrosoftIntegrationValidationRecord(record);
  }

  async getLatestMicrosoftIntegrationValidationRecord(): Promise<MicrosoftIntegrationValidationRecord | null> {
    const record = await this.client.microsoftIntegrationValidationRecord.findFirst({
      where: {
        provider: "microsoft"
      },
      orderBy: {
        checkedAt: "desc"
      }
    });

    return record ? this.mapMicrosoftIntegrationValidationRecord(record) : null;
  }
}
