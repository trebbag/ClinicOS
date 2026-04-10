"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
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

type RevenueSummary = {
  openPayerIssues: number;
  escalatedPayerIssues: number;
  overduePayerIssues: number;
  pricingPendingApproval: number;
  pricingAttentionNeeded: number;
  overdueRevenueReviews: number;
  serviceLinesMissingPricingGovernance: number;
  serviceLinesWeakClaimsGovernance: number;
  publicAssetsAtRisk: number;
  payerIssueAging?: {
    dueSoon: number;
    overdue: number;
    olderThanThirtyDays: number;
    escalated: number;
  };
  pricingReviewBuckets?: {
    reviewDueSoon: number;
    overdue: number;
    pendingApproval: number;
    attentionNeeded: number;
  };
  pricingFreshnessBuckets?: {
    current: number;
    dueSoon: number;
    overdue: number;
    missing: number;
  };
  claimsCoverageBuckets?: {
    covered: number;
    weak: number;
    none: number;
  };
  trends?: Array<{
    periodLabel: string;
    periodStart: string;
    periodEnd: string;
    openPayerIssues: number;
    escalatedPayerIssues: number;
    pricingPendingApproval: number;
    overdueRevenueReviews: number;
  }>;
  serviceLineRisks?: Array<{
    serviceLineId: ServiceLineId;
    publishedPack: boolean;
    latestPricingGovernanceStatus: PricingGovernanceRecord["status"] | null;
    latestRevenueReviewStatus: RevenueReviewRecord["status"] | null;
    publicAssetsAtRisk: number;
    weakClaimsGovernance: boolean;
    missingPricingGovernance: boolean;
  }>;
  serviceLineComparisons?: Array<{
    serviceLineId: ServiceLineId;
    governanceStatus: string;
    publishedPack: boolean;
    latestPricingGovernanceStatus: PricingGovernanceRecord["status"] | null;
    pricingFreshness: "current" | "due_soon" | "overdue" | "missing";
    latestRevenueReviewStatus: RevenueReviewRecord["status"] | null;
    revenueReviewFreshnessDays: number | null;
    publishedPublicAssets: number;
    claimsCoverageStatus: "covered" | "weak" | "none";
    commercialRiskLevel: "low" | "medium" | "high" | "critical";
  }>;
  attentionItems: string[];
};

type PayerIssueRecord = {
  id: string;
  title: string;
  payerName: string;
  issueType: "denial" | "reimbursement_delay" | "coverage_policy" | "pricing_exception" | "credentialing" | "other";
  serviceLineId: ServiceLineId | null;
  ownerRole: ActorRole;
  status: "open" | "under_review" | "escalated" | "resolved" | "closed";
  summary: string;
  financialImpactSummary: string | null;
  dueDate: string | null;
  resolutionNote: string | null;
  actionItemId: string | null;
};

type PricingGovernanceRecord = {
  id: string;
  title: string;
  serviceLineId: ServiceLineId | null;
  ownerRole: ActorRole;
  status: "draft" | "approval_pending" | "approved" | "publish_pending" | "published" | "attention_needed";
  pricingSummary: string;
  marginGuardrailsSummary: string;
  discountGuardrailsSummary: string;
  payerAlignmentSummary: string;
  claimsConstraintSummary: string;
  reviewDueAt: string | null;
  documentId: string | null;
  publishedPath: string | null;
};

type RevenueReviewRecord = {
  id: string;
  title: string;
  status: "draft" | "review_pending" | "completed" | "archived";
  ownerRole: ActorRole;
  serviceLineId: ServiceLineId | null;
  reviewWindowLabel: string;
  targetReviewDate: string | null;
  summaryNote: string | null;
  linkedCommitteeId: string | null;
  snapshot: RevenueSummary;
};

const serviceLineOptions: Array<{ value: ServiceLineId; label: string }> = [
  { value: "primary_care", label: "Primary care" },
  { value: "women_health", label: "Women’s health" },
  { value: "telehealth", label: "Telehealth" },
  { value: "weight_management", label: "Weight management" },
  { value: "hrt", label: "HRT" },
  { value: "vaccines", label: "Vaccines" },
  { value: "waived_testing", label: "Waived testing" },
  { value: "contracted_lab", label: "Contracted lab" },
  { value: "iv_hydration", label: "IV hydration" },
  { value: "aesthetics", label: "Aesthetics" },
  { value: "allergy_testing", label: "Allergy testing" }
];

const ownerRoles: ActorRole[] = ["cfo", "medical_director", "office_manager", "quality_lead"];

export default function RevenuePage(): JSX.Element {
  const { actor, hasCapability } = useAppAuth();
  const canView = hasCapability("revenue.view");
  const canManage = hasCapability("revenue.manage");
  const [summary, setSummary] = useState<RevenueSummary | null>(null);
  const [payerIssues, setPayerIssues] = useState<PayerIssueRecord[]>([]);
  const [pricingRecords, setPricingRecords] = useState<PricingGovernanceRecord[]>([]);
  const [revenueReviews, setRevenueReviews] = useState<RevenueReviewRecord[]>([]);
  const [historyMonths, setHistoryMonths] = useState("12");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [issueTitle, setIssueTitle] = useState("Payer policy ambiguity for telehealth follow-up visits");
  const [payerName, setPayerName] = useState("Regional Commercial Plan");
  const [issueType, setIssueType] = useState<PayerIssueRecord["issueType"]>("coverage_policy");
  const [issueServiceLineId, setIssueServiceLineId] = useState<ServiceLineId>("telehealth");
  const [issueOwnerRole, setIssueOwnerRole] = useState<ActorRole>("cfo");
  const [issueDueDate, setIssueDueDate] = useState("2026-04-15");
  const [issueSummary, setIssueSummary] = useState("Clarify whether protocol-based telehealth follow-ups require a prior authorization update before the next commercial campaign starts.");
  const [financialImpactSummary, setFinancialImpactSummary] = useState("Potential write-offs if reimbursement terms stay unclear for existing follow-up visit bundles.");

  const [pricingTitle, setPricingTitle] = useState("Telehealth follow-up pricing governance");
  const [pricingServiceLineId, setPricingServiceLineId] = useState<ServiceLineId>("telehealth");
  const [pricingOwnerRole, setPricingOwnerRole] = useState<ActorRole>("cfo");
  const [pricingSummary, setPricingSummary] = useState("Define visit tiers, add-on boundaries, and package rules for telehealth follow-up care.");
  const [marginGuardrailsSummary, setMarginGuardrailsSummary] = useState("Hold target gross margin unless the CFO and medical director approve a documented pilot exception.");
  const [discountGuardrailsSummary, setDiscountGuardrailsSummary] = useState("No ad hoc discounting outside approved campaign bundles and documented retention offers.");
  const [payerAlignmentSummary, setPayerAlignmentSummary] = useState("Confirm payer coverage posture and carve out self-pay rules where reimbursement remains uncertain.");
  const [claimsConstraintSummary, setClaimsConstraintSummary] = useState("Do not promise reimbursement outcomes or clinical effectiveness beyond approved claims inventory.");
  const [pricingReviewDueAt, setPricingReviewDueAt] = useState("2026-07-01");
  const [pricingNotes, setPricingNotes] = useState("Pair this packet with the active telehealth service-line pack and current public-claims review outputs.");

  const [reviewTitle, setReviewTitle] = useState("April revenue / commercial review");
  const [reviewOwnerRole, setReviewOwnerRole] = useState<ActorRole>("cfo");
  const [reviewServiceLineId, setReviewServiceLineId] = useState<ServiceLineId | "">("");
  const [reviewWindowLabel, setReviewWindowLabel] = useState("April 2026");
  const [reviewTargetDate, setReviewTargetDate] = useState("2026-04-30");
  const [reviewSummaryNote, setReviewSummaryNote] = useState("Focus on open payer ambiguity, pricing guardrails still awaiting approval, and service lines with public-asset activity that outpaces claims-governance coverage.");

  async function loadData(): Promise<void> {
    if (!actor || !canView) {
      return;
    }

    setLoading(true);
    try {
      const [summaryResponse, payerIssueResponse, pricingResponse, reviewResponse] = await Promise.all([
        apiRequest<RevenueSummary>(`/revenue/summary?historyMonths=${historyMonths}`, actor),
        apiRequest<PayerIssueRecord[]>("/payer-issues", actor),
        apiRequest<PricingGovernanceRecord[]>("/pricing-governance", actor),
        apiRequest<RevenueReviewRecord[]>("/revenue-reviews", actor)
      ]);
      setSummary(summaryResponse);
      setPayerIssues(payerIssueResponse);
      setPricingRecords(pricingResponse);
      setRevenueReviews(reviewResponse);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load revenue governance.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, [actor?.actorId, actor?.role, canView, historyMonths]);

  async function runMutation(action: () => Promise<void>): Promise<void> {
    setSubmitting(true);
    try {
      await action();
      await loadData();
      setError(null);
    } catch (mutationError) {
      setError(mutationError instanceof Error ? mutationError.message : "Unable to save revenue governance update.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCreateIssue(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!actor) {
      return;
    }
    await runMutation(async () => {
      await apiRequest("/payer-issues", actor, {
        method: "POST",
        body: JSON.stringify({
          title: issueTitle,
          payerName,
          issueType,
          serviceLineId: issueServiceLineId,
          ownerRole: issueOwnerRole,
          summary: issueSummary,
          financialImpactSummary,
          dueDate: issueDueDate
        })
      });
    });
  }

  async function handleIssueStatus(issueId: string, status: PayerIssueRecord["status"]): Promise<void> {
    if (!actor) {
      return;
    }
    await runMutation(async () => {
      await apiRequest(`/payer-issues/${issueId}`, actor, {
        method: "PATCH",
        body: JSON.stringify({
          status,
          resolutionNote: status === "resolved" || status === "closed" ? "Closed during pilot revenue review." : undefined
        })
      });
    });
  }

  async function handleCreatePricing(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!actor) {
      return;
    }
    await runMutation(async () => {
      await apiRequest("/pricing-governance", actor, {
        method: "POST",
        body: JSON.stringify({
          title: pricingTitle,
          serviceLineId: pricingServiceLineId,
          ownerRole: pricingOwnerRole,
          pricingSummary,
          marginGuardrailsSummary,
          discountGuardrailsSummary,
          payerAlignmentSummary,
          claimsConstraintSummary,
          reviewDueAt: pricingReviewDueAt,
          notes: pricingNotes
        })
      });
    });
  }

  async function handleSubmitPricing(id: string): Promise<void> {
    if (!actor) {
      return;
    }
    await runMutation(async () => {
      await apiRequest(`/pricing-governance/${id}/submit`, actor, {
        method: "POST"
      });
    });
  }

  async function handlePublishPricing(id: string): Promise<void> {
    if (!actor) {
      return;
    }
    await runMutation(async () => {
      await apiRequest(`/pricing-governance/${id}/publish`, actor, {
        method: "POST"
      });
    });
  }

  async function handleCreateReview(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!actor) {
      return;
    }
    await runMutation(async () => {
      await apiRequest("/revenue-reviews", actor, {
        method: "POST",
        body: JSON.stringify({
          title: reviewTitle,
          ownerRole: reviewOwnerRole,
          serviceLineId: reviewServiceLineId || null,
          reviewWindowLabel,
          targetReviewDate: reviewTargetDate,
          summaryNote: reviewSummaryNote
        })
      });
    });
  }

  async function handleReviewStatus(id: string, status: RevenueReviewRecord["status"]): Promise<void> {
    if (!actor) {
      return;
    }
    await runMutation(async () => {
      await apiRequest(`/revenue-reviews/${id}`, actor, {
        method: "PATCH",
        body: JSON.stringify({ status })
      });
    });
  }

  if (!actor) {
    return (
      <section className="stack">
        <div className="card">Sign in to view revenue and commercial governance.</div>
      </section>
    );
  }

  if (!canView) {
    return (
      <section className="stack">
        <div className="card">Your current role cannot access revenue governance.</div>
      </section>
    );
  }

  return (
    <section className="stack">
      <header className="stack">
        <span className="eyebrow">Revenue / Commercial Governance</span>
        <div className="page-header">
          <div>
            <h1>Revenue</h1>
            <p className="muted">
              Track payer friction, pricing governance, and formal revenue reviews without bypassing the existing committee and approval model.
            </p>
          </div>
          <div className="actions">
            <Link className="button secondary" href="/committees">
              Committees
            </Link>
            <Link className="button secondary" href="/service-lines">
              Service Lines
            </Link>
            <Link className="button secondary" href="/public-assets">
              Public Assets
            </Link>
          </div>
        </div>
      </header>

      {error ? <div className="card error">{error}</div> : null}

      <article className="card stack">
        <div className="actions" style={{ justifyContent: "space-between" }}>
          <div className="stack" style={{ gap: 4 }}>
            <h2>Dashboard</h2>
            <span className="muted">{loading ? "Loading..." : "Current revenue signal"}</span>
          </div>
          <label className="stack" style={{ minWidth: 160 }}>
            <span className="muted">Trend window</span>
            <select value={historyMonths} onChange={(event) => setHistoryMonths(event.target.value)}>
              <option value="6">Last 6 months</option>
              <option value="12">Last 12 months</option>
              <option value="18">Last 18 months</option>
            </select>
          </label>
        </div>
        {summary ? (
          <>
            <div className="grid cols-3">
              <div className="card"><div className="muted">Open payer issues</div><strong>{summary.openPayerIssues}</strong></div>
              <div className="card"><div className="muted">Escalated payer issues</div><strong>{summary.escalatedPayerIssues}</strong></div>
              <div className="card"><div className="muted">Overdue payer issues</div><strong>{summary.overduePayerIssues}</strong></div>
              <div className="card"><div className="muted">Pricing pending approval</div><strong>{summary.pricingPendingApproval}</strong></div>
              <div className="card"><div className="muted">Pricing needing attention</div><strong>{summary.pricingAttentionNeeded}</strong></div>
              <div className="card"><div className="muted">Overdue revenue reviews</div><strong>{summary.overdueRevenueReviews}</strong></div>
              <div className="card"><div className="muted">Service lines missing pricing</div><strong>{summary.serviceLinesMissingPricingGovernance}</strong></div>
              <div className="card"><div className="muted">Weak claims governance</div><strong>{summary.serviceLinesWeakClaimsGovernance}</strong></div>
              <div className="card"><div className="muted">Public assets at risk</div><strong>{summary.publicAssetsAtRisk}</strong></div>
            </div>
            {summary.payerIssueAging ? (
              <div className="grid cols-4">
                <div className="card"><div className="muted">Payer issues due soon</div><strong>{summary.payerIssueAging.dueSoon}</strong></div>
                <div className="card"><div className="muted">Payer issues overdue</div><strong>{summary.payerIssueAging.overdue}</strong></div>
                <div className="card"><div className="muted">Older than 30 days</div><strong>{summary.payerIssueAging.olderThanThirtyDays}</strong></div>
                <div className="card"><div className="muted">Escalated issues</div><strong>{summary.payerIssueAging.escalated}</strong></div>
              </div>
            ) : null}
            {summary.pricingReviewBuckets ? (
              <div className="grid cols-4">
                <div className="card"><div className="muted">Pricing due soon</div><strong>{summary.pricingReviewBuckets.reviewDueSoon}</strong></div>
                <div className="card"><div className="muted">Pricing overdue</div><strong>{summary.pricingReviewBuckets.overdue}</strong></div>
                <div className="card"><div className="muted">Pending approval</div><strong>{summary.pricingReviewBuckets.pendingApproval}</strong></div>
                <div className="card"><div className="muted">Attention needed</div><strong>{summary.pricingReviewBuckets.attentionNeeded}</strong></div>
              </div>
            ) : null}
            {summary.pricingFreshnessBuckets && summary.claimsCoverageBuckets ? (
              <div className="grid cols-4">
                <div className="card"><div className="muted">Pricing current</div><strong>{summary.pricingFreshnessBuckets.current}</strong></div>
                <div className="card"><div className="muted">Pricing due soon / overdue</div><strong>{summary.pricingFreshnessBuckets.dueSoon} / {summary.pricingFreshnessBuckets.overdue}</strong></div>
                <div className="card"><div className="muted">Pricing missing</div><strong>{summary.pricingFreshnessBuckets.missing}</strong></div>
                <div className="card"><div className="muted">Claims coverage</div><strong>{summary.claimsCoverageBuckets.covered} covered / {summary.claimsCoverageBuckets.weak} weak / {summary.claimsCoverageBuckets.none} none</strong></div>
              </div>
            ) : null}
            <div className="stack">
              <strong>Attention items</strong>
              {summary.attentionItems.length > 0 ? (
                <ul className="stack" style={{ margin: 0, paddingLeft: 18 }}>
                  {summary.attentionItems.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ) : (
                <p className="muted">No active commercial attention items right now.</p>
              )}
            </div>
            {summary.trends?.length ? (
              <div className="table">
                <div className="table-row table-head">
                  <span>Period</span>
                  <span>Payer issues</span>
                  <span>Pricing approvals</span>
                  <span>Overdue reviews</span>
                </div>
                {summary.trends.map((period) => (
                  <div key={period.periodStart} className="table-row">
                    <span>{period.periodLabel}</span>
                    <span>{period.openPayerIssues} open / {period.escalatedPayerIssues} escalated</span>
                    <span>{period.pricingPendingApproval} pending</span>
                    <span>{period.overdueRevenueReviews}</span>
                  </div>
                ))}
              </div>
            ) : null}
            {summary.serviceLineRisks?.length ? (
              <div className="table">
                <div className="table-row table-head">
                  <span>Service line</span>
                  <span>Pricing</span>
                  <span>Revenue review</span>
                  <span>Risk</span>
                </div>
                {summary.serviceLineRisks.map((risk) => (
                  <div key={risk.serviceLineId} className="table-row">
                    <span>{risk.serviceLineId.replaceAll("_", " ")}</span>
                    <span>{risk.latestPricingGovernanceStatus ?? "none"}</span>
                    <span>{risk.latestRevenueReviewStatus ?? "none"}</span>
                    <span>
                      {risk.missingPricingGovernance ? "Missing pricing governance. " : ""}
                      {risk.weakClaimsGovernance ? "Weak claims governance. " : ""}
                      {risk.publicAssetsAtRisk > 0 ? `${risk.publicAssetsAtRisk} public assets at risk.` : "No active commercial risk flags."}
                    </span>
                  </div>
                ))}
              </div>
            ) : null}
            {summary.serviceLineComparisons?.length ? (
              <div className="table">
                <div className="table-row table-head">
                  <span>Service line</span>
                  <span>Governance</span>
                  <span>Pricing freshness</span>
                  <span>Review freshness</span>
                  <span>Claims / risk</span>
                </div>
                {summary.serviceLineComparisons.map((comparison) => (
                  <div key={comparison.serviceLineId} className="table-row">
                    <span>{comparison.serviceLineId.replaceAll("_", " ")}</span>
                    <span>{comparison.governanceStatus.replaceAll("_", " ")}</span>
                    <span>{comparison.pricingFreshness}{comparison.latestPricingGovernanceStatus ? ` / ${comparison.latestPricingGovernanceStatus}` : ""}</span>
                    <span>{comparison.revenueReviewFreshnessDays != null ? `${comparison.revenueReviewFreshnessDays} days` : "n/a"}</span>
                    <span>{comparison.claimsCoverageStatus} / {comparison.commercialRiskLevel}</span>
                  </div>
                ))}
              </div>
            ) : null}
          </>
        ) : (
          <p className="muted">Loading revenue summary...</p>
        )}
      </article>

      <section className="grid cols-2">
        <article className="card stack">
          <div className="actions" style={{ justifyContent: "space-between" }}>
            <h2>Payer issues</h2>
            <span className="muted">{payerIssues.length} tracked</span>
          </div>
          {canManage ? (
            <form className="stack" onSubmit={(event) => void handleCreateIssue(event)}>
              <input value={issueTitle} onChange={(event) => setIssueTitle(event.target.value)} placeholder="Issue title" />
              <div className="grid cols-2">
                <input value={payerName} onChange={(event) => setPayerName(event.target.value)} placeholder="Payer name" />
                <select value={issueType} onChange={(event) => setIssueType(event.target.value as PayerIssueRecord["issueType"])}>
                  <option value="coverage_policy">Coverage policy</option>
                  <option value="denial">Denial</option>
                  <option value="reimbursement_delay">Reimbursement delay</option>
                  <option value="pricing_exception">Pricing exception</option>
                  <option value="credentialing">Credentialing</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div className="grid cols-2">
                <select value={issueServiceLineId} onChange={(event) => setIssueServiceLineId(event.target.value as ServiceLineId)}>
                  {serviceLineOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
                <select value={issueOwnerRole} onChange={(event) => setIssueOwnerRole(event.target.value as ActorRole)}>
                  {ownerRoles.map((role) => <option key={role} value={role}>{role}</option>)}
                </select>
              </div>
              <input value={issueDueDate} onChange={(event) => setIssueDueDate(event.target.value)} placeholder="Due date (YYYY-MM-DD)" />
              <textarea value={issueSummary} onChange={(event) => setIssueSummary(event.target.value)} rows={4} />
              <textarea value={financialImpactSummary} onChange={(event) => setFinancialImpactSummary(event.target.value)} rows={3} />
              <button className="button" disabled={submitting}>Create payer issue</button>
            </form>
          ) : null}

          <div className="stack">
            {payerIssues.map((issue) => (
              <div key={issue.id} className="card stack">
                <div className="actions" style={{ justifyContent: "space-between" }}>
                  <strong>{issue.title}</strong>
                  <span className={`badge badge-${issue.status}`}>{issue.status.replaceAll("_", " ")}</span>
                </div>
                <div className="muted">{issue.payerName} / {issue.issueType.replaceAll("_", " ")} / {issue.serviceLineId ?? "cross-service"}</div>
                <p>{issue.summary}</p>
                <p className="muted">Owner {issue.ownerRole}{issue.dueDate ? ` / due ${issue.dueDate.slice(0, 10)}` : ""}</p>
                {issue.actionItemId ? <p className="muted">Linked action item: {issue.actionItemId}</p> : null}
                {canManage ? (
                  <div className="actions">
                    <button className="button secondary" disabled={submitting} onClick={() => void handleIssueStatus(issue.id, "under_review")}>Under review</button>
                    <button className="button secondary" disabled={submitting} onClick={() => void handleIssueStatus(issue.id, "escalated")}>Escalate</button>
                    <button className="button secondary" disabled={submitting} onClick={() => void handleIssueStatus(issue.id, "resolved")}>Resolve</button>
                    <button className="button secondary" disabled={submitting} onClick={() => void handleIssueStatus(issue.id, "closed")}>Close</button>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </article>

        <article className="card stack">
          <div className="actions" style={{ justifyContent: "space-between" }}>
            <h2>Pricing governance</h2>
            <span className="muted">{pricingRecords.length} packets</span>
          </div>
          {canManage ? (
            <form className="stack" onSubmit={(event) => void handleCreatePricing(event)}>
              <input value={pricingTitle} onChange={(event) => setPricingTitle(event.target.value)} placeholder="Pricing packet title" />
              <div className="grid cols-2">
                <select value={pricingServiceLineId} onChange={(event) => setPricingServiceLineId(event.target.value as ServiceLineId)}>
                  {serviceLineOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
                <select value={pricingOwnerRole} onChange={(event) => setPricingOwnerRole(event.target.value as ActorRole)}>
                  {ownerRoles.map((role) => <option key={role} value={role}>{role}</option>)}
                </select>
              </div>
              <textarea value={pricingSummary} onChange={(event) => setPricingSummary(event.target.value)} rows={3} />
              <textarea value={marginGuardrailsSummary} onChange={(event) => setMarginGuardrailsSummary(event.target.value)} rows={2} />
              <textarea value={discountGuardrailsSummary} onChange={(event) => setDiscountGuardrailsSummary(event.target.value)} rows={2} />
              <textarea value={payerAlignmentSummary} onChange={(event) => setPayerAlignmentSummary(event.target.value)} rows={2} />
              <textarea value={claimsConstraintSummary} onChange={(event) => setClaimsConstraintSummary(event.target.value)} rows={2} />
              <input value={pricingReviewDueAt} onChange={(event) => setPricingReviewDueAt(event.target.value)} placeholder="Review due (YYYY-MM-DD)" />
              <textarea value={pricingNotes} onChange={(event) => setPricingNotes(event.target.value)} rows={2} />
              <button className="button" disabled={submitting}>Create pricing governance packet</button>
            </form>
          ) : null}

          <div className="stack">
            {pricingRecords.map((record) => (
              <div key={record.id} className="card stack">
                <div className="actions" style={{ justifyContent: "space-between" }}>
                  <strong>{record.title}</strong>
                  <span className={`badge badge-${record.status}`}>{record.status.replaceAll("_", " ")}</span>
                </div>
                <div className="muted">{record.serviceLineId ?? "cross-service"} / owner {record.ownerRole}</div>
                <p>{record.pricingSummary}</p>
                <p className="muted">Review due {record.reviewDueAt ? record.reviewDueAt.slice(0, 10) : "not set"}</p>
                {record.publishedPath ? <p className="muted">Published path: {record.publishedPath}</p> : null}
                {canManage ? (
                  <div className="actions">
                    {record.status === "draft" || record.status === "attention_needed" ? (
                      <button className="button secondary" disabled={submitting} onClick={() => void handleSubmitPricing(record.id)}>Submit</button>
                    ) : null}
                    {record.status === "approved" || record.status === "publish_pending" ? (
                      <button className="button secondary" disabled={submitting} onClick={() => void handlePublishPricing(record.id)}>Publish</button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </article>
      </section>

      <article className="card stack">
        <div className="actions" style={{ justifyContent: "space-between" }}>
          <h2>Revenue reviews</h2>
          <span className="muted">{revenueReviews.length} reviews</span>
        </div>
        {canManage ? (
          <form className="grid cols-2" onSubmit={(event) => void handleCreateReview(event)}>
            <input value={reviewTitle} onChange={(event) => setReviewTitle(event.target.value)} placeholder="Review title" />
            <select value={reviewOwnerRole} onChange={(event) => setReviewOwnerRole(event.target.value as ActorRole)}>
              {ownerRoles.map((role) => <option key={role} value={role}>{role}</option>)}
            </select>
            <select value={reviewServiceLineId} onChange={(event) => setReviewServiceLineId(event.target.value as ServiceLineId | "")}>
              <option value="">All service lines</option>
              {serviceLineOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            <input value={reviewWindowLabel} onChange={(event) => setReviewWindowLabel(event.target.value)} placeholder="Window label" />
            <input value={reviewTargetDate} onChange={(event) => setReviewTargetDate(event.target.value)} placeholder="Target review date" />
            <textarea value={reviewSummaryNote} onChange={(event) => setReviewSummaryNote(event.target.value)} rows={3} />
            <button className="button" disabled={submitting} style={{ gridColumn: "1 / -1" }}>Create revenue review</button>
          </form>
        ) : null}

        <div className="grid cols-2">
          {revenueReviews.map((review) => (
            <div key={review.id} className="card stack">
              <div className="actions" style={{ justifyContent: "space-between" }}>
                <strong>{review.title}</strong>
                <span className={`badge badge-${review.status}`}>{review.status.replaceAll("_", " ")}</span>
              </div>
              <div className="muted">{review.reviewWindowLabel} / owner {review.ownerRole}{review.serviceLineId ? ` / ${review.serviceLineId}` : ""}</div>
              {review.summaryNote ? <p>{review.summaryNote}</p> : null}
              <div className="grid cols-3">
                <div className="card"><div className="muted">Open payer issues</div><strong>{review.snapshot.openPayerIssues}</strong></div>
                <div className="card"><div className="muted">Pricing pending</div><strong>{review.snapshot.pricingPendingApproval}</strong></div>
                <div className="card"><div className="muted">Assets at risk</div><strong>{review.snapshot.publicAssetsAtRisk}</strong></div>
              </div>
              {canManage ? (
                <div className="actions">
                  {review.status === "draft" ? (
                    <button className="button secondary" disabled={submitting} onClick={() => void handleReviewStatus(review.id, "review_pending")}>Mark pending</button>
                  ) : null}
                  {review.status === "review_pending" ? (
                    <button className="button secondary" disabled={submitting} onClick={() => void handleReviewStatus(review.id, "completed")}>Complete</button>
                  ) : null}
                  {review.status !== "archived" ? (
                    <button className="button secondary" disabled={submitting} onClick={() => void handleReviewStatus(review.id, "archived")}>Archive</button>
                  ) : null}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </article>
    </section>
  );
}
