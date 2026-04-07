"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { apiRequest, type ActorRole } from "../../lib/api";
import { useAppAuth } from "../../components/auth-provider";

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

type PracticeAgreementRecord = {
  id: string;
  title: string;
  agreementType: "practice_agreement" | "physician_oversight_plan" | "standing_order_supervision";
  status: "draft" | "approval_pending" | "approved" | "publish_pending" | "published" | "sent_back" | "archived" | "expired";
  ownerRole: ActorRole;
  supervisingPhysicianName: string;
  supervisingPhysicianRole: ActorRole;
  supervisedRole: ActorRole;
  serviceLineIds: ServiceLineId[];
  scopeSummary: string;
  delegatedActivitiesSummary: string;
  cosignExpectation: string;
  escalationProtocol: string;
  reviewCadenceDays: number;
  effectiveDate: string | null;
  reviewDueAt: string | null;
  expiresAt: string | null;
  notes: string | null;
  documentId: string | null;
  workflowRunId: string | null;
  publishedAt: string | null;
  publishedPath: string | null;
};

const serviceLineOptions: Array<{ id: ServiceLineId; label: string }> = [
  { id: "primary_care", label: "Primary care" },
  { id: "women_health", label: "Women's health" },
  { id: "telehealth", label: "Telehealth" },
  { id: "weight_management", label: "Weight management" },
  { id: "hrt", label: "HRT" },
  { id: "vaccines", label: "Vaccines" },
  { id: "waived_testing", label: "Waived testing" },
  { id: "contracted_lab", label: "Contracted lab" },
  { id: "iv_hydration", label: "IV hydration" },
  { id: "aesthetics", label: "Aesthetics" },
  { id: "allergy_testing", label: "Allergy testing" }
];

const actorRoles: ActorRole[] = [
  "medical_director",
  "quality_lead",
  "office_manager",
  "hr_lead",
  "cfo",
  "patient_care_team_physician",
  "nurse_practitioner",
  "medical_assistant",
  "front_desk"
];

export default function PracticeAgreementsPage(): JSX.Element {
  const { actor, hasCapability } = useAppAuth();
  const [agreements, setAgreements] = useState<PracticeAgreementRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [title, setTitle] = useState("Telehealth physician oversight agreement");
  const [agreementType, setAgreementType] = useState<PracticeAgreementRecord["agreementType"]>("physician_oversight_plan");
  const [ownerRole, setOwnerRole] = useState<ActorRole>("medical_director");
  const [supervisingPhysicianName, setSupervisingPhysicianName] = useState("Assigned supervising physician");
  const [supervisingPhysicianRole, setSupervisingPhysicianRole] = useState<ActorRole>("patient_care_team_physician");
  const [supervisedRole, setSupervisedRole] = useState<ActorRole>("nurse_practitioner");
  const [selectedServiceLines, setSelectedServiceLines] = useState<ServiceLineId[]>(["telehealth"]);
  const [scopeSummary, setScopeSummary] = useState("Define the physician-oversight boundary, escalation path, and review cadence for the supervised role.");
  const [delegatedActivitiesSummary, setDelegatedActivitiesSummary] = useState("List the protocol-guided activities, documentation expectations, and escalation triggers that remain inside the supervised scope.");
  const [cosignExpectation, setCosignExpectation] = useState("Physician cosign is required for new-start plans, protocol exceptions, and charts selected for physician review.");
  const [escalationProtocol, setEscalationProtocol] = useState("Escalate same-day for red-flag findings, adverse reactions, protocol exceptions, or any uncertainty about scope.");
  const [reviewCadenceDays, setReviewCadenceDays] = useState("60");
  const [effectiveDate, setEffectiveDate] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [notes, setNotes] = useState("Pair this agreement with the current delegation matrix and service-line governance pack.");

  const canView = hasCapability("practice_agreements.view");
  const canManage = hasCapability("practice_agreements.manage");

  const draftCount = useMemo(
    () => agreements.filter((agreement) => ["draft", "sent_back"].includes(agreement.status)).length,
    [agreements]
  );

  function resetForm(): void {
    setEditingId(null);
    setTitle("Telehealth physician oversight agreement");
    setAgreementType("physician_oversight_plan");
    setOwnerRole("medical_director");
    setSupervisingPhysicianName("Assigned supervising physician");
    setSupervisingPhysicianRole("patient_care_team_physician");
    setSupervisedRole("nurse_practitioner");
    setSelectedServiceLines(["telehealth"]);
    setScopeSummary("Define the physician-oversight boundary, escalation path, and review cadence for the supervised role.");
    setDelegatedActivitiesSummary("List the protocol-guided activities, documentation expectations, and escalation triggers that remain inside the supervised scope.");
    setCosignExpectation("Physician cosign is required for new-start plans, protocol exceptions, and charts selected for physician review.");
    setEscalationProtocol("Escalate same-day for red-flag findings, adverse reactions, protocol exceptions, or any uncertainty about scope.");
    setReviewCadenceDays("60");
    setEffectiveDate("");
    setExpiresAt("");
    setNotes("Pair this agreement with the current delegation matrix and service-line governance pack.");
  }

  function loadIntoForm(agreement: PracticeAgreementRecord): void {
    setEditingId(agreement.id);
    setTitle(agreement.title);
    setAgreementType(agreement.agreementType);
    setOwnerRole(agreement.ownerRole);
    setSupervisingPhysicianName(agreement.supervisingPhysicianName);
    setSupervisingPhysicianRole(agreement.supervisingPhysicianRole);
    setSupervisedRole(agreement.supervisedRole);
    setSelectedServiceLines(agreement.serviceLineIds);
    setScopeSummary(agreement.scopeSummary);
    setDelegatedActivitiesSummary(agreement.delegatedActivitiesSummary);
    setCosignExpectation(agreement.cosignExpectation);
    setEscalationProtocol(agreement.escalationProtocol);
    setReviewCadenceDays(String(agreement.reviewCadenceDays));
    setEffectiveDate(agreement.effectiveDate ? agreement.effectiveDate.slice(0, 10) : "");
    setExpiresAt(agreement.expiresAt ? agreement.expiresAt.slice(0, 10) : "");
    setNotes(agreement.notes ?? "");
  }

  async function loadData(): Promise<void> {
    if (!actor || !canView) {
      return;
    }
    setLoading(true);
    try {
      const rows = await apiRequest<PracticeAgreementRecord[]>("/practice-agreements", actor);
      setAgreements(rows);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load practice agreements.");
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
      setError(mutationError instanceof Error ? mutationError.message : "Unable to save practice-agreement changes.");
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
    if (!actor) {
      return;
    }
    await runMutation(async () => {
      await apiRequest("/practice-agreements/bootstrap-defaults", actor, {
        method: "POST"
      });
    });
  }

  async function handleSave(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!actor) {
      return;
    }

    const payload = {
      title,
      agreementType,
      ownerRole,
      supervisingPhysicianName,
      supervisingPhysicianRole,
      supervisedRole,
      serviceLineIds: selectedServiceLines,
      scopeSummary,
      delegatedActivitiesSummary,
      cosignExpectation,
      escalationProtocol,
      reviewCadenceDays: Number(reviewCadenceDays),
      effectiveDate: effectiveDate || null,
      expiresAt: expiresAt || null,
      notes
    };

    await runMutation(async () => {
      if (editingId) {
        await apiRequest(`/practice-agreements/${editingId}`, actor, {
          method: "PATCH",
          body: JSON.stringify(payload)
        });
      } else {
        await apiRequest("/practice-agreements", actor, {
          method: "POST",
          body: JSON.stringify(payload)
        });
      }
      resetForm();
    });
  }

  async function handleSubmitAgreement(agreementId: string): Promise<void> {
    if (!actor) {
      return;
    }
    await runMutation(async () => {
      await apiRequest(`/practice-agreements/${agreementId}/submit`, actor, {
        method: "POST"
      });
    });
  }

  async function handlePublishAgreement(agreementId: string): Promise<void> {
    if (!actor) {
      return;
    }
    await runMutation(async () => {
      await apiRequest(`/practice-agreements/${agreementId}/publish`, actor, {
        method: "POST"
      });
    });
  }

  if (!actor) {
    return (
      <section className="stack">
        <div className="card">Sign in to view physician-oversight and practice-agreement workflows.</div>
      </section>
    );
  }

  if (!canView) {
    return (
      <section className="stack">
        <div className="card">Your current role cannot access practice agreements.</div>
      </section>
    );
  }

  return (
    <section className="stack">
      <header className="stack">
        <span className="eyebrow">Physician Oversight</span>
        <div className="page-header">
          <div>
            <h1>Practice Agreements</h1>
            <p className="muted">
              Draft, route, and publish physician-oversight agreements through the same controlled clinical-governance path as the rest of the clinic’s operating system.
            </p>
          </div>
          {canManage ? (
            <div className="actions">
              <button className="button secondary" type="button" onClick={() => void handleBootstrapDefaults()} disabled={submitting}>
                Bootstrap defaults
              </button>
              <button className="button secondary" type="button" onClick={resetForm} disabled={submitting}>
                New draft
              </button>
            </div>
          ) : null}
        </div>
      </header>

      {error ? <div className="card error">{error}</div> : null}

      <article className="card stack">
        <div className="actions" style={{ justifyContent: "space-between" }}>
          <h2>Registry</h2>
          <span className="muted">{loading ? "Loading..." : `${agreements.length} agreements / ${draftCount} drafts needing attention`}</span>
        </div>
        <div className="grid cols-2">
          {agreements.map((agreement) => (
            <div key={agreement.id} className="card stack">
              <div className="actions" style={{ justifyContent: "space-between" }}>
                <strong>{agreement.title}</strong>
                <span className={`badge badge-${agreement.status}`}>{agreement.status.replaceAll("_", " ")}</span>
              </div>
              <div className="muted">
                {agreement.supervisingPhysicianName} / {agreement.supervisingPhysicianRole.replaceAll("_", " ")} supervising {agreement.supervisedRole.replaceAll("_", " ")}
              </div>
              <div className="muted">
                service lines {agreement.serviceLineIds.map((serviceLineId) => serviceLineId.replaceAll("_", " ")).join(", ")}
              </div>
              <div className="grid cols-3">
                <div className="card">
                  <div className="muted">Review cadence</div>
                  <strong>{agreement.reviewCadenceDays} days</strong>
                </div>
                <div className="card">
                  <div className="muted">Review due</div>
                  <strong>{agreement.reviewDueAt ? new Date(agreement.reviewDueAt).toLocaleDateString() : "not set"}</strong>
                </div>
                <div className="card">
                  <div className="muted">Published</div>
                  <strong>{agreement.publishedAt ? new Date(agreement.publishedAt).toLocaleDateString() : "no"}</strong>
                </div>
              </div>
              <p>{agreement.scopeSummary}</p>
              <div className="actions">
                {canManage && ["draft", "sent_back"].includes(agreement.status) ? (
                  <button className="button secondary" type="button" onClick={() => loadIntoForm(agreement)}>
                    Edit draft
                  </button>
                ) : null}
                {canManage && ["draft", "sent_back"].includes(agreement.status) ? (
                  <button className="button secondary" type="button" onClick={() => void handleSubmitAgreement(agreement.id)} disabled={submitting}>
                    Submit
                  </button>
                ) : null}
                {canManage && agreement.status === "approved" ? (
                  <button className="button secondary" type="button" onClick={() => void handlePublishAgreement(agreement.id)} disabled={submitting}>
                    Publish
                  </button>
                ) : null}
                {agreement.publishedPath ? (
                  <a className="button secondary" href={agreement.publishedPath} target="_blank" rel="noreferrer">
                    Open published copy
                  </a>
                ) : null}
              </div>
            </div>
          ))}
          {!loading && agreements.length === 0 ? <div className="muted">No practice agreements have been drafted yet.</div> : null}
        </div>
      </article>

      {canManage ? (
        <form className="card stack" onSubmit={(event) => void handleSave(event)}>
          <div className="actions" style={{ justifyContent: "space-between" }}>
            <h2>{editingId ? "Edit draft" : "Create draft"}</h2>
            {editingId ? (
              <button className="button secondary" type="button" onClick={resetForm} disabled={submitting}>
                Cancel editing
              </button>
            ) : null}
          </div>
          <label className="stack">
            <span>Agreement title</span>
            <input value={title} onChange={(event) => setTitle(event.target.value)} required />
          </label>
          <div className="grid cols-4">
            <label className="stack">
              <span>Agreement type</span>
              <select value={agreementType} onChange={(event) => setAgreementType(event.target.value as PracticeAgreementRecord["agreementType"])}>
                <option value="practice_agreement">Practice agreement</option>
                <option value="physician_oversight_plan">Physician oversight plan</option>
                <option value="standing_order_supervision">Standing-order supervision</option>
              </select>
            </label>
            <label className="stack">
              <span>Owner role</span>
              <select value={ownerRole} onChange={(event) => setOwnerRole(event.target.value as ActorRole)}>
                {actorRoles.map((role) => (
                  <option key={role} value={role}>{role.replaceAll("_", " ")}</option>
                ))}
              </select>
            </label>
            <label className="stack">
              <span>Supervising role</span>
              <select value={supervisingPhysicianRole} onChange={(event) => setSupervisingPhysicianRole(event.target.value as ActorRole)}>
                {actorRoles.map((role) => (
                  <option key={role} value={role}>{role.replaceAll("_", " ")}</option>
                ))}
              </select>
            </label>
            <label className="stack">
              <span>Supervised role</span>
              <select value={supervisedRole} onChange={(event) => setSupervisedRole(event.target.value as ActorRole)}>
                {actorRoles.map((role) => (
                  <option key={role} value={role}>{role.replaceAll("_", " ")}</option>
                ))}
              </select>
            </label>
          </div>
          <label className="stack">
            <span>Supervising physician name</span>
            <input value={supervisingPhysicianName} onChange={(event) => setSupervisingPhysicianName(event.target.value)} required />
          </label>
          <div className="stack">
            <span>Service lines</span>
            <div className="grid cols-3">
              {serviceLineOptions.map((serviceLine) => (
                <label key={serviceLine.id} className="card" style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input
                    type="checkbox"
                    checked={selectedServiceLines.includes(serviceLine.id)}
                    onChange={() => toggleServiceLine(serviceLine.id)}
                  />
                  <span>{serviceLine.label}</span>
                </label>
              ))}
            </div>
          </div>
          <label className="stack">
            <span>Scope summary</span>
            <textarea rows={4} value={scopeSummary} onChange={(event) => setScopeSummary(event.target.value)} />
          </label>
          <label className="stack">
            <span>Delegated activities</span>
            <textarea rows={4} value={delegatedActivitiesSummary} onChange={(event) => setDelegatedActivitiesSummary(event.target.value)} />
          </label>
          <label className="stack">
            <span>Cosign expectation</span>
            <textarea rows={3} value={cosignExpectation} onChange={(event) => setCosignExpectation(event.target.value)} />
          </label>
          <label className="stack">
            <span>Escalation protocol</span>
            <textarea rows={3} value={escalationProtocol} onChange={(event) => setEscalationProtocol(event.target.value)} />
          </label>
          <div className="grid cols-3">
            <label className="stack">
              <span>Review cadence (days)</span>
              <input type="number" min={1} max={365} value={reviewCadenceDays} onChange={(event) => setReviewCadenceDays(event.target.value)} />
            </label>
            <label className="stack">
              <span>Effective date</span>
              <input type="date" value={effectiveDate} onChange={(event) => setEffectiveDate(event.target.value)} />
            </label>
            <label className="stack">
              <span>Expiration date</span>
              <input type="date" value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} />
            </label>
          </div>
          <label className="stack">
            <span>Notes</span>
            <textarea rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} />
          </label>
          <div className="actions">
            <button className="button secondary" type="submit" disabled={submitting || selectedServiceLines.length === 0}>
              {editingId ? "Save draft" : "Create draft"}
            </button>
          </div>
        </form>
      ) : null}
    </section>
  );
}
