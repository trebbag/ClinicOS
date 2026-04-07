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

type DelegationRuleStatus = "draft" | "active" | "retired";
type DelegationSupervisionLevel = "protocol" | "direct" | "cosign" | "not_allowed";

type DelegationRuleRecord = {
  id: string;
  serviceLineId: ServiceLineId;
  taskCode: string;
  taskLabel: string;
  performerRole: ActorRole;
  supervisingRole: ActorRole | null;
  status: DelegationRuleStatus;
  supervisionLevel: DelegationSupervisionLevel;
  requiresCompetencyEvidence: boolean;
  requiresDocumentedOrder: boolean;
  requiresCosign: boolean;
  patientFacing: boolean;
  evidenceRequired: string;
  notes: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

type DelegationEvaluationResult = {
  allowed: boolean;
  reason: string;
  matchedRule: DelegationRuleRecord | null;
};

const serviceLineOptions: ServiceLineId[] = [
  "primary_care",
  "women_health",
  "telehealth",
  "weight_management",
  "hrt",
  "vaccines",
  "waived_testing",
  "contracted_lab",
  "iv_hydration",
  "aesthetics",
  "allergy_testing"
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

function formatLabel(value: string): string {
  return value.replaceAll("_", " ");
}

export default function DelegationPage(): JSX.Element {
  const { actor, hasCapability } = useAppAuth();
  const [rules, setRules] = useState<DelegationRuleRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [filterServiceLineId, setFilterServiceLineId] = useState<ServiceLineId | "all">("all");
  const [filterPerformerRole, setFilterPerformerRole] = useState<ActorRole | "all">("all");

  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [serviceLineId, setServiceLineId] = useState<ServiceLineId>("weight_management");
  const [taskCode, setTaskCode] = useState("weigh_in_and_screen");
  const [taskLabel, setTaskLabel] = useState("Weigh-in, vitals capture, and scripted intake screening");
  const [performerRole, setPerformerRole] = useState<ActorRole>("medical_assistant");
  const [supervisingRole, setSupervisingRole] = useState<ActorRole | "">("nurse_practitioner");
  const [status, setStatus] = useState<DelegationRuleStatus>("active");
  const [supervisionLevel, setSupervisionLevel] = useState<DelegationSupervisionLevel>("protocol");
  const [requiresCompetencyEvidence, setRequiresCompetencyEvidence] = useState(true);
  const [requiresDocumentedOrder, setRequiresDocumentedOrder] = useState(false);
  const [requiresCosign, setRequiresCosign] = useState(false);
  const [patientFacing, setPatientFacing] = useState(true);
  const [evidenceRequired, setEvidenceRequired] = useState("Current competency checklist and service-line onboarding acknowledgement.");
  const [notes, setNotes] = useState("Draft clinic template only; verify against state delegation rules before live use.");

  const [evaluationTaskCode, setEvaluationTaskCode] = useState("weigh_in_and_screen");
  const [evaluationServiceLineId, setEvaluationServiceLineId] = useState<ServiceLineId>("weight_management");
  const [evaluationPerformerRole, setEvaluationPerformerRole] = useState<ActorRole>("medical_assistant");
  const [evaluation, setEvaluation] = useState<DelegationEvaluationResult | null>(null);

  const canView = hasCapability("delegation.view");
  const canManage = hasCapability("delegation.manage");

  const visibleRules = useMemo(
    () =>
      rules.filter((rule) =>
        (filterServiceLineId === "all" || rule.serviceLineId === filterServiceLineId)
        && (filterPerformerRole === "all" || rule.performerRole === filterPerformerRole)
      ),
    [rules, filterPerformerRole, filterServiceLineId]
  );

  const groupedCounts = useMemo(() => {
    const counts = new Map<ServiceLineId, number>();
    for (const rule of rules) {
      if (rule.status !== "active") {
        continue;
      }
      counts.set(rule.serviceLineId, (counts.get(rule.serviceLineId) ?? 0) + 1);
    }
    return counts;
  }, [rules]);

  function resetForm(): void {
    setEditingRuleId(null);
    setServiceLineId("weight_management");
    setTaskCode("weigh_in_and_screen");
    setTaskLabel("Weigh-in, vitals capture, and scripted intake screening");
    setPerformerRole("medical_assistant");
    setSupervisingRole("nurse_practitioner");
    setStatus("active");
    setSupervisionLevel("protocol");
    setRequiresCompetencyEvidence(true);
    setRequiresDocumentedOrder(false);
    setRequiresCosign(false);
    setPatientFacing(true);
    setEvidenceRequired("Current competency checklist and service-line onboarding acknowledgement.");
    setNotes("Draft clinic template only; verify against state delegation rules before live use.");
  }

  function seedForm(rule: DelegationRuleRecord): void {
    setEditingRuleId(rule.id);
    setServiceLineId(rule.serviceLineId);
    setTaskCode(rule.taskCode);
    setTaskLabel(rule.taskLabel);
    setPerformerRole(rule.performerRole);
    setSupervisingRole(rule.supervisingRole ?? "");
    setStatus(rule.status);
    setSupervisionLevel(rule.supervisionLevel);
    setRequiresCompetencyEvidence(rule.requiresCompetencyEvidence);
    setRequiresDocumentedOrder(rule.requiresDocumentedOrder);
    setRequiresCosign(rule.requiresCosign);
    setPatientFacing(rule.patientFacing);
    setEvidenceRequired(rule.evidenceRequired);
    setNotes(rule.notes ?? "");
  }

  async function loadRules(): Promise<void> {
    if (!actor || !canView) {
      return;
    }

    setLoading(true);
    try {
      const query = new URLSearchParams();
      if (filterServiceLineId !== "all") {
        query.set("serviceLineId", filterServiceLineId);
      }
      if (filterPerformerRole !== "all") {
        query.set("performerRole", filterPerformerRole);
      }
      const rows = await apiRequest<DelegationRuleRecord[]>(
        `/delegation-rules${query.size > 0 ? `?${query.toString()}` : ""}`,
        actor
      );
      setRules(rows);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load delegation rules.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadRules();
  }, [actor, canView, filterServiceLineId, filterPerformerRole]);

  async function runMutation(action: () => Promise<void>): Promise<void> {
    setSubmitting(true);
    try {
      await action();
      await loadRules();
      setError(null);
    } catch (mutationError) {
      setError(mutationError instanceof Error ? mutationError.message : "Unable to save delegation rule.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleBootstrapDefaults(): Promise<void> {
    if (!actor) {
      return;
    }
    await runMutation(async () => {
      await apiRequest("/delegation-rules/bootstrap-defaults", actor, {
        method: "POST"
      });
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!actor) {
      return;
    }

    const payload = {
      serviceLineId,
      taskCode,
      taskLabel,
      performerRole,
      supervisingRole: supervisingRole || null,
      status,
      supervisionLevel,
      requiresCompetencyEvidence,
      requiresDocumentedOrder,
      requiresCosign,
      patientFacing,
      evidenceRequired,
      notes: notes.trim().length > 0 ? notes : null
    };

    await runMutation(async () => {
      if (editingRuleId) {
        await apiRequest(`/delegation-rules/${editingRuleId}`, actor, {
          method: "PATCH",
          body: JSON.stringify({
            taskLabel: payload.taskLabel,
            supervisingRole: payload.supervisingRole,
            status: payload.status,
            supervisionLevel: payload.supervisionLevel,
            requiresCompetencyEvidence: payload.requiresCompetencyEvidence,
            requiresDocumentedOrder: payload.requiresDocumentedOrder,
            requiresCosign: payload.requiresCosign,
            patientFacing: payload.patientFacing,
            evidenceRequired: payload.evidenceRequired,
            notes: payload.notes
          })
        });
      } else {
        await apiRequest("/delegation-rules", actor, {
          method: "POST",
          body: JSON.stringify(payload)
        });
      }
      resetForm();
    });
  }

  async function handleEvaluate(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!actor) {
      return;
    }

    setSubmitting(true);
    try {
      const result = await apiRequest<DelegationEvaluationResult>("/delegation-rules/evaluate", actor, {
        method: "POST",
        body: JSON.stringify({
          serviceLineId: evaluationServiceLineId,
          taskCode: evaluationTaskCode,
          performerRole: evaluationPerformerRole
        })
      });
      setEvaluation(result);
      setError(null);
    } catch (evaluationError) {
      setError(evaluationError instanceof Error ? evaluationError.message : "Unable to evaluate delegation rule.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggleStatus(rule: DelegationRuleRecord): Promise<void> {
    if (!actor) {
      return;
    }
    await runMutation(async () => {
      await apiRequest(`/delegation-rules/${rule.id}`, actor, {
        method: "PATCH",
        body: JSON.stringify({
          status: rule.status === "retired" ? "active" : "retired"
        })
      });
    });
  }

  if (!actor) {
    return (
      <section className="stack">
        <div className="card">Sign in to view delegation rules.</div>
      </section>
    );
  }

  if (!canView) {
    return (
      <section className="stack">
        <div className="card">Your current role cannot access the delegation matrix.</div>
      </section>
    );
  }

  return (
    <section className="stack">
      <header className="stack">
        <span className="eyebrow">Clinic-Specific Governance</span>
        <div className="page-header">
          <div>
            <h1>Delegation Matrix</h1>
            <p className="muted">
              Make delegated task rules explicit by service line, performer role, supervision level, and evidence expectations.
            </p>
          </div>
          {canManage ? (
            <button className="button secondary" type="button" disabled={submitting} onClick={() => void handleBootstrapDefaults()}>
              Bootstrap draft rules
            </button>
          ) : null}
        </div>
      </header>

      {error ? <div className="card error">{error}</div> : null}

      <article className="card stack">
        <div className="actions" style={{ justifyContent: "space-between" }}>
          <h2>Registry summary</h2>
          <span className="muted">{loading ? "Loading..." : `${rules.length} total rules`}</span>
        </div>
        <div className="grid cols-4">
          {serviceLineOptions.map((entry) => (
            <div className="card" key={entry}>
              <div className="muted">{formatLabel(entry)}</div>
              <strong>{groupedCounts.get(entry) ?? 0} active rules</strong>
            </div>
          ))}
        </div>
      </article>

      <div className="grid cols-2">
        <article className="card stack">
          <div className="actions" style={{ justifyContent: "space-between" }}>
            <h2>Rule check</h2>
            <span className="muted">Deterministic evaluator</span>
          </div>
          <form className="stack" onSubmit={(event) => { void handleEvaluate(event); }}>
            <select value={evaluationServiceLineId} onChange={(event) => setEvaluationServiceLineId(event.target.value as ServiceLineId)}>
              {serviceLineOptions.map((entry) => (
                <option key={entry} value={entry}>
                  {formatLabel(entry)}
                </option>
              ))}
            </select>
            <input value={evaluationTaskCode} onChange={(event) => setEvaluationTaskCode(event.target.value)} placeholder="task_code" required />
            <select value={evaluationPerformerRole} onChange={(event) => setEvaluationPerformerRole(event.target.value as ActorRole)}>
              {actorRoles.map((role) => (
                <option key={role} value={role}>
                  {formatLabel(role)}
                </option>
              ))}
            </select>
            <button className="button" type="submit" disabled={submitting}>Evaluate rule</button>
          </form>
          {evaluation ? (
            <div className={`card ${evaluation.allowed ? "" : "warning"}`}>
              <div className="actions" style={{ justifyContent: "space-between" }}>
                <strong>{evaluation.allowed ? "Allowed" : "Not allowed"}</strong>
                {evaluation.matchedRule ? (
                  <span className={`badge badge-${evaluation.matchedRule.status}`}>{evaluation.matchedRule.status}</span>
                ) : null}
              </div>
              <div>{evaluation.reason}</div>
              {evaluation.matchedRule ? (
                <div className="muted">
                  {evaluation.matchedRule.taskLabel} / supervision {formatLabel(evaluation.matchedRule.supervisionLevel)}
                  {evaluation.matchedRule.supervisingRole ? ` / supervisor ${formatLabel(evaluation.matchedRule.supervisingRole)}` : ""}
                </div>
              ) : null}
            </div>
          ) : null}
        </article>

        {canManage ? (
          <article className="card stack">
            <div className="actions" style={{ justifyContent: "space-between" }}>
              <h2>{editingRuleId ? "Edit rule" : "Create rule"}</h2>
              {editingRuleId ? (
                <button className="button secondary" type="button" onClick={resetForm}>
                  Cancel edit
                </button>
              ) : null}
            </div>
            <form className="stack" onSubmit={(event) => { void handleSubmit(event); }}>
              <select value={serviceLineId} onChange={(event) => setServiceLineId(event.target.value as ServiceLineId)} disabled={Boolean(editingRuleId)}>
                {serviceLineOptions.map((entry) => (
                  <option key={entry} value={entry}>
                    {formatLabel(entry)}
                  </option>
                ))}
              </select>
              <input value={taskCode} onChange={(event) => setTaskCode(event.target.value)} placeholder="task_code" required disabled={Boolean(editingRuleId)} />
              <input value={taskLabel} onChange={(event) => setTaskLabel(event.target.value)} placeholder="Task label" required />
              <select value={performerRole} onChange={(event) => setPerformerRole(event.target.value as ActorRole)} disabled={Boolean(editingRuleId)}>
                {actorRoles.map((role) => (
                  <option key={role} value={role}>
                    {formatLabel(role)}
                  </option>
                ))}
              </select>
              <select value={supervisingRole} onChange={(event) => setSupervisingRole(event.target.value as ActorRole | "")}>
                <option value="">No supervising role</option>
                {actorRoles.map((role) => (
                  <option key={role} value={role}>
                    {formatLabel(role)}
                  </option>
                ))}
              </select>
              <select value={status} onChange={(event) => setStatus(event.target.value as DelegationRuleStatus)}>
                <option value="draft">draft</option>
                <option value="active">active</option>
                <option value="retired">retired</option>
              </select>
              <select value={supervisionLevel} onChange={(event) => setSupervisionLevel(event.target.value as DelegationSupervisionLevel)}>
                <option value="protocol">protocol</option>
                <option value="direct">direct</option>
                <option value="cosign">cosign</option>
                <option value="not_allowed">not allowed</option>
              </select>
              <textarea value={evidenceRequired} onChange={(event) => setEvidenceRequired(event.target.value)} rows={3} placeholder="Evidence required" required />
              <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} placeholder="Notes" />
              <label className="actions">
                <input type="checkbox" checked={requiresCompetencyEvidence} onChange={(event) => setRequiresCompetencyEvidence(event.target.checked)} />
                <span>Competency evidence required</span>
              </label>
              <label className="actions">
                <input type="checkbox" checked={requiresDocumentedOrder} onChange={(event) => setRequiresDocumentedOrder(event.target.checked)} />
                <span>Documented order required</span>
              </label>
              <label className="actions">
                <input type="checkbox" checked={requiresCosign} onChange={(event) => setRequiresCosign(event.target.checked)} />
                <span>Cosign required</span>
              </label>
              <label className="actions">
                <input type="checkbox" checked={patientFacing} onChange={(event) => setPatientFacing(event.target.checked)} />
                <span>Patient-facing task</span>
              </label>
              <button className="button" type="submit" disabled={submitting}>
                {editingRuleId ? "Save rule" : "Create rule"}
              </button>
            </form>
          </article>
        ) : null}
      </div>

      <article className="card stack">
        <div className="actions" style={{ justifyContent: "space-between" }}>
          <h2>Delegation rules</h2>
          <div className="actions">
            <select value={filterServiceLineId} onChange={(event) => setFilterServiceLineId(event.target.value as ServiceLineId | "all")}>
              <option value="all">All service lines</option>
              {serviceLineOptions.map((entry) => (
                <option key={entry} value={entry}>
                  {formatLabel(entry)}
                </option>
              ))}
            </select>
            <select value={filterPerformerRole} onChange={(event) => setFilterPerformerRole(event.target.value as ActorRole | "all")}>
              <option value="all">All performer roles</option>
              {actorRoles.map((role) => (
                <option key={role} value={role}>
                  {formatLabel(role)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {loading ? (
          <div className="muted">Loading delegation rules...</div>
        ) : visibleRules.length === 0 ? (
          <div className="muted">No delegation rules match the current filters yet.</div>
        ) : (
          <div className="grid cols-2">
            {visibleRules.map((rule) => (
              <div className="card stack" key={rule.id}>
                <div className="actions" style={{ justifyContent: "space-between" }}>
                  <strong>{rule.taskLabel}</strong>
                  <span className={`badge badge-${rule.status}`}>{rule.status.replaceAll("_", " ")}</span>
                </div>
                <div className="muted">
                  {formatLabel(rule.serviceLineId)} / {formatLabel(rule.performerRole)}
                  {rule.supervisingRole ? ` / supervisor ${formatLabel(rule.supervisingRole)}` : ""}
                </div>
                <div>
                  Supervision: <strong>{formatLabel(rule.supervisionLevel)}</strong>
                </div>
                <div className="muted">Evidence: {rule.evidenceRequired}</div>
                {rule.notes ? <div className="muted">Notes: {rule.notes}</div> : null}
                <div className="muted">
                  {rule.requiresCompetencyEvidence ? "Competency evidence" : "No competency evidence"}
                  {" / "}
                  {rule.requiresDocumentedOrder ? "Documented order" : "No documented order"}
                  {" / "}
                  {rule.requiresCosign ? "Cosign" : "No cosign"}
                </div>
                {canManage ? (
                  <div className="actions">
                    <button className="button secondary" type="button" onClick={() => seedForm(rule)}>
                      Edit
                    </button>
                    <button className="button secondary" type="button" disabled={submitting} onClick={() => { void handleToggleStatus(rule); }}>
                      {rule.status === "retired" ? "Reactivate" : "Retire"}
                    </button>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </article>
    </section>
  );
}
