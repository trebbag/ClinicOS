"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useAppAuth } from "../../components/auth-provider";
import { apiRequest } from "../../lib/api";

type ActionItem = {
  id: string;
  kind: string;
  title: string;
  description: string | null;
  status: string;
  dueDate: string | null;
  resolutionNote: string | null;
  escalationStatus: string;
  plannerTaskId: string | null;
  syncStatus: string;
  lastSyncedAt: string | null;
  lastSyncError: string | null;
};

type DocumentRecord = {
  id: string;
  title: string;
  status: string;
  updatedAt: string;
};

type WorkflowRun = {
  id: string;
  state: string;
  createdAt: string;
};

type WorkerJob = {
  id: string;
  type: string;
  status: string;
  sourceEntityType: string | null;
  sourceEntityId: string | null;
  updatedAt: string;
};

type ChecklistItem = {
  id: string;
  areaLabel: string;
  label: string;
  required: boolean;
  status: string;
  note: string | null;
  reviewActionItemId: string | null;
};

type OfficeDashboard = {
  targetDate: string;
  closeoutDueAt: string;
  closeoutCutoffStatus: "before_cutoff" | "due_soon" | "overdue";
  closeoutSubmitted: boolean;
  workflowRun: WorkflowRun | null;
  dailyPacket: DocumentRecord | null;
  closeoutDocument: DocumentRecord | null;
  checklistRun: { id: string } | null;
  checklistItems: ChecklistItem[];
  issues: ActionItem[];
  routineItems: ActionItem[];
  escalations: ActionItem[];
  relatedJobs: WorkerJob[];
  checklist: {
    totalItems: number;
    completedItems: number;
    blockedItems: number;
    waivedItems: number;
    pendingItems: number;
    requiredRemaining: number;
  };
  plannerSync: {
    pendingCreate: number;
    synced: number;
    syncErrors: number;
    externallyCompleted: number;
  };
  counts: {
    openIssues: number;
    overdueItems: number;
    escalatedItems: number;
  };
};

function statusBadge(status: string): string {
  return status.replaceAll("_", " ");
}

export default function OfficeManagerPage(): JSX.Element {
  const { actor } = useAppAuth();
  const today = new Date().toISOString().slice(0, 10);
  const [dashboard, setDashboard] = useState<OfficeDashboard | null>(null);
  const [issueTitle, setIssueTitle] = useState("");
  const [issueDescription, setIssueDescription] = useState("");
  const [closeoutNotes, setCloseoutNotes] = useState("");
  const [checklistNotes, setChecklistNotes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    if (!actor) {
      return;
    }

    try {
      const status = await apiRequest<OfficeDashboard>(`/office-ops/dashboard?date=${today}`, actor);
      setDashboard(status);
      setChecklistNotes((current) => {
        const next = { ...current };
        for (const item of status.checklistItems) {
          next[item.id] = current[item.id] ?? item.note ?? "";
        }
        return next;
      });
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load office-manager cockpit.");
    }
  }

  useEffect(() => {
    if (!actor || actor.role !== "office_manager") {
      return;
    }

    void load();
  }, [actor, today]);

  const latestJobBySource = useMemo(() => {
    const lookup = new Map<string, WorkerJob>();
    for (const job of dashboard?.relatedJobs ?? []) {
      const key = `${job.sourceEntityType ?? "worker_job"}:${job.sourceEntityId ?? job.id}`;
      if (!lookup.has(key)) {
        lookup.set(key, job);
      }
    }
    return lookup;
  }, [dashboard?.relatedJobs]);

  async function handleCreateIssue(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);

    try {
      await apiRequest("/action-items", actor, {
        method: "POST",
        body: JSON.stringify({
          kind: "issue",
          title: issueTitle,
          description: issueDescription,
          ownerRole: "office_manager",
          dueDate: dashboard?.closeoutDueAt
        })
      });
      setIssueTitle("");
      setIssueDescription("");
      await load();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to create issue.");
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerateDailyPacket() {
    setLoading(true);
    try {
      await apiRequest("/office-ops/daily-packet", actor, {
        method: "POST",
        body: JSON.stringify({ targetDate: today })
      });
      await load();
    } catch (packetError) {
      setError(packetError instanceof Error ? packetError.message : "Unable to generate daily packet.");
    } finally {
      setLoading(false);
    }
  }

  async function handleCloseout() {
    setLoading(true);
    try {
      await apiRequest("/office-ops/daily-closeout", actor, {
        method: "POST",
        body: JSON.stringify({
          targetDate: today,
          notes: closeoutNotes
        })
      });
      setCloseoutNotes("");
      await load();
    } catch (closeoutError) {
      setError(closeoutError instanceof Error ? closeoutError.message : "Unable to submit closeout.");
    } finally {
      setLoading(false);
    }
  }

  async function handleItemStatus(itemId: string, status: "in_progress" | "done") {
    setLoading(true);
    try {
      await apiRequest(`/action-items/${itemId}`, actor, {
        method: "PATCH",
        body: JSON.stringify({ status })
      });
      await load();
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Unable to update action item.");
    } finally {
      setLoading(false);
    }
  }

  async function handleChecklistUpdate(item: ChecklistItem, status: "complete" | "blocked" | "waived") {
    if (!dashboard?.checklistRun) {
      return;
    }

    setLoading(true);
    try {
      await apiRequest(`/office-ops/checklist-runs/${dashboard.checklistRun.id}/items/${item.id}`, actor, {
        method: "PATCH",
        body: JSON.stringify({
          status,
          note: checklistNotes[item.id] || undefined
        })
      });
      await load();
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Unable to update checklist item.");
    } finally {
      setLoading(false);
    }
  }

  async function handlePlannerReconcile() {
    setLoading(true);
    try {
      await apiRequest("/office-ops/reconcile-planner", actor, {
        method: "POST"
      });
      await load();
    } catch (reconcileError) {
      setError(reconcileError instanceof Error ? reconcileError.message : "Unable to trigger Planner reconciliation.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid" style={{ gap: 16 }}>
      <div className="card">
        <h1>Office Manager cockpit</h1>
        <p className="muted">
          Daily operating rhythm for huddles, room readiness, unresolved issues, Planner sync, closeout, and escalation visibility.
        </p>
        <div className="muted">
          Active profile: {actor ? `${actor.name} / ${actor.role}` : "No active profile"}
        </div>
        <div className="actions">
          <button className="button" onClick={() => { void handleGenerateDailyPacket(); }} disabled={loading}>
            Generate daily packet
          </button>
          <button className="button secondary" onClick={() => { void handlePlannerReconcile(); }} disabled={loading}>
            Reconcile Planner
          </button>
          <button
            className="button secondary"
            onClick={() => { void handleCloseout(); }}
            disabled={loading || !dashboard?.workflowRun || !dashboard?.dailyPacket || dashboard.closeoutSubmitted}
          >
            Submit closeout
          </button>
        </div>
      </div>

      {actor && actor.role !== "office_manager" ? (
        <div className="card error">This cockpit is reserved for the office-manager profile.</div>
      ) : null}

      {error ? <div className="card error">{error}</div> : null}

      <div className="grid cols-4">
        <div className="card">
          <div className="muted">Workflow</div>
          <div style={{ fontSize: "1.4rem", fontWeight: 700 }}>{dashboard?.workflowRun?.state ?? "not started"}</div>
          <div className="muted" style={{ marginTop: 8 }}>
            Cutoff: {dashboard?.closeoutCutoffStatus ? statusBadge(dashboard.closeoutCutoffStatus) : "n/a"}
          </div>
        </div>
        <div className="card">
          <div className="muted">Open issues</div>
          <div style={{ fontSize: "1.4rem", fontWeight: 700 }}>{dashboard?.counts.openIssues ?? 0}</div>
        </div>
        <div className="card">
          <div className="muted">Checklist remaining</div>
          <div style={{ fontSize: "1.4rem", fontWeight: 700 }}>{dashboard?.checklist.requiredRemaining ?? 0}</div>
          <div className="muted" style={{ marginTop: 8 }}>
            {dashboard?.checklist.blockedItems ?? 0} blocked / {dashboard?.checklist.pendingItems ?? 0} pending
          </div>
        </div>
        <div className="card">
          <div className="muted">Planner sync health</div>
          <div style={{ fontSize: "1.4rem", fontWeight: 700 }}>{dashboard?.plannerSync.synced ?? 0} synced</div>
          <div className="muted" style={{ marginTop: 8 }}>
            {dashboard?.plannerSync.syncErrors ?? 0} sync errors
          </div>
        </div>
      </div>

      <div className="grid cols-2">
        <div className="card">
          <h2>Raise issue</h2>
          <form className="stack" onSubmit={(event) => { void handleCreateIssue(event); }}>
            <input value={issueTitle} onChange={(event) => setIssueTitle(event.target.value)} placeholder="Issue title" required />
            <textarea value={issueDescription} onChange={(event) => setIssueDescription(event.target.value)} placeholder="Short description" rows={4} />
            <button className="button" type="submit" disabled={loading}>Create issue</button>
          </form>
        </div>

        <div className="card">
          <h2>Daily packet</h2>
          {dashboard?.dailyPacket ? (
            <div className="stack">
              <div>
                <strong>{dashboard.dailyPacket.title}</strong> <span className={`badge badge-${dashboard.dailyPacket.status}`}>{dashboard.dailyPacket.status}</span>
              </div>
              <div className="muted">
                Closeout due by {dashboard.closeoutDueAt ? new Date(dashboard.closeoutDueAt).toLocaleString() : "not set"}
              </div>
              <div className="muted">
                Checklist progress: {dashboard.checklist.completedItems}/{dashboard.checklist.totalItems} complete, {dashboard.checklist.waivedItems} waived
              </div>
              {dashboard.closeoutDocument ? (
                <div className="muted">
                  Closeout submitted: {dashboard.closeoutDocument.title}
                </div>
              ) : null}
              {latestJobBySource.get(`document:${dashboard.dailyPacket.id}`) ? (
                <div className="muted">
                  Latest document job: {latestJobBySource.get(`document:${dashboard.dailyPacket.id}`)?.type} / {latestJobBySource.get(`document:${dashboard.dailyPacket.id}`)?.status}
                </div>
              ) : null}
            </div>
          ) : (
            <div className="muted">Generate the daily packet to begin today’s office-ops workflow.</div>
          )}
        </div>
      </div>

      <div className="card">
        <h2>Room readiness checklist</h2>
        {dashboard?.checklistItems.length ? (
          <ul>
            {dashboard.checklistItems.map((item) => (
              <li key={item.id} style={{ marginBottom: 12 }}>
                <strong>{item.areaLabel}</strong> <span className={`badge badge-${item.status}`}>{statusBadge(item.status)}</span>
                {!item.required ? <span className="badge badge-archived" style={{ marginLeft: 8 }}>optional</span> : null}
                <div>{item.label}</div>
                <textarea
                  rows={2}
                  value={checklistNotes[item.id] ?? ""}
                  onChange={(event) => setChecklistNotes((current) => ({ ...current, [item.id]: event.target.value }))}
                  placeholder="Add note for blocked or waived items"
                  style={{ marginTop: 8 }}
                />
                <div className="actions" style={{ marginTop: 8 }}>
                  <button className="button secondary" onClick={() => { void handleChecklistUpdate(item, "complete"); }} disabled={loading}>
                    Complete
                  </button>
                  <button className="button secondary" onClick={() => { void handleChecklistUpdate(item, "waived"); }} disabled={loading}>
                    Waive
                  </button>
                  <button className="button secondary" onClick={() => { void handleChecklistUpdate(item, "blocked"); }} disabled={loading}>
                    Block
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="muted">Generate the daily packet to create today’s checklist run.</div>
        )}
      </div>

      <div className="card">
        <h2>Closeout notes</h2>
        <textarea value={closeoutNotes} onChange={(event) => setCloseoutNotes(event.target.value)} rows={4} placeholder="Summarize unresolved items, staffing notes, and escalations." />
      </div>

      <div className="grid cols-2">
        <div className="card">
          <h2>Open issues</h2>
          <ul>
            {(dashboard?.issues ?? []).map((item) => (
              <li key={item.id}>
                <strong>{item.title}</strong> <span className={`badge badge-${item.status}`}>{item.status}</span> <span className={`badge badge-${item.escalationStatus}`}>{statusBadge(item.escalationStatus)}</span>
                <div className="muted">{item.description ?? "No description"}</div>
                <div className="actions" style={{ marginTop: 8 }}>
                  {item.status === "open" ? (
                    <button className="button secondary" onClick={() => { void handleItemStatus(item.id, "in_progress"); }} disabled={loading}>
                      Start
                    </button>
                  ) : null}
                  {item.status !== "done" ? (
                    <button className="button secondary" onClick={() => { void handleItemStatus(item.id, "done"); }} disabled={loading}>
                      Mark done
                    </button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="card">
          <h2>Follow-through queue</h2>
          <ul>
            {(dashboard?.routineItems ?? []).map((item) => (
              <li key={item.id}>
                <strong>{item.title}</strong> <span className={`badge badge-${item.status}`}>{item.status}</span> <span className={`badge badge-${item.escalationStatus}`}>{statusBadge(item.escalationStatus)}</span>
                <div className="muted">{item.description ?? "No description"}</div>
                {item.dueDate ? <div className="muted">Due: {new Date(item.dueDate).toLocaleString()}</div> : null}
                <div className="muted">
                  Planner: {item.syncStatus}
                  {item.plannerTaskId ? ` / ${item.plannerTaskId}` : ""}
                  {item.lastSyncError ? ` / ${item.lastSyncError}` : ""}
                </div>
                <div className="actions" style={{ marginTop: 8 }}>
                  {item.status === "open" ? (
                    <button className="button secondary" onClick={() => { void handleItemStatus(item.id, "in_progress"); }} disabled={loading}>
                      Start
                    </button>
                  ) : null}
                  {item.status !== "done" ? (
                    <button className="button secondary" onClick={() => { void handleItemStatus(item.id, "done"); }} disabled={loading}>
                      Mark done
                    </button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="card">
        <h2>Medical-director escalations</h2>
        <ul>
          {(dashboard?.escalations ?? []).map((item) => (
            <li key={item.id}>
              <strong>{item.title}</strong> <span className={`badge badge-${item.status}`}>{item.status}</span>
              <div className="muted">{item.description ?? "No description"}</div>
              <div className="muted">Planner sync: {item.syncStatus}</div>
            </li>
          ))}
        </ul>
      </div>

      <div className="card">
        <h2>Related jobs</h2>
        <ul>
          {(dashboard?.relatedJobs ?? []).slice(0, 8).map((job) => (
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
