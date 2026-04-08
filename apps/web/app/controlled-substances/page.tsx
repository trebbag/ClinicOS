"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useAppAuth } from "../../components/auth-provider";
import { apiRequest, type ActorRole } from "../../lib/api";

type PracticeAgreementSummary = {
  id: string;
  title: string;
  status: string;
};

type ServiceLineId =
  | "primary_care"
  | "women_health"
  | "telehealth"
  | "weight_management"
  | "hrt"
  | "vaccines"
  | "waived_testing"
  | "contracted_lab"
  | "iv_hydration"
  | "aesthetics"
  | "allergy_testing";

type ControlledSubstanceStewardshipRecord = {
  id: string;
  title: string;
  ownerRole: ActorRole;
  supervisingPhysicianRole: ActorRole;
  serviceLineIds: ServiceLineId[];
  status: "draft" | "approval_pending" | "approved" | "publish_pending" | "published" | "sent_back" | "archived";
  linkedPracticeAgreementId: string | null;
  prescribingScopeSummary: string;
  pdmpReviewSummary: string;
  screeningProtocolSummary: string;
  refillEscalationSummary: string;
  inventoryControlSummary: string;
  patientEducationSummary: string;
  adverseEventEscalationSummary: string;
  reviewCadenceDays: number;
  effectiveDate: string | null;
  reviewDueAt: string | null;
  notes: string | null;
  documentId: string | null;
  workflowRunId: string | null;
  publishedAt: string | null;
  publishedPath: string | null;
};

const actorRoles: ActorRole[] = [
  "medical_director",
  "quality_lead",
  "patient_care_team_physician",
  "office_manager",
  "hr_lead",
  "cfo",
  "nurse_practitioner",
  "medical_assistant",
  "front_desk"
];

const serviceLineOptions: Array<{ id: ServiceLineId; label: string }> = [
  { id: "primary_care", label: "Primary care" },
  { id: "telehealth", label: "Telehealth" },
  { id: "weight_management", label: "Weight management" },
  { id: "hrt", label: "HRT" },
  { id: "women_health", label: "Women's health" },
  { id: "vaccines", label: "Vaccines" },
  { id: "waived_testing", label: "Waived testing" },
  { id: "contracted_lab", label: "Contracted lab" },
  { id: "iv_hydration", label: "IV hydration" },
  { id: "aesthetics", label: "Aesthetics" },
  { id: "allergy_testing", label: "Allergy testing" }
];

export default function ControlledSubstancesPage(): JSX.Element {
  const { actor, hasCapability } = useAppAuth();
  const [records, setRecords] = useState<ControlledSubstanceStewardshipRecord[]>([]);
  const [agreements, setAgreements] = useState<PracticeAgreementSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [title, setTitle] = useState("Controlled-substance stewardship packet");
  const [ownerRole, setOwnerRole] = useState<ActorRole>("medical_director");
  const [supervisingPhysicianRole, setSupervisingPhysicianRole] = useState<ActorRole>("patient_care_team_physician");
  const [selectedServiceLines, setSelectedServiceLines] = useState<ServiceLineId[]>(["weight_management", "hrt", "primary_care"]);
  const [linkedPracticeAgreementId, setLinkedPracticeAgreementId] = useState("");
  const [prescribingScopeSummary, setPrescribingScopeSummary] = useState("Define which controlled-substance workflows remain inside clinic scope, which require supervising-physician review, and which are out of scope.");
  const [pdmpReviewSummary, setPdmpReviewSummary] = useState("Require documented PDMP review before new starts, dose escalation, early refill consideration, or transfer-of-care continuation decisions.");
  const [screeningProtocolSummary, setScreeningProtocolSummary] = useState("Document the standardized risk-screening, toxicology, contraindication, and monitoring checkpoints required before controlled-medication prescribing or renewal.");
  const [refillEscalationSummary, setRefillEscalationSummary] = useState("Escalate early refill requests, lost-medication reports, outside-prescriber overlap, and missed-monitoring events to same-day supervising-physician review.");
  const [inventoryControlSummary, setInventoryControlSummary] = useState("Maintain locked storage, access logging, discrepancy review, and immediate diversion escalation expectations for any on-site stock or samples.");
  const [patientEducationSummary, setPatientEducationSummary] = useState("Give consistent patient education on refill timing, safe storage, no-sharing expectations, and what triggers reassessment or discontinuation.");
  const [adverseEventEscalationSummary, setAdverseEventEscalationSummary] = useState("Escalate suspected misuse, overdose risk, sedation, withdrawal concern, or red-flag adverse effects immediately with documented warm handoff.");
  const [reviewCadenceDays, setReviewCadenceDays] = useState("45");
  const [effectiveDate, setEffectiveDate] = useState("");
  const [notes, setNotes] = useState("Keep aligned with the current practice agreement and service-line governance packs.");

  const canView = hasCapability("controlled_substances.view");
  const canManage = hasCapability("controlled_substances.manage");

  const draftCount = useMemo(
    () => records.filter((record) => ["draft", "sent_back"].includes(record.status)).length,
    [records]
  );

  function resetForm(): void {
    setEditingId(null);
    setTitle("Controlled-substance stewardship packet");
    setOwnerRole("medical_director");
    setSupervisingPhysicianRole("patient_care_team_physician");
    setSelectedServiceLines(["weight_management", "hrt", "primary_care"]);
    setLinkedPracticeAgreementId("");
    setPrescribingScopeSummary("Define which controlled-substance workflows remain inside clinic scope, which require supervising-physician review, and which are out of scope.");
    setPdmpReviewSummary("Require documented PDMP review before new starts, dose escalation, early refill consideration, or transfer-of-care continuation decisions.");
    setScreeningProtocolSummary("Document the standardized risk-screening, toxicology, contraindication, and monitoring checkpoints required before controlled-medication prescribing or renewal.");
    setRefillEscalationSummary("Escalate early refill requests, lost-medication reports, outside-prescriber overlap, and missed-monitoring events to same-day supervising-physician review.");
    setInventoryControlSummary("Maintain locked storage, access logging, discrepancy review, and immediate diversion escalation expectations for any on-site stock or samples.");
    setPatientEducationSummary("Give consistent patient education on refill timing, safe storage, no-sharing expectations, and what triggers reassessment or discontinuation.");
    setAdverseEventEscalationSummary("Escalate suspected misuse, overdose risk, sedation, withdrawal concern, or red-flag adverse effects immediately with documented warm handoff.");
    setReviewCadenceDays("45");
    setEffectiveDate("");
    setNotes("Keep aligned with the current practice agreement and service-line governance packs.");
  }

  function loadIntoForm(record: ControlledSubstanceStewardshipRecord): void {
    setEditingId(record.id);
    setTitle(record.title);
    setOwnerRole(record.ownerRole);
    setSupervisingPhysicianRole(record.supervisingPhysicianRole);
    setSelectedServiceLines(record.serviceLineIds);
    setLinkedPracticeAgreementId(record.linkedPracticeAgreementId ?? "");
    setPrescribingScopeSummary(record.prescribingScopeSummary);
    setPdmpReviewSummary(record.pdmpReviewSummary);
    setScreeningProtocolSummary(record.screeningProtocolSummary);
    setRefillEscalationSummary(record.refillEscalationSummary);
    setInventoryControlSummary(record.inventoryControlSummary);
    setPatientEducationSummary(record.patientEducationSummary);
    setAdverseEventEscalationSummary(record.adverseEventEscalationSummary);
    setReviewCadenceDays(String(record.reviewCadenceDays));
    setEffectiveDate(record.effectiveDate ? record.effectiveDate.slice(0, 10) : "");
    setNotes(record.notes ?? "");
  }

  async function loadData(): Promise<void> {
    if (!actor || !canView) {
      return;
    }
    setLoading(true);
    try {
      const [nextRecords, nextAgreements] = await Promise.all([
        apiRequest<ControlledSubstanceStewardshipRecord[]>("/controlled-substances", actor),
        apiRequest<PracticeAgreementSummary[]>("/practice-agreements", actor)
      ]);
      setRecords(nextRecords);
      setAgreements(nextAgreements);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load controlled-substance stewardship.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, [actor, canView]);

  async function runMutation(action: () => Promise<void>): Promise<void> {
    setSubmitting(true);
    try {
      await action();
      await loadData();
      setError(null);
    } catch (mutationError) {
      setError(mutationError instanceof Error ? mutationError.message : "Unable to save controlled-substance changes.");
    } finally {
      setSubmitting(false);
    }
  }

  function toggleServiceLine(serviceLineId: ServiceLineId): void {
    setSelectedServiceLines((current) =>
      current.includes(serviceLineId)
        ? current.filter((value) => value !== serviceLineId)
        : [...current, serviceLineId]
    );
  }

  async function handleBootstrapDefaults(): Promise<void> {
    if (!actor) return;
    await runMutation(async () => {
      await apiRequest("/controlled-substances/bootstrap-defaults", actor, { method: "POST" });
    });
  }

  async function handleSave(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!actor) return;

    const payload = {
      title,
      ownerRole,
      supervisingPhysicianRole,
      serviceLineIds: selectedServiceLines,
      linkedPracticeAgreementId: linkedPracticeAgreementId || null,
      prescribingScopeSummary,
      pdmpReviewSummary,
      screeningProtocolSummary,
      refillEscalationSummary,
      inventoryControlSummary,
      patientEducationSummary,
      adverseEventEscalationSummary,
      reviewCadenceDays: Number(reviewCadenceDays),
      effectiveDate: effectiveDate || null,
      notes
    };

    await runMutation(async () => {
      if (editingId) {
        await apiRequest(`/controlled-substances/${editingId}`, actor, {
          method: "PATCH",
          body: JSON.stringify(payload)
        });
      } else {
        await apiRequest("/controlled-substances", actor, {
          method: "POST",
          body: JSON.stringify(payload)
        });
      }
      resetForm();
    });
  }

  async function handleSubmitRecord(recordId: string): Promise<void> {
    if (!actor) return;
    await runMutation(async () => {
      await apiRequest(`/controlled-substances/${recordId}/submit`, actor, { method: "POST" });
    });
  }

  async function handlePublishRecord(recordId: string): Promise<void> {
    if (!actor) return;
    await runMutation(async () => {
      await apiRequest(`/controlled-substances/${recordId}/publish`, actor, { method: "POST" });
    });
  }

  if (!actor) {
    return <div className="card">Sign in to view controlled-substance stewardship.</div>;
  }

  if (!canView) {
    return <div className="card">Your current role cannot access controlled-substance stewardship.</div>;
  }

  return (
    <div className="page-shell">
      <div className="card">
        <div className="section-heading">
          <div>
            <h1>Controlled-Substance Stewardship</h1>
            <p className="muted">
              Maintain prescribing guardrails, refill escalation rules, diversion controls, and physician-oversight expectations through explicit clinical-governance approval.
            </p>
          </div>
          <div className="status-badges">
            <span className="badge badge-info">Drafts: {draftCount}</span>
            <span className="badge badge-success">Published: {records.filter((record) => record.status === "published").length}</span>
          </div>
        </div>
        {error ? <div className="alert alert-error">{error}</div> : null}
      </div>

      <div className="card">
        <div className="section-heading">
          <div>
            <h2>Draft packet</h2>
            <p className="muted">Bootstrap the default packet or maintain a clinic-specific variant before routing it through approval.</p>
          </div>
          {canManage ? (
            <button type="button" className="secondary-button" onClick={() => void handleBootstrapDefaults()} disabled={submitting}>
              Bootstrap default
            </button>
          ) : null}
        </div>
        <form className="stack" onSubmit={(event) => void handleSave(event)}>
          <label>
            Title
            <input value={title} onChange={(event) => setTitle(event.target.value)} disabled={!canManage || submitting} />
          </label>
          <div className="grid two-column">
            <label>
              Owner role
              <select value={ownerRole} onChange={(event) => setOwnerRole(event.target.value as ActorRole)} disabled={!canManage || submitting}>
                {actorRoles.map((role) => <option key={role} value={role}>{role}</option>)}
              </select>
            </label>
            <label>
              Supervising physician role
              <select value={supervisingPhysicianRole} onChange={(event) => setSupervisingPhysicianRole(event.target.value as ActorRole)} disabled={!canManage || submitting}>
                {actorRoles.map((role) => <option key={role} value={role}>{role}</option>)}
              </select>
            </label>
          </div>
          <div className="stack">
            <span className="muted">Service lines</span>
            <div className="chip-grid">
              {serviceLineOptions.map((option) => (
                <label key={option.id} className="chip-option">
                  <input
                    type="checkbox"
                    checked={selectedServiceLines.includes(option.id)}
                    onChange={() => toggleServiceLine(option.id)}
                    disabled={!canManage || submitting}
                  />
                  <span>{option.label}</span>
                </label>
              ))}
            </div>
          </div>
          <label>
            Linked practice agreement
            <select value={linkedPracticeAgreementId} onChange={(event) => setLinkedPracticeAgreementId(event.target.value)} disabled={!canManage || submitting}>
              <option value="">No linked agreement</option>
              {agreements.map((agreement) => (
                <option key={agreement.id} value={agreement.id}>
                  {agreement.title}
                </option>
              ))}
            </select>
          </label>
          <label>
            Prescribing scope
            <textarea value={prescribingScopeSummary} onChange={(event) => setPrescribingScopeSummary(event.target.value)} rows={4} disabled={!canManage || submitting} />
          </label>
          <label>
            PDMP review
            <textarea value={pdmpReviewSummary} onChange={(event) => setPdmpReviewSummary(event.target.value)} rows={4} disabled={!canManage || submitting} />
          </label>
          <label>
            Screening and monitoring
            <textarea value={screeningProtocolSummary} onChange={(event) => setScreeningProtocolSummary(event.target.value)} rows={4} disabled={!canManage || submitting} />
          </label>
          <label>
            Refill escalation
            <textarea value={refillEscalationSummary} onChange={(event) => setRefillEscalationSummary(event.target.value)} rows={4} disabled={!canManage || submitting} />
          </label>
          <label>
            Inventory and diversion controls
            <textarea value={inventoryControlSummary} onChange={(event) => setInventoryControlSummary(event.target.value)} rows={4} disabled={!canManage || submitting} />
          </label>
          <label>
            Patient education
            <textarea value={patientEducationSummary} onChange={(event) => setPatientEducationSummary(event.target.value)} rows={4} disabled={!canManage || submitting} />
          </label>
          <label>
            Adverse-event escalation
            <textarea value={adverseEventEscalationSummary} onChange={(event) => setAdverseEventEscalationSummary(event.target.value)} rows={4} disabled={!canManage || submitting} />
          </label>
          <div className="grid two-column">
            <label>
              Review cadence (days)
              <input value={reviewCadenceDays} onChange={(event) => setReviewCadenceDays(event.target.value)} disabled={!canManage || submitting} />
            </label>
            <label>
              Effective date
              <input type="date" value={effectiveDate} onChange={(event) => setEffectiveDate(event.target.value)} disabled={!canManage || submitting} />
            </label>
          </div>
          <label>
            Notes
            <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} disabled={!canManage || submitting} />
          </label>
          {canManage ? (
            <div className="actions">
              <button type="submit" className="primary-button" disabled={submitting}>
                {editingId ? "Save packet" : "Create packet"}
              </button>
              <button type="button" className="secondary-button" onClick={resetForm} disabled={submitting}>
                Reset
              </button>
            </div>
          ) : null}
        </form>
      </div>

      <div className="card">
        <h2>Packets</h2>
        {loading ? <p className="muted">Loading…</p> : null}
        <div className="stack">
          {records.map((record) => (
            <article key={record.id} className="card subtle-card">
              <div className="section-heading">
                <div>
                  <h3>{record.title}</h3>
                  <p className="muted">
                    {record.serviceLineIds.join(", ")} / owner {record.ownerRole} / supervising {record.supervisingPhysicianRole}
                  </p>
                </div>
                <div className="status-badges">
                  <span className="badge badge-info">{record.status}</span>
                  {record.reviewDueAt ? <span className="badge badge-warning">Review due {record.reviewDueAt.slice(0, 10)}</span> : null}
                </div>
              </div>
              <p>{record.prescribingScopeSummary}</p>
              <div className="actions">
                {canManage && ["draft", "sent_back"].includes(record.status) ? (
                  <button type="button" className="secondary-button" onClick={() => loadIntoForm(record)} disabled={submitting}>
                    Edit draft
                  </button>
                ) : null}
                {canManage && ["draft", "sent_back"].includes(record.status) ? (
                  <button type="button" className="secondary-button" onClick={() => void handleSubmitRecord(record.id)} disabled={submitting}>
                    Submit for approval
                  </button>
                ) : null}
                {canManage && record.status === "approved" ? (
                  <button type="button" className="secondary-button" onClick={() => void handlePublishRecord(record.id)} disabled={submitting}>
                    Publish
                  </button>
                ) : null}
                {record.publishedPath ? (
                  <a className="secondary-button" href={record.publishedPath} target="_blank" rel="noreferrer">
                    Open published artifact
                  </a>
                ) : null}
              </div>
            </article>
          ))}
          {!loading && records.length === 0 ? <p className="muted">No stewardship packets yet.</p> : null}
        </div>
      </div>
    </div>
  );
}
