"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useAppAuth } from "../../components/auth-provider";
import { apiRequest, type ActorRole } from "../../lib/api";

type AccreditationDomain =
  | "leadership"
  | "medication_management"
  | "infection_prevention"
  | "staff_competency"
  | "environment_of_care"
  | "documentation"
  | "rights_education"
  | "lab_testing"
  | "emergency_preparedness"
  | "custom";

type StandardMappingRecord = {
  id: string;
  standardCode: string;
  title: string;
  domain: AccreditationDomain;
  sourceAuthority: string;
  ownerRole: ActorRole;
  status: "not_started" | "mapped" | "evidence_ready" | "review_pending" | "complete" | "attention_needed";
  requirementSummary: string;
  evidenceExpectation: string;
  evidenceDocumentIds: string[];
  latestBinderId: string | null;
  reviewCadenceDays: number;
  lastReviewedAt: string | null;
  nextReviewDueAt: string | null;
  notes: string | null;
};

type EvidenceBinderRecord = {
  id: string;
  title: string;
  ownerRole: ActorRole;
  status: "draft" | "approval_pending" | "approved" | "publish_pending" | "published" | "sent_back" | "archived";
  sourceAuthority: string;
  surveyWindowLabel: string | null;
  standardIds: string[];
  summary: string;
  evidenceReadinessSummary: string;
  openGapSummary: string;
  reviewCadenceDays: number;
  notes: string | null;
  documentId: string | null;
  workflowRunId: string | null;
  publishedAt: string | null;
  publishedPath: string | null;
};

const actorRoles: ActorRole[] = [
  "medical_director",
  "quality_lead",
  "hr_lead",
  "cfo",
  "office_manager",
  "patient_care_team_physician",
  "nurse_practitioner",
  "medical_assistant",
  "front_desk"
];

const domainOptions: AccreditationDomain[] = [
  "leadership",
  "medication_management",
  "infection_prevention",
  "staff_competency",
  "environment_of_care",
  "documentation",
  "rights_education",
  "lab_testing",
  "emergency_preparedness",
  "custom"
];

export default function StandardsPage(): JSX.Element {
  const { actor, hasCapability } = useAppAuth();
  const [standards, setStandards] = useState<StandardMappingRecord[]>([]);
  const [binders, setBinders] = useState<EvidenceBinderRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingStandardId, setEditingStandardId] = useState<string | null>(null);
  const [editingBinderId, setEditingBinderId] = useState<string | null>(null);

  const [standardCode, setStandardCode] = useState("MM.03.01.01");
  const [standardTitle, setStandardTitle] = useState("Medication management oversight");
  const [standardDomain, setStandardDomain] = useState<AccreditationDomain>("medication_management");
  const [sourceAuthority, setSourceAuthority] = useState("Joint Commission Mock Survey");
  const [standardOwnerRole, setStandardOwnerRole] = useState<ActorRole>("quality_lead");
  const [requirementSummary, setRequirementSummary] = useState("Define how the clinic governs medication handling, review cadence, escalation, and documentation for higher-risk medication workflows.");
  const [evidenceExpectation, setEvidenceExpectation] = useState("Current stewardship policy, approval trail, recent review packet, and follow-up actions tied to medication-management oversight.");
  const [standardReviewCadenceDays, setStandardReviewCadenceDays] = useState("90");
  const [standardNotes, setStandardNotes] = useState("Keep this mapping aligned with the latest binder and committee evidence.");

  const [binderTitle, setBinderTitle] = useState("Mock survey evidence binder");
  const [binderOwnerRole, setBinderOwnerRole] = useState<ActorRole>("quality_lead");
  const [binderSourceAuthority, setBinderSourceAuthority] = useState("Joint Commission Mock Survey");
  const [surveyWindowLabel, setSurveyWindowLabel] = useState("Pilot readiness mock survey");
  const [selectedStandardIds, setSelectedStandardIds] = useState<string[]>([]);
  const [binderSummary, setBinderSummary] = useState("Assemble the core survey-readiness evidence trail across mapped standards and the most recent approved governance artifacts.");
  const [evidenceReadinessSummary, setEvidenceReadinessSummary] = useState("Each mapped standard should point to a current artifact, recent review evidence, and a named owner responsible for keeping the binder current.");
  const [openGapSummary, setOpenGapSummary] = useState("Track missing signatures, stale policy versions, delayed committee review artifacts, or competency follow-up gaps before treating the binder as survey-ready.");
  const [binderReviewCadenceDays, setBinderReviewCadenceDays] = useState("60");
  const [binderNotes, setBinderNotes] = useState("Use this as the current mock-survey packet until broader standards coverage is needed.");

  const canView = hasCapability("standards.view");
  const canManage = hasCapability("standards.manage");

  const completeCount = useMemo(
    () => standards.filter((standard) => standard.status === "complete").length,
    [standards]
  );

  function resetStandardForm(): void {
    setEditingStandardId(null);
    setStandardCode("MM.03.01.01");
    setStandardTitle("Medication management oversight");
    setStandardDomain("medication_management");
    setSourceAuthority("Joint Commission Mock Survey");
    setStandardOwnerRole("quality_lead");
    setRequirementSummary("Define how the clinic governs medication handling, review cadence, escalation, and documentation for higher-risk medication workflows.");
    setEvidenceExpectation("Current stewardship policy, approval trail, recent review packet, and follow-up actions tied to medication-management oversight.");
    setStandardReviewCadenceDays("90");
    setStandardNotes("Keep this mapping aligned with the latest binder and committee evidence.");
  }

  function resetBinderForm(): void {
    setEditingBinderId(null);
    setBinderTitle("Mock survey evidence binder");
    setBinderOwnerRole("quality_lead");
    setBinderSourceAuthority("Joint Commission Mock Survey");
    setSurveyWindowLabel("Pilot readiness mock survey");
    setSelectedStandardIds((current) => current.length > 0 ? current : standards.slice(0, 4).map((standard) => standard.id));
    setBinderSummary("Assemble the core survey-readiness evidence trail across mapped standards and the most recent approved governance artifacts.");
    setEvidenceReadinessSummary("Each mapped standard should point to a current artifact, recent review evidence, and a named owner responsible for keeping the binder current.");
    setOpenGapSummary("Track missing signatures, stale policy versions, delayed committee review artifacts, or competency follow-up gaps before treating the binder as survey-ready.");
    setBinderReviewCadenceDays("60");
    setBinderNotes("Use this as the current mock-survey packet until broader standards coverage is needed.");
  }

  function loadStandardIntoForm(record: StandardMappingRecord): void {
    setEditingStandardId(record.id);
    setStandardCode(record.standardCode);
    setStandardTitle(record.title);
    setStandardDomain(record.domain);
    setSourceAuthority(record.sourceAuthority);
    setStandardOwnerRole(record.ownerRole);
    setRequirementSummary(record.requirementSummary);
    setEvidenceExpectation(record.evidenceExpectation);
    setStandardReviewCadenceDays(String(record.reviewCadenceDays));
    setStandardNotes(record.notes ?? "");
  }

  function loadBinderIntoForm(record: EvidenceBinderRecord): void {
    setEditingBinderId(record.id);
    setBinderTitle(record.title);
    setBinderOwnerRole(record.ownerRole);
    setBinderSourceAuthority(record.sourceAuthority);
    setSurveyWindowLabel(record.surveyWindowLabel ?? "");
    setSelectedStandardIds(record.standardIds);
    setBinderSummary(record.summary);
    setEvidenceReadinessSummary(record.evidenceReadinessSummary);
    setOpenGapSummary(record.openGapSummary);
    setBinderReviewCadenceDays(String(record.reviewCadenceDays));
    setBinderNotes(record.notes ?? "");
  }

  async function loadData(): Promise<void> {
    if (!actor || !canView) {
      return;
    }
    setLoading(true);
    try {
      const [nextStandards, nextBinders] = await Promise.all([
        apiRequest<StandardMappingRecord[]>("/standards", actor),
        apiRequest<EvidenceBinderRecord[]>("/evidence-binders", actor)
      ]);
      setStandards(nextStandards);
      setBinders(nextBinders);
      setSelectedStandardIds((current) => current.length > 0 ? current : nextStandards.slice(0, 4).map((standard) => standard.id));
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load standards tooling.");
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
      setError(mutationError instanceof Error ? mutationError.message : "Unable to save standards tooling changes.");
    } finally {
      setSubmitting(false);
    }
  }

  function toggleStandardSelection(standardId: string): void {
    setSelectedStandardIds((current) =>
      current.includes(standardId)
        ? current.filter((value) => value !== standardId)
        : [...current, standardId]
    );
  }

  async function handleBootstrapStandards(): Promise<void> {
    if (!actor) return;
    await runMutation(async () => {
      await apiRequest("/standards/bootstrap-defaults", actor, { method: "POST" });
    });
  }

  async function handleBootstrapBinder(): Promise<void> {
    if (!actor) return;
    await runMutation(async () => {
      await apiRequest("/evidence-binders/bootstrap-defaults", actor, { method: "POST" });
    });
  }

  async function handleSaveStandard(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!actor) return;
    const payload = {
      standardCode,
      title: standardTitle,
      domain: standardDomain,
      sourceAuthority,
      ownerRole: standardOwnerRole,
      requirementSummary,
      evidenceExpectation,
      reviewCadenceDays: Number(standardReviewCadenceDays),
      notes: standardNotes
    };

    await runMutation(async () => {
      if (editingStandardId) {
        await apiRequest(`/standards/${editingStandardId}`, actor, {
          method: "PATCH",
          body: JSON.stringify(payload)
        });
      } else {
        await apiRequest("/standards", actor, {
          method: "POST",
          body: JSON.stringify(payload)
        });
      }
      resetStandardForm();
    });
  }

  async function handleSaveBinder(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!actor) return;
    const payload = {
      title: binderTitle,
      ownerRole: binderOwnerRole,
      sourceAuthority: binderSourceAuthority,
      surveyWindowLabel: surveyWindowLabel || null,
      standardIds: selectedStandardIds,
      summary: binderSummary,
      evidenceReadinessSummary,
      openGapSummary,
      reviewCadenceDays: Number(binderReviewCadenceDays),
      notes: binderNotes
    };

    await runMutation(async () => {
      if (editingBinderId) {
        await apiRequest(`/evidence-binders/${editingBinderId}`, actor, {
          method: "PATCH",
          body: JSON.stringify(payload)
        });
      } else {
        await apiRequest("/evidence-binders", actor, {
          method: "POST",
          body: JSON.stringify(payload)
        });
      }
      resetBinderForm();
    });
  }

  async function handleSubmitBinder(binderId: string): Promise<void> {
    if (!actor) return;
    await runMutation(async () => {
      await apiRequest(`/evidence-binders/${binderId}/submit`, actor, { method: "POST" });
    });
  }

  async function handlePublishBinder(binderId: string): Promise<void> {
    if (!actor) return;
    await runMutation(async () => {
      await apiRequest(`/evidence-binders/${binderId}/publish`, actor, { method: "POST" });
    });
  }

  if (!actor) {
    return <div className="card">Sign in to view standards mapping and evidence binders.</div>;
  }

  if (!canView) {
    return <div className="card">Your current role cannot access standards mapping and evidence binders.</div>;
  }

  return (
    <div className="page-shell">
      <div className="card">
        <div className="section-heading">
          <div>
            <h1>Standards Mapping and Evidence Binders</h1>
            <p className="muted">
              Maintain a survey-ready standards registry, then bundle current evidence into approval-backed binders before treating anything as accreditation-ready.
            </p>
          </div>
          <div className="status-badges">
            <span className="badge badge-info">Mapped standards: {standards.length}</span>
            <span className="badge badge-success">Complete standards: {completeCount}</span>
          </div>
        </div>
        {error ? <div className="alert alert-error">{error}</div> : null}
      </div>

      <div className="grid two-column">
        <div className="card">
          <div className="section-heading">
            <div>
              <h2>Standards registry</h2>
              <p className="muted">Capture the requirement, owner, and evidence expectation for each survey standard.</p>
            </div>
            {canManage ? (
              <button type="button" className="secondary-button" onClick={() => void handleBootstrapStandards()} disabled={submitting}>
                Bootstrap defaults
              </button>
            ) : null}
          </div>
          <form className="stack" onSubmit={(event) => void handleSaveStandard(event)}>
            <div className="grid two-column">
              <label>
                Standard code
                <input value={standardCode} onChange={(event) => setStandardCode(event.target.value)} disabled={!canManage || submitting} />
              </label>
              <label>
                Source authority
                <input value={sourceAuthority} onChange={(event) => setSourceAuthority(event.target.value)} disabled={!canManage || submitting} />
              </label>
            </div>
            <label>
              Title
              <input value={standardTitle} onChange={(event) => setStandardTitle(event.target.value)} disabled={!canManage || submitting} />
            </label>
            <div className="grid two-column">
              <label>
                Domain
                <select value={standardDomain} onChange={(event) => setStandardDomain(event.target.value as AccreditationDomain)} disabled={!canManage || submitting}>
                  {domainOptions.map((domain) => <option key={domain} value={domain}>{domain}</option>)}
                </select>
              </label>
              <label>
                Owner role
                <select value={standardOwnerRole} onChange={(event) => setStandardOwnerRole(event.target.value as ActorRole)} disabled={!canManage || submitting}>
                  {actorRoles.map((role) => <option key={role} value={role}>{role}</option>)}
                </select>
              </label>
            </div>
            <label>
              Requirement summary
              <textarea value={requirementSummary} onChange={(event) => setRequirementSummary(event.target.value)} rows={4} disabled={!canManage || submitting} />
            </label>
            <label>
              Evidence expectation
              <textarea value={evidenceExpectation} onChange={(event) => setEvidenceExpectation(event.target.value)} rows={4} disabled={!canManage || submitting} />
            </label>
            <div className="grid two-column">
              <label>
                Review cadence (days)
                <input value={standardReviewCadenceDays} onChange={(event) => setStandardReviewCadenceDays(event.target.value)} disabled={!canManage || submitting} />
              </label>
            </div>
            <label>
              Notes
              <textarea value={standardNotes} onChange={(event) => setStandardNotes(event.target.value)} rows={3} disabled={!canManage || submitting} />
            </label>
            {canManage ? (
              <div className="actions">
                <button type="submit" className="primary-button" disabled={submitting}>
                  {editingStandardId ? "Save standard" : "Add standard"}
                </button>
                <button type="button" className="secondary-button" onClick={resetStandardForm} disabled={submitting}>
                  Reset
                </button>
              </div>
            ) : null}
          </form>
        </div>

        <div className="card">
          <div className="section-heading">
            <div>
              <h2>Evidence binders</h2>
              <p className="muted">Bundle mapped standards into a survey-ready binder, then route it through approval before publication.</p>
            </div>
            {canManage ? (
              <button type="button" className="secondary-button" onClick={() => void handleBootstrapBinder()} disabled={submitting}>
                Bootstrap binder
              </button>
            ) : null}
          </div>
          <form className="stack" onSubmit={(event) => void handleSaveBinder(event)}>
            <div className="grid two-column">
              <label>
                Title
                <input value={binderTitle} onChange={(event) => setBinderTitle(event.target.value)} disabled={!canManage || submitting} />
              </label>
              <label>
                Owner role
                <select value={binderOwnerRole} onChange={(event) => setBinderOwnerRole(event.target.value as ActorRole)} disabled={!canManage || submitting}>
                  {actorRoles.map((role) => <option key={role} value={role}>{role}</option>)}
                </select>
              </label>
            </div>
            <div className="grid two-column">
              <label>
                Source authority
                <input value={binderSourceAuthority} onChange={(event) => setBinderSourceAuthority(event.target.value)} disabled={!canManage || submitting} />
              </label>
              <label>
                Survey window
                <input value={surveyWindowLabel} onChange={(event) => setSurveyWindowLabel(event.target.value)} disabled={!canManage || submitting} />
              </label>
            </div>
            <div className="stack">
              <span className="muted">Included standards</span>
              <div className="chip-grid">
                {standards.map((standard) => (
                  <label key={standard.id} className="chip-option">
                    <input
                      type="checkbox"
                      checked={selectedStandardIds.includes(standard.id)}
                      onChange={() => toggleStandardSelection(standard.id)}
                      disabled={!canManage || submitting}
                    />
                    <span>{standard.standardCode}</span>
                  </label>
                ))}
              </div>
            </div>
            <label>
              Binder summary
              <textarea value={binderSummary} onChange={(event) => setBinderSummary(event.target.value)} rows={3} disabled={!canManage || submitting} />
            </label>
            <label>
              Evidence readiness summary
              <textarea value={evidenceReadinessSummary} onChange={(event) => setEvidenceReadinessSummary(event.target.value)} rows={3} disabled={!canManage || submitting} />
            </label>
            <label>
              Open gaps
              <textarea value={openGapSummary} onChange={(event) => setOpenGapSummary(event.target.value)} rows={3} disabled={!canManage || submitting} />
            </label>
            <div className="grid two-column">
              <label>
                Review cadence (days)
                <input value={binderReviewCadenceDays} onChange={(event) => setBinderReviewCadenceDays(event.target.value)} disabled={!canManage || submitting} />
              </label>
            </div>
            <label>
              Notes
              <textarea value={binderNotes} onChange={(event) => setBinderNotes(event.target.value)} rows={3} disabled={!canManage || submitting} />
            </label>
            {canManage ? (
              <div className="actions">
                <button type="submit" className="primary-button" disabled={submitting}>
                  {editingBinderId ? "Save binder" : "Create binder"}
                </button>
                <button type="button" className="secondary-button" onClick={resetBinderForm} disabled={submitting}>
                  Reset
                </button>
              </div>
            ) : null}
          </form>
        </div>
      </div>

      <div className="card">
        <h2>Registry</h2>
        {loading ? <p className="muted">Loading…</p> : null}
        <div className="stack">
          {standards.map((standard) => (
            <article key={standard.id} className="card subtle-card">
              <div className="section-heading">
                <div>
                  <h3>{standard.standardCode} - {standard.title}</h3>
                  <p className="muted">{standard.domain} / owner {standard.ownerRole} / {standard.sourceAuthority}</p>
                </div>
                <div className="status-badges">
                  <span className="badge badge-info">{standard.status}</span>
                  {standard.nextReviewDueAt ? <span className="badge badge-warning">Next review {standard.nextReviewDueAt.slice(0, 10)}</span> : null}
                </div>
              </div>
              <p>{standard.requirementSummary}</p>
              {canManage ? (
                <div className="actions">
                  <button type="button" className="secondary-button" onClick={() => loadStandardIntoForm(standard)} disabled={submitting}>
                    Edit mapping
                  </button>
                </div>
              ) : null}
            </article>
          ))}
          {!loading && standards.length === 0 ? <p className="muted">No standards mapped yet.</p> : null}
        </div>
      </div>

      <div className="card">
        <h2>Binders</h2>
        <div className="stack">
          {binders.map((binder) => (
            <article key={binder.id} className="card subtle-card">
              <div className="section-heading">
                <div>
                  <h3>{binder.title}</h3>
                  <p className="muted">{binder.sourceAuthority} / owner {binder.ownerRole} / standards {binder.standardIds.length}</p>
                </div>
                <div className="status-badges">
                  <span className="badge badge-info">{binder.status}</span>
                </div>
              </div>
              <p>{binder.summary}</p>
              <div className="actions">
                {canManage && ["draft", "sent_back"].includes(binder.status) ? (
                  <button type="button" className="secondary-button" onClick={() => loadBinderIntoForm(binder)} disabled={submitting}>
                    Edit binder
                  </button>
                ) : null}
                {canManage && ["draft", "sent_back"].includes(binder.status) ? (
                  <button type="button" className="secondary-button" onClick={() => void handleSubmitBinder(binder.id)} disabled={submitting}>
                    Submit for approval
                  </button>
                ) : null}
                {canManage && binder.status === "approved" ? (
                  <button type="button" className="secondary-button" onClick={() => void handlePublishBinder(binder.id)} disabled={submitting}>
                    Publish
                  </button>
                ) : null}
                {binder.publishedPath ? (
                  <a className="secondary-button" href={binder.publishedPath} target="_blank" rel="noreferrer">
                    Open published binder
                  </a>
                ) : null}
              </div>
            </article>
          ))}
          {!loading && binders.length === 0 ? <p className="muted">No evidence binders yet.</p> : null}
        </div>
      </div>
    </div>
  );
}
