"use client";

import { useEffect, useState } from "react";
import { useAppAuth } from "../../components/auth-provider";
import { apiRequest, type ActorIdentity } from "../../lib/api";

type ApprovalTask = {
  id: string;
  targetId: string;
  reviewerRole: string;
  approvalClass: string;
  status: string;
  requestedAt: string;
};

type DocumentRecord = {
  id: string;
  title: string;
  status: string;
  approvalClass: string;
  publishedPath: string | null;
};

type WorkerJob = {
  id: string;
  type: string;
  status: string;
  sourceEntityType: string | null;
  sourceEntityId: string | null;
};

export default function MedicalDirectorPage(): JSX.Element {
  const { actor } = useAppAuth();
  const [approvals, setApprovals] = useState<ApprovalTask[]>([]);
  const [approvedDocuments, setApprovedDocuments] = useState<DocumentRecord[]>([]);
  const [jobs, setJobs] = useState<WorkerJob[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function load(currentActor: ActorIdentity) {
    try {
      const [approvalQueue, documents, workerJobs] = await Promise.all([
        apiRequest<ApprovalTask[]>(`/approvals?reviewerRole=${currentActor.role}&status=requested`, currentActor),
        apiRequest<DocumentRecord[]>("/documents", currentActor),
        apiRequest<WorkerJob[]>("/worker-jobs?sourceEntityType=document", currentActor)
      ]);
      setApprovals(approvalQueue);
      setApprovedDocuments(documents.filter((document) => ["approved", "publish_pending", "published"].includes(document.status)));
      setJobs(workerJobs);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load approval inbox.");
    }
  }

  useEffect(() => {
    if (!actor || !["medical_director", "cfo"].includes(actor.role)) {
      return;
    }

    void load(actor);
  }, [actor]);

  const latestJobByDocument = new Map<string, WorkerJob>();
  for (const job of jobs) {
    if (job.sourceEntityId && !latestJobByDocument.has(job.sourceEntityId)) {
      latestJobByDocument.set(job.sourceEntityId, job);
    }
  }

  async function handleDecision(approvalTaskId: string, decision: "approved" | "sent_back") {
    if (!actor) {
      return;
    }

    try {
      await apiRequest(`/approvals/${approvalTaskId}/decide`, actor, {
        method: "POST",
        body: JSON.stringify({
          decision,
          notes: decision === "approved" ? "Approved from dashboard." : "Returned for revision."
        })
      });
      await load(actor);
    } catch (decisionError) {
      setError(decisionError instanceof Error ? decisionError.message : "Unable to record approval decision.");
    }
  }

  async function handlePublish(documentId: string) {
    if (!actor) {
      return;
    }

    try {
      await apiRequest(`/documents/${documentId}/publish`, actor, {
        method: "POST"
      });
      await load(actor);
    } catch (publishError) {
      setError(publishError instanceof Error ? publishError.message : "Unable to publish approved document.");
    }
  }

  return (
    <div className="grid" style={{ gap: 16 }}>
      <div className="card">
        <h1>Approval workstation</h1>
        <p className="muted">
          Pilot reviewers can process human approvals and controlled publication from here.
        </p>
        <div className="muted">
          Active reviewer: {actor ? `${actor.name} / ${actor.role}` : "No active profile"}
        </div>
      </div>

      {actor && !["medical_director", "cfo"].includes(actor.role) ? (
        <div className="card error">This workstation is only available to medical-director and CFO approval profiles.</div>
      ) : null}

      {error ? <div className="card error">{error}</div> : null}

      <div className="card">
        <h2>Approval queue</h2>
        <div className="table">
          <div className="table-row table-head">
            <span>Approval</span>
            <span>Class</span>
            <span>Requested</span>
            <span>Actions</span>
          </div>
          {approvals.map((approval) => (
            <div key={approval.id} className="table-row">
              <span>{approval.targetId}</span>
              <span>{approval.approvalClass}</span>
              <span>{new Date(approval.requestedAt).toLocaleString()}</span>
              <span className="actions">
                <button className="button" onClick={() => { void handleDecision(approval.id, "approved"); }}>Approve</button>
                <button className="button secondary" onClick={() => { void handleDecision(approval.id, "sent_back"); }}>Send back</button>
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <h2>Approved or published documents</h2>
        <div className="table">
          <div className="table-row table-head">
            <span>Title</span>
            <span>Status</span>
            <span>Class</span>
            <span>Action</span>
          </div>
          {approvedDocuments.map((document) => (
            <div key={document.id} className="table-row">
              <span>{document.title}</span>
              <span><span className={`badge badge-${document.status}`}>{document.status}</span></span>
              <span>{document.approvalClass}</span>
              <span>
                {document.status === "approved" ? (
                  <button className="button" onClick={() => { void handlePublish(document.id); }}>
                    Publish
                  </button>
                ) : document.status === "publish_pending" ? (
                  <span className="muted">
                    Worker job: {latestJobByDocument.get(document.id)?.status ?? "queued"}
                  </span>
                ) : (
                  <span className="muted">{document.publishedPath ?? "Published locally"}</span>
                )}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
