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
  ControlledSubstanceStewardshipRecord,
  DeploymentPromotionRecord,
  DelegationRuleRecord,
  DeviceAllowedProfile,
  DeviceEnrollmentCode,
  DeviceSession,
  DocumentRecord,
  EvidenceGapRecord,
  EnrolledDevice,
  IncidentRecord,
  MetricRun,
  MicrosoftIntegrationValidationRecord,
  PublicAssetRecord,
  PayerIssueRecord,
  PricingGovernanceRecord,
  PracticeAgreementRecord,
  RoomRecord,
  RevenueReviewRecord,
  ScorecardReviewRecord,
  ServiceLinePackRecord,
  ServiceLineRecord,
  StandardMappingRecord,
  TelehealthStewardshipRecord,
  EvidenceBinderRecord,
  TrainingCompletionRecord,
  TrainingPlanRecord,
  TrainingRequirement,
  UserProfile,
  WorkerJobRecord,
  WorkflowRun
} from "@clinic-os/domain";
import type { ClinicRepository } from "@clinic-os/db";

type FilterMap = Record<string, string | undefined>;

function matchesFilters<T extends Record<string, unknown>>(item: T, filters?: FilterMap): boolean {
  if (!filters) return true;
  return Object.entries(filters).every(([key, value]) => value === undefined || item[key] === value);
}

export class MemoryClinicRepository implements ClinicRepository {
  public readonly workflows: WorkflowRun[] = [];
  public readonly documents: DocumentRecord[] = [];
  public readonly approvals: ApprovalTask[] = [];
  public readonly actionItems: ActionItemRecord[] = [];
  public readonly rooms: RoomRecord[] = [];
  public readonly incidents: IncidentRecord[] = [];
  public readonly capas: CapaRecord[] = [];
  public readonly publicAssets: PublicAssetRecord[] = [];
  public readonly payerIssues: PayerIssueRecord[] = [];
  public readonly pricingGovernanceRecords: PricingGovernanceRecord[] = [];
  public readonly practiceAgreements: PracticeAgreementRecord[] = [];
  public readonly revenueReviews: RevenueReviewRecord[] = [];
  public readonly telehealthStewardshipRecords: TelehealthStewardshipRecord[] = [];
  public readonly controlledSubstanceStewardshipRecords: ControlledSubstanceStewardshipRecord[] = [];
  public readonly committees: CommitteeRecord[] = [];
  public readonly committeeMeetings: CommitteeMeetingRecord[] = [];
  public readonly serviceLines: ServiceLineRecord[] = [];
  public readonly serviceLinePacks: ServiceLinePackRecord[] = [];
  public readonly standardMappings: StandardMappingRecord[] = [];
  public readonly evidenceBinders: EvidenceBinderRecord[] = [];
  public readonly evidenceGaps: EvidenceGapRecord[] = [];
  public readonly delegationRules: DelegationRuleRecord[] = [];
  public readonly checklistTemplates: ChecklistTemplate[] = [];
  public readonly checklistRuns: ChecklistRun[] = [];
  public readonly checklistItems: ChecklistItemRecord[] = [];
  public readonly metrics: MetricRun[] = [];
  public readonly scorecardReviews: ScorecardReviewRecord[] = [];
  public readonly trainingRequirements: TrainingRequirement[] = [];
  public readonly trainingPlans: TrainingPlanRecord[] = [];
  public readonly trainingCompletions: TrainingCompletionRecord[] = [];
  public readonly auditEvents: AuditEvent[] = [];
  public readonly userProfiles: UserProfile[] = [];
  public readonly enrolledDevices: EnrolledDevice[] = [];
  public readonly deviceAllowedProfiles: DeviceAllowedProfile[] = [];
  public readonly enrollmentCodes: DeviceEnrollmentCode[] = [];
  public readonly deviceSessions: DeviceSession[] = [];
  public readonly workerJobs: WorkerJobRecord[] = [];
  public readonly integrationValidations: MicrosoftIntegrationValidationRecord[] = [];
  public readonly deploymentPromotions: DeploymentPromotionRecord[] = [];

  async createWorkflowRun(run: WorkflowRun): Promise<WorkflowRun> {
    this.workflows.unshift(run);
    return run;
  }

  async updateWorkflowRun(id: string, patch: Partial<WorkflowRun>): Promise<WorkflowRun> {
    const index = this.workflows.findIndex((run) => run.id === id);
    this.workflows[index] = { ...this.workflows[index], ...patch };
    return this.workflows[index];
  }

  async getWorkflowRun(id: string): Promise<WorkflowRun | null> {
    return this.workflows.find((run) => run.id === id) ?? null;
  }

  async listWorkflowRuns(filters?: { workflowDefinitionId?: string }): Promise<WorkflowRun[]> {
    return this.workflows.filter((run) => matchesFilters(run, filters));
  }

  async createDocument(document: DocumentRecord): Promise<DocumentRecord> {
    this.documents.unshift(document);
    return document;
  }

  async updateDocument(id: string, patch: Partial<DocumentRecord>): Promise<DocumentRecord> {
    const index = this.documents.findIndex((document) => document.id === id);
    this.documents[index] = { ...this.documents[index], ...patch };
    return this.documents[index];
  }

  async getDocument(id: string): Promise<DocumentRecord | null> {
    return this.documents.find((document) => document.id === id) ?? null;
  }

  async listDocuments(filters?: { status?: string; approvalClass?: string }): Promise<DocumentRecord[]> {
    return this.documents.filter((document) => matchesFilters(document, filters));
  }

  async createApprovalTasks(tasks: ApprovalTask[]): Promise<ApprovalTask[]> {
    this.approvals.push(...tasks);
    return tasks;
  }

  async updateApprovalTask(id: string, patch: Partial<ApprovalTask>): Promise<ApprovalTask> {
    const index = this.approvals.findIndex((approval) => approval.id === id);
    this.approvals[index] = { ...this.approvals[index], ...patch };
    return this.approvals[index];
  }

  async getApprovalTask(id: string): Promise<ApprovalTask | null> {
    return this.approvals.find((approval) => approval.id === id) ?? null;
  }

  async listApprovalTasks(filters?: { reviewerRole?: string; status?: string; targetId?: string }): Promise<ApprovalTask[]> {
    return this.approvals.filter((approval) => matchesFilters(approval, filters));
  }

  async createActionItem(item: ActionItemRecord): Promise<ActionItemRecord> {
    this.actionItems.unshift(item);
    return item;
  }

  async updateActionItem(id: string, patch: Partial<ActionItemRecord>): Promise<ActionItemRecord> {
    const index = this.actionItems.findIndex((item) => item.id === id);
    this.actionItems[index] = { ...this.actionItems[index], ...patch };
    return this.actionItems[index];
  }

  async listActionItems(filters?: {
    ownerRole?: string;
    status?: string;
    kind?: string;
    escalationStatus?: string;
    sourceWorkflowRunId?: string;
  }): Promise<ActionItemRecord[]> {
    return this.actionItems.filter((item) => matchesFilters(item, filters));
  }

  async getActionItem(id: string): Promise<ActionItemRecord | null> {
    return this.actionItems.find((item) => item.id === id) ?? null;
  }

  async createRoom(record: RoomRecord): Promise<RoomRecord> {
    this.rooms.unshift(record);
    return record;
  }

  async updateRoom(id: string, patch: Partial<RoomRecord>): Promise<RoomRecord> {
    const index = this.rooms.findIndex((room) => room.id === id);
    this.rooms[index] = { ...this.rooms[index], ...patch };
    return this.rooms[index];
  }

  async getRoom(id: string): Promise<RoomRecord | null> {
    return this.rooms.find((room) => room.id === id) ?? null;
  }

  async listRooms(filters?: {
    status?: string;
    roomType?: string;
  }): Promise<RoomRecord[]> {
    return this.rooms.filter((room) => matchesFilters(room, filters));
  }

  async createIncident(record: IncidentRecord): Promise<IncidentRecord> {
    this.incidents.unshift(record);
    return record;
  }

  async updateIncident(id: string, patch: Partial<IncidentRecord>): Promise<IncidentRecord> {
    const index = this.incidents.findIndex((record) => record.id === id);
    this.incidents[index] = { ...this.incidents[index], ...patch };
    return this.incidents[index];
  }

  async getIncident(id: string): Promise<IncidentRecord | null> {
    return this.incidents.find((record) => record.id === id) ?? null;
  }

  async listIncidents(filters?: {
    status?: string;
    severity?: string;
    ownerRole?: string;
    linkedCapaId?: string;
  }): Promise<IncidentRecord[]> {
    return this.incidents.filter((record) => matchesFilters(record, filters));
  }

  async createCapa(record: CapaRecord): Promise<CapaRecord> {
    this.capas.unshift(record);
    return record;
  }

  async updateCapa(id: string, patch: Partial<CapaRecord>): Promise<CapaRecord> {
    const index = this.capas.findIndex((record) => record.id === id);
    this.capas[index] = { ...this.capas[index], ...patch };
    return this.capas[index];
  }

  async getCapa(id: string): Promise<CapaRecord | null> {
    return this.capas.find((record) => record.id === id) ?? null;
  }

  async listCapas(filters?: {
    status?: string;
    sourceType?: string;
    ownerRole?: string;
    incidentId?: string;
  }): Promise<CapaRecord[]> {
    return this.capas.filter((record) => matchesFilters(record, filters));
  }

  async createPublicAsset(record: PublicAssetRecord): Promise<PublicAssetRecord> {
    this.publicAssets.unshift(record);
    return record;
  }

  async updatePublicAsset(id: string, patch: Partial<PublicAssetRecord>): Promise<PublicAssetRecord> {
    const index = this.publicAssets.findIndex((record) => record.id === id);
    this.publicAssets[index] = { ...this.publicAssets[index], ...patch };
    return this.publicAssets[index];
  }

  async getPublicAsset(id: string): Promise<PublicAssetRecord | null> {
    return this.publicAssets.find((record) => record.id === id) ?? null;
  }

  async getPublicAssetByDocumentId(documentId: string): Promise<PublicAssetRecord | null> {
    return this.publicAssets.find((record) => record.documentId === documentId) ?? null;
  }

  async listPublicAssets(filters?: {
    status?: string;
    ownerRole?: string;
    assetType?: string;
    serviceLine?: string;
  }): Promise<PublicAssetRecord[]> {
    return this.publicAssets.filter((record) => matchesFilters(record, filters));
  }

  async createPayerIssue(record: PayerIssueRecord): Promise<PayerIssueRecord> {
    this.payerIssues.unshift(record);
    return record;
  }

  async updatePayerIssue(id: string, patch: Partial<PayerIssueRecord>): Promise<PayerIssueRecord> {
    const index = this.payerIssues.findIndex((record) => record.id === id);
    this.payerIssues[index] = { ...this.payerIssues[index], ...patch };
    return this.payerIssues[index];
  }

  async getPayerIssue(id: string): Promise<PayerIssueRecord | null> {
    return this.payerIssues.find((record) => record.id === id) ?? null;
  }

  async listPayerIssues(filters?: {
    status?: string;
    ownerRole?: string;
    serviceLineId?: string;
    issueType?: string;
    payerName?: string;
  }): Promise<PayerIssueRecord[]> {
    return this.payerIssues.filter((record) => matchesFilters(record, filters));
  }

  async createPricingGovernance(record: PricingGovernanceRecord): Promise<PricingGovernanceRecord> {
    this.pricingGovernanceRecords.unshift(record);
    return record;
  }

  async updatePricingGovernance(id: string, patch: Partial<PricingGovernanceRecord>): Promise<PricingGovernanceRecord> {
    const index = this.pricingGovernanceRecords.findIndex((record) => record.id === id);
    this.pricingGovernanceRecords[index] = { ...this.pricingGovernanceRecords[index], ...patch };
    return this.pricingGovernanceRecords[index];
  }

  async getPricingGovernance(id: string): Promise<PricingGovernanceRecord | null> {
    return this.pricingGovernanceRecords.find((record) => record.id === id) ?? null;
  }

  async getPricingGovernanceByDocumentId(documentId: string): Promise<PricingGovernanceRecord | null> {
    return this.pricingGovernanceRecords.find((record) => record.documentId === documentId) ?? null;
  }

  async listPricingGovernance(filters?: {
    status?: string;
    ownerRole?: string;
    serviceLineId?: string;
  }): Promise<PricingGovernanceRecord[]> {
    return this.pricingGovernanceRecords.filter((record) => matchesFilters(record, filters));
  }

  async createRevenueReview(record: RevenueReviewRecord): Promise<RevenueReviewRecord> {
    this.revenueReviews.unshift(record);
    return record;
  }

  async updateRevenueReview(id: string, patch: Partial<RevenueReviewRecord>): Promise<RevenueReviewRecord> {
    const index = this.revenueReviews.findIndex((record) => record.id === id);
    this.revenueReviews[index] = { ...this.revenueReviews[index], ...patch };
    return this.revenueReviews[index];
  }

  async getRevenueReview(id: string): Promise<RevenueReviewRecord | null> {
    return this.revenueReviews.find((record) => record.id === id) ?? null;
  }

  async listRevenueReviews(filters?: {
    status?: string;
    ownerRole?: string;
    serviceLineId?: string;
    linkedCommitteeId?: string;
  }): Promise<RevenueReviewRecord[]> {
    return this.revenueReviews.filter((record) => matchesFilters(record, filters));
  }

  async createPracticeAgreement(record: PracticeAgreementRecord): Promise<PracticeAgreementRecord> {
    this.practiceAgreements.unshift(record);
    return record;
  }

  async updatePracticeAgreement(id: string, patch: Partial<PracticeAgreementRecord>): Promise<PracticeAgreementRecord> {
    const index = this.practiceAgreements.findIndex((record) => record.id === id);
    this.practiceAgreements[index] = { ...this.practiceAgreements[index], ...patch };
    return this.practiceAgreements[index];
  }

  async getPracticeAgreement(id: string): Promise<PracticeAgreementRecord | null> {
    return this.practiceAgreements.find((record) => record.id === id) ?? null;
  }

  async getPracticeAgreementByDocumentId(documentId: string): Promise<PracticeAgreementRecord | null> {
    return this.practiceAgreements.find((record) => record.documentId === documentId) ?? null;
  }

  async listPracticeAgreements(filters?: {
    status?: string;
    ownerRole?: string;
    supervisingPhysicianRole?: string;
    supervisedRole?: string;
    agreementType?: string;
  }): Promise<PracticeAgreementRecord[]> {
    return this.practiceAgreements.filter((record) => matchesFilters(record, filters));
  }

  async createTelehealthStewardship(record: TelehealthStewardshipRecord): Promise<TelehealthStewardshipRecord> {
    this.telehealthStewardshipRecords.unshift(record);
    return record;
  }

  async updateTelehealthStewardship(id: string, patch: Partial<TelehealthStewardshipRecord>): Promise<TelehealthStewardshipRecord> {
    const index = this.telehealthStewardshipRecords.findIndex((record) => record.id === id);
    this.telehealthStewardshipRecords[index] = { ...this.telehealthStewardshipRecords[index], ...patch };
    return this.telehealthStewardshipRecords[index];
  }

  async getTelehealthStewardship(id: string): Promise<TelehealthStewardshipRecord | null> {
    return this.telehealthStewardshipRecords.find((record) => record.id === id) ?? null;
  }

  async getTelehealthStewardshipByDocumentId(documentId: string): Promise<TelehealthStewardshipRecord | null> {
    return this.telehealthStewardshipRecords.find((record) => record.documentId === documentId) ?? null;
  }

  async listTelehealthStewardship(filters?: {
    status?: string;
    ownerRole?: string;
    supervisingPhysicianRole?: string;
  }): Promise<TelehealthStewardshipRecord[]> {
    return this.telehealthStewardshipRecords.filter((record) => matchesFilters(record, filters));
  }

  async createControlledSubstanceStewardship(
    record: ControlledSubstanceStewardshipRecord
  ): Promise<ControlledSubstanceStewardshipRecord> {
    this.controlledSubstanceStewardshipRecords.unshift(record);
    return record;
  }

  async updateControlledSubstanceStewardship(
    id: string,
    patch: Partial<ControlledSubstanceStewardshipRecord>
  ): Promise<ControlledSubstanceStewardshipRecord> {
    const index = this.controlledSubstanceStewardshipRecords.findIndex((record) => record.id === id);
    this.controlledSubstanceStewardshipRecords[index] = {
      ...this.controlledSubstanceStewardshipRecords[index],
      ...patch
    };
    return this.controlledSubstanceStewardshipRecords[index];
  }

  async getControlledSubstanceStewardship(id: string): Promise<ControlledSubstanceStewardshipRecord | null> {
    return this.controlledSubstanceStewardshipRecords.find((record) => record.id === id) ?? null;
  }

  async getControlledSubstanceStewardshipByDocumentId(
    documentId: string
  ): Promise<ControlledSubstanceStewardshipRecord | null> {
    return this.controlledSubstanceStewardshipRecords.find((record) => record.documentId === documentId) ?? null;
  }

  async listControlledSubstanceStewardship(filters?: {
    status?: string;
    ownerRole?: string;
    supervisingPhysicianRole?: string;
  }): Promise<ControlledSubstanceStewardshipRecord[]> {
    return this.controlledSubstanceStewardshipRecords.filter((record) => matchesFilters(record, filters));
  }

  async createStandardMapping(record: StandardMappingRecord): Promise<StandardMappingRecord> {
    this.standardMappings.unshift(record);
    return record;
  }

  async updateStandardMapping(id: string, patch: Partial<StandardMappingRecord>): Promise<StandardMappingRecord> {
    const index = this.standardMappings.findIndex((record) => record.id === id);
    this.standardMappings[index] = { ...this.standardMappings[index], ...patch };
    return this.standardMappings[index];
  }

  async getStandardMapping(id: string): Promise<StandardMappingRecord | null> {
    return this.standardMappings.find((record) => record.id === id) ?? null;
  }

  async listStandardMappings(filters?: {
    domain?: string;
    ownerRole?: string;
    status?: string;
    sourceAuthority?: string;
  }): Promise<StandardMappingRecord[]> {
    return this.standardMappings.filter((record) => matchesFilters(record, filters));
  }

  async createEvidenceBinder(record: EvidenceBinderRecord): Promise<EvidenceBinderRecord> {
    this.evidenceBinders.unshift(record);
    return record;
  }

  async updateEvidenceBinder(id: string, patch: Partial<EvidenceBinderRecord>): Promise<EvidenceBinderRecord> {
    const index = this.evidenceBinders.findIndex((record) => record.id === id);
    this.evidenceBinders[index] = { ...this.evidenceBinders[index], ...patch };
    return this.evidenceBinders[index];
  }

  async getEvidenceBinder(id: string): Promise<EvidenceBinderRecord | null> {
    return this.evidenceBinders.find((record) => record.id === id) ?? null;
  }

  async getEvidenceBinderByDocumentId(documentId: string): Promise<EvidenceBinderRecord | null> {
    return this.evidenceBinders.find((record) => record.documentId === documentId) ?? null;
  }

  async listEvidenceBinders(filters?: {
    status?: string;
    ownerRole?: string;
    sourceAuthority?: string;
  }): Promise<EvidenceBinderRecord[]> {
    return this.evidenceBinders.filter((record) => matchesFilters(record, filters));
  }

  async createEvidenceGap(record: EvidenceGapRecord): Promise<EvidenceGapRecord> {
    this.evidenceGaps.unshift(record);
    return record;
  }

  async updateEvidenceGap(id: string, patch: Partial<EvidenceGapRecord>): Promise<EvidenceGapRecord> {
    const index = this.evidenceGaps.findIndex((record) => record.id === id);
    this.evidenceGaps[index] = { ...this.evidenceGaps[index], ...patch };
    return this.evidenceGaps[index];
  }

  async getEvidenceGap(id: string): Promise<EvidenceGapRecord | null> {
    return this.evidenceGaps.find((record) => record.id === id) ?? null;
  }

  async listEvidenceGaps(filters?: {
    status?: string;
    ownerRole?: string;
    severity?: string;
    standardId?: string;
    binderId?: string;
    committeeMeetingId?: string;
    serviceLineId?: string;
    normalizedGapKey?: string;
  }): Promise<EvidenceGapRecord[]> {
    return this.evidenceGaps.filter((record) => matchesFilters(record, filters));
  }

  async createCommittee(record: CommitteeRecord): Promise<CommitteeRecord> {
    this.committees.unshift(record);
    return record;
  }

  async updateCommittee(id: string, patch: Partial<CommitteeRecord>): Promise<CommitteeRecord> {
    const index = this.committees.findIndex((record) => record.id === id);
    this.committees[index] = { ...this.committees[index], ...patch };
    return this.committees[index];
  }

  async getCommittee(id: string): Promise<CommitteeRecord | null> {
    return this.committees.find((record) => record.id === id) ?? null;
  }

  async listCommittees(filters?: {
    category?: string;
    isActive?: boolean;
    qapiFocus?: boolean;
    serviceLine?: string;
  }): Promise<CommitteeRecord[]> {
    return this.committees.filter((record) =>
      (filters?.category === undefined || record.category === filters.category)
      && (filters?.isActive === undefined || record.isActive === filters.isActive)
      && (filters?.qapiFocus === undefined || record.qapiFocus === filters.qapiFocus)
      && (filters?.serviceLine === undefined || record.serviceLine === filters.serviceLine)
    );
  }

  async createCommitteeMeeting(record: CommitteeMeetingRecord): Promise<CommitteeMeetingRecord> {
    this.committeeMeetings.unshift(record);
    return record;
  }

  async updateCommitteeMeeting(id: string, patch: Partial<CommitteeMeetingRecord>): Promise<CommitteeMeetingRecord> {
    const index = this.committeeMeetings.findIndex((record) => record.id === id);
    this.committeeMeetings[index] = { ...this.committeeMeetings[index], ...patch };
    return this.committeeMeetings[index];
  }

  async getCommitteeMeeting(id: string): Promise<CommitteeMeetingRecord | null> {
    return this.committeeMeetings.find((record) => record.id === id) ?? null;
  }

  async getCommitteeMeetingByPacketDocumentId(packetDocumentId: string): Promise<CommitteeMeetingRecord | null> {
    return this.committeeMeetings.find((record) => record.packetDocumentId === packetDocumentId) ?? null;
  }

  async listCommitteeMeetings(filters?: {
    committeeId?: string;
    status?: string;
  }): Promise<CommitteeMeetingRecord[]> {
    return this.committeeMeetings.filter((record) => matchesFilters(record, filters));
  }

  async createServiceLine(record: ServiceLineRecord): Promise<ServiceLineRecord> {
    this.serviceLines.unshift(record);
    return record;
  }

  async updateServiceLine(id: string, patch: Partial<ServiceLineRecord>): Promise<ServiceLineRecord> {
    const index = this.serviceLines.findIndex((record) => record.id === id);
    this.serviceLines[index] = { ...this.serviceLines[index], ...patch };
    return this.serviceLines[index];
  }

  async getServiceLine(id: string): Promise<ServiceLineRecord | null> {
    return this.serviceLines.find((record) => record.id === id) ?? null;
  }

  async listServiceLines(filters?: {
    governanceStatus?: string;
    ownerRole?: string;
  }): Promise<ServiceLineRecord[]> {
    return this.serviceLines.filter((record) => matchesFilters(record, filters));
  }

  async createServiceLinePack(record: ServiceLinePackRecord): Promise<ServiceLinePackRecord> {
    this.serviceLinePacks.unshift(record);
    return record;
  }

  async updateServiceLinePack(id: string, patch: Partial<ServiceLinePackRecord>): Promise<ServiceLinePackRecord> {
    const index = this.serviceLinePacks.findIndex((record) => record.id === id);
    this.serviceLinePacks[index] = { ...this.serviceLinePacks[index], ...patch };
    return this.serviceLinePacks[index];
  }

  async getServiceLinePack(id: string): Promise<ServiceLinePackRecord | null> {
    return this.serviceLinePacks.find((record) => record.id === id) ?? null;
  }

  async getServiceLinePackByDocumentId(documentId: string): Promise<ServiceLinePackRecord | null> {
    return this.serviceLinePacks.find((record) => record.documentId === documentId) ?? null;
  }

  async listServiceLinePacks(filters?: {
    serviceLineId?: string;
    status?: string;
  }): Promise<ServiceLinePackRecord[]> {
    return this.serviceLinePacks.filter((record) => matchesFilters(record, filters));
  }

  async createDelegationRule(record: DelegationRuleRecord): Promise<DelegationRuleRecord> {
    this.delegationRules.unshift(record);
    return record;
  }

  async updateDelegationRule(id: string, patch: Partial<DelegationRuleRecord>): Promise<DelegationRuleRecord> {
    const index = this.delegationRules.findIndex((record) => record.id === id);
    this.delegationRules[index] = { ...this.delegationRules[index], ...patch };
    return this.delegationRules[index];
  }

  async getDelegationRule(id: string): Promise<DelegationRuleRecord | null> {
    return this.delegationRules.find((record) => record.id === id) ?? null;
  }

  async listDelegationRules(filters?: {
    serviceLineId?: string;
    performerRole?: string;
    status?: string;
    taskCode?: string;
  }): Promise<DelegationRuleRecord[]> {
    return this.delegationRules.filter((record) => matchesFilters(record, filters));
  }

  async createChecklistTemplate(template: ChecklistTemplate): Promise<ChecklistTemplate> {
    this.checklistTemplates.unshift(template);
    return template;
  }

  async updateChecklistTemplate(id: string, patch: Partial<ChecklistTemplate>): Promise<ChecklistTemplate> {
    const index = this.checklistTemplates.findIndex((template) => template.id === id);
    this.checklistTemplates[index] = { ...this.checklistTemplates[index], ...patch };
    return this.checklistTemplates[index];
  }

  async getChecklistTemplate(id: string): Promise<ChecklistTemplate | null> {
    return this.checklistTemplates.find((template) => template.id === id) ?? null;
  }

  async listChecklistTemplates(filters?: {
    workflowDefinitionId?: string;
    isActive?: boolean;
  }): Promise<ChecklistTemplate[]> {
    return this.checklistTemplates.filter((template) =>
      (filters?.workflowDefinitionId === undefined || template.workflowDefinitionId === filters.workflowDefinitionId)
      && (filters?.isActive === undefined || template.isActive === filters.isActive)
    );
  }

  async createChecklistRun(run: ChecklistRun): Promise<ChecklistRun> {
    this.checklistRuns.unshift(run);
    return run;
  }

  async updateChecklistRun(id: string, patch: Partial<ChecklistRun>): Promise<ChecklistRun> {
    const index = this.checklistRuns.findIndex((run) => run.id === id);
    this.checklistRuns[index] = { ...this.checklistRuns[index], ...patch };
    return this.checklistRuns[index];
  }

  async getChecklistRun(id: string): Promise<ChecklistRun | null> {
    return this.checklistRuns.find((run) => run.id === id) ?? null;
  }

  async listChecklistRuns(filters?: {
    workflowRunId?: string;
    templateId?: string;
    roomId?: string;
  }): Promise<ChecklistRun[]> {
    return this.checklistRuns.filter((run) => matchesFilters(run, filters));
  }

  async createChecklistItems(items: ChecklistItemRecord[]): Promise<ChecklistItemRecord[]> {
    this.checklistItems.push(...items);
    return items;
  }

  async updateChecklistItem(id: string, patch: Partial<ChecklistItemRecord>): Promise<ChecklistItemRecord> {
    const index = this.checklistItems.findIndex((item) => item.id === id);
    this.checklistItems[index] = { ...this.checklistItems[index], ...patch };
    return this.checklistItems[index];
  }

  async getChecklistItem(id: string): Promise<ChecklistItemRecord | null> {
    return this.checklistItems.find((item) => item.id === id) ?? null;
  }

  async listChecklistItems(filters?: {
    checklistRunId?: string;
    status?: string;
    reviewActionItemId?: string;
  }): Promise<ChecklistItemRecord[]> {
    return this.checklistItems.filter((item) => matchesFilters(item, filters));
  }

  async createScorecardReviews(records: ScorecardReviewRecord[]): Promise<ScorecardReviewRecord[]> {
    this.scorecardReviews.unshift(...records);
    return records;
  }

  async updateScorecardReview(id: string, patch: Partial<ScorecardReviewRecord>): Promise<ScorecardReviewRecord> {
    const index = this.scorecardReviews.findIndex((review) => review.id === id);
    this.scorecardReviews[index] = { ...this.scorecardReviews[index], ...patch };
    return this.scorecardReviews[index];
  }

  async getScorecardReview(id: string): Promise<ScorecardReviewRecord | null> {
    return this.scorecardReviews.find((review) => review.id === id) ?? null;
  }

  async listScorecardReviews(filters?: {
    status?: string;
    assignedReviewerRole?: string;
    workflowRunId?: string;
    employeeId?: string;
  }): Promise<ScorecardReviewRecord[]> {
    return this.scorecardReviews.filter((review) => matchesFilters(review, filters));
  }

  async createMetricRuns(metricRuns: MetricRun[]): Promise<MetricRun[]> {
    this.metrics.push(...metricRuns);
    return metricRuns;
  }

  async listMetricRuns(filters?: { entityId?: string }): Promise<MetricRun[]> {
    return this.metrics.filter((metric) => matchesFilters(metric, filters));
  }

  async createTrainingRequirement(requirement: TrainingRequirement): Promise<TrainingRequirement> {
    this.trainingRequirements.unshift(requirement);
    return requirement;
  }

  async updateTrainingRequirement(id: string, patch: Partial<TrainingRequirement>): Promise<TrainingRequirement> {
    const index = this.trainingRequirements.findIndex((requirement) => requirement.id === id);
    this.trainingRequirements[index] = { ...this.trainingRequirements[index], ...patch };
    return this.trainingRequirements[index];
  }

  async getTrainingRequirement(id: string): Promise<TrainingRequirement | null> {
    return this.trainingRequirements.find((requirement) => requirement.id === id) ?? null;
  }

  async listTrainingRequirements(filters?: {
    employeeId?: string;
    employeeRole?: string;
    requirementType?: string;
    planId?: string;
  }): Promise<TrainingRequirement[]> {
    return this.trainingRequirements.filter((requirement) => matchesFilters(requirement, filters));
  }

  async createTrainingPlan(plan: TrainingPlanRecord): Promise<TrainingPlanRecord> {
    this.trainingPlans.unshift(plan);
    return plan;
  }

  async updateTrainingPlan(id: string, patch: Partial<TrainingPlanRecord>): Promise<TrainingPlanRecord> {
    const index = this.trainingPlans.findIndex((plan) => plan.id === id);
    this.trainingPlans[index] = { ...this.trainingPlans[index], ...patch };
    return this.trainingPlans[index];
  }

  async getTrainingPlan(id: string): Promise<TrainingPlanRecord | null> {
    return this.trainingPlans.find((plan) => plan.id === id) ?? null;
  }

  async listTrainingPlans(filters?: {
    employeeId?: string;
    employeeRole?: string;
    ownerRole?: string;
    status?: string;
  }): Promise<TrainingPlanRecord[]> {
    return this.trainingPlans.filter((plan) => matchesFilters(plan, filters));
  }

  async createTrainingCompletion(record: TrainingCompletionRecord): Promise<TrainingCompletionRecord> {
    this.trainingCompletions.unshift(record);
    return record;
  }

  async listTrainingCompletions(filters?: {
    requirementId?: string;
    employeeId?: string;
    employeeRole?: string;
  }): Promise<TrainingCompletionRecord[]> {
    return this.trainingCompletions.filter((record) => matchesFilters(record, filters));
  }

  async createAuditEvent(event: AuditEvent): Promise<AuditEvent> {
    this.auditEvents.unshift(event);
    return event;
  }

  async listAuditEvents(filters?: { entityType?: string; entityId?: string }): Promise<AuditEvent[]> {
    return this.auditEvents.filter((event) => matchesFilters(event, filters));
  }

  async createUserProfile(profile: UserProfile): Promise<UserProfile> {
    this.userProfiles.unshift(profile);
    return profile;
  }

  async updateUserProfile(id: string, patch: Partial<UserProfile>): Promise<UserProfile> {
    const index = this.userProfiles.findIndex((profile) => profile.id === id);
    this.userProfiles[index] = { ...this.userProfiles[index], ...patch };
    return this.userProfiles[index];
  }

  async getUserProfile(id: string): Promise<UserProfile | null> {
    return this.userProfiles.find((profile) => profile.id === id) ?? null;
  }

  async listUserProfiles(filters?: { status?: string; role?: string }): Promise<UserProfile[]> {
    return this.userProfiles.filter((profile) => matchesFilters(profile, filters));
  }

  async createEnrolledDevice(device: EnrolledDevice): Promise<EnrolledDevice> {
    this.enrolledDevices.unshift(device);
    return device;
  }

  async updateEnrolledDevice(id: string, patch: Partial<EnrolledDevice>): Promise<EnrolledDevice> {
    const index = this.enrolledDevices.findIndex((device) => device.id === id);
    this.enrolledDevices[index] = { ...this.enrolledDevices[index], ...patch };
    return this.enrolledDevices[index];
  }

  async getEnrolledDevice(id: string): Promise<EnrolledDevice | null> {
    return this.enrolledDevices.find((device) => device.id === id) ?? null;
  }

  async getEnrolledDeviceBySecretHash(secretHash: string): Promise<EnrolledDevice | null> {
    return this.enrolledDevices.find((device) => device.deviceSecretHash === secretHash) ?? null;
  }

  async listEnrolledDevices(filters?: { status?: string; primaryProfileId?: string }): Promise<EnrolledDevice[]> {
    return this.enrolledDevices.filter((device) => matchesFilters(device, filters));
  }

  async replaceDeviceAllowedProfiles(deviceId: string, records: DeviceAllowedProfile[]): Promise<DeviceAllowedProfile[]> {
    for (let index = this.deviceAllowedProfiles.length - 1; index >= 0; index -= 1) {
      if (this.deviceAllowedProfiles[index].deviceId === deviceId) {
        this.deviceAllowedProfiles.splice(index, 1);
      }
    }
    this.deviceAllowedProfiles.push(...records);
    return this.deviceAllowedProfiles.filter((record) => record.deviceId === deviceId);
  }

  async updateDeviceAllowedProfile(id: string, patch: Partial<DeviceAllowedProfile>): Promise<DeviceAllowedProfile> {
    const index = this.deviceAllowedProfiles.findIndex((record) => record.id === id);
    this.deviceAllowedProfiles[index] = { ...this.deviceAllowedProfiles[index], ...patch };
    return this.deviceAllowedProfiles[index];
  }

  async listDeviceAllowedProfiles(filters?: { deviceId?: string; profileId?: string }): Promise<DeviceAllowedProfile[]> {
    return this.deviceAllowedProfiles.filter((record) => matchesFilters(record, filters));
  }

  async createDeviceEnrollmentCode(code: DeviceEnrollmentCode): Promise<DeviceEnrollmentCode> {
    this.enrollmentCodes.unshift(code);
    return code;
  }

  async updateDeviceEnrollmentCode(id: string, patch: Partial<DeviceEnrollmentCode>): Promise<DeviceEnrollmentCode> {
    const index = this.enrollmentCodes.findIndex((code) => code.id === id);
    this.enrollmentCodes[index] = { ...this.enrollmentCodes[index], ...patch };
    return this.enrollmentCodes[index];
  }

  async getDeviceEnrollmentCodeByCodeHash(codeHash: string): Promise<DeviceEnrollmentCode | null> {
    return this.enrollmentCodes.find((code) => code.codeHash === codeHash) ?? null;
  }

  async listDeviceEnrollmentCodes(filters?: {
    createdByProfileId?: string;
    primaryProfileId?: string;
    includeConsumed?: boolean;
  }): Promise<DeviceEnrollmentCode[]> {
    return this.enrollmentCodes.filter((code) =>
      (filters?.createdByProfileId === undefined || code.createdByProfileId === filters.createdByProfileId)
      && (filters?.primaryProfileId === undefined || code.primaryProfileId === filters.primaryProfileId)
      && (filters?.includeConsumed ? true : code.consumedAt === null)
    );
  }

  async deleteDeviceEnrollmentCodes(ids: string[]): Promise<number> {
    let deleted = 0;
    for (let index = this.enrollmentCodes.length - 1; index >= 0; index -= 1) {
      if (ids.includes(this.enrollmentCodes[index].id)) {
        this.enrollmentCodes.splice(index, 1);
        deleted += 1;
      }
    }
    return deleted;
  }

  async createDeviceSession(session: DeviceSession): Promise<DeviceSession> {
    this.deviceSessions.unshift(session);
    return session;
  }

  async updateDeviceSession(id: string, patch: Partial<DeviceSession>): Promise<DeviceSession> {
    const index = this.deviceSessions.findIndex((session) => session.id === id);
    this.deviceSessions[index] = { ...this.deviceSessions[index], ...patch };
    return this.deviceSessions[index];
  }

  async getDeviceSession(id: string): Promise<DeviceSession | null> {
    return this.deviceSessions.find((session) => session.id === id) ?? null;
  }

  async getDeviceSessionBySecretHash(secretHash: string): Promise<DeviceSession | null> {
    return this.deviceSessions.find((session) => session.sessionSecretHash === secretHash) ?? null;
  }

  async listDeviceSessions(filters?: { deviceId?: string; profileId?: string; includeRevoked?: boolean }): Promise<DeviceSession[]> {
    return this.deviceSessions.filter((session) =>
      (filters?.deviceId === undefined || session.deviceId === filters.deviceId)
      && (filters?.profileId === undefined || session.profileId === filters.profileId)
      && (filters?.includeRevoked ? true : session.revokedAt === null)
    );
  }

  async deleteDeviceSessions(ids: string[]): Promise<number> {
    let deleted = 0;
    for (let index = this.deviceSessions.length - 1; index >= 0; index -= 1) {
      if (ids.includes(this.deviceSessions[index].id)) {
        this.deviceSessions.splice(index, 1);
        deleted += 1;
      }
    }
    return deleted;
  }

  async enqueueWorkerJob(job: WorkerJobRecord): Promise<WorkerJobRecord> {
    this.workerJobs.unshift(job);
    return job;
  }

  async getWorkerJob(id: string): Promise<WorkerJobRecord | null> {
    return this.workerJobs.find((job) => job.id === id) ?? null;
  }

  async listWorkerJobs(filters?: {
    status?: string;
    type?: string;
    sourceEntityId?: string;
    sourceEntityType?: string;
  }): Promise<WorkerJobRecord[]> {
    return this.workerJobs.filter((job) => matchesFilters(job, filters));
  }

  async updateWorkerJob(id: string, patch: Partial<WorkerJobRecord>): Promise<WorkerJobRecord> {
    const index = this.workerJobs.findIndex((job) => job.id === id);
    this.workerJobs[index] = { ...this.workerJobs[index], ...patch };
    return this.workerJobs[index];
  }

  async leaseWorkerJobs(options?: {
    limit?: number;
    now?: string;
    lockTimeoutMinutes?: number;
  }): Promise<WorkerJobRecord[]> {
    const now = new Date(options?.now ?? new Date().toISOString());
    const staleThreshold = new Date(now.getTime() - (options?.lockTimeoutMinutes ?? 5) * 60_000).toISOString();
    const limit = Math.max(1, options?.limit ?? 10);
    const leased: WorkerJobRecord[] = [];

    for (const job of this.workerJobs
      .filter((candidate) =>
        ["queued", "failed"].includes(candidate.status)
        && candidate.scheduledAt <= now.toISOString()
        && (!candidate.lockedAt || candidate.lockedAt < staleThreshold)
      )
      .sort((left, right) => left.scheduledAt.localeCompare(right.scheduledAt))) {
      if (leased.length >= limit) {
        break;
      }

      job.status = "processing";
      job.lockedAt = now.toISOString();
      job.attempts += 1;
      job.updatedAt = now.toISOString();
      leased.push(job);
    }

    return leased;
  }

  async retryWorkerJob(id: string, nowInput?: string): Promise<WorkerJobRecord> {
    const index = this.workerJobs.findIndex((job) => job.id === id);
    const now = nowInput ?? new Date().toISOString();
    this.workerJobs[index] = {
      ...this.workerJobs[index],
      status: "queued",
      attempts: 0,
      lockedAt: null,
      lastError: null,
      resultJson: null,
      scheduledAt: now,
      updatedAt: now
    };
    return this.workerJobs[index];
  }

  async deleteWorkerJobs(ids: string[]): Promise<number> {
    let deleted = 0;
    for (let index = this.workerJobs.length - 1; index >= 0; index -= 1) {
      if (ids.includes(this.workerJobs[index].id)) {
        this.workerJobs.splice(index, 1);
        deleted += 1;
      }
    }
    return deleted;
  }

  async createMicrosoftIntegrationValidationRecord(
    record: MicrosoftIntegrationValidationRecord
  ): Promise<MicrosoftIntegrationValidationRecord> {
    this.integrationValidations.unshift(record);
    return record;
  }

  async getLatestMicrosoftIntegrationValidationRecord(): Promise<MicrosoftIntegrationValidationRecord | null> {
    return this.integrationValidations[0] ?? null;
  }

  async createDeploymentPromotion(record: DeploymentPromotionRecord): Promise<DeploymentPromotionRecord> {
    this.deploymentPromotions.unshift(record);
    return record;
  }

  async updateDeploymentPromotion(id: string, patch: Partial<DeploymentPromotionRecord>): Promise<DeploymentPromotionRecord> {
    const index = this.deploymentPromotions.findIndex((record) => record.id === id);
    this.deploymentPromotions[index] = { ...this.deploymentPromotions[index], ...patch };
    return this.deploymentPromotions[index];
  }

  async getDeploymentPromotion(id: string): Promise<DeploymentPromotionRecord | null> {
    return this.deploymentPromotions.find((record) => record.id === id) ?? null;
  }

  async listDeploymentPromotions(filters?: {
    environmentKey?: string;
    status?: string;
    targetAuthMode?: string;
  }): Promise<DeploymentPromotionRecord[]> {
    return this.deploymentPromotions.filter((record) => matchesFilters(record, filters));
  }
}
