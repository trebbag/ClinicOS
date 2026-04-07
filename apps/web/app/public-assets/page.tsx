"use client";

import { useEffect, useMemo, useState } from "react";
import { apiRequest, type ActorRole } from "../../lib/api";
import { useAppAuth } from "../../components/auth-provider";

type PublicAssetClaim = {
  id: string;
  claimText: string;
  evidenceNote: string | null;
  reviewStatus: "pending" | "approved" | "needs_revision" | "unsupported";
  reviewerNotes: string | null;
};

type PublicAssetRecord = {
  id: string;
  assetType: "website_page" | "ad_copy" | "service_page" | "handout" | "intake_packet" | "social_post" | "landing_page" | "email_campaign";
  title: string;
  status: "draft" | "claims_in_review" | "claims_reviewed" | "approval_pending" | "approved" | "publish_pending" | "published" | "archived" | "sent_back";
  ownerRole: ActorRole;
  serviceLine: string | null;
  audience: string | null;
  channelLabel: string | null;
  summary: string;
  body: string;
  claims: PublicAssetClaim[];
  claimsReviewed: boolean;
  claimsReviewStatus: "not_started" | "in_review" | "completed" | "needs_revision";
  claimsReviewNotes: string | null;
  claimsReviewedAt: string | null;
  claimsReviewedByRole: ActorRole | null;
  documentId: string | null;
  workflowRunId: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
  publishedPath: string | null;
};

type ApprovalTask = {
  id: string;
  targetId: string;
  reviewerRole: ActorRole;
  status: "requested" | "approved" | "rejected" | "sent_back";
};

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

export default function PublicAssetsPage(): JSX.Element {
  const { actor, hasCapability } = useAppAuth();
  const [assets, setAssets] = useState<PublicAssetRecord[]>([]);
  const [approvals, setApprovals] = useState<ApprovalTask[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [reviewNotes, setReviewNotes] = useState("");
  const [claimDecisions, setClaimDecisions] = useState<Record<string, { decision: "approved" | "needs_revision" | "unsupported"; notes: string }>>({});

  const [title, setTitle] = useState("Weight-management landing page refresh");
  const [assetType, setAssetType] = useState<PublicAssetRecord["assetType"]>("landing_page");
  const [ownerRole, setOwnerRole] = useState<ActorRole>("quality_lead");
  const [serviceLine, setServiceLine] = useState<string>("weight_management");
  const [audience, setAudience] = useState("Prospective patients");
  const [channelLabel, setChannelLabel] = useState("Website");
  const [summary, setSummary] = useState("Refresh patient-facing landing-page language and route every claim through explicit review.");
  const [body, setBody] = useState("# Draft\n\nA physician-led weight-management program with individualized plans and ongoing follow-up.");
  const [claimsText, setClaimsText] = useState([
    "Physician-led weight-management program",
    "Individualized plans and ongoing follow-up"
  ].join("\n"));

  const canView = hasCapability("public_assets.view");
  const canManage = hasCapability("public_assets.manage");
  const canReviewClaims = canManage && actor && ["quality_lead", "medical_director"].includes(actor.role);
  const canPublish = canManage && actor && ["medical_director", "cfo"].includes(actor.role);

  async function loadData(): Promise<void> {
    if (!actor) {
      return;
    }
    setLoading(true);
    try {
      const [assetRows, approvalRows] = await Promise.all([
        apiRequest<PublicAssetRecord[]>("/public-assets", actor),
        hasCapability("approvals.view")
          ? apiRequest<ApprovalTask[]>("/approvals?status=requested", actor)
          : Promise.resolve([])
      ]);
      setAssets(assetRows);
      setApprovals(approvalRows);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load public assets.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, [actor]);

  const selectedAsset = useMemo(
    () => assets.find((asset) => asset.id === selectedAssetId) ?? null,
    [assets, selectedAssetId]
  );

  const approvalCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const approval of approvals) {
      counts[approval.targetId] = (counts[approval.targetId] ?? 0) + 1;
    }
    return counts;
  }, [approvals]);

  function seedClaimsReview(asset: PublicAssetRecord): void {
    const decisions = Object.fromEntries(
      asset.claims.map((claim) => [
        claim.id,
        {
          decision: claim.reviewStatus === "pending" ? "approved" : claim.reviewStatus,
          notes: claim.reviewerNotes ?? ""
        }
      ])
    );
    setClaimDecisions(decisions);
    setReviewNotes(asset.claimsReviewNotes ?? "");
    setSelectedAssetId(asset.id);
  }

  async function handleCreate(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!actor) {
      return;
    }
    setSubmitting(true);
    try {
      await apiRequest("/public-assets", actor, {
        method: "POST",
        body: JSON.stringify({
          title,
          assetType,
          ownerRole,
          serviceLine,
          audience,
          channelLabel,
          summary,
          body,
          claims: claimsText
            .split("\n")
            .map((entry) => entry.trim())
            .filter(Boolean)
            .map((claimText) => ({ claimText }))
        })
      });
      await loadData();
      setClaimsText("");
      setError(null);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to create the public asset.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleClaimsReview(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!actor || !selectedAsset) {
      return;
    }
    setSubmitting(true);
    try {
      await apiRequest(`/public-assets/${selectedAsset.id}/review-claims`, actor, {
        method: "POST",
        body: JSON.stringify({
          claimDecisions: selectedAsset.claims.map((claim) => ({
            claimId: claim.id,
            decision: claimDecisions[claim.id]?.decision ?? "approved",
            notes: claimDecisions[claim.id]?.notes || undefined
          })),
          overallNotes: reviewNotes || undefined
        })
      });
      await loadData();
      setSelectedAssetId(null);
      setReviewNotes("");
      setClaimDecisions({});
      setError(null);
    } catch (reviewError) {
      setError(reviewError instanceof Error ? reviewError.message : "Unable to save claims review.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSubmitForApproval(assetId: string): Promise<void> {
    if (!actor) {
      return;
    }
    setSubmitting(true);
    try {
      await apiRequest(`/public-assets/${assetId}/submit`, actor, {
        method: "POST"
      });
      await loadData();
      setError(null);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to route the public asset for approval.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handlePublish(assetId: string): Promise<void> {
    if (!actor) {
      return;
    }
    setSubmitting(true);
    try {
      await apiRequest(`/public-assets/${assetId}/publish`, actor, {
        method: "POST"
      });
      await loadData();
      setError(null);
    } catch (publishError) {
      setError(publishError instanceof Error ? publishError.message : "Unable to queue publication for this public asset.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!actor) {
    return (
      <section className="stack">
        <div className="card">Sign in to review public-facing assets.</div>
      </section>
    );
  }

  return (
    <section className="stack">
      <header className="stack">
        <span className="eyebrow">Public Claims Governance</span>
        <div className="page-header">
          <div>
            <h1>Public Assets</h1>
            <p className="muted">
              Draft public-facing copy, route explicit claim reviews, hand off to human approval, and publish only through the controlled document path.
            </p>
          </div>
        </div>
      </header>

      {error ? <div className="card error">{error}</div> : null}
      {!canView ? <div className="card error">This screen is reserved for public-asset review roles.</div> : null}

      {canView ? (
        <>
          <section className="grid cols-4">
            <div className="card">
              <h2>Total assets</h2>
              <div className="kpi">{assets.length}</div>
              <div className="muted">Tracked public-facing drafts and approved assets.</div>
            </div>
            <div className="card">
              <h2>Claims review queue</h2>
              <div className="kpi">{assets.filter((asset) => ["draft", "claims_in_review", "sent_back"].includes(asset.status)).length}</div>
              <div className="muted">Needs quality or medical claims review before approval routing.</div>
            </div>
            <div className="card">
              <h2>Human approvals pending</h2>
              <div className="kpi">{assets.filter((asset) => asset.status === "approval_pending").length}</div>
              <div className="muted">Waiting on medical-director and CFO review.</div>
            </div>
            <div className="card">
              <h2>Published archive</h2>
              <div className="kpi">{assets.filter((asset) => ["published", "archived"].includes(asset.status)).length}</div>
              <div className="muted">Approved public copy retained with publication path evidence.</div>
            </div>
          </section>

          {canManage ? (
            <section className="card stack">
              <h2>Create public asset</h2>
              <form className="stack" onSubmit={(event) => { void handleCreate(event); }}>
                <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Asset title" required />
                <div className="grid cols-3">
                  <select value={assetType} onChange={(event) => setAssetType(event.target.value as PublicAssetRecord["assetType"])}>
                    <option value="landing_page">Landing page</option>
                    <option value="website_page">Website page</option>
                    <option value="service_page">Service page</option>
                    <option value="social_post">Social post</option>
                    <option value="email_campaign">Email campaign</option>
                    <option value="ad_copy">Ad copy</option>
                    <option value="handout">Handout</option>
                    <option value="intake_packet">Intake packet</option>
                  </select>
                  <select value={ownerRole} onChange={(event) => setOwnerRole(event.target.value as ActorRole)}>
                    <option value="quality_lead">quality_lead</option>
                    <option value="medical_director">medical_director</option>
                    <option value="cfo">cfo</option>
                    <option value="office_manager">office_manager</option>
                  </select>
                  <select value={serviceLine} onChange={(event) => setServiceLine(event.target.value)}>
                    {serviceLines.map((entry) => (
                      <option key={entry} value={entry}>
                        {entry}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid cols-2">
                  <input value={audience} onChange={(event) => setAudience(event.target.value)} placeholder="Audience" />
                  <input value={channelLabel} onChange={(event) => setChannelLabel(event.target.value)} placeholder="Channel or placement" />
                </div>
                <textarea value={summary} onChange={(event) => setSummary(event.target.value)} rows={3} placeholder="Summary" required />
                <textarea value={body} onChange={(event) => setBody(event.target.value)} rows={8} placeholder="Draft body" required />
                <textarea value={claimsText} onChange={(event) => setClaimsText(event.target.value)} rows={5} placeholder="One public claim per line" required />
                <button className="button" type="submit" disabled={submitting || loading}>Create public asset</button>
              </form>
            </section>
          ) : null}

          <section className="grid cols-2">
            <div className="card stack">
              <h2>Asset inventory</h2>
              {loading ? <div className="muted">Loading public assets…</div> : null}
              <ul className="stack" style={{ listStyle: "none", padding: 0, margin: 0 }}>
                {assets.map((asset) => (
                  <li key={asset.id} style={{ marginBottom: 16 }}>
                    <strong>{asset.title}</strong>
                    <div className="muted">
                      {asset.assetType} / owner {asset.ownerRole} / {asset.serviceLine ?? "no service line"}
                    </div>
                    <div>
                      Status: <span className={`badge badge-${asset.status}`}>{asset.status}</span>
                      {" / "}
                      Claims: <span className={`badge badge-${asset.claimsReviewStatus}`}>{asset.claimsReviewStatus}</span>
                      {asset.documentId && approvalCounts[asset.documentId]
                        ? ` / ${approvalCounts[asset.documentId]} active approval(s)`
                        : ""}
                    </div>
                    <div>{asset.summary}</div>
                    <div className="muted">
                      {asset.claims.length} structured claim{asset.claims.length === 1 ? "" : "s"}
                      {asset.publishedPath ? ` / published at ${asset.publishedPath}` : ""}
                    </div>
                    <div className="actions" style={{ marginTop: 12 }}>
                      {canReviewClaims && !["approval_pending", "approved", "publish_pending", "published", "archived"].includes(asset.status) ? (
                        <button className="button secondary" type="button" disabled={submitting} onClick={() => seedClaimsReview(asset)}>
                          Review claims
                        </button>
                      ) : null}
                      {canManage && asset.claimsReviewStatus === "completed" && !["approval_pending", "approved", "publish_pending", "published", "archived"].includes(asset.status) ? (
                        <button className="button secondary" type="button" disabled={submitting} onClick={() => { void handleSubmitForApproval(asset.id); }}>
                          Submit for approval
                        </button>
                      ) : null}
                      {canPublish && asset.status === "approved" ? (
                        <button className="button secondary" type="button" disabled={submitting} onClick={() => { void handlePublish(asset.id); }}>
                          Publish
                        </button>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <div className="card stack">
              <h2>Claims review workspace</h2>
              {selectedAsset ? (
                <form className="stack" onSubmit={(event) => { void handleClaimsReview(event); }}>
                  <strong>{selectedAsset.title}</strong>
                  {selectedAsset.claims.map((claim) => (
                    <div key={claim.id} className="stack" style={{ paddingBottom: 12, borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                      <div>{claim.claimText}</div>
                      {claim.evidenceNote ? <div className="muted">Evidence note: {claim.evidenceNote}</div> : null}
                      <select
                        value={claimDecisions[claim.id]?.decision ?? "approved"}
                        onChange={(event) => setClaimDecisions((current) => ({
                          ...current,
                          [claim.id]: {
                            decision: event.target.value as "approved" | "needs_revision" | "unsupported",
                            notes: current[claim.id]?.notes ?? ""
                          }
                        }))}
                      >
                        <option value="approved">approved</option>
                        <option value="needs_revision">needs_revision</option>
                        <option value="unsupported">unsupported</option>
                      </select>
                      <textarea
                        rows={2}
                        value={claimDecisions[claim.id]?.notes ?? ""}
                        onChange={(event) => setClaimDecisions((current) => ({
                          ...current,
                          [claim.id]: {
                            decision: current[claim.id]?.decision ?? "approved",
                            notes: event.target.value
                          }
                        }))}
                        placeholder="Reviewer notes"
                      />
                    </div>
                  ))}
                  <textarea value={reviewNotes} onChange={(event) => setReviewNotes(event.target.value)} rows={3} placeholder="Overall claims-review note" />
                  <div className="actions">
                    <button className="button" type="submit" disabled={submitting}>Save claims review</button>
                    <button className="button secondary" type="button" onClick={() => setSelectedAssetId(null)}>Close</button>
                  </div>
                </form>
              ) : (
                <div className="muted">
                  Choose a draft asset to review each claim explicitly before routing it for human approval.
                </div>
              )}
            </div>
          </section>

          <section className="card stack">
            <h2>Approved archive</h2>
            <ul className="stack" style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {assets.filter((asset) => ["approved", "publish_pending", "published", "archived"].includes(asset.status)).map((asset) => (
                <li key={asset.id}>
                  <strong>{asset.title}</strong>
                  <div className="muted">
                    <span className={`badge badge-${asset.status}`}>{asset.status}</span>
                    {asset.publishedPath ? ` / ${asset.publishedPath}` : ""}
                    {asset.publishedAt ? ` / ${new Date(asset.publishedAt).toLocaleString()}` : ""}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </>
      ) : null}
    </section>
  );
}
