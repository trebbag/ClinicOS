"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useAppAuth } from "../../components/auth-provider";
import { apiRequest } from "../../lib/api";

type Scorecard = {
  employeeId: string;
  employeeRole: string;
  overallScore: number;
  periodStart: string;
  periodEnd: string;
  buckets: Array<{ name: string; score: number }>;
};

type ScorecardReview = {
  id: string;
  employeeId: string;
  employeeRole: string;
  periodStart: string;
  periodEnd: string;
  overallScore: number;
  safetyComplianceScore: number;
  status: string;
  oversightStatus: string;
  requiresMedicalDirectorReview: boolean;
  assignedReviewerRole: string;
};

type ScorecardHistoryPoint = {
  employeeId: string;
  employeeRole: string;
  periodStart: string;
  periodEnd: string;
  overallScore: number;
  previousOverallScore: number | null;
  overallDelta: number | null;
  rollingAverageOverallScore: number | null;
  openTrainingGapCount: number;
  buckets: Array<{
    name: string;
    score: number;
    previousScore: number | null;
    delta: number | null;
  }>;
};

type WorkerJob = {
  id: string;
  type: string;
  status: string;
  sourceEntityType: string | null;
  sourceEntityId: string | null;
};

type TrainingDashboard = {
  employeeId: string;
  employeeRole: string;
  plans: Array<{
    id: string;
    title: string;
    status: string;
    cadenceDays: number;
    leadTimeDays: number;
    validityDays: number | null;
    ownerRole: string;
    employeeRole: string;
    employeeId: string | null;
    notes: string | null;
  }>;
  requirements: Array<{
    id: string;
    requirementType: string;
    title: string;
    planId: string | null;
    dueDate: string | null;
    notes: string | null;
  }>;
  completions: Array<{
    id: string;
    requirementId: string;
    completedAt: string;
    validUntil: string | null;
    note: string | null;
  }>;
  gapSummary: {
    counts: {
      complete: number;
      expiringSoon: number;
      overdue: number;
      missing: number;
    };
    items: Array<{
      requirementId: string;
      requirementType: string;
      title: string;
      status: string;
      dueDate: string | null;
      validUntil: string | null;
      latestCompletionAt: string | null;
      notes: string | null;
    }>;
  };
  planSummary: {
    activePlans: number;
    generatedRequirements: number;
    upcomingRequirements: number;
    overdueRequirements: number;
    openFollowUps: number;
  };
};

const defaultCsv = `employee_id,employee_role,period_start,period_end,task_completion_rate,training_completion_rate,audit_pass_rate,issue_close_rate,complaint_count,note_lag_days,refill_turnaround_hours,schedule_fill_rate
E-100,front_desk,2026-03-01,2026-03-31,0.96,1,0.98,0.91,0,0,0,0.88
E-200,medical_assistant,2026-03-01,2026-03-31,0.92,0.95,0.97,0.89,1,0,0,0.81`;

function prettyStatus(status: string): string {
  return status.replaceAll("_", " ");
}

export default function ScorecardsPage(): JSX.Element {
  const { actor } = useAppAuth();
  const [filename, setFilename] = useState("march-2026-operational-metrics.csv");
  const [csv, setCsv] = useState(defaultCsv);
  const [scorecards, setScorecards] = useState<Scorecard[]>([]);
  const [reviews, setReviews] = useState<ScorecardReview[]>([]);
  const [jobs, setJobs] = useState<WorkerJob[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<{ employeeId: string; employeeRole: string } | null>(null);
  const [history, setHistory] = useState<ScorecardHistoryPoint[]>([]);
  const [trainingDashboard, setTrainingDashboard] = useState<TrainingDashboard | null>(null);
  const [reviewFilter, setReviewFilter] = useState<"all" | "pending" | "exceptions" | "signed_off">("all");
  const [requirementTitle, setRequirementTitle] = useState("");
  const [requirementType, setRequirementType] = useState<"training" | "competency">("training");
  const [requirementDueDate, setRequirementDueDate] = useState("");
  const [completionRequirementId, setCompletionRequirementId] = useState("");
  const [completionValidUntil, setCompletionValidUntil] = useState("");
  const [completionNote, setCompletionNote] = useState("");
  const [planTitle, setPlanTitle] = useState("");
  const [planCadenceDays, setPlanCadenceDays] = useState("90");
  const [planLeadTimeDays, setPlanLeadTimeDays] = useState("14");
  const [planValidityDays, setPlanValidityDays] = useState("90");
  const [planApplyToRoleOnly, setPlanApplyToRoleOnly] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    if (!actor) {
      return;
    }

    try {
      const [scorecardRows, reviewRows, workerJobs] = await Promise.all([
        apiRequest<Scorecard[]>("/scorecards", actor),
        apiRequest<ScorecardReview[]>("/scorecard-reviews", actor),
        apiRequest<WorkerJob[]>("/worker-jobs?sourceEntityType=workflow_run", actor)
      ]);
      setScorecards(scorecardRows);
      setReviews(reviewRows);
      setJobs(workerJobs);
      if (!selectedEmployee && scorecardRows.length > 0) {
        setSelectedEmployee({
          employeeId: scorecardRows[0].employeeId,
          employeeRole: scorecardRows[0].employeeRole
        });
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load scorecards.");
    }
  }

  async function loadEmployeeDetail(employeeId: string, employeeRole: string) {
    if (!actor) {
      return;
    }

    try {
      const [points, dashboard] = await Promise.all([
        apiRequest<ScorecardHistoryPoint[]>(
          `/scorecards/history?employeeId=${employeeId}&employeeRole=${employeeRole}`,
          actor
        ),
        apiRequest<TrainingDashboard>(
          `/training/dashboard?employeeId=${employeeId}&employeeRole=${employeeRole}`,
          actor
        )
      ]);
      setHistory(points);
      setTrainingDashboard(dashboard);
      setCompletionRequirementId((current) => current || dashboard.requirements[0]?.id || "");
    } catch (detailError) {
      setError(detailError instanceof Error ? detailError.message : "Unable to load scorecard detail.");
    }
  }

  useEffect(() => {
    if (!actor || !["office_manager", "hr_lead", "medical_director"].includes(actor.role)) {
      return;
    }

    void load();
  }, [actor]);

  useEffect(() => {
    if (!selectedEmployee) {
      setHistory([]);
      setTrainingDashboard(null);
      return;
    }

    void loadEmployeeDetail(selectedEmployee.employeeId, selectedEmployee.employeeRole);
  }, [selectedEmployee]);

  const selectedReview = useMemo(
    () =>
      reviews.find(
        (review) =>
          review.employeeId === selectedEmployee?.employeeId && review.employeeRole === selectedEmployee?.employeeRole
      ) ?? null,
    [reviews, selectedEmployee]
  );

  const filteredReviews = useMemo(() => {
    switch (reviewFilter) {
      case "pending":
        return reviews.filter((review) => review.status !== "signed_off");
      case "exceptions":
        return reviews.filter((review) => review.requiresMedicalDirectorReview);
      case "signed_off":
        return reviews.filter((review) => review.status === "signed_off");
      default:
        return reviews;
    }
  }, [reviewFilter, reviews]);

  async function handleImport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!actor) {
      return;
    }
    setLoading(true);

    try {
      await apiRequest("/scorecard-imports", actor, {
        method: "POST",
        body: JSON.stringify({
          filename,
          csv
        })
      });
      await load();
      setError(null);
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : "Unable to import scorecards.");
    } finally {
      setLoading(false);
    }
  }

  async function handleReviewDecision(review: ScorecardReview, decision: "signed_off" | "sent_back" | "escalated") {
    if (!actor) {
      return;
    }

    setLoading(true);

    try {
      await apiRequest(`/scorecard-reviews/${review.id}/decision`, actor, {
        method: "POST",
        body: JSON.stringify({ decision })
      });
      await load();
      if (selectedEmployee) {
        await loadEmployeeDetail(selectedEmployee.employeeId, selectedEmployee.employeeRole);
      }
      setError(null);
    } catch (decisionError) {
      setError(decisionError instanceof Error ? decisionError.message : "Unable to update scorecard review.");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateRequirement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedEmployee || !actor) {
      return;
    }

    setLoading(true);
    try {
      await apiRequest("/training-requirements", actor, {
        method: "POST",
        body: JSON.stringify({
          employeeId: selectedEmployee.employeeId,
          employeeRole: selectedEmployee.employeeRole,
          requirementType,
          title: requirementTitle,
          dueDate: requirementDueDate ? new Date(`${requirementDueDate}T12:00:00.000Z`).toISOString() : null
        })
      });
      setRequirementTitle("");
      setRequirementDueDate("");
      await loadEmployeeDetail(selectedEmployee.employeeId, selectedEmployee.employeeRole);
      await load();
      setError(null);
    } catch (requirementError) {
      setError(requirementError instanceof Error ? requirementError.message : "Unable to create training requirement.");
    } finally {
      setLoading(false);
    }
  }

  async function handleRecordCompletion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!completionRequirementId || !selectedEmployee || !actor) {
      return;
    }

    setLoading(true);
    try {
      await apiRequest("/training-completions", actor, {
        method: "POST",
        body: JSON.stringify({
          requirementId: completionRequirementId,
          validUntil: completionValidUntil ? new Date(`${completionValidUntil}T12:00:00.000Z`).toISOString() : null,
          note: completionNote || null
        })
      });
      setCompletionNote("");
      setCompletionValidUntil("");
      await loadEmployeeDetail(selectedEmployee.employeeId, selectedEmployee.employeeRole);
      await load();
      setError(null);
    } catch (completionError) {
      setError(completionError instanceof Error ? completionError.message : "Unable to record training completion.");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateTrainingPlan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedEmployee || !actor) {
      return;
    }

    setLoading(true);
    try {
      await apiRequest("/training-plans", actor, {
        method: "POST",
        body: JSON.stringify({
          employeeRole: selectedEmployee.employeeRole,
          employeeId: planApplyToRoleOnly ? null : selectedEmployee.employeeId,
          requirementType,
          title: planTitle,
          cadenceDays: Number(planCadenceDays),
          leadTimeDays: Number(planLeadTimeDays),
          validityDays: planValidityDays ? Number(planValidityDays) : null,
          ownerRole: actor.role
        })
      });
      setPlanTitle("");
      setPlanCadenceDays("90");
      setPlanLeadTimeDays("14");
      setPlanValidityDays("90");
      setPlanApplyToRoleOnly(false);
      await loadEmployeeDetail(selectedEmployee.employeeId, selectedEmployee.employeeRole);
      setError(null);
    } catch (planError) {
      setError(planError instanceof Error ? planError.message : "Unable to create training plan.");
    } finally {
      setLoading(false);
    }
  }

  async function handleBootstrapTrainingPlans() {
    if (!selectedEmployee || !actor) {
      return;
    }

    setLoading(true);
    try {
      await apiRequest("/training-plans/bootstrap-defaults", actor, {
        method: "POST",
        body: JSON.stringify({
          employeeRole: selectedEmployee.employeeRole,
          employeeId: selectedEmployee.employeeId
        })
      });
      await loadEmployeeDetail(selectedEmployee.employeeId, selectedEmployee.employeeRole);
      setError(null);
    } catch (bootstrapError) {
      setError(bootstrapError instanceof Error ? bootstrapError.message : "Unable to bootstrap training plans.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid" style={{ gap: 16 }}>
      <div className="card">
        <h1>Scorecards</h1>
        <p className="muted">
          Import de-identified operational metrics, complete HR sign-off, route exception reviews, and track training or competency gaps for follow-through.
        </p>
        <div className="muted">
          Active profile: {actor ? `${actor.name} / ${actor.role}` : "No active profile"}
        </div>
      </div>

      {actor && !["office_manager", "hr_lead", "medical_director"].includes(actor.role) ? (
        <div className="card error">This screen is reserved for office-manager, HR lead, and medical-director profiles.</div>
      ) : null}

      {error ? <div className="card error">{error}</div> : null}

      <div className="grid cols-2">
        <div className="card">
          <h2>Import CSV</h2>
          <form className="stack" onSubmit={(event) => { void handleImport(event); }}>
            <input value={filename} onChange={(event) => setFilename(event.target.value)} placeholder="Filename" required />
            <textarea value={csv} onChange={(event) => setCsv(event.target.value)} rows={14} />
            <button className="button" type="submit" disabled={loading || actor?.role !== "office_manager"}>Import scorecards</button>
          </form>
        </div>

        <div className="card">
          <h2>Imported scorecards</h2>
          <div className="table">
            <div className="table-row table-head">
              <span>Employee</span>
              <span>Role</span>
              <span>Overall</span>
              <span>Period</span>
            </div>
            {scorecards.map((scorecard) => (
              <button
                key={`${scorecard.employeeRole}:${scorecard.employeeId}:${scorecard.periodStart}`}
                className="table-row button-link"
                onClick={() => setSelectedEmployee({ employeeId: scorecard.employeeId, employeeRole: scorecard.employeeRole })}
                type="button"
              >
                <span>{scorecard.employeeId}</span>
                <span>{scorecard.employeeRole}</span>
                <span>{scorecard.overallScore}</span>
                <span>{scorecard.periodStart} to {scorecard.periodEnd}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="card">
        <h2>Review queue</h2>
        <div className="actions" style={{ marginBottom: 12 }}>
          <span className="badge badge-ready">Pending {reviews.filter((review) => review.status !== "signed_off").length}</span>
          <span className="badge badge-degraded">Exceptions {reviews.filter((review) => review.requiresMedicalDirectorReview).length}</span>
          <label className="stack" style={{ minWidth: 220 }}>
            <span className="muted">Filter</span>
            <select value={reviewFilter} onChange={(event) => setReviewFilter(event.target.value as typeof reviewFilter)}>
              <option value="all">All reviews</option>
              <option value="pending">Pending</option>
              <option value="exceptions">Medical-director exceptions</option>
              <option value="signed_off">Signed off</option>
            </select>
          </label>
        </div>
        <ul>
          {filteredReviews.map((review) => (
            <li key={review.id}>
              <strong>{review.employeeId}</strong> <span className={`badge badge-${review.status}`}>{prettyStatus(review.status)}</span>
              {review.requiresMedicalDirectorReview ? (
                <span className={`badge badge-${review.oversightStatus}`} style={{ marginLeft: 8 }}>
                  {prettyStatus(review.oversightStatus)}
                </span>
              ) : null}
              <div className="muted">
                {review.employeeRole} · {review.periodStart} to {review.periodEnd} · overall {review.overallScore} · safety {review.safetyComplianceScore}
              </div>
              <div className="actions" style={{ marginTop: 8 }}>
                {review.status === "pending_hr_review" ? (
                  <>
                    <button className="button secondary" onClick={() => { void handleReviewDecision(review, "signed_off"); }} disabled={loading || actor?.role !== "hr_lead"}>
                      HR sign off
                    </button>
                    <button className="button secondary" onClick={() => { void handleReviewDecision(review, "sent_back"); }} disabled={loading || actor?.role !== "hr_lead"}>
                      Send back
                    </button>
                    <button className="button secondary" onClick={() => { void handleReviewDecision(review, "escalated"); }} disabled={loading || actor?.role !== "hr_lead"}>
                      Escalate
                    </button>
                  </>
                ) : null}
                {review.status === "pending_medical_director_review" ? (
                  <>
                    <button className="button secondary" onClick={() => { void handleReviewDecision(review, "signed_off"); }} disabled={loading || actor?.role !== "medical_director"}>
                      MD sign off
                    </button>
                    <button className="button secondary" onClick={() => { void handleReviewDecision(review, "sent_back"); }} disabled={loading || actor?.role !== "medical_director"}>
                      MD send back
                    </button>
                  </>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="grid cols-2">
        <div className="card">
          <h2>Selected employee</h2>
          {selectedReview ? (
            <div className="stack">
              <div>
                <strong>{selectedReview.employeeId}</strong> <span className={`badge badge-${selectedReview.status}`}>{prettyStatus(selectedReview.status)}</span>
              </div>
              <div className="muted">Role: {selectedReview.employeeRole}</div>
              <div className="muted">Overall: {selectedReview.overallScore}</div>
              <div className="muted">Safety / compliance: {selectedReview.safetyComplianceScore}</div>
              <div className="muted">Assigned reviewer: {selectedReview.assignedReviewerRole}</div>
              <div className="muted">
                Training gaps: {(trainingDashboard?.gapSummary.counts.overdue ?? 0) + (trainingDashboard?.gapSummary.counts.missing ?? 0) + (trainingDashboard?.gapSummary.counts.expiringSoon ?? 0)}
              </div>
              <div className="muted">
                Active plans: {trainingDashboard?.planSummary.activePlans ?? 0} · generated requirements {trainingDashboard?.planSummary.generatedRequirements ?? 0}
              </div>
            </div>
          ) : (
            <div className="muted">Select a scorecard row to inspect history and review status.</div>
          )}
        </div>

        <div className="card">
          <h2>History</h2>
          <ul>
            {history.map((point) => (
              <li key={`${point.periodStart}:${point.periodEnd}`}>
                <strong>{point.periodStart} to {point.periodEnd}</strong>
                <div className="muted">
                  Overall {point.overallScore}
                  {point.overallDelta !== null ? ` (${point.overallDelta >= 0 ? "+" : ""}${point.overallDelta} vs prior)` : ""}
                </div>
                <div className="muted">
                  Rolling average: {point.rollingAverageOverallScore ?? "n/a"} · open training gaps: {point.openTrainingGapCount}
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="grid cols-2">
        <div className="card">
          <h2>Training and competency gaps</h2>
          {trainingDashboard ? (
            <div className="stack">
              <div className="muted">
                Complete {trainingDashboard.gapSummary.counts.complete} · expiring soon {trainingDashboard.gapSummary.counts.expiringSoon} · overdue {trainingDashboard.gapSummary.counts.overdue} · missing {trainingDashboard.gapSummary.counts.missing}
              </div>
              <div className="muted">
                Recurring plans {trainingDashboard.planSummary.activePlans} · upcoming requirements {trainingDashboard.planSummary.upcomingRequirements} · overdue planned requirements {trainingDashboard.planSummary.overdueRequirements}
              </div>
              <ul>
                {trainingDashboard.gapSummary.items.map((item) => (
                  <li key={item.requirementId}>
                    <strong>{item.title}</strong> <span className={`badge badge-${item.status}`}>{prettyStatus(item.status)}</span>
                    <div className="muted">
                      {item.requirementType} · due {item.dueDate ? new Date(item.dueDate).toLocaleDateString() : "n/a"} · valid until {item.validUntil ? new Date(item.validUntil).toLocaleDateString() : "n/a"}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="muted">Select an employee to view training gaps.</div>
          )}
        </div>

        <div className="card">
          <h2>Manage requirements</h2>
          {selectedEmployee ? (
            <div className="grid" style={{ gap: 16 }}>
              <div className="stack">
                <div className="actions">
                  <button className="button secondary" type="button" onClick={() => { void handleBootstrapTrainingPlans(); }} disabled={loading || actor?.role === "office_manager"}>
                    Bootstrap recurring plans
                  </button>
                </div>
                <ul>
                  {(trainingDashboard?.plans ?? []).map((plan) => (
                    <li key={plan.id}>
                      <strong>{plan.title}</strong> <span className={`badge badge-${plan.status}`}>{prettyStatus(plan.status)}</span>
                      <div className="muted">
                        every {plan.cadenceDays} days · lead {plan.leadTimeDays} days · valid {plan.validityDays ?? "n/a"} days · owner {plan.ownerRole}
                      </div>
                      <div className="muted">
                        scope {plan.employeeId ? plan.employeeId : `all ${plan.employeeRole.replaceAll("_", " ")}`}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>

              <form className="stack" onSubmit={(event) => { void handleCreateRequirement(event); }}>
                <input value={requirementTitle} onChange={(event) => setRequirementTitle(event.target.value)} placeholder="Requirement title" required />
                <select value={requirementType} onChange={(event) => setRequirementType(event.target.value as "training" | "competency")}>
                  <option value="training">Training</option>
                  <option value="competency">Competency</option>
                </select>
                <input type="date" value={requirementDueDate} onChange={(event) => setRequirementDueDate(event.target.value)} />
                <button className="button" type="submit" disabled={loading || !["hr_lead", "medical_director"].includes(actor?.role ?? "")}>Add requirement</button>
              </form>

              <form className="stack" onSubmit={(event) => { void handleCreateTrainingPlan(event); }}>
                <input value={planTitle} onChange={(event) => setPlanTitle(event.target.value)} placeholder="Recurring plan title" required />
                <div className="grid cols-3">
                  <input type="number" min={30} value={planCadenceDays} onChange={(event) => setPlanCadenceDays(event.target.value)} placeholder="Cadence days" />
                  <input type="number" min={0} value={planLeadTimeDays} onChange={(event) => setPlanLeadTimeDays(event.target.value)} placeholder="Lead days" />
                  <input type="number" min={1} value={planValidityDays} onChange={(event) => setPlanValidityDays(event.target.value)} placeholder="Validity days" />
                </div>
                <label className="muted">
                  <input type="checkbox" checked={planApplyToRoleOnly} onChange={(event) => setPlanApplyToRoleOnly(event.target.checked)} />
                  {" "}Apply to all {selectedEmployee.employeeRole.replaceAll("_", " ")} profiles
                </label>
                <button className="button secondary" type="submit" disabled={loading || actor?.role === "office_manager"}>
                  Add recurring plan
                </button>
              </form>

              <form className="stack" onSubmit={(event) => { void handleRecordCompletion(event); }}>
                <select value={completionRequirementId} onChange={(event) => setCompletionRequirementId(event.target.value)} required>
                  <option value="">Select requirement</option>
                  {(trainingDashboard?.requirements ?? []).map((requirement) => (
                    <option key={requirement.id} value={requirement.id}>
                      {requirement.title}
                    </option>
                  ))}
                </select>
                <input type="date" value={completionValidUntil} onChange={(event) => setCompletionValidUntil(event.target.value)} />
                <textarea value={completionNote} onChange={(event) => setCompletionNote(event.target.value)} rows={3} placeholder="Optional note" />
                <button className="button secondary" type="submit" disabled={loading || !completionRequirementId || !["hr_lead", "medical_director"].includes(actor?.role ?? "")}>
                  Record completion
                </button>
              </form>
            </div>
          ) : (
            <div className="muted">Select an employee before adding requirements or completions.</div>
          )}
        </div>
      </div>

      <div className="card">
        <h2>Recent import jobs</h2>
        <ul>
          {jobs.slice(0, 8).map((job) => (
            <li key={job.id}>
              <strong>{job.type}</strong> <span className={`badge badge-${job.status}`}>{job.status}</span>
              <div className="muted">
                {job.sourceEntityType ?? "worker_job"} / {job.sourceEntityId ?? job.id}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
