"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { apiRequest, type ActorRole } from "../../lib/api";
import { useAppAuth } from "../../components/auth-provider";

type PracticeAgreementSummary = {
  id: string;
  title: string;
  status: string;
};

type TelehealthStewardshipRecord = {
  id: string;
  serviceLineId: "telehealth";
  title: string;
  ownerRole: ActorRole;
  supervisingPhysicianRole: ActorRole;
  status: "draft" | "approval_pending" | "approved" | "publish_pending" | "published" | "sent_back" | "archived";
  linkedPracticeAgreementId: string | null;
  delegatedTaskCodes: string[];
  modalityScopeSummary: string;
  stateCoverageSummary: string;
  patientIdentitySummary: string;
  consentWorkflowSummary: string;
  documentationStandardSummary: string;
  emergencyRedirectSummary: string;
  qaReviewSummary: string;
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

export default function TelehealthStewardshipPage(): JSX.Element {
  const { actor, hasCapability } = useAppAuth();
  const [records, setRecords] = useState<TelehealthStewardshipRecord[]>([]);
  const [agreements, setAgreements] = useState<PracticeAgreementSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [title, setTitle] = useState("Telehealth stewardship packet");
  const [ownerRole, setOwnerRole] = useState<ActorRole>("medical_director");
  const [supervisingPhysicianRole, setSupervisingPhysicianRole] = useState<ActorRole>("patient_care_team_physician");
  const [linkedPracticeAgreementId, setLinkedPracticeAgreementId] = useState("");
  const [delegatedTaskCodes, setDelegatedTaskCodes] = useState("virtual_triage, refill_review, asynchronous_follow_up");
  const [modalityScopeSummary, setModalityScopeSummary] = useState("Cover synchronous visits, asynchronous refill review, secure messaging follow-up, and after-hours escalation boundaries for telehealth care.");
  const [stateCoverageSummary, setStateCoverageSummary] = useState("Maintain a current licensure-and-service-state matrix, pause unsupported scheduling, and escalate state-coverage exceptions before booking.");
  const [patientIdentitySummary, setPatientIdentitySummary] = useState("Verify patient identity, current location, callback number, and emergency contact before clinical decision-making or medication changes.");
  const [consentWorkflowSummary, setConsentWorkflowSummary] = useState("Capture telehealth consent at intake, reaffirm when workflows change, and document interpreter or caregiver participation.");
  const [documentationStandardSummary, setDocumentationStandardSummary] = useState("Document modality, patient location, supervising availability, escalation decisions, and any protocol deviations in every telehealth encounter.");
  const [emergencyRedirectSummary, setEmergencyRedirectSummary] = useState("Redirect emergent symptoms to local EMS or urgent in-person evaluation immediately, with documented warm handoff and same-day physician notice.");
  const [qaReviewSummary, setQaReviewSummary] = useState("Review telehealth charts monthly for consent capture, documentation completeness, protocol adherence, and escalation timeliness.");
  const [reviewCadenceDays, setReviewCadenceDays] = useState("60");
  const [effectiveDate, setEffectiveDate] = useState("");
  const [notes, setNotes] = useState("Keep this packet aligned with the current telehealth service-line pack, practice agreement, and delegation matrix.");

  const canView = hasCapability("telehealth.view");
  const canManage = hasCapability("telehealth.manage");

  const draftCount = useMemo(
    () => records.filter((record) => ["draft", "sent_back"].includes(record.status)).length,
    [records]
  );

  function resetForm(): void {
    setEditingId(null);
    setTitle("Telehealth stewardship packet");
    setOwnerRole("medical_director");
    setSupervisingPhysicianRole("patient_care_team_physician");
    setLinkedPracticeAgreementId("");
    setDelegatedTaskCodes("virtual_triage, refill_review, asynchronous_follow_up");
    setModalityScopeSummary("Cover synchronous visits, asynchronous refill review, secure messaging follow-up, and after-hours escalation boundaries for telehealth care.");
    setStateCoverageSummary("Maintain a current licensure-and-service-state matrix, pause unsupported scheduling, and escalate state-coverage exceptions before booking.");
    setPatientIdentitySummary("Verify patient identity, current location, callback number, and emergency contact before clinical decision-making or medication changes.");
    setConsentWorkflowSummary("Capture telehealth consent at intake, reaffirm when workflows change, and document interpreter or caregiver participation.");
    setDocumentationStandardSummary("Document modality, patient location, supervising availability, escalation decisions, and any protocol deviations in every telehealth encounter.");
    setEmergencyRedirectSummary("Redirect emergent symptoms to local EMS or urgent in-person evaluation immediately, with documented warm handoff and same-day physician notice.");
    setQaReviewSummary("Review telehealth charts monthly for consent capture, documentation completeness, protocol adherence, and escalation timeliness.");
    setReviewCadenceDays("60");
    setEffectiveDate("");
    setNotes("Keep this packet aligned with the current telehealth service-line pack, practice agreement, and delegation matrix.");
  }

  function loadIntoForm(record: TelehealthStewardshipRecord): void {
    setEditingId(record.id);
    setTitle(record.title);
    setOwnerRole(record.ownerRole);
    setSupervisingPhysicianRole(record.supervisingPhysicianRole);
    setLinkedPracticeAgreementId(record.linkedPracticeAgreementId ?? "");
    setDelegatedTaskCodes(record.delegatedTaskCodes.join(", "));
    setModalityScopeSummary(record.modalityScopeSummary);
    setStateCoverageSummary(record.stateCoverageSummary);
    setPatientIdentitySummary(record.patientIdentitySummary);
    setConsentWorkflowSummary(record.consentWorkflowSummary);
    setDocumentationStandardSummary(record.documentationStandardSummary);
    setEmergencyRedirectSummary(record.emergencyRedirectSummary);
    setQaReviewSummary(record.qaReviewSummary);
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
        apiRequest<TelehealthStewardshipRecord[]>("/telehealth-stewardship", actor),
        apiRequest<PracticeAgreementSummary[]>("/practice-agreements?serviceLineId=telehealth", actor)
      ]);
      setRecords(nextRecords);
      setAgreements(nextAgreements);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load telehealth stewardship data.");
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
      setError(mutationError instanceof Error ? mutationError.message : "Unable to save telehealth stewardship changes.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleBootstrapDefaults(): Promise<void> {
    if (!actor) return;
    await runMutation(async () => {
      await apiRequest("/telehealth-stewardship/bootstrap-defaults", actor, {
        method: "POST"
      });
    });
  }

  async function handleSave(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!actor) return;

    const payload = {
      title,
      ownerRole,
      supervisingPhysicianRole,
      linkedPracticeAgreementId: linkedPracticeAgreementId || null,
      delegatedTaskCodes: delegatedTaskCodes.split(",").map((value) => value.trim()).filter(Boolean),
      modalityScopeSummary,
      stateCoverageSummary,
      patientIdentitySummary,
      consentWorkflowSummary,
      documentationStandardSummary,
      emergencyRedirectSummary,
      qaReviewSummary,
      reviewCadenceDays: Number(reviewCadenceDays),
      effectiveDate: effectiveDate || null,
      notes
    };

    await runMutation(async () => {
      if (editingId) {
        await apiRequest(`/telehealth-stewardship/${editingId}`, actor, {
          method: "PATCH",
          body: JSON.stringify(payload)
        });
      } else {
        await apiRequest("/telehealth-stewardship", actor, {
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
      await apiRequest(`/telehealth-stewardship/${recordId}/submit`, actor, { method: "POST" });
    });
  }

  async function handlePublishRecord(recordId: string): Promise<void> {
    if (!actor) return;
    await runMutation(async () => {
      await apiRequest(`/telehealth-stewardship/${recordId}/publish`, actor, { method: "POST" });
    });
  }

  if (!actor) {
    return <div className="card">Sign in to view telehealth stewardship.</div>;
  }

  if (!canView) {
    return <div className="card">Your current role cannot access telehealth stewardship.</div>;
  }

  return (
    <div className="page-shell">
      <div className="card">
        <div className="section-heading">
          <div>
            <h1>Telehealth Stewardship</h1>
            <p className="muted">
              Tie telehealth scope, consent, identity verification, documentation, and emergency redirect rules to the current oversight agreement.
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
            <p className="muted">Bootstrap the default telehealth packet or maintain a clinic-specific variant before sending it through approval.</p>
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
          <label>
            Owner role
            <select value={ownerRole} onChange={(event) => setOwnerRole(event.target.value as ActorRole)} disabled={!canManage || submitting}>
              {actorRoles.map((role) => (
                <option key={role} value={role}>{role.replaceAll("_", " ")}</option>
              ))}
            </select>
          </label>
          <label>
            Supervising physician role
            <select value={supervisingPhysicianRole} onChange={(event) => setSupervisingPhysicianRole(event.target.value as ActorRole)} disabled={!canManage || submitting}>
              {actorRoles.map((role) => (
                <option key={role} value={role}>{role.replaceAll("_", " ")}</option>
              ))}
            </select>
          </label>
          <label>
            Linked practice agreement
            <select value={linkedPracticeAgreementId} onChange={(event) => setLinkedPracticeAgreementId(event.target.value)} disabled={!canManage || submitting}>
              <option value="">None linked</option>
              {agreements.map((agreement) => (
                <option key={agreement.id} value={agreement.id}>{agreement.title} ({agreement.status})</option>
              ))}
            </select>
          </label>
          <label>
            Delegated task codes
            <input value={delegatedTaskCodes} onChange={(event) => setDelegatedTaskCodes(event.target.value)} disabled={!canManage || submitting} />
          </label>
          <label>
            Modality scope
            <textarea value={modalityScopeSummary} onChange={(event) => setModalityScopeSummary(event.target.value)} rows={3} disabled={!canManage || submitting} />
          </label>
          <label>
            State coverage
            <textarea value={stateCoverageSummary} onChange={(event) => setStateCoverageSummary(event.target.value)} rows={3} disabled={!canManage || submitting} />
          </label>
          <label>
            Patient identity workflow
            <textarea value={patientIdentitySummary} onChange={(event) => setPatientIdentitySummary(event.target.value)} rows={3} disabled={!canManage || submitting} />
          </label>
          <label>
            Consent workflow
            <textarea value={consentWorkflowSummary} onChange={(event) => setConsentWorkflowSummary(event.target.value)} rows={3} disabled={!canManage || submitting} />
          </label>
          <label>
            Documentation standards
            <textarea value={documentationStandardSummary} onChange={(event) => setDocumentationStandardSummary(event.target.value)} rows={3} disabled={!canManage || submitting} />
          </label>
          <label>
            Emergency redirect
            <textarea value={emergencyRedirectSummary} onChange={(event) => setEmergencyRedirectSummary(event.target.value)} rows={3} disabled={!canManage || submitting} />
          </label>
          <label>
            QA review summary
            <textarea value={qaReviewSummary} onChange={(event) => setQaReviewSummary(event.target.value)} rows={3} disabled={!canManage || submitting} />
          </label>
          <label>
            Review cadence (days)
            <input type="number" min={1} max={365} value={reviewCadenceDays} onChange={(event) => setReviewCadenceDays(event.target.value)} disabled={!canManage || submitting} />
          </label>
          <label>
            Effective date
            <input type="date" value={effectiveDate} onChange={(event) => setEffectiveDate(event.target.value)} disabled={!canManage || submitting} />
          </label>
          <label>
            Notes
            <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} disabled={!canManage || submitting} />
          </label>
          {canManage ? (
            <div className="button-row">
              <button type="submit" className="primary-button" disabled={submitting}>
                {editingId ? "Save changes" : "Create packet"}
              </button>
              <button type="button" className="secondary-button" onClick={resetForm} disabled={submitting}>
                Reset
              </button>
            </div>
          ) : null}
        </form>
      </div>

      <div className="card">
        <div className="section-heading">
          <div>
            <h2>Packets</h2>
            <p className="muted">Published packets become the approved telehealth operating baseline.</p>
          </div>
        </div>
        {loading ? <div className="muted">Loading telehealth stewardship packets...</div> : null}
        {!loading && records.length === 0 ? <div className="muted">No telehealth stewardship packets have been drafted yet.</div> : null}
        <div className="stack">
          {records.map((record) => (
            <div key={record.id} className="list-row">
              <div>
                <div className="list-row-title">{record.title}</div>
                <div className="muted">
                  {record.status.replaceAll("_", " ")} · owner {record.ownerRole.replaceAll("_", " ")} · review every {record.reviewCadenceDays} days
                </div>
                <div className="muted">Delegated tasks: {record.delegatedTaskCodes.length > 0 ? record.delegatedTaskCodes.join(", ") : "none linked"}</div>
                {record.publishedPath ? (
                  <a href={record.publishedPath} target="_blank" rel="noreferrer">Open published packet</a>
                ) : null}
              </div>
              <div className="button-row">
                {canManage && ["draft", "sent_back"].includes(record.status) ? (
                  <>
                    <button type="button" className="secondary-button" onClick={() => loadIntoForm(record)} disabled={submitting}>Edit</button>
                    <button type="button" className="secondary-button" onClick={() => void handleSubmitRecord(record.id)} disabled={submitting}>Submit</button>
                  </>
                ) : null}
                {canManage && record.status === "approved" ? (
                  <button type="button" className="primary-button" onClick={() => void handlePublishRecord(record.id)} disabled={submitting}>Publish</button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
