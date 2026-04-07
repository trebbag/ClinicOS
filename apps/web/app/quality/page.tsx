"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useAppAuth } from "../../components/auth-provider";
import { apiRequest, type ActorIdentity, type ActorRole } from "../../lib/api";

type AuditEvent = {
  id: string;
  eventType: string;
  entityType: string;
  entityId: string;
  actorRole: string;
  createdAt: string;
};

type DocumentRecord = {
  id: string;
  title: string;
  status: string;
  reviewDueAt: string | null;
  publishedPath: string | null;
  body: string;
};

type WorkerJob = {
  id: string;
  type: string;
  status: string;
  sourceEntityType: string | null;
  sourceEntityId: string | null;
};

type IncidentRecord = {
  id: string;
  title: string;
  severity: "low" | "moderate" | "high" | "critical";
  category: string;
  detectedAt: string;
  detectedByRole: string;
  ownerRole: string;
  status: "open" | "under_review" | "capa_open" | "closed";
  summary: string;
  immediateResponse: string | null;
  resolutionNote: string | null;
  reviewActionItemId: string | null;
  linkedCapaId: string | null;
  dueDate: string | null;
  closedAt: string | null;
};

type CapaRecord = {
  id: string;
  title: string;
  summary: string;
  sourceId: string;
  sourceType: "incident" | "audit" | "committee_review" | "leadership_request";
  incidentId: string | null;
  ownerRole: string;
  dueDate: string;
  status: "open" | "in_progress" | "pending_verification" | "overdue" | "closed";
  correctiveAction: string;
  preventiveAction: string;
  verificationPlan: string | null;
  resolutionNote: string | null;
  actionItemId: string | null;
  closedAt: string | null;
};

const roleOptions: ActorRole[] = [
  "medical_director",
  "cfo",
  "office_manager",
  "hr_lead",
  "quality_lead",
  "patient_care_team_physician",
  "nurse_practitioner",
  "medical_assistant",
  "front_desk"
];

export default function QualityPage(): JSX.Element {
  const { actor, hasCapability } = useAppAuth();
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [publishedDocuments, setPublishedDocuments] = useState<DocumentRecord[]>([]);
  const [jobs, setJobs] = useState<WorkerJob[]>([]);
  const [incidents, setIncidents] = useState<IncidentRecord[]>([]);
  const [capas, setCapas] = useState<CapaRecord[]>([]);
  const [policyTitle, setPolicyTitle] = useState("Controlled-substance stewardship policy");
  const [policyObjective, setPolicyObjective] = useState("Refresh policy language and route for human approval.");
  const [policyBody, setPolicyBody] = useState("# Policy draft\n\n## Purpose\nCreate a controlled, reviewable policy draft.\n");
  const [incidentTitle, setIncidentTitle] = useState("Temperature log variance");
  const [incidentSeverity, setIncidentSeverity] = useState<IncidentRecord["severity"]>("moderate");
  const [incidentCategory, setIncidentCategory] = useState("environment");
  const [incidentSummary, setIncidentSummary] = useState("Morning vaccine fridge check found a log entry discrepancy requiring review.");
  const [incidentResponse, setIncidentResponse] = useState("Log quarantined pending review.");
  const [incidentOwnerRole, setIncidentOwnerRole] = useState<ActorRole>("quality_lead");
  const [incidentDueDate, setIncidentDueDate] = useState("");
  const [standaloneCapaTitle, setStandaloneCapaTitle] = useState("Audit follow-up for expired competency files");
  const [standaloneCapaSummary, setStandaloneCapaSummary] = useState("Close out the competency documentation gaps found during the weekly quality audit.");
  const [standaloneCapaSourceId, setStandaloneCapaSourceId] = useState("audit-weekly-quality");
  const [standaloneCapaOwnerRole, setStandaloneCapaOwnerRole] = useState<ActorRole>("quality_lead");
  const [standaloneCapaDueDate, setStandaloneCapaDueDate] = useState("");
  const [standaloneCorrectiveAction, setStandaloneCorrectiveAction] = useState("Reconcile missing files and document the corrected record set.");
  const [standalonePreventiveAction, setStandalonePreventiveAction] = useState("Add monthly competency file spot checks to the quality calendar.");
  const [standaloneVerificationPlan, setStandaloneVerificationPlan] = useState("Quality lead verifies sample files after remediation.");
  const [capaIncidentId, setCapaIncidentId] = useState<string | null>(null);
  const [capaFromIncidentTitle, setCapaFromIncidentTitle] = useState("");
  const [capaFromIncidentSummary, setCapaFromIncidentSummary] = useState("");
  const [capaFromIncidentOwnerRole, setCapaFromIncidentOwnerRole] = useState<ActorRole>("quality_lead");
  const [capaFromIncidentDueDate, setCapaFromIncidentDueDate] = useState("");
  const [capaFromIncidentCorrectiveAction, setCapaFromIncidentCorrectiveAction] = useState("");
  const [capaFromIncidentPreventiveAction, setCapaFromIncidentPreventiveAction] = useState("");
  const [capaFromIncidentVerificationPlan, setCapaFromIncidentVerificationPlan] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const canViewQuality = hasCapability("quality.view");
  const canManageQuality = hasCapability("quality.manage");

  function downloadArchiveDocument(document: DocumentRecord): void {
    const blob = new Blob([document.body], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = window.document.createElement("a");
    anchor.href = url;
    anchor.download = `${document.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.md`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function load() {
    if (!actor || !canViewQuality) {
      return;
    }

    try {
      const [auditEvents, published, pending, workerJobs, incidentRows, capaRows] = await Promise.all([
        apiRequest<AuditEvent[]>("/audit-events", actor),
        apiRequest<DocumentRecord[]>("/documents?status=published", actor),
        apiRequest<DocumentRecord[]>("/documents?status=publish_pending", actor),
        apiRequest<WorkerJob[]>("/worker-jobs?sourceEntityType=document", actor),
        apiRequest<IncidentRecord[]>("/incidents", actor),
        apiRequest<CapaRecord[]>("/capas", actor)
      ]);
      setEvents(auditEvents.slice(0, 10));
      setPublishedDocuments([...pending, ...published]);
      setJobs(workerJobs);
      setIncidents(incidentRows);
      setCapas(capaRows);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load quality dashboard.");
    }
  }

  useEffect(() => {
    void load();
  }, [actor, canViewQuality]);

  const latestJobByDocument = new Map<string, WorkerJob>();
  for (const job of jobs) {
    if (job.sourceEntityId && !latestJobByDocument.has(job.sourceEntityId)) {
      latestJobByDocument.set(job.sourceEntityId, job);
    }
  }

  async function runMutation(action: () => Promise<void>) {
    if (!actor) {
      return;
    }

    setSubmitting(true);
    try {
      await action();
      await load();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to save quality update.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCreatePolicy(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!actor) {
      return;
    }

    await runMutation(async () => {
      const workflow = await apiRequest<{ id: string }>("/workflow-runs", actor, {
        method: "POST",
        body: JSON.stringify({
          workflowId: "policy_lifecycle",
          input: {
            title: policyTitle,
            ownerRole: "quality_lead",
            approvalClass: "policy_effective",
            serviceLines: [],
            requestedBy: actor.actorId,
            objective: policyObjective
          }
        })
      });

      const document = await apiRequest<{ id: string }>("/documents", actor, {
        method: "POST",
        body: JSON.stringify({
          title: policyTitle,
          ownerRole: "quality_lead",
          approvalClass: "policy_effective",
          artifactType: "policy",
          summary: policyObjective,
          workflowRunId: workflow.id,
          serviceLines: [],
          body: policyBody
        })
      });

      for (const nextState of ["scoped", "drafted", "quality_checked", "compliance_checked"] as const) {
        await apiRequest(`/workflow-runs/${workflow.id}/transitions`, actor, {
          method: "POST",
          body: JSON.stringify({ nextState, note: `Advanced to ${nextState} from quality dashboard.` })
        });
      }

      await apiRequest(`/documents/${document.id}/submit`, actor, {
        method: "POST"
      });

      await apiRequest(`/workflow-runs/${workflow.id}/transitions`, actor, {
        method: "POST",
        body: JSON.stringify({
          nextState: "awaiting_human_review",
          note: "Submitted for human review from quality dashboard."
        })
      });
    });
  }

  async function handleCreateIncident(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!actor) {
      return;
    }

    await runMutation(async () => {
      await apiRequest("/incidents", actor, {
        method: "POST",
        body: JSON.stringify({
          title: incidentTitle,
          severity: incidentSeverity,
          category: incidentCategory,
          summary: incidentSummary,
          immediateResponse: incidentResponse,
          ownerRole: incidentOwnerRole,
          dueDate: incidentDueDate || undefined
        })
      });
      setIncidentTitle("Supply refrigerator variance");
      setIncidentSummary("Describe the event and what needs to be reviewed.");
      setIncidentResponse("");
      setIncidentDueDate("");
    });
  }

  async function handleCreateStandaloneCapa(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!actor) {
      return;
    }

    await runMutation(async () => {
      await apiRequest("/capas", actor, {
        method: "POST",
        body: JSON.stringify({
          title: standaloneCapaTitle,
          summary: standaloneCapaSummary,
          sourceId: standaloneCapaSourceId,
          sourceType: "audit",
          ownerRole: standaloneCapaOwnerRole,
          dueDate: standaloneCapaDueDate,
          correctiveAction: standaloneCorrectiveAction,
          preventiveAction: standalonePreventiveAction,
          verificationPlan: standaloneVerificationPlan
        })
      });
      setStandaloneCapaDueDate("");
    });
  }

  async function handleIncidentReview(incidentId: string, decision: "log_review" | "close_incident") {
    if (!actor) {
      return;
    }
    await runMutation(async () => {
      await apiRequest(`/incidents/${incidentId}/review`, actor, {
        method: "POST",
        body: JSON.stringify({ decision })
      });
    });
  }

  async function handleOpenCapaFromIncident(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!actor || !capaIncidentId) {
      return;
    }

    await runMutation(async () => {
      await apiRequest(`/incidents/${capaIncidentId}/review`, actor, {
        method: "POST",
        body: JSON.stringify({
          decision: "open_capa",
          capaTitle: capaFromIncidentTitle,
          capaSummary: capaFromIncidentSummary,
          ownerRole: capaFromIncidentOwnerRole,
          dueDate: capaFromIncidentDueDate,
          correctiveAction: capaFromIncidentCorrectiveAction,
          preventiveAction: capaFromIncidentPreventiveAction,
          verificationPlan: capaFromIncidentVerificationPlan
        })
      });
      setCapaIncidentId(null);
      setCapaFromIncidentTitle("");
      setCapaFromIncidentSummary("");
      setCapaFromIncidentDueDate("");
      setCapaFromIncidentCorrectiveAction("");
      setCapaFromIncidentPreventiveAction("");
      setCapaFromIncidentVerificationPlan("");
    });
  }

  async function handleResolveCapa(capaId: string, decision: "start" | "request_verification" | "close" | "reopen") {
    if (!actor) {
      return;
    }

    await runMutation(async () => {
      await apiRequest(`/capas/${capaId}/resolve`, actor, {
        method: "POST",
        body: JSON.stringify({ decision })
      });
    });
  }

  function seedIncidentCapaForm(incident: IncidentRecord): void {
    setCapaIncidentId(incident.id);
    setCapaFromIncidentTitle(`CAPA for ${incident.title}`);
    setCapaFromIncidentSummary(incident.summary);
    setCapaFromIncidentCorrectiveAction(incident.immediateResponse ?? "Document the corrective action to remediate this incident.");
    setCapaFromIncidentPreventiveAction("Add the preventive control that will reduce recurrence.");
    setCapaFromIncidentVerificationPlan("Quality lead verifies corrective and preventive steps were completed.");
  }

  const openIncidents = incidents.filter((incident) => incident.status !== "closed");
  const overdueCapas = capas.filter((capa) => capa.status === "overdue");

  return (
    <div className="grid" style={{ gap: 16 }}>
      <div className="card">
        <h1>Quality and accreditation</h1>
        <p className="muted">
          Review audit activity, manage incident and CAPA follow-through, and keep approved governance artifacts accessible.
        </p>
        <div className="muted">
          Active profile: {actor ? `${actor.name} / ${actor.role}` : "No active profile"}
        </div>
      </div>

      {!canViewQuality ? (
        <div className="card error">This screen is reserved for quality-capable profiles.</div>
      ) : null}

      {error ? <div className="card error">{error}</div> : null}

      {canViewQuality ? (
        <div className="grid cols-4">
          <div className="card">
            <h2>Open incidents</h2>
            <div className="kpi">{openIncidents.length}</div>
            <div className="muted">Incidents still awaiting closure or linked CAPA resolution.</div>
          </div>
          <div className="card">
            <h2>Open CAPAs</h2>
            <div className="kpi">{capas.filter((capa) => capa.status !== "closed").length}</div>
            <div className="muted">Corrective and preventive actions not yet closed.</div>
          </div>
          <div className="card">
            <h2>Overdue CAPAs</h2>
            <div className="kpi">{overdueCapas.length}</div>
            <div className="muted">CAPAs past due date and still unresolved.</div>
          </div>
          <div className="card">
            <h2>Archive items</h2>
            <div className="kpi">{publishedDocuments.length}</div>
            <div className="muted">Published or publish-pending controlled documents.</div>
          </div>
        </div>
      ) : null}

      {canViewQuality ? (
        <div className="grid cols-2">
          {canManageQuality ? (
            <div className="card">
              <h2>Log incident</h2>
              <form className="stack" onSubmit={(event) => { void handleCreateIncident(event); }}>
                <input value={incidentTitle} onChange={(event) => setIncidentTitle(event.target.value)} placeholder="Incident title" required />
                <select value={incidentSeverity} onChange={(event) => setIncidentSeverity(event.target.value as IncidentRecord["severity"])}>
                  <option value="low">Low</option>
                  <option value="moderate">Moderate</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
                <input value={incidentCategory} onChange={(event) => setIncidentCategory(event.target.value)} placeholder="Category" required />
                <textarea value={incidentSummary} onChange={(event) => setIncidentSummary(event.target.value)} rows={5} placeholder="Summary" required />
                <textarea value={incidentResponse} onChange={(event) => setIncidentResponse(event.target.value)} rows={3} placeholder="Immediate response" />
                <select value={incidentOwnerRole} onChange={(event) => setIncidentOwnerRole(event.target.value as ActorRole)}>
                  {roleOptions.map((role) => <option key={role} value={role}>{role}</option>)}
                </select>
                <input type="date" value={incidentDueDate} onChange={(event) => setIncidentDueDate(event.target.value)} />
                <button className="button" type="submit" disabled={submitting}>Log incident</button>
              </form>
            </div>
          ) : null}

          {canManageQuality ? (
            <div className="card">
              <h2>Open standalone CAPA</h2>
              <form className="stack" onSubmit={(event) => { void handleCreateStandaloneCapa(event); }}>
                <input value={standaloneCapaTitle} onChange={(event) => setStandaloneCapaTitle(event.target.value)} placeholder="CAPA title" required />
                <textarea value={standaloneCapaSummary} onChange={(event) => setStandaloneCapaSummary(event.target.value)} rows={4} placeholder="Summary" required />
                <input value={standaloneCapaSourceId} onChange={(event) => setStandaloneCapaSourceId(event.target.value)} placeholder="Source ID" required />
                <select value={standaloneCapaOwnerRole} onChange={(event) => setStandaloneCapaOwnerRole(event.target.value as ActorRole)}>
                  {roleOptions.map((role) => <option key={role} value={role}>{role}</option>)}
                </select>
                <input type="date" value={standaloneCapaDueDate} onChange={(event) => setStandaloneCapaDueDate(event.target.value)} required />
                <textarea value={standaloneCorrectiveAction} onChange={(event) => setStandaloneCorrectiveAction(event.target.value)} rows={3} placeholder="Corrective action" required />
                <textarea value={standalonePreventiveAction} onChange={(event) => setStandalonePreventiveAction(event.target.value)} rows={3} placeholder="Preventive action" required />
                <textarea value={standaloneVerificationPlan} onChange={(event) => setStandaloneVerificationPlan(event.target.value)} rows={2} placeholder="Verification plan" />
                <button className="button" type="submit" disabled={submitting}>Create CAPA</button>
              </form>
            </div>
          ) : null}

          <div className="card">
            <h2>Incident register</h2>
            <ul>
              {incidents.map((incident) => (
                <li key={incident.id} style={{ marginBottom: 16 }}>
                  <strong>{incident.title}</strong>
                  <div className="muted">
                    {incident.severity} / {incident.category} / owner {incident.ownerRole}
                  </div>
                  <div className="muted">
                    Status: <span className={`badge badge-${incident.status}`}>{incident.status}</span>
                    {incident.dueDate ? ` / due ${new Date(incident.dueDate).toLocaleDateString()}` : ""}
                  </div>
                  <div>{incident.summary}</div>
                  {incident.immediateResponse ? <div className="muted">Immediate response: {incident.immediateResponse}</div> : null}
                  {incident.linkedCapaId ? <div className="muted">Linked CAPA: {incident.linkedCapaId}</div> : null}
                  {canManageQuality && incident.status !== "closed" ? (
                    <div className="actions" style={{ marginTop: 8 }}>
                      <button className="button secondary" type="button" disabled={submitting} onClick={() => { void handleIncidentReview(incident.id, "log_review"); }}>
                        Mark under review
                      </button>
                      {!incident.linkedCapaId ? (
                        <button className="button secondary" type="button" disabled={submitting} onClick={() => seedIncidentCapaForm(incident)}>
                          Open CAPA
                        </button>
                      ) : null}
                      <button className="button secondary" type="button" disabled={submitting} onClick={() => { void handleIncidentReview(incident.id, "close_incident"); }}>
                        Close incident
                      </button>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>

          <div className="card">
            <h2>CAPA tracker</h2>
            <ul>
              {capas.map((capa) => (
                <li key={capa.id} style={{ marginBottom: 16 }}>
                  <strong>{capa.title}</strong>
                  <div className="muted">
                    Status: <span className={`badge badge-${capa.status}`}>{capa.status}</span> / owner {capa.ownerRole}
                  </div>
                  <div className="muted">
                    Due {new Date(capa.dueDate).toLocaleDateString()} / source {capa.sourceType}
                  </div>
                  <div>{capa.summary}</div>
                  <div className="muted">Corrective: {capa.correctiveAction}</div>
                  <div className="muted">Preventive: {capa.preventiveAction}</div>
                  {canManageQuality && capa.status !== "closed" ? (
                    <div className="actions" style={{ marginTop: 8 }}>
                      <button className="button secondary" type="button" disabled={submitting} onClick={() => { void handleResolveCapa(capa.id, "start"); }}>
                        Start
                      </button>
                      <button className="button secondary" type="button" disabled={submitting} onClick={() => { void handleResolveCapa(capa.id, "request_verification"); }}>
                        Request verification
                      </button>
                      <button className="button secondary" type="button" disabled={submitting} onClick={() => { void handleResolveCapa(capa.id, "close"); }}>
                        Close CAPA
                      </button>
                    </div>
                  ) : null}
                  {canManageQuality && capa.status === "closed" ? (
                    <div className="actions" style={{ marginTop: 8 }}>
                      <button className="button secondary" type="button" disabled={submitting} onClick={() => { void handleResolveCapa(capa.id, "reopen"); }}>
                        Reopen
                      </button>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>

          {capaIncidentId ? (
            <div className="card">
              <h2>Open CAPA from incident</h2>
              <form className="stack" onSubmit={(event) => { void handleOpenCapaFromIncident(event); }}>
                <input value={capaFromIncidentTitle} onChange={(event) => setCapaFromIncidentTitle(event.target.value)} placeholder="CAPA title" required />
                <textarea value={capaFromIncidentSummary} onChange={(event) => setCapaFromIncidentSummary(event.target.value)} rows={4} placeholder="Summary" required />
                <select value={capaFromIncidentOwnerRole} onChange={(event) => setCapaFromIncidentOwnerRole(event.target.value as ActorRole)}>
                  {roleOptions.map((role) => <option key={role} value={role}>{role}</option>)}
                </select>
                <input type="date" value={capaFromIncidentDueDate} onChange={(event) => setCapaFromIncidentDueDate(event.target.value)} required />
                <textarea value={capaFromIncidentCorrectiveAction} onChange={(event) => setCapaFromIncidentCorrectiveAction(event.target.value)} rows={3} placeholder="Corrective action" required />
                <textarea value={capaFromIncidentPreventiveAction} onChange={(event) => setCapaFromIncidentPreventiveAction(event.target.value)} rows={3} placeholder="Preventive action" required />
                <textarea value={capaFromIncidentVerificationPlan} onChange={(event) => setCapaFromIncidentVerificationPlan(event.target.value)} rows={2} placeholder="Verification plan" />
                <div className="actions">
                  <button className="button" type="submit" disabled={submitting}>Create linked CAPA</button>
                  <button className="button secondary" type="button" onClick={() => setCapaIncidentId(null)}>Cancel</button>
                </div>
              </form>
            </div>
          ) : null}

          <div className="card">
            <h2>Create policy draft</h2>
            <form className="stack" onSubmit={(event) => { void handleCreatePolicy(event); }}>
              <input value={policyTitle} onChange={(event) => setPolicyTitle(event.target.value)} placeholder="Policy title" required />
              <input value={policyObjective} onChange={(event) => setPolicyObjective(event.target.value)} placeholder="Objective" required />
              <textarea value={policyBody} onChange={(event) => setPolicyBody(event.target.value)} rows={10} />
              <button className="button" type="submit" disabled={submitting}>Create and submit policy</button>
            </form>
          </div>

          <div className="card">
            <h2>Recent audit events</h2>
            <ul>
              {events.map((event) => (
                <li key={event.id}>
                  <strong>{event.eventType}</strong> on {event.entityType} {event.entityId}
                  <div className="muted">
                    {event.actorRole} at {new Date(event.createdAt).toLocaleString()}
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="card">
            <h2>Approved document archive</h2>
            <ul>
              {publishedDocuments.map((document) => (
                <li key={document.id}>
                  <strong>{document.title}</strong>
                  <div className="muted">
                    Status: <span className={`badge badge-${document.status}`}>{document.status}</span>
                  </div>
                  <div className="muted">
                    Review due: {document.reviewDueAt ? new Date(document.reviewDueAt).toLocaleDateString() : "Not scheduled"}
                  </div>
                  <div className="muted">
                    Archive path: {document.publishedPath ?? "not published externally"}
                  </div>
                  {latestJobByDocument.get(document.id) ? (
                    <div className="muted">
                      Latest worker job: {latestJobByDocument.get(document.id)?.type} / {latestJobByDocument.get(document.id)?.status}
                    </div>
                  ) : null}
                  <div className="actions" style={{ marginTop: 8 }}>
                    <button className="button secondary" type="button" onClick={() => downloadArchiveDocument(document)}>
                      Download markdown
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
    </div>
  );
}
