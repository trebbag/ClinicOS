"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useAppAuth } from "../../components/auth-provider";
import { apiRequest, type ActorIdentity } from "../../lib/api";

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

export default function QualityPage(): JSX.Element {
  const { actor } = useAppAuth();
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [publishedDocuments, setPublishedDocuments] = useState<DocumentRecord[]>([]);
  const [jobs, setJobs] = useState<WorkerJob[]>([]);
  const [policyTitle, setPolicyTitle] = useState("Controlled-substance stewardship policy");
  const [policyObjective, setPolicyObjective] = useState("Refresh policy language and route for human approval.");
  const [policyBody, setPolicyBody] = useState("# Policy draft\n\n## Purpose\nCreate a controlled, reviewable policy draft.\n");
  const [error, setError] = useState<string | null>(null);

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
    if (!actor) {
      return;
    }

    try {
      const [auditEvents, published, pending, workerJobs] = await Promise.all([
        apiRequest<AuditEvent[]>("/audit-events", actor),
        apiRequest<DocumentRecord[]>("/documents?status=published", actor),
        apiRequest<DocumentRecord[]>("/documents?status=publish_pending", actor),
        apiRequest<WorkerJob[]>("/worker-jobs?sourceEntityType=document", actor)
      ]);
      setEvents(auditEvents.slice(0, 10));
      setPublishedDocuments([...pending, ...published]);
      setJobs(workerJobs);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load quality dashboard.");
    }
  }

  useEffect(() => {
    if (!actor || actor.role !== "quality_lead") {
      return;
    }

    void load();
  }, [actor]);

  const latestJobByDocument = new Map<string, WorkerJob>();
  for (const job of jobs) {
    if (job.sourceEntityId && !latestJobByDocument.has(job.sourceEntityId)) {
      latestJobByDocument.set(job.sourceEntityId, job);
    }
  }

  async function handleCreatePolicy(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!actor) {
      return;
    }

    try {
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

      await load();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to create and submit policy draft.");
    }
  }

  return (
    <div className="grid" style={{ gap: 16 }}>
      <div className="card">
        <h1>Quality and accreditation</h1>
        <p className="muted">
          Review audit trail activity and published artifacts that will need periodic review.
        </p>
        <div className="muted">
          Active profile: {actor ? `${actor.name} / ${actor.role}` : "No active profile"}
        </div>
      </div>

      {actor && actor.role !== "quality_lead" ? (
        <div className="card error">This screen is reserved for the quality lead profile.</div>
      ) : null}

      {error ? <div className="card error">{error}</div> : null}

      <div className="grid cols-2">
        <div className="card">
          <h2>Create policy draft</h2>
          <form className="stack" onSubmit={(event) => { void handleCreatePolicy(event); }}>
            <input value={policyTitle} onChange={(event) => setPolicyTitle(event.target.value)} placeholder="Policy title" required />
            <input value={policyObjective} onChange={(event) => setPolicyObjective(event.target.value)} placeholder="Objective" required />
            <textarea value={policyBody} onChange={(event) => setPolicyBody(event.target.value)} rows={10} />
            <button className="button" type="submit">Create and submit policy</button>
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
                  <button
                    className="button secondary"
                    type="button"
                    onClick={() => downloadArchiveDocument(document)}
                  >
                    Download markdown
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
