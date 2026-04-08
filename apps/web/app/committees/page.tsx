"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { apiRequest, type ActorRole } from "../../lib/api";
import { useAppAuth } from "../../components/auth-provider";

type CommitteeRecord = {
  id: string;
  name: string;
  category: "leadership" | "qapi" | "hr_training" | "revenue_commercial" | "service_line_governance" | "custom";
  cadence: "monthly" | "quarterly" | "semiannual" | "annual" | "ad_hoc";
  chairRole: ActorRole;
  recorderRole: ActorRole;
  scope: string;
  serviceLine: string | null;
  qapiFocus: boolean;
  isActive: boolean;
};

type CommitteeAgendaItem = {
  id: string;
  title: string;
  summary: string;
  ownerRole: ActorRole;
  dueDate: string | null;
  status: "proposed" | "confirmed" | "carried_forward" | "closed";
  linkedIncidentId: string | null;
  linkedCapaId: string | null;
};

type CommitteeDecisionRecord = {
  id: string;
  summary: string;
  ownerRole: ActorRole;
  dueDate: string | null;
  status: "open" | "in_progress" | "closed" | "deferred";
  actionItemId: string | null;
  linkedIncidentId: string | null;
  linkedCapaId: string | null;
  notes: string | null;
};

type CommitteeQapiSnapshot = {
  openIncidents: number;
  criticalIncidents: number;
  openCapas: number;
  overdueCapas: number;
  overdueActionItems: number;
  pendingApprovals: number;
  overdueScorecardReviews: number;
  queuedJobs: number;
  summaryNote: string | null;
};

type CommitteeQapiDashboardSummary = {
  openIncidents: number;
  criticalIncidents: number;
  openCapas: number;
  overdueCapas: number;
  overdueActionItems: number;
  pendingApprovals: number;
  overdueScorecardReviews: number;
  queuedJobs: number;
  standardsAttentionNeeded: number;
  standardsReviewPending: number;
  overdueStandardsReviews: number;
  evidenceBindersDraft: number;
  evidenceBindersInReview: number;
  controlledSubstancePacketsNeedingReview: number;
  controlledSubstancePacketsPublished: number;
  telehealthPacketsNeedingReview: number;
  practiceAgreementsExpiringSoon: number;
};

type CommitteeMeetingRecord = {
  id: string;
  committeeId: string;
  title: string;
  scheduledFor: string;
  status: "planned" | "packet_drafting" | "packet_ready" | "review_pending" | "approved" | "completed" | "cancelled" | "sent_back";
  packetDocumentId: string | null;
  workflowRunId: string | null;
  notes: string | null;
  agendaItems: CommitteeAgendaItem[];
  decisions: CommitteeDecisionRecord[];
  qapiSnapshot: CommitteeQapiSnapshot | null;
  completedAt: string | null;
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

const committeeCategories: CommitteeRecord["category"][] = [
  "leadership",
  "qapi",
  "hr_training",
  "revenue_commercial",
  "service_line_governance",
  "custom"
];

const committeeCadences: CommitteeRecord["cadence"][] = [
  "monthly",
  "quarterly",
  "semiannual",
  "annual",
  "ad_hoc"
];

const serviceLines = [
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
] as const;

function parseAgendaItems(text: string): Array<{
  title: string;
  ownerRole: ActorRole;
  summary: string;
  dueDate?: string;
}> {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [title, ownerRole, summary, dueDate] = line.split("|").map((part) => part.trim());
      if (!title || !ownerRole || !summary) {
        throw new Error("Agenda lines must use: title | owner_role | summary | optional due date");
      }
      if (!actorRoles.includes(ownerRole as ActorRole)) {
        throw new Error(`Unknown owner role in agenda line: ${ownerRole}`);
      }
      return {
        title,
        ownerRole: ownerRole as ActorRole,
        summary,
        dueDate: dueDate || undefined
      };
    });
}

export default function CommitteesPage(): JSX.Element {
  const { actor, hasCapability } = useAppAuth();
  const [committees, setCommittees] = useState<CommitteeRecord[]>([]);
  const [meetings, setMeetings] = useState<CommitteeMeetingRecord[]>([]);
  const [approvals, setApprovals] = useState<ApprovalTask[]>([]);
  const [qapiSummary, setQapiSummary] = useState<CommitteeQapiDashboardSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selectedMeetingId, setSelectedMeetingId] = useState<string | null>(null);

  const [committeeName, setCommitteeName] = useState("QAPI Committee");
  const [committeeCategory, setCommitteeCategory] = useState<CommitteeRecord["category"]>("qapi");
  const [committeeCadence, setCommitteeCadence] = useState<CommitteeRecord["cadence"]>("monthly");
  const [committeeChairRole, setCommitteeChairRole] = useState<ActorRole>("medical_director");
  const [committeeRecorderRole, setCommitteeRecorderRole] = useState<ActorRole>("quality_lead");
  const [committeeScope, setCommitteeScope] = useState("Monthly quality review, incident themes, CAPA follow-through, and dashboard review.");
  const [committeeServiceLine, setCommitteeServiceLine] = useState("");

  const [meetingCommitteeId, setMeetingCommitteeId] = useState("");
  const [meetingTitle, setMeetingTitle] = useState("");
  const [meetingScheduledFor, setMeetingScheduledFor] = useState(new Date().toISOString().slice(0, 10));
  const [meetingNotes, setMeetingNotes] = useState("Focus on open incidents, CAPA verification, and any overdue action items.");
  const [meetingAgendaText, setMeetingAgendaText] = useState([
    "Open incident themes | quality_lead | Review incident trends from the last 30 days |",
    "CAPA follow-through | medical_director | Confirm overdue CAPAs and verification steps |",
    "Action-item backlog | office_manager | Review overdue action items and assign owners |"
  ].join("\n"));
  const [meetingQapiNote, setMeetingQapiNote] = useState("Highlight any repeat incident themes or operational exceptions.");

  const [decisionSummary, setDecisionSummary] = useState("Assign follow-up on overdue CAPA verification.");
  const [decisionOwnerRole, setDecisionOwnerRole] = useState<ActorRole>("quality_lead");
  const [decisionDueDate, setDecisionDueDate] = useState("");
  const [decisionNotes, setDecisionNotes] = useState("Return with verification evidence at the next committee review.");

  const canView = hasCapability("committees.view");
  const canManage = hasCapability("committees.manage");
  const selectedMeeting = useMemo(
    () => meetings.find((meeting) => meeting.id === selectedMeetingId) ?? null,
    [meetings, selectedMeetingId]
  );
  const committeeById = useMemo(
    () => new Map(committees.map((committee) => [committee.id, committee])),
    [committees]
  );
  const pendingApprovalCountByDocument = useMemo(() => {
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
      const [committeeRows, meetingRows, qapiDashboard, approvalRows] = await Promise.all([
        apiRequest<CommitteeRecord[]>("/committees?isActive=true", actor),
        apiRequest<CommitteeMeetingRecord[]>("/committee-meetings", actor),
        apiRequest<CommitteeQapiDashboardSummary>("/committees/qapi-summary", actor),
        hasCapability("approvals.view")
          ? apiRequest<ApprovalTask[]>("/approvals?status=requested", actor)
          : Promise.resolve([])
      ]);
      setCommittees(committeeRows);
      setMeetings(meetingRows);
      setQapiSummary(qapiDashboard);
      setApprovals(approvalRows);
      setMeetingCommitteeId((current) => current || committeeRows[0]?.id || "");
      setSelectedMeetingId((current) => current ?? meetingRows[0]?.id ?? null);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load committees.");
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
      setError(mutationError instanceof Error ? mutationError.message : "Unable to save committee update.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleBootstrapDefaults(): Promise<void> {
    if (!actor) {
      return;
    }
    await runMutation(async () => {
      await apiRequest("/committees/bootstrap-defaults", actor, {
        method: "POST"
      });
    });
  }

  async function handleCreateCommittee(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!actor) {
      return;
    }

    await runMutation(async () => {
      await apiRequest("/committees", actor, {
        method: "POST",
        body: JSON.stringify({
          name: committeeName,
          category: committeeCategory,
          cadence: committeeCadence,
          chairRole: committeeChairRole,
          recorderRole: committeeRecorderRole,
          scope: committeeScope,
          serviceLine: committeeServiceLine || undefined,
          qapiFocus: committeeCategory === "qapi"
        })
      });
    });
  }

  async function handleCreateMeeting(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!actor) {
      return;
    }

    await runMutation(async () => {
      await apiRequest("/committee-meetings", actor, {
        method: "POST",
        body: JSON.stringify({
          committeeId: meetingCommitteeId,
          title: meetingTitle || undefined,
          scheduledFor: `${meetingScheduledFor}T14:00:00.000Z`,
          notes: meetingNotes || undefined,
          agendaItems: parseAgendaItems(meetingAgendaText),
          qapiSummaryNote: meetingQapiNote || undefined
        })
      });
    });
  }

  async function handleGeneratePacket(meetingId: string): Promise<void> {
    if (!actor) {
      return;
    }
    await runMutation(async () => {
      await apiRequest(`/committee-meetings/${meetingId}/generate-packet`, actor, {
        method: "POST"
      });
    });
  }

  async function handleSubmitPacket(meetingId: string): Promise<void> {
    if (!actor) {
      return;
    }
    await runMutation(async () => {
      await apiRequest(`/committee-meetings/${meetingId}/submit`, actor, {
        method: "POST"
      });
    });
  }

  async function handleRecordDecision(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!actor || !selectedMeeting) {
      return;
    }
    await runMutation(async () => {
      await apiRequest(`/committee-meetings/${selectedMeeting.id}/record-decisions`, actor, {
        method: "POST",
        body: JSON.stringify({
          decisions: [
            {
              summary: decisionSummary,
              ownerRole: decisionOwnerRole,
              dueDate: decisionDueDate || undefined,
              notes: decisionNotes || undefined
            }
          ]
        })
      });
    });
  }

  async function handleCompleteMeeting(meetingId: string): Promise<void> {
    if (!actor) {
      return;
    }
    await runMutation(async () => {
      await apiRequest(`/committee-meetings/${meetingId}/complete`, actor, {
        method: "POST",
        body: JSON.stringify({
          notes: "Committee review completed and minutes captured."
        })
      });
    });
  }

  if (!actor) {
    return (
      <section className="stack">
        <div className="card">Sign in to access committees and QAPI workflows.</div>
      </section>
    );
  }

  if (!canView) {
    return (
      <section className="stack">
        <div className="card">Your current role cannot access committee workflows.</div>
      </section>
    );
  }

  return (
    <section className="stack">
      <header className="stack">
        <span className="eyebrow">Committee And QAPI Governance</span>
        <div className="page-header">
          <div>
            <h1>Committees</h1>
            <p className="muted">
              Schedule governance meetings, generate packets, route them for human approval, and record committee follow-up decisions.
            </p>
          </div>
          {canManage ? (
            <div className="actions">
              <button className="button secondary" type="button" onClick={() => void handleBootstrapDefaults()} disabled={submitting}>
                Bootstrap recommended committees
              </button>
            </div>
          ) : null}
        </div>
      </header>

      {error ? <div className="card error">{error}</div> : null}

      {qapiSummary ? (
        <article className="card stack">
          <div className="actions" style={{ justifyContent: "space-between" }}>
            <h2>QAPI Dashboard</h2>
            <span className="muted">Live governance snapshot</span>
          </div>
          <div className="grid cols-4">
            <div className="card">
              <div className="muted">Open incidents</div>
              <strong>{qapiSummary.openIncidents}</strong>
              <div className="muted">Critical: {qapiSummary.criticalIncidents}</div>
            </div>
            <div className="card">
              <div className="muted">Open CAPAs</div>
              <strong>{qapiSummary.openCapas}</strong>
              <div className="muted">Overdue: {qapiSummary.overdueCapas}</div>
            </div>
            <div className="card">
              <div className="muted">Pending approvals</div>
              <strong>{qapiSummary.pendingApprovals}</strong>
              <div className="muted">Queued jobs: {qapiSummary.queuedJobs}</div>
            </div>
            <div className="card">
              <div className="muted">Overdue actions</div>
              <strong>{qapiSummary.overdueActionItems}</strong>
              <div className="muted">Scorecard reviews: {qapiSummary.overdueScorecardReviews}</div>
            </div>
          </div>
          <div className="grid cols-4">
            <div className="card">
              <div className="muted">Standards needing attention</div>
              <strong>{qapiSummary.standardsAttentionNeeded}</strong>
              <div className="muted">Review pending: {qapiSummary.standardsReviewPending}</div>
            </div>
            <div className="card">
              <div className="muted">Overdue standard reviews</div>
              <strong>{qapiSummary.overdueStandardsReviews}</strong>
              <div className="muted">Binder drafts: {qapiSummary.evidenceBindersDraft}</div>
            </div>
            <div className="card">
              <div className="muted">Evidence binders in review</div>
              <strong>{qapiSummary.evidenceBindersInReview}</strong>
              <div className="muted">Controlled-substance review: {qapiSummary.controlledSubstancePacketsNeedingReview}</div>
            </div>
            <div className="card">
              <div className="muted">Published controlled-substance packets</div>
              <strong>{qapiSummary.controlledSubstancePacketsPublished}</strong>
              <div className="muted">Telehealth review: {qapiSummary.telehealthPacketsNeedingReview}</div>
            </div>
          </div>
          <div className="grid cols-2">
            <div className="card">
              <div className="muted">Practice agreements expiring soon</div>
              <strong>{qapiSummary.practiceAgreementsExpiringSoon}</strong>
            </div>
            <div className="card">
              <div className="muted">QAPI attention summary</div>
              <div>
                {qapiSummary.criticalIncidents > 0 || qapiSummary.overdueCapas > 0 || qapiSummary.overdueStandardsReviews > 0
                  ? "Escalation needed across active governance signals."
                  : "No critical governance escalations in the current snapshot."}
              </div>
            </div>
          </div>
        </article>
      ) : null}

      <div className="grid cols-2">
        <article className="card stack">
          <h2>Committee Registry</h2>
          <div className="muted">
            Active committees: {committees.length}
          </div>
          <div className="stack">
            {committees.map((committee) => (
              <div key={committee.id} className="card">
                <div className="actions" style={{ justifyContent: "space-between" }}>
                  <strong>{committee.name}</strong>
                  <span className={`badge badge-${committee.qapiFocus ? "approved" : "queued"}`}>
                    {committee.qapiFocus ? "QAPI" : committee.category.replaceAll("_", " ")}
                  </span>
                </div>
                <div className="muted">
                  {committee.cadence} / chair {committee.chairRole} / recorder {committee.recorderRole}
                </div>
                <div>{committee.scope}</div>
                {committee.serviceLine ? <div className="muted">Service line: {committee.serviceLine}</div> : null}
              </div>
            ))}
          </div>
        </article>

        {canManage ? (
          <article className="card stack">
            <h2>Create Committee</h2>
            <form className="stack" onSubmit={(event) => void handleCreateCommittee(event)}>
              <label className="stack">
                <span>Name</span>
                <input value={committeeName} onChange={(event) => setCommitteeName(event.target.value)} />
              </label>
              <div className="grid cols-2">
                <label className="stack">
                  <span>Category</span>
                  <select value={committeeCategory} onChange={(event) => setCommitteeCategory(event.target.value as CommitteeRecord["category"])}>
                    {committeeCategories.map((category) => (
                      <option key={category} value={category}>
                        {category.replaceAll("_", " ")}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="stack">
                  <span>Cadence</span>
                  <select value={committeeCadence} onChange={(event) => setCommitteeCadence(event.target.value as CommitteeRecord["cadence"])}>
                    {committeeCadences.map((cadence) => (
                      <option key={cadence} value={cadence}>
                        {cadence}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="grid cols-2">
                <label className="stack">
                  <span>Chair role</span>
                  <select value={committeeChairRole} onChange={(event) => setCommitteeChairRole(event.target.value as ActorRole)}>
                    {actorRoles.map((role) => (
                      <option key={role} value={role}>{role}</option>
                    ))}
                  </select>
                </label>
                <label className="stack">
                  <span>Recorder role</span>
                  <select value={committeeRecorderRole} onChange={(event) => setCommitteeRecorderRole(event.target.value as ActorRole)}>
                    {actorRoles.map((role) => (
                      <option key={role} value={role}>{role}</option>
                    ))}
                  </select>
                </label>
              </div>
              <label className="stack">
                <span>Service line</span>
                <select value={committeeServiceLine} onChange={(event) => setCommitteeServiceLine(event.target.value)}>
                  <option value="">None</option>
                  {serviceLines.map((line) => (
                    <option key={line} value={line}>{line}</option>
                  ))}
                </select>
              </label>
              <label className="stack">
                <span>Scope</span>
                <textarea rows={4} value={committeeScope} onChange={(event) => setCommitteeScope(event.target.value)} />
              </label>
              <button className="button" type="submit" disabled={submitting}>
                Create committee
              </button>
            </form>
          </article>
        ) : null}
      </div>

      {canManage ? (
        <article className="card stack">
          <h2>Schedule Meeting</h2>
          <form className="stack" onSubmit={(event) => void handleCreateMeeting(event)}>
            <div className="grid cols-2">
              <label className="stack">
                <span>Committee</span>
                <select value={meetingCommitteeId} onChange={(event) => setMeetingCommitteeId(event.target.value)}>
                  {committees.map((committee) => (
                    <option key={committee.id} value={committee.id}>{committee.name}</option>
                  ))}
                </select>
              </label>
              <label className="stack">
                <span>Scheduled date</span>
                <input type="date" value={meetingScheduledFor} onChange={(event) => setMeetingScheduledFor(event.target.value)} />
              </label>
            </div>
            <label className="stack">
              <span>Meeting title</span>
              <input value={meetingTitle} onChange={(event) => setMeetingTitle(event.target.value)} placeholder="Optional custom title" />
            </label>
            <label className="stack">
              <span>Notes</span>
              <textarea rows={3} value={meetingNotes} onChange={(event) => setMeetingNotes(event.target.value)} />
            </label>
            <label className="stack">
              <span>Agenda items</span>
              <textarea rows={6} value={meetingAgendaText} onChange={(event) => setMeetingAgendaText(event.target.value)} />
              <span className="muted">One per line: title | owner_role | summary | optional due date</span>
            </label>
            <label className="stack">
              <span>QAPI note</span>
              <textarea rows={2} value={meetingQapiNote} onChange={(event) => setMeetingQapiNote(event.target.value)} />
            </label>
            <button className="button" type="submit" disabled={submitting || committees.length === 0}>
              Schedule meeting
            </button>
          </form>
        </article>
      ) : null}

      <article className="card stack">
        <div className="actions" style={{ justifyContent: "space-between" }}>
          <h2>Meetings</h2>
          <span className="muted">{loading ? "Loading..." : `${meetings.length} meetings`}</span>
        </div>
        <div className="stack">
          {meetings.map((meeting) => {
            const committee = committeeById.get(meeting.committeeId);
            const pendingApprovals = meeting.packetDocumentId ? pendingApprovalCountByDocument[meeting.packetDocumentId] ?? 0 : 0;
            return (
              <div key={meeting.id} className="card stack">
                <div className="actions" style={{ justifyContent: "space-between" }}>
                  <div>
                    <strong>{meeting.title}</strong>
                    <div className="muted">
                      {committee?.name ?? "Unknown committee"} / {new Date(meeting.scheduledFor).toLocaleString()}
                    </div>
                  </div>
                  <span className={`badge badge-${meeting.status}`}>{meeting.status.replaceAll("_", " ")}</span>
                </div>
                <div className="grid cols-3">
                  <div className="card">
                    <div className="muted">Agenda items</div>
                    <strong>{meeting.agendaItems.length}</strong>
                  </div>
                  <div className="card">
                    <div className="muted">Pending approvals</div>
                    <strong>{pendingApprovals}</strong>
                  </div>
                  <div className="card">
                    <div className="muted">Decisions logged</div>
                    <strong>{meeting.decisions.length}</strong>
                  </div>
                </div>
                {meeting.qapiSnapshot ? (
                  <div className="grid cols-4">
                    <div className="card"><div className="muted">Open incidents</div><strong>{meeting.qapiSnapshot.openIncidents}</strong></div>
                    <div className="card"><div className="muted">Open CAPAs</div><strong>{meeting.qapiSnapshot.openCapas}</strong></div>
                    <div className="card"><div className="muted">Overdue actions</div><strong>{meeting.qapiSnapshot.overdueActionItems}</strong></div>
                    <div className="card"><div className="muted">Pending approvals</div><strong>{meeting.qapiSnapshot.pendingApprovals}</strong></div>
                  </div>
                ) : null}
                <div className="actions">
                  <button className="button secondary" type="button" onClick={() => setSelectedMeetingId(meeting.id)}>
                    View decisions
                  </button>
                  {canManage && ["planned", "sent_back"].includes(meeting.status) ? (
                    <button className="button" type="button" onClick={() => void handleGeneratePacket(meeting.id)} disabled={submitting}>
                      Generate packet
                    </button>
                  ) : null}
                  {canManage && meeting.status === "packet_ready" ? (
                    <button className="button" type="button" onClick={() => void handleSubmitPacket(meeting.id)} disabled={submitting}>
                      Route for approval
                    </button>
                  ) : null}
                  {canManage && meeting.status === "approved" ? (
                    <button className="button secondary" type="button" onClick={() => void handleCompleteMeeting(meeting.id)} disabled={submitting}>
                      Complete meeting
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </article>

      {selectedMeeting ? (
        <article className="card stack">
          <h2>Meeting Decisions</h2>
          <div className="muted">
            {selectedMeeting.title} / status {selectedMeeting.status.replaceAll("_", " ")}
          </div>
          <div className="stack">
            {selectedMeeting.decisions.map((decision) => (
              <div key={decision.id} className="card">
                <div className="actions" style={{ justifyContent: "space-between" }}>
                  <strong>{decision.summary}</strong>
                  <span className={`badge badge-${decision.status}`}>{decision.status.replaceAll("_", " ")}</span>
                </div>
                <div className="muted">
                  owner {decision.ownerRole} / due {decision.dueDate ?? "n/a"}
                </div>
                {decision.actionItemId ? <div className="muted">Linked action item: {decision.actionItemId}</div> : null}
                {decision.notes ? <div>{decision.notes}</div> : null}
              </div>
            ))}
          </div>
          {canManage ? (
            <form className="stack" onSubmit={(event) => void handleRecordDecision(event)}>
              <label className="stack">
                <span>Decision summary</span>
                <input value={decisionSummary} onChange={(event) => setDecisionSummary(event.target.value)} />
              </label>
              <div className="grid cols-2">
                <label className="stack">
                  <span>Owner role</span>
                  <select value={decisionOwnerRole} onChange={(event) => setDecisionOwnerRole(event.target.value as ActorRole)}>
                    {actorRoles.map((role) => (
                      <option key={role} value={role}>{role}</option>
                    ))}
                  </select>
                </label>
                <label className="stack">
                  <span>Due date</span>
                  <input type="date" value={decisionDueDate} onChange={(event) => setDecisionDueDate(event.target.value)} />
                </label>
              </div>
              <label className="stack">
                <span>Notes</span>
                <textarea rows={3} value={decisionNotes} onChange={(event) => setDecisionNotes(event.target.value)} />
              </label>
              <button
                className="button"
                type="submit"
                disabled={submitting || !["approved", "completed"].includes(selectedMeeting.status)}
              >
                Record decision and create follow-up if due date is set
              </button>
            </form>
          ) : null}
        </article>
      ) : null}
    </section>
  );
}
