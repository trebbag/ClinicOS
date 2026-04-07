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

type ServiceLineRecord = {
  id: ServiceLineId;
  ownerRole: ActorRole | null;
  governanceStatus: "not_started" | "drafting" | "review_pending" | "approved" | "published" | "attention_needed";
  hasCharter: boolean;
  hasCompetencyMatrix: boolean;
  hasAuditTool: boolean;
  hasClaimsInventory: boolean;
  reviewCadenceDays: number;
  lastReviewedAt: string | null;
  nextReviewDueAt: string | null;
  latestPackId: string | null;
};

type ServiceLinePackRecord = {
  id: string;
  serviceLineId: ServiceLineId;
  title: string;
  ownerRole: ActorRole;
  status: "draft" | "approval_pending" | "approved" | "publish_pending" | "published" | "archived" | "sent_back";
  documentId: string | null;
  workflowRunId: string | null;
  publishedAt: string | null;
  publishedPath: string | null;
};

type ServiceLineSummary = {
  serviceLine: ServiceLineRecord;
  latestPack: ServiceLinePackRecord | null;
  linkedPublicAssetCount: number;
  publishedPublicAssetCount: number;
};

type ApprovalTask = {
  id: string;
  targetId: string;
  reviewerRole: ActorRole;
  status: "requested" | "approved" | "rejected" | "sent_back";
};

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

export default function ServiceLinesPage(): JSX.Element {
  const { actor, hasCapability } = useAppAuth();
  const [rows, setRows] = useState<ServiceLineSummary[]>([]);
  const [approvals, setApprovals] = useState<ApprovalTask[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selectedServiceLineId, setSelectedServiceLineId] = useState<ServiceLineId | "">("");

  const [ownerRole, setOwnerRole] = useState<ActorRole>("medical_director");
  const [charterSummary, setCharterSummary] = useState("Define the service purpose, scope, and accountable owner for this service line.");
  const [inclusionRules, setInclusionRules] = useState("List the patient/service inclusion boundaries and any exclusion rules or escalation triggers.");
  const [roleMatrixSummary, setRoleMatrixSummary] = useState("Summarize who can perform, supervise, document, and escalate within this service line.");
  const [competencyRequirements, setCompetencyRequirements] = useState("Define required onboarding, competencies, and periodic retraining checkpoints.");
  const [auditToolSummary, setAuditToolSummary] = useState("Describe the audit tool, review cadence, and evidence expected for safe operation.");
  const [emergencyEscalation, setEmergencyEscalation] = useState("Describe immediate escalation paths, downtime workflows, and emergency stop conditions.");
  const [pricingModelSummary, setPricingModelSummary] = useState("Summarize the pricing model, discount boundaries, packaging rules, and finance review expectations.");
  const [claimsGovernanceSummary, setClaimsGovernanceSummary] = useState("Describe how patient-facing claims are inventoried, reviewed, and tied back to approved evidence.");
  const [notes, setNotes] = useState("First-pass governance pack for pilot operations.");

  const canView = hasCapability("service_lines.view");
  const canManage = hasCapability("service_lines.manage");
  const selected = useMemo(
    () => rows.find((row) => row.serviceLine.id === selectedServiceLineId) ?? null,
    [rows, selectedServiceLineId]
  );
  const pendingApprovalCountByTarget = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const approval of approvals) {
      counts[approval.targetId] = (counts[approval.targetId] ?? 0) + 1;
    }
    return counts;
  }, [approvals]);

  async function loadData(): Promise<void> {
    if (!actor || !canView) {
      return;
    }

    setLoading(true);
    try {
      const [serviceLineRows, approvalRows] = await Promise.all([
        apiRequest<ServiceLineSummary[]>("/service-lines", actor),
        hasCapability("approvals.view")
          ? apiRequest<ApprovalTask[]>("/approvals?status=requested", actor)
          : Promise.resolve([])
      ]);
      setRows(serviceLineRows);
      setApprovals(approvalRows);
      setSelectedServiceLineId((current) => current || serviceLineRows[0]?.serviceLine.id || "");
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load service lines.");
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
      setError(mutationError instanceof Error ? mutationError.message : "Unable to save service-line update.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleBootstrapDefaults(): Promise<void> {
    if (!actor) {
      return;
    }
    await runMutation(async () => {
      await apiRequest("/service-lines/bootstrap-defaults", actor, {
        method: "POST"
      });
    });
  }

  async function handleGeneratePack(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!actor || !selectedServiceLineId) {
      return;
    }

    await runMutation(async () => {
      await apiRequest(`/service-lines/${selectedServiceLineId}/generate-pack`, actor, {
        method: "POST",
        body: JSON.stringify({
          ownerRole,
          charterSummary,
          inclusionExclusionRules: inclusionRules,
          roleMatrixSummary,
          competencyRequirements,
          auditToolSummary,
          emergencyEscalation,
          pricingModelSummary,
          claimsGovernanceSummary,
          notes
        })
      });
    });
  }

  async function handleSubmitPack(serviceLineId: ServiceLineId): Promise<void> {
    if (!actor) {
      return;
    }
    await runMutation(async () => {
      await apiRequest(`/service-lines/${serviceLineId}/submit-pack`, actor, {
        method: "POST"
      });
    });
  }

  async function handlePublishPack(serviceLineId: ServiceLineId): Promise<void> {
    if (!actor) {
      return;
    }
    await runMutation(async () => {
      await apiRequest(`/service-lines/${serviceLineId}/publish-pack`, actor, {
        method: "POST"
      });
    });
  }

  if (!actor) {
    return (
      <section className="stack">
        <div className="card">Sign in to view service-line governance packs.</div>
      </section>
    );
  }

  if (!canView) {
    return (
      <section className="stack">
        <div className="card">Your current role cannot access service-line governance.</div>
      </section>
    );
  }

  return (
    <section className="stack">
      <header className="stack">
        <span className="eyebrow">Service-Line Governance</span>
        <div className="page-header">
          <div>
            <h1>Service Lines</h1>
            <p className="muted">
              Track governance readiness, draft service-line packs, and route them through explicit review and controlled publication.
            </p>
          </div>
          {canManage ? (
            <button className="button secondary" type="button" onClick={() => void handleBootstrapDefaults()} disabled={submitting}>
              Bootstrap default service lines
            </button>
          ) : null}
        </div>
      </header>

      {error ? <div className="card error">{error}</div> : null}

      <article className="card stack">
        <div className="actions" style={{ justifyContent: "space-between" }}>
          <h2>Registry</h2>
          <span className="muted">{loading ? "Loading..." : `${rows.length} service lines`}</span>
        </div>
        <div className="grid cols-2">
          {rows.map((row) => {
            const pendingApprovals = row.latestPack?.documentId ? pendingApprovalCountByTarget[row.latestPack.documentId] ?? 0 : 0;
            return (
              <div key={row.serviceLine.id} className="card stack">
                <div className="actions" style={{ justifyContent: "space-between" }}>
                  <strong>{row.serviceLine.id.replaceAll("_", " ")}</strong>
                  <span className={`badge badge-${row.serviceLine.governanceStatus}`}>{row.serviceLine.governanceStatus.replaceAll("_", " ")}</span>
                </div>
                <div className="muted">
                  owner {row.serviceLine.ownerRole ?? "unassigned"} / review cadence {row.serviceLine.reviewCadenceDays} days
                </div>
                <div className="grid cols-4">
                  <div className="card"><div className="muted">Public assets</div><strong>{row.linkedPublicAssetCount}</strong></div>
                  <div className="card"><div className="muted">Published assets</div><strong>{row.publishedPublicAssetCount}</strong></div>
                  <div className="card"><div className="muted">Pending approvals</div><strong>{pendingApprovals}</strong></div>
                  <div className="card"><div className="muted">Latest pack</div><strong>{row.latestPack?.status ?? "none"}</strong></div>
                </div>
                <div className="muted">
                  Charter {row.serviceLine.hasCharter ? "yes" : "no"} / competency {row.serviceLine.hasCompetencyMatrix ? "yes" : "no"} / audit tool {row.serviceLine.hasAuditTool ? "yes" : "no"} / claims inventory {row.serviceLine.hasClaimsInventory ? "yes" : "no"}
                </div>
                <div className="actions">
                  <button className="button secondary" type="button" onClick={() => setSelectedServiceLineId(row.serviceLine.id)}>
                    Draft pack
                  </button>
                  {canManage && row.latestPack && row.latestPack.status === "draft" ? (
                    <button className="button" type="button" onClick={() => void handleSubmitPack(row.serviceLine.id)} disabled={submitting}>
                      Route for approval
                    </button>
                  ) : null}
                  {canManage && row.latestPack && row.latestPack.status === "approved" ? (
                    <button className="button secondary" type="button" onClick={() => void handlePublishPack(row.serviceLine.id)} disabled={submitting}>
                      Publish pack
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </article>

      {canManage && selected ? (
        <article className="card stack">
          <h2>Draft Governance Pack</h2>
          <div className="muted">
            Service line: {selected.serviceLine.id.replaceAll("_", " ")} / current status {selected.serviceLine.governanceStatus.replaceAll("_", " ")}
          </div>
          <form className="stack" onSubmit={(event) => void handleGeneratePack(event)}>
            <label className="stack">
              <span>Owner role</span>
              <select value={ownerRole} onChange={(event) => setOwnerRole(event.target.value as ActorRole)}>
                {actorRoles.map((role) => (
                  <option key={role} value={role}>{role}</option>
                ))}
              </select>
            </label>
            <label className="stack">
              <span>Service charter</span>
              <textarea rows={3} value={charterSummary} onChange={(event) => setCharterSummary(event.target.value)} />
            </label>
            <label className="stack">
              <span>Inclusion / exclusion rules</span>
              <textarea rows={3} value={inclusionRules} onChange={(event) => setInclusionRules(event.target.value)} />
            </label>
            <label className="stack">
              <span>Role matrix</span>
              <textarea rows={3} value={roleMatrixSummary} onChange={(event) => setRoleMatrixSummary(event.target.value)} />
            </label>
            <label className="stack">
              <span>Competency requirements</span>
              <textarea rows={3} value={competencyRequirements} onChange={(event) => setCompetencyRequirements(event.target.value)} />
            </label>
            <label className="stack">
              <span>Audit tool</span>
              <textarea rows={3} value={auditToolSummary} onChange={(event) => setAuditToolSummary(event.target.value)} />
            </label>
            <label className="stack">
              <span>Emergency escalation</span>
              <textarea rows={3} value={emergencyEscalation} onChange={(event) => setEmergencyEscalation(event.target.value)} />
            </label>
            <label className="stack">
              <span>Pricing model</span>
              <textarea rows={3} value={pricingModelSummary} onChange={(event) => setPricingModelSummary(event.target.value)} />
            </label>
            <label className="stack">
              <span>Claims governance</span>
              <textarea rows={3} value={claimsGovernanceSummary} onChange={(event) => setClaimsGovernanceSummary(event.target.value)} />
            </label>
            <label className="stack">
              <span>Notes</span>
              <textarea rows={2} value={notes} onChange={(event) => setNotes(event.target.value)} />
            </label>
            <button className="button" type="submit" disabled={submitting}>
              Generate service-line pack
            </button>
          </form>
        </article>
      ) : null}
    </section>
  );
}
