"use client";

import { useEffect, useState } from "react";
import { useAppAuth } from "../components/auth-provider";
import { StatCard } from "../components/stat-card";
import { apiRequest } from "../lib/api";

type OverviewStats = {
  openApprovals: number;
  publishedDocuments: number;
  publishPendingDocuments: number;
  openIssues: number;
  overdueActionItems: number;
  overdueScorecardReviews: number;
  scorecardsImported: number;
  queuedJobs: number;
  failedJobs: number;
};

type WhoAmI = {
  actor: {
    actorId: string;
    role: string;
    name?: string;
  };
  authMode: "dev_headers" | "trusted_proxy" | "device_profiles";
};

type ConfigStatus = {
  authMode: "dev_headers" | "trusted_proxy" | "device_profiles";
  pilotUsable: boolean;
  publicationMode: "local_stub" | "sharepoint_live";
  worker: {
    queued: number;
    processing: number;
    failed: number;
    deadLetter: number;
    succeeded: number;
  };
  microsoft: {
    mode: "stub" | "live";
    readyForLive: boolean;
    pilotUsable: boolean;
    publicationMode: "local_stub" | "sharepoint_live";
  };
  blockingIssues: string[];
};

type DocumentRecord = {
  id: string;
  title: string;
  status: string;
  approvalClass: string;
  updatedAt: string;
};

type WorkerJob = {
  id: string;
  type: string;
  status: string;
  sourceEntityType: string | null;
  sourceEntityId: string | null;
  updatedAt: string;
};

export default function HomePage(): JSX.Element {
  const { actor } = useAppAuth();
  const [stats, setStats] = useState<OverviewStats | null>(null);
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [jobs, setJobs] = useState<WorkerJob[]>([]);
  const [whoami, setWhoami] = useState<WhoAmI | null>(null);
  const [configStatus, setConfigStatus] = useState<ConfigStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!actor) {
      return;
    }

    async function load() {
      try {
        const [overview, recentDocuments, recentJobs, currentUser, runtimeStatus] = await Promise.all([
          apiRequest<OverviewStats>("/dashboard/overview", actor),
          apiRequest<DocumentRecord[]>("/documents", actor),
          apiRequest<WorkerJob[]>("/worker-jobs", actor),
          apiRequest<WhoAmI>("/auth/whoami", actor),
          apiRequest<ConfigStatus>("/ops/config-status", actor)
        ]);
        setStats(overview);
        setDocuments(recentDocuments.slice(0, 5));
        setJobs(recentJobs);
        setWhoami(currentUser);
        setConfigStatus(runtimeStatus);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Unable to load overview.");
      }
    }

    void load();
  }, [actor]);

  return (
    <div className="grid" style={{ gap: 24 }}>
      <section>
        <h1>Clinic OS overview</h1>
        <p className="muted">
          Internal control surface for approvals, document control, office operations, and scorecard review.
        </p>
      </section>

      {!actor ? <section className="card">Select or restore a profile to load the overview.</section> : null}

      {error ? <section className="card error">{error}</section> : null}

      <section className="grid cols-3">
        <StatCard label="Open approvals" value={String(stats?.openApprovals ?? 0)} helper="Human review still pending" />
        <StatCard label="Published docs" value={String(stats?.publishedDocuments ?? 0)} helper="Controlled publication path" />
        <StatCard label="Publish pending" value={String(stats?.publishPendingDocuments ?? 0)} helper="Waiting on worker publication" />
        <StatCard label="Open issues" value={String(stats?.openIssues ?? 0)} helper="Office-manager queue" />
        <StatCard label="Overdue actions" value={String(stats?.overdueActionItems ?? 0)} helper="Needs office-manager follow-through" />
        <StatCard label="Overdue reviews" value={String(stats?.overdueScorecardReviews ?? 0)} helper="HR or medical-director sign-off still pending" />
        <StatCard label="Scorecard imports" value={String(stats?.scorecardsImported ?? 0)} helper="Distinct imported periods" />
        <StatCard label="Queued jobs" value={String(stats?.queuedJobs ?? 0)} helper={`${stats?.failedJobs ?? 0} failed or dead-letter`} />
      </section>

      <section className="grid cols-3">
        <StatCard label="Auth mode" value={whoami?.authMode ?? "unknown"} helper={whoami?.actor.name ?? "No actor resolved"} />
        <StatCard
          label="Integration mode"
          value={configStatus?.microsoft.mode ?? "unknown"}
          helper={
            configStatus?.microsoft.mode === "stub"
              ? "Local pilot mode"
              : configStatus?.microsoft.readyForLive
                ? "Ready for live"
                : "Live validation still required"
          }
        />
        <StatCard
          label="Worker health"
          value={String((configStatus?.worker.queued ?? 0) + (configStatus?.worker.processing ?? 0))}
          helper={`${(configStatus?.worker.failed ?? 0) + (configStatus?.worker.deadLetter ?? 0)} failed/dead-letter`}
        />
      </section>

      <section className="card">
        <h2>Pilot readiness</h2>
        <div className="actions">
          <span className={`badge badge-${configStatus?.pilotUsable ? "ready" : "degraded"}`}>
            {configStatus?.pilotUsable ? "pilot usable" : "launch setup still needed"}
          </span>
          <span className={`badge badge-${configStatus?.publicationMode === "local_stub" ? "ready" : "published"}`}>
            {configStatus?.publicationMode === "local_stub" ? "local publication" : "sharepoint publication"}
          </span>
        </div>
        {configStatus?.blockingIssues.length ? (
          <ul>
            {configStatus.blockingIssues.map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
        ) : (
          <p className="muted">No pilot-blocking runtime issues are currently reported.</p>
        )}
      </section>

      <section className="card">
        <h2>Recent documents</h2>
        <div className="table">
          <div className="table-row table-head">
            <span>Title</span>
            <span>Status</span>
            <span>Approval class</span>
            <span>Updated</span>
          </div>
          {documents.map((document) => (
            <div key={document.id} className="table-row">
              <span>{document.title}</span>
              <span><StatusBadge value={document.status} /></span>
              <span>{document.approvalClass}</span>
              <span>{new Date(document.updatedAt).toLocaleString()}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="card">
        <h2>Pilot backbone status</h2>
        <ul>
          <li>Workflow runs and documents are now persisted through the API.</li>
          <li>Approvals and publication are gated with explicit reviewer roles, signed-proxy-ready auth, and async worker jobs.</li>
          <li>Office-manager issues, closeout, and escalations now move through persisted action-item lifecycles.</li>
          <li>Scorecard imports now create HR review queues, medical-director exception oversight, and employee history views.</li>
          <li>Operators can now run a stub-mode pilot on one same-origin site before enabling any live Microsoft side effects.</li>
        </ul>
      </section>

      <section className="card">
        <h2>Recent worker jobs</h2>
        <div className="table">
          <div className="table-row table-head">
            <span>Type</span>
            <span>Status</span>
            <span>Source</span>
            <span>Updated</span>
          </div>
          {jobs.slice(0, 6).map((job) => (
            <div key={job.id} className="table-row">
              <span>{job.type}</span>
              <span><StatusBadge value={job.status} /></span>
              <span>{job.sourceEntityType ?? "worker_job"} / {job.sourceEntityId ?? job.id}</span>
              <span>{new Date(job.updatedAt).toLocaleString()}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function StatusBadge({ value }: { value: string }): JSX.Element {
  return <span className={`badge badge-${value}`}>{value.replaceAll("_", " ")}</span>;
}
