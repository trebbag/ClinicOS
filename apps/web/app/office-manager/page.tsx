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
  checklistRunId: string;
  areaLabel: string;
  label: string;
  required: boolean;
  status: string;
  note: string | null;
  reviewActionItemId: string | null;
};

type RoomReadiness = {
  room: {
    id: string;
    roomLabel: string;
    roomType: string;
    status: string;
    checklistAreaLabel: string;
    notes: string | null;
  };
  checklistRun: { id: string; roomId: string | null } | null;
  readinessStatus: "ready" | "attention_needed" | "blocked" | "inactive";
  counts: {
    totalItems: number;
    completedItems: number;
    blockedItems: number;
    waivedItems: number;
    pendingItems: number;
    requiredRemaining: number;
  };
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
  checklistRuns: Array<{ id: string; roomId: string | null }>;
  checklistItems: ChecklistItem[];
  rooms: RoomReadiness[];
  roomSummary: {
    activeRooms: number;
    readyRooms: number;
    attentionNeededRooms: number;
    blockedRooms: number;
    inactiveRooms: number;
  };
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

type OfficeAnalytics = {
  generatedAt: string;
  dateRangeStart: string;
  dateRangeEnd: string;
  roomId: string | null;
  roomType: string | null;
  readinessTrend: Array<{
    targetDate: string;
    readyRooms: number;
    attentionNeededRooms: number;
    blockedRooms: number;
    inactiveRooms: number;
  }>;
  rooms: Array<{
    roomId: string;
    roomLabel: string;
    roomType: string;
    trackedDays: number;
    readyDays: number;
    attentionNeededDays: number;
    blockedDays: number;
    inactiveDays: number;
    missedRequiredItems: number;
    repeatAttentionDays: number;
    averageCompletionLatencyMinutes: number | null;
  }>;
  checklist: {
    totalRuns: number;
    totalItems: number;
    completedItems: number;
    blockedItems: number;
    waivedItems: number;
    pendingItems: number;
    missedRequiredItems: number;
    averageCompletionLatencyMinutes: number | null;
  };
  plannerReconciliation: {
    pendingCreate: number;
    synced: number;
    syncErrors: number;
    externallyCompleted: number;
    openActionItems: number;
    overdueOpenActionItems: number;
    agingBuckets: {
      underSevenDays: number;
      sevenToThirtyDays: number;
      overThirtyDays: number;
    };
    workflowTypeBreakdown: Array<{
      workflowType: string;
      openActionItems: number;
      overdueOpenActionItems: number;
      pendingCreate: number;
      syncErrors: number;
    }>;
  };
  templatePerformance: Array<{
    templateId: string;
    templateName: string;
    workflowDefinitionId: string;
    totalRuns: number;
    blockedItems: number;
    missedRequiredItems: number;
    averageCompletionLatencyMinutes: number | null;
  }>;
  repeatAttentionRooms: Array<{
    roomId: string;
    roomLabel: string;
    roomType: string;
    attentionDays: number;
    blockedDays: number;
    missedRequiredItems: number;
  }>;
};

function statusBadge(status: string): string {
  return status.replaceAll("_", " ");
}

export default function OfficeManagerPage(): JSX.Element {
  const { actor } = useAppAuth();
  const today = new Date().toISOString().slice(0, 10);
  const [dashboard, setDashboard] = useState<OfficeDashboard | null>(null);
  const [analytics, setAnalytics] = useState<OfficeAnalytics | null>(null);
  const [analyticsWindowDays, setAnalyticsWindowDays] = useState("30");
  const [analyticsRoomType, setAnalyticsRoomType] = useState<"" | "front_desk" | "exam" | "procedure" | "lab" | "virtual" | "common">("");
  const [issueTitle, setIssueTitle] = useState("");
  const [issueDescription, setIssueDescription] = useState("");
  const [closeoutNotes, setCloseoutNotes] = useState("");
  const [checklistNotes, setChecklistNotes] = useState<Record<string, string>>({});
  const [newRoomId, setNewRoomId] = useState("");
  const [newRoomLabel, setNewRoomLabel] = useState("");
  const [newRoomType, setNewRoomType] = useState<"front_desk" | "exam" | "procedure" | "lab" | "virtual" | "common">("exam");
  const [newRoomAreaLabel, setNewRoomAreaLabel] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    if (!actor) {
      return;
    }

    try {
      const analyticsStartDate = new Date();
      analyticsStartDate.setUTCDate(analyticsStartDate.getUTCDate() - Math.max(0, Number(analyticsWindowDays) - 1));
      const analyticsDateFrom = analyticsStartDate.toISOString().slice(0, 10);
      const analyticsQuery = new URLSearchParams({
        dateFrom: analyticsDateFrom,
        dateTo: today
      });
      if (analyticsRoomType) {
        analyticsQuery.set("roomType", analyticsRoomType);
      }
      const [status, analyticsSummary] = await Promise.all([
        apiRequest<OfficeDashboard>(`/office-ops/dashboard?date=${today}`, actor),
        apiRequest<OfficeAnalytics>(`/office-ops/analytics?${analyticsQuery.toString()}`, actor)
      ]);
      setDashboard(status);
      setAnalytics(analyticsSummary);
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
  }, [actor, today, analyticsRoomType, analyticsWindowDays]);

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

  const roomLabelByRunId = useMemo(() => {
    const lookup = new Map<string, string>();
    for (const room of dashboard?.rooms ?? []) {
      if (room.checklistRun?.id) {
        lookup.set(room.checklistRun.id, room.room.roomLabel);
      }
    }
    return lookup;
  }, [dashboard?.rooms]);

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

  async function handleCreateRoom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    try {
      await apiRequest("/office-ops/rooms", actor, {
        method: "POST",
        body: JSON.stringify({
          id: newRoomId,
          roomLabel: newRoomLabel,
          roomType: newRoomType,
          checklistAreaLabel: newRoomAreaLabel || newRoomLabel
        })
      });
      setNewRoomId("");
      setNewRoomLabel("");
      setNewRoomAreaLabel("");
      setNewRoomType("exam");
      await load();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to create room.");
    } finally {
      setLoading(false);
    }
  }

  async function handleBootstrapRooms() {
    setLoading(true);
    try {
      await apiRequest("/office-ops/rooms/bootstrap-defaults", actor, {
        method: "POST"
      });
      await load();
    } catch (bootstrapError) {
      setError(bootstrapError instanceof Error ? bootstrapError.message : "Unable to bootstrap office rooms.");
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
    if (!item.checklistRunId) {
      return;
    }

    setLoading(true);
    try {
      await apiRequest(`/office-ops/checklist-runs/${item.checklistRunId}/items/${item.id}`, actor, {
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
          <div className="muted">Room readiness</div>
          <div style={{ fontSize: "1.4rem", fontWeight: 700 }}>{dashboard?.roomSummary.readyRooms ?? 0} ready</div>
          <div className="muted" style={{ marginTop: 8 }}>
            {dashboard?.roomSummary.blockedRooms ?? 0} blocked / {dashboard?.roomSummary.attentionNeededRooms ?? 0} attention needed
          </div>
        </div>
      </div>

      <div className="grid cols-3">
        <div className="card">
          <div className="muted">Tracked room runs</div>
          <div style={{ fontSize: "1.4rem", fontWeight: 700 }}>{analytics?.checklist.totalRuns ?? 0}</div>
          <div className="muted" style={{ marginTop: 8 }}>
            Missed required items {analytics?.checklist.missedRequiredItems ?? 0}
          </div>
        </div>
        <div className="card">
          <div className="muted">Average completion latency</div>
          <div style={{ fontSize: "1.4rem", fontWeight: 700 }}>
            {analytics?.checklist.averageCompletionLatencyMinutes != null ? `${analytics.checklist.averageCompletionLatencyMinutes} min` : "n/a"}
          </div>
          <div className="muted" style={{ marginTop: 8 }}>
            Across the current analytics window for room-bound checklist completions.
          </div>
        </div>
        <div className="card">
          <div className="muted">Planner reconciliation risk</div>
          <div style={{ fontSize: "1.4rem", fontWeight: 700 }}>{analytics?.plannerReconciliation.overdueOpenActionItems ?? 0}</div>
          <div className="muted" style={{ marginTop: 8 }}>
            Overdue open office-ops action items tied to Planner follow-through.
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
          <h2>Rooms</h2>
          <div className="actions" style={{ marginBottom: 12 }}>
            <button className="button secondary" onClick={() => { void handleBootstrapRooms(); }} disabled={loading}>
              Bootstrap default rooms
            </button>
          </div>
          <ul>
            {(dashboard?.rooms ?? []).map((entry) => (
              <li key={entry.room.id} style={{ marginBottom: 12 }}>
                <strong>{entry.room.roomLabel}</strong>{" "}
                <span className={`badge badge-${entry.readinessStatus}`}>{statusBadge(entry.readinessStatus)}</span>{" "}
                <span className={`badge badge-${entry.room.status}`}>{statusBadge(entry.room.status)}</span>
                <div className="muted">
                  {entry.room.roomType.replaceAll("_", " ")} / {entry.counts.completedItems} of {entry.counts.totalItems} checklist items complete
                </div>
              </li>
            ))}
          </ul>
          <form className="stack" onSubmit={(event) => { void handleCreateRoom(event); }}>
            <input value={newRoomId} onChange={(event) => setNewRoomId(event.target.value)} placeholder="room id" required />
            <input value={newRoomLabel} onChange={(event) => setNewRoomLabel(event.target.value)} placeholder="Room label" required />
            <select value={newRoomType} onChange={(event) => setNewRoomType(event.target.value as typeof newRoomType)}>
              <option value="exam">Exam</option>
              <option value="procedure">Procedure</option>
              <option value="lab">Lab</option>
              <option value="front_desk">Front desk</option>
              <option value="virtual">Virtual</option>
              <option value="common">Common</option>
            </select>
            <input value={newRoomAreaLabel} onChange={(event) => setNewRoomAreaLabel(event.target.value)} placeholder="Checklist area label" />
            <button className="button" type="submit" disabled={loading}>Create room</button>
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
              <div className="muted">
                Active rooms: {dashboard.roomSummary.activeRooms}, ready {dashboard.roomSummary.readyRooms}, blocked {dashboard.roomSummary.blockedRooms}
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

      <div className="grid cols-2">
        <div className="card">
          <h2>Room readiness trend</h2>
          <div className="actions" style={{ marginBottom: 12 }}>
            <label className="stack" style={{ minWidth: 180 }}>
              <span className="muted">Analytics window</span>
              <select value={analyticsWindowDays} onChange={(event) => setAnalyticsWindowDays(event.target.value)}>
                <option value="7">Last 7 days</option>
                <option value="14">Last 14 days</option>
                <option value="30">Last 30 days</option>
              </select>
            </label>
            <label className="stack" style={{ minWidth: 180 }}>
              <span className="muted">Room type filter</span>
              <select value={analyticsRoomType} onChange={(event) => setAnalyticsRoomType(event.target.value as typeof analyticsRoomType)}>
                <option value="">All room types</option>
                <option value="front_desk">Front desk</option>
                <option value="exam">Exam</option>
                <option value="procedure">Procedure</option>
                <option value="lab">Lab</option>
                <option value="virtual">Virtual</option>
                <option value="common">Common</option>
              </select>
            </label>
          </div>
          {analytics?.readinessTrend.length ? (
            <div className="table">
              <div className="table-row table-head">
                <span>Date</span>
                <span>Ready</span>
                <span>Attention needed</span>
                <span>Blocked</span>
              </div>
              {analytics.readinessTrend.map((bucket) => (
                <div key={bucket.targetDate} className="table-row">
                  <span>{bucket.targetDate}</span>
                  <span>{bucket.readyRooms}</span>
                  <span>{bucket.attentionNeededRooms}</span>
                  <span>{bucket.blockedRooms}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="muted">Room readiness analytics appear after room-bound checklist runs exist.</div>
          )}
        </div>

        <div className="card">
          <h2>Planner reconciliation</h2>
          <div className="grid cols-2">
            <div>
              <div className="muted">Pending create</div>
              <strong>{analytics?.plannerReconciliation.pendingCreate ?? 0}</strong>
            </div>
            <div>
              <div className="muted">Sync errors</div>
              <strong>{analytics?.plannerReconciliation.syncErrors ?? 0}</strong>
            </div>
            <div>
              <div className="muted">Externally completed</div>
              <strong>{analytics?.plannerReconciliation.externallyCompleted ?? 0}</strong>
            </div>
            <div>
              <div className="muted">Over 30 days old</div>
              <strong>{analytics?.plannerReconciliation.agingBuckets.overThirtyDays ?? 0}</strong>
            </div>
          </div>
          {analytics?.plannerReconciliation.workflowTypeBreakdown.length ? (
            <div className="table" style={{ marginTop: 16 }}>
              <div className="table-row table-head">
                <span>Workflow type</span>
                <span>Open</span>
                <span>Overdue</span>
                <span>Planner sync</span>
              </div>
              {analytics.plannerReconciliation.workflowTypeBreakdown.map((bucket) => (
                <div key={bucket.workflowType} className="table-row">
                  <span>{bucket.workflowType.replaceAll("_", " ")}</span>
                  <span>{bucket.openActionItems}</span>
                  <span>{bucket.overdueOpenActionItems}</span>
                  <span>{bucket.pendingCreate} pending / {bucket.syncErrors} errors</span>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <div className="card">
        <h2>Room performance</h2>
        {analytics?.rooms.length ? (
          <div className="table">
            <div className="table-row table-head">
              <span>Room</span>
              <span>Tracked days</span>
              <span>Ready / attention / blocked</span>
              <span>Missed required items</span>
              <span>Repeat attention / latency</span>
            </div>
            {analytics.rooms.map((room) => (
              <div key={room.roomId} className="table-row">
                <span>{room.roomLabel}</span>
                <span>{room.trackedDays}</span>
                <span>{room.readyDays} / {room.attentionNeededDays} / {room.blockedDays}</span>
                <span>{room.missedRequiredItems}</span>
                <span>
                  {room.repeatAttentionDays} repeat
                  {" / "}
                  {room.averageCompletionLatencyMinutes != null ? `${room.averageCompletionLatencyMinutes} min` : "n/a"}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="muted">No room analytics are available yet for this date range.</div>
        )}
      </div>

      <div className="grid cols-2">
        <div className="card">
          <h2>Checklist template performance</h2>
          {analytics?.templatePerformance.length ? (
            <div className="table">
              <div className="table-row table-head">
                <span>Template</span>
                <span>Runs</span>
                <span>Missed required</span>
                <span>Blocked / latency</span>
              </div>
              {analytics.templatePerformance.map((template) => (
                <div key={template.templateId} className="table-row">
                  <span>{template.templateName}</span>
                  <span>{template.totalRuns}</span>
                  <span>{template.missedRequiredItems}</span>
                  <span>
                    {template.blockedItems} blocked / {template.averageCompletionLatencyMinutes != null ? `${template.averageCompletionLatencyMinutes} min` : "n/a"}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="muted">Template-level analytics appear once checklist runs accumulate in the selected window.</div>
          )}
        </div>

        <div className="card">
          <h2>Repeat attention rooms</h2>
          {analytics?.repeatAttentionRooms.length ? (
            <div className="table">
              <div className="table-row table-head">
                <span>Room</span>
                <span>Attention days</span>
                <span>Blocked days</span>
                <span>Missed required</span>
              </div>
              {analytics.repeatAttentionRooms.map((room) => (
                <div key={room.roomId} className="table-row">
                  <span>{room.roomLabel}</span>
                  <span>{room.attentionDays}</span>
                  <span>{room.blockedDays}</span>
                  <span>{room.missedRequiredItems}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="muted">No repeat-attention room patterns are currently flagged in this window.</div>
          )}
        </div>
      </div>

      <div className="card">
        <h2>Room readiness checklist</h2>
        {dashboard?.checklistItems.length ? (
          <ul>
            {dashboard.checklistItems.map((item) => (
              <li key={item.id} style={{ marginBottom: 12 }}>
                <strong>{roomLabelByRunId.get(item.checklistRunId) ?? item.areaLabel}</strong>{" "}
                <span className={`badge badge-${item.status}`}>{statusBadge(item.status)}</span>
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
