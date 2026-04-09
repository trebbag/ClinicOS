const baseUrl = process.env.PILOT_SMOKE_BASE_URL ?? process.argv[2];

if (!baseUrl) {
  console.error("Usage: npm run smoke:pilot-live -- https://clinic-os.example.com");
  process.exit(1);
}

const trimmedBaseUrl = baseUrl.replace(/\/$/, "");
const apiBaseUrl = `${trimmedBaseUrl}/clinic-api`;
const origin = new URL(trimmedBaseUrl).origin;
const cookieJar = new Map();

function nowSuffix() {
  return new Date().toISOString().replace(/[^\d]/g, "").slice(0, 14);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function setCookieFromHeader(header) {
  if (!header) {
    return;
  }

  const [pair] = header.split(";");
  const index = pair.indexOf("=");
  if (index < 0) {
    return;
  }

  const name = pair.slice(0, index).trim();
  const value = pair.slice(index + 1).trim();
  if (!value) {
    cookieJar.delete(name);
    return;
  }

  cookieJar.set(name, value);
}

function updateCookies(response) {
  if (typeof response.headers.getSetCookie === "function") {
    for (const header of response.headers.getSetCookie()) {
      setCookieFromHeader(header);
    }
    return;
  }

  const combined = response.headers.get("set-cookie");
  if (!combined) {
    return;
  }

  for (const header of combined.split(/,(?=[^;]+=[^;]+)/g)) {
    setCookieFromHeader(header);
  }
}

function cookieHeader() {
  if (cookieJar.size === 0) {
    return undefined;
  }

  return Array.from(cookieJar.entries())
    .map(([name, value]) => `${name}=${value}`)
    .join("; ");
}

async function request(label, url, options = {}) {
  const headers = new Headers(options.headers ?? {});
  const method = (options.method ?? "GET").toUpperCase();
  const cookie = cookieHeader();
  if (cookie) {
    headers.set("cookie", cookie);
  }
  if (options.json !== undefined) {
    headers.set("content-type", "application/json");
  }
  if (!["GET", "HEAD", "OPTIONS"].includes(method)) {
    headers.set("origin", origin);
  }

  const response = await fetch(url, {
    method,
    headers,
    body: options.json === undefined ? options.body : JSON.stringify(options.json),
    redirect: "manual"
  });

  updateCookies(response);
  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }

  console.log(JSON.stringify({
    label,
    url,
    method,
    status: response.status,
    ok: response.ok,
    body: text.slice(0, 400)
  }));

  if (options.expectOk !== false && !response.ok) {
    throw new Error(`${label} failed with ${response.status}: ${text}`);
  }

  return { response, text, json };
}

async function publicRequest(label, path) {
  return request(label, `${trimmedBaseUrl}${path}`);
}

async function apiRequest(label, path, options) {
  return request(label, `${apiBaseUrl}${path}`, options);
}

function chooseProfile(state, preferredProfileId, preferredRole) {
  if (!state?.allowedProfiles?.length) {
    return null;
  }

  return state.allowedProfiles.find((profile) => profile.id === preferredProfileId)
    ?? state.allowedProfiles.find((profile) =>
      preferredRole && (profile.role === preferredRole || profile.availableRoles?.includes(preferredRole))
    )
    ?? state.allowedProfiles.find((profile) => profile.isPrimary)
    ?? state.allowedProfiles[0]
    ?? null;
}

function envKeyForRole(role) {
  return role.toUpperCase().replace(/[^A-Z0-9]+/g, "_");
}

function pinForRole(role) {
  return process.env[`PILOT_SMOKE_${envKeyForRole(role)}_PIN`]
    ?? process.env.PILOT_SMOKE_PIN
    ?? null;
}

async function switchToRole(authState, role, label) {
  const profile = chooseProfile(authState, process.env.PILOT_SMOKE_PROFILE_ID, role);
  if (!profile) {
    throw new Error(`No allowed profile can act as ${role}.`);
  }

  const pin = pinForRole(role);
  if (!pin) {
    throw new Error(`No PIN available for role ${role}. Set PILOT_SMOKE_PIN or PILOT_SMOKE_${envKeyForRole(role)}_PIN.`);
  }

  const result = await apiRequest(label, "/auth/switch-profile", {
    method: "POST",
    json: {
      profileId: profile.id,
      pin,
      role
    }
  });

  return result.json;
}

async function approveAll(authState, approvals, labelPrefix) {
  for (const approval of approvals) {
    await switchToRole(authState, approval.reviewerRole, `${labelPrefix} switch ${approval.reviewerRole}`);
    await apiRequest(`${labelPrefix} decide ${approval.reviewerRole}`, `/approvals/${approval.id}/decide`, {
      method: "POST",
      json: { decision: "approved" }
    });
  }
}

async function poll(label, fn, options = {}) {
  const attempts = options.attempts ?? 20;
  const delayMs = options.delayMs ?? 1500;
  let lastResult = null;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    lastResult = await fn();
    if (lastResult.done) {
      return lastResult.value;
    }
    await sleep(delayMs);
  }

  throw new Error(`${label} did not complete before timeout${lastResult?.detail ? `: ${lastResult.detail}` : ""}`);
}

function buildSmokeCsv(suffix) {
  return [
    "employee_id,employee_role,period_start,period_end,task_completion_rate,training_completion_rate,audit_pass_rate,issue_close_rate,complaint_count,note_lag_days,refill_turnaround_hours,schedule_fill_rate",
    [
      `smoke-${suffix}`,
      "office_manager",
      "2026-03-01",
      "2026-03-31",
      "0.95",
      "1",
      "0.98",
      "0.9",
      "0",
      "1",
      "12",
      "0.92"
    ].join(",")
  ].join("\n");
}

async function ensureAuthenticated() {
  await publicRequest("web health", "/healthz");
  await publicRequest("web readiness", "/readyz");
  await apiRequest("api readiness", "/readyz");

  let authState = (await apiRequest("auth state", "/auth/state")).json;
  if (authState?.needsEnrollment) {
    const enrollmentCode = process.env.PILOT_SMOKE_ENROLLMENT_CODE;
    if (!enrollmentCode) {
      throw new Error("This browser is not enrolled. Set PILOT_SMOKE_ENROLLMENT_CODE to let the smoke script enroll a fresh device.");
    }

    const deviceLabel = process.env.PILOT_SMOKE_DEVICE_LABEL ?? `Codex smoke ${nowSuffix()}`;
    authState = (
      await apiRequest("device enrollment", "/auth/enroll-device", {
        method: "POST",
        json: {
          enrollmentCode,
          deviceLabel
        }
      })
    ).json;
  }

  if (authState?.needsLogin) {
    const pin = process.env.PILOT_SMOKE_PIN;
    if (!pin) {
      throw new Error("This browser still needs a profile login. Set PILOT_SMOKE_PIN so the script can authenticate.");
    }

    const profile = chooseProfile(
      authState,
      process.env.PILOT_SMOKE_PROFILE_ID,
      process.env.PILOT_SMOKE_PROFILE_ROLE
    );
    if (!profile) {
      throw new Error("No allowed profile was available for login.");
    }

    authState = (
      await apiRequest("profile login", "/auth/login", {
        method: "POST",
        json: {
          profileId: profile.id,
          pin
        }
      })
    ).json;
  }

  const whoami = (await apiRequest("auth whoami", "/auth/whoami")).json;
  return {
    authState,
    whoami
  };
}

async function verifyRuntimeAgentsDisabled() {
  const expectRuntimeAgentsDisabled = process.env.PILOT_SMOKE_EXPECT_RUNTIME_AGENTS_DISABLED !== "false";
  const runtimeAgentStatus = (await apiRequest("runtime agent status", "/runtime-agents")).json;
  if (!expectRuntimeAgentsDisabled) {
    return runtimeAgentStatus;
  }

  if (runtimeAgentStatus?.enabled) {
    throw new Error("Runtime agents were expected to stay disabled in the deployed pilot environment.");
  }

  const reason = String(runtimeAgentStatus?.reason ?? "");
  if (reason !== "Runtime agents are disabled by configuration.") {
    throw new Error(`Runtime agents are disabled, but not by the expected explicit configuration flag: ${runtimeAgentStatus?.reason ?? "missing reason"}`);
  }

  return runtimeAgentStatus;
}

async function waitForWorkerSuccess(sourceEntityId, expectedTypes) {
  return poll(
    `worker success for ${sourceEntityId}`,
    async () => {
      const jobs = (
        await apiRequest(
          `worker jobs ${sourceEntityId}`,
          `/worker-jobs?sourceEntityId=${encodeURIComponent(sourceEntityId)}`
        )
      ).json;
      const relevantJobs = jobs.filter((job) => expectedTypes.includes(job.type));
      const done = expectedTypes.every((type) => relevantJobs.some((job) => job.type === type && job.status === "succeeded"));
      const failed = relevantJobs.find((job) => ["failed", "dead_letter"].includes(job.status));
      return {
        done,
        value: relevantJobs,
        detail: failed ? `${failed.type}=${failed.status}` : `waiting for ${expectedTypes.join(", ")}`
      };
    }
  );
}

async function runLiveMutations(authState, whoami) {
  const suffix = nowSuffix();
  const issue = (
    await apiRequest("create issue action item", "/action-items", {
      method: "POST",
      json: {
        kind: "issue",
        title: `Smoke issue ${suffix}`,
        description: "Non-PHI smoke issue generated by the pilot live smoke script.",
        ownerRole: "office_manager"
      }
    })
  ).json;
  await waitForWorkerSuccess(issue.id, ["lists.issue.upsert"]);

  const routine = (
    await apiRequest("create follow-through action item", "/action-items", {
      method: "POST",
      json: {
        kind: "review",
        title: `Smoke follow-through ${suffix}`,
        description: "Non-PHI smoke follow-through item generated by the pilot live smoke script.",
        ownerRole: "office_manager",
        dueDate: new Date(Date.now() + 60 * 60 * 1000).toISOString()
      }
    })
  ).json;
  await waitForWorkerSuccess(routine.id, ["planner.task.create", "lists.action-item.upsert"]);

  const scorecardImport = (
    await apiRequest("import smoke scorecards", "/scorecard-imports", {
      method: "POST",
      json: {
        filename: `smoke-${suffix}.csv`,
        csv: buildSmokeCsv(suffix)
      }
    })
  ).json;
  await waitForWorkerSuccess(scorecardImport.workflow.id, ["lists.import-status.upsert", "teams.notification"]);

  await apiRequest("reconcile planner", "/office-ops/reconcile-planner", {
    method: "POST"
  });

  const originalRole = whoami?.actor?.role ?? authState?.session?.role ?? null;
  const canPublishSmoke = chooseProfile(authState, process.env.PILOT_SMOKE_PROFILE_ID, "office_manager")
    && chooseProfile(authState, process.env.PILOT_SMOKE_PROFILE_ID, "medical_director")
    && pinForRole("office_manager")
    && pinForRole("medical_director");

  if (!canPublishSmoke) {
    console.log(JSON.stringify({
      label: "publish smoke skipped",
      reason: "Office manager and medical director role access plus PIN values are required."
    }));
    return;
  }

  await switchToRole(authState, "office_manager", "switch to office manager");

  const document = (
    await apiRequest("create smoke document", "/documents", {
      method: "POST",
      json: {
        title: `Pilot smoke document ${suffix}`,
        ownerRole: "office_manager",
        approvalClass: "action_request",
        artifactType: "smoke_packet",
        summary: "Non-PHI live smoke document",
        serviceLines: [],
        body: "# Pilot smoke document\n\nThis is a non-PHI live smoke artifact."
      }
    })
  ).json;

  const submitted = (
    await apiRequest("submit smoke document", `/documents/${document.id}/submit`, {
      method: "POST"
    })
  ).json;
  const officeManagerApproval = submitted.approvals.find((approval) => approval.reviewerRole === "office_manager");
  const medicalDirectorApproval = submitted.approvals.find((approval) => approval.reviewerRole === "medical_director");

  if (!officeManagerApproval || !medicalDirectorApproval) {
    throw new Error("Smoke document did not create the expected office manager and medical director approvals.");
  }

  await approveAll(authState, [officeManagerApproval, medicalDirectorApproval], "document approval");

  await apiRequest("publish smoke document", `/documents/${document.id}/publish`, {
    method: "POST"
  });

  await poll(
    "document publish",
    async () => {
      const documents = (await apiRequest("published documents", "/documents?status=published")).json;
      const published = documents.find((record) => record.id === document.id);
      return {
        done: Boolean(published),
        value: published,
        detail: "waiting for document.publish worker completion"
      };
    }
  );

  await apiRequest("approved context", `/documents/${document.id}/approved-context`);

  if (originalRole && originalRole !== "medical_director") {
    await switchToRole(authState, originalRole, "restore primary role");
  }
}

async function runGovernanceSmoke(authState, whoami) {
  const suffix = nowSuffix();
  const originalRole = whoami?.actor?.role ?? authState?.session?.role ?? null;

  await switchToRole(authState, "medical_director", "switch to medical director for controlled substances");
  await apiRequest("practice agreement bootstrap", "/practice-agreements/bootstrap-defaults", {
    method: "POST"
  });
  await apiRequest("controlled substances bootstrap", "/controlled-substances/bootstrap-defaults", {
    method: "POST"
  });

  const stewardshipRecords = (await apiRequest("controlled substances list", "/controlled-substances")).json;
  const stewardship = stewardshipRecords.find((record) => record.title === "Controlled-substance stewardship packet")
    ?? stewardshipRecords[0];
  if (!stewardship) {
    throw new Error("Controlled-substance stewardship bootstrap did not return a packet.");
  }

  await apiRequest("controlled substances update", `/controlled-substances/${stewardship.id}`, {
    method: "PATCH",
    json: {
      pdmpReviewSummary: `Live smoke PDMP review ${suffix}.`,
      notes: `Live smoke note ${suffix}.`
    }
  });

  const submittedStewardship = (
    await apiRequest("controlled substances submit", `/controlled-substances/${stewardship.id}/submit`, {
      method: "POST"
    })
  ).json;
  await approveAll(authState, submittedStewardship.approvals, "controlled substances approval");

  await apiRequest("controlled substances publish", `/controlled-substances/${stewardship.id}/publish`, {
    method: "POST"
  });
  await poll("controlled substances publish", async () => {
    const records = (await apiRequest("controlled substances poll", "/controlled-substances")).json;
    const published = records.find((record) => record.id === stewardship.id);
    return {
      done: published?.status === "published",
      value: published,
      detail: "waiting for controlled-substance publication"
    };
  }, { attempts: 30, delayMs: 1500 });

  await switchToRole(authState, "quality_lead", "switch to quality lead for standards");
  await apiRequest("standards bootstrap", "/standards/bootstrap-defaults", {
    method: "POST"
  });
  const standards = (await apiRequest("standards list", "/standards")).json;
  if (!Array.isArray(standards) || standards.length < 1) {
    throw new Error("Standards bootstrap did not return any standards.");
  }

  const selectedStandardIds = standards.slice(0, 3).map((standard) => standard.id);
  const binderTitle = `Pilot live evidence binder ${suffix}`;
  const binderCreate = (
    await apiRequest("create evidence binder", "/evidence-binders", {
      method: "POST",
      json: {
        title: binderTitle,
        ownerRole: "quality_lead",
        sourceAuthority: "Joint Commission Mock Survey",
        surveyWindowLabel: `Pilot window ${suffix}`,
        standardIds: selectedStandardIds,
        summary: "Live smoke evidence binder for deployed governance validation.",
        evidenceReadinessSummary: "Each selected standard should resolve to current evidence owned by a named role.",
        openGapSummary: "Track missing signatures, stale reviews, or overdue committee evidence before survey use.",
        reviewCadenceDays: 60,
        notes: `Live smoke binder ${suffix}.`
      }
    })
  ).json;

  const submittedBinder = (
    await apiRequest("submit evidence binder", `/evidence-binders/${binderCreate.binder.id}/submit`, {
      method: "POST"
    })
  ).json;
  await approveAll(authState, submittedBinder.approvals, "evidence binder approval");

  await switchToRole(authState, "medical_director", "switch to medical director for evidence binder publish");
  await apiRequest("publish evidence binder", `/evidence-binders/${binderCreate.binder.id}/publish`, {
    method: "POST"
  });

  await poll("evidence binder publish", async () => {
    const binders = (await apiRequest("evidence binder poll", "/evidence-binders")).json;
    const published = binders.find((binder) => binder.id === binderCreate.binder.id);
    return {
      done: published?.status === "published",
      value: published,
      detail: "waiting for evidence-binder publication"
    };
  }, { attempts: 30, delayMs: 1500 });

  await switchToRole(authState, "quality_lead", "switch to quality lead for standards verification");
  await poll("standards completion after evidence binder publish", async () => {
    const refreshedStandards = (await apiRequest("standards verify", "/standards")).json;
    const linkedStandards = refreshedStandards.filter((record) => selectedStandardIds.includes(record.id));
    const allComplete = linkedStandards.length === selectedStandardIds.length
      && linkedStandards.every((record) => record.status === "complete" && record.latestBinderId === binderCreate.binder.id);
    return {
      done: allComplete,
      value: linkedStandards,
      detail: "waiting for linked standards to complete after binder publish"
    };
  }, { attempts: 30, delayMs: 1500 });

  if (originalRole && originalRole !== "quality_lead") {
    await switchToRole(authState, originalRole, "restore original role after governance smoke");
  }
}

async function runRevenueSmoke(authState, whoami) {
  const suffix = nowSuffix();
  const originalRole = whoami?.actor?.role ?? authState?.session?.role ?? null;
  const canRunRevenueSmoke = chooseProfile(authState, process.env.PILOT_SMOKE_PROFILE_ID, "cfo")
    && chooseProfile(authState, process.env.PILOT_SMOKE_PROFILE_ID, "medical_director")
    && pinForRole("cfo")
    && pinForRole("medical_director");

  if (!canRunRevenueSmoke) {
    console.log(JSON.stringify({
      label: "revenue smoke skipped",
      reason: "CFO and medical director role access plus PIN values are required."
    }));
    return;
  }

  await switchToRole(authState, "medical_director", "switch to medical director for revenue bootstrap");
  await apiRequest("service lines bootstrap", "/service-lines/bootstrap-defaults", {
    method: "POST"
  });
  await apiRequest("committees bootstrap", "/committees/bootstrap-defaults", {
    method: "POST"
  });

  await switchToRole(authState, "cfo", "switch to cfo for revenue governance");
  const payerIssue = (
    await apiRequest("create payer issue", "/payer-issues", {
      method: "POST",
      json: {
        title: `Telehealth reimbursement ambiguity ${suffix}`,
        payerName: "Regional Commercial Plan",
        issueType: "coverage_policy",
        serviceLineId: "telehealth",
        ownerRole: "cfo",
        summary: "Clarify reimbursement posture for telehealth follow-up bundles before the next campaign window.",
        financialImpactSummary: "Potential reimbursement leakage if the current reimbursement language remains ambiguous.",
        dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString()
      }
    })
  ).json;

  await apiRequest("escalate payer issue", `/payer-issues/${payerIssue.id}`, {
    method: "PATCH",
    json: {
      status: "escalated",
      resolutionNote: "Escalated during live smoke validation."
    }
  });

  const pricingResponse = (
    await apiRequest("create pricing governance", "/pricing-governance", {
      method: "POST",
      json: {
        title: `Telehealth pricing governance ${suffix}`,
        serviceLineId: "telehealth",
        ownerRole: "cfo",
        pricingSummary: "Define visit tiers, package boundaries, and approved self-pay guardrails for telehealth follow-up care.",
        marginGuardrailsSummary: "Maintain target margin guardrails unless a documented pilot exception is approved by both finance and clinical leadership.",
        discountGuardrailsSummary: "Limit discounts to approved campaigns and documented retention cases.",
        payerAlignmentSummary: "Tie self-pay offers to the current payer reimbursement posture and escalation notes.",
        claimsConstraintSummary: "Do not promise reimbursement outcomes or clinical effectiveness beyond approved claims inventory.",
        reviewDueAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
        notes: `Live smoke pricing governance ${suffix}.`
      }
    })
  ).json;

  const submittedPricing = (
    await apiRequest("submit pricing governance", `/pricing-governance/${pricingResponse.pricingGovernance.id}/submit`, {
      method: "POST"
    })
  ).json;
  await approveAll(authState, submittedPricing.approvals, "pricing governance approval");

  await switchToRole(authState, "medical_director", "switch to medical director for pricing publish");
  await apiRequest("publish pricing governance", `/pricing-governance/${pricingResponse.pricingGovernance.id}/publish`, {
    method: "POST"
  });
  await poll("pricing governance publish", async () => {
    const records = (await apiRequest("pricing governance poll", "/pricing-governance")).json;
    const published = records.find((record) => record.id === pricingResponse.pricingGovernance.id);
    return {
      done: published?.status === "published",
      value: published,
      detail: "waiting for pricing-governance publication"
    };
  }, { attempts: 30, delayMs: 1500 });

  await switchToRole(authState, "cfo", "switch to cfo for revenue review");
  const revenueReview = (
    await apiRequest("create revenue review", "/revenue-reviews", {
      method: "POST",
      json: {
        title: `Revenue review ${suffix}`,
        ownerRole: "cfo",
        serviceLineId: "telehealth",
        reviewWindowLabel: `Live smoke ${suffix}`,
        targetReviewDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        summaryNote: "Validate payer ambiguity, pricing governance posture, and commercial readiness together."
      }
    })
  ).json;

  const summary = (await apiRequest("revenue summary", "/revenue/summary?serviceLineId=telehealth")).json;
  if (!summary || typeof summary.openPayerIssues !== "number" || typeof summary.pricingPendingApproval !== "number") {
    throw new Error("Revenue summary did not return the expected dashboard structure.");
  }

  const committees = (await apiRequest("revenue committees", "/committees?category=revenue_commercial")).json;
  const revenueCommittee = committees.find((committee) => committee.category === "revenue_commercial");
  if (revenueCommittee) {
    const meeting = (
      await apiRequest("create revenue committee meeting", "/committee-meetings", {
        method: "POST",
        json: {
          committeeId: revenueCommittee.id,
          scheduledFor: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          notes: "Live smoke commercial review packet.",
          agendaItems: [
            {
              title: "Review open payer ambiguity",
              ownerRole: "cfo",
              summary: "Confirm payer escalation plan and next follow-up date."
            },
            {
              title: "Review published pricing governance",
              ownerRole: "medical_director",
              summary: `Review linked revenue review ${revenueReview.id} before committee approval routing.`
            }
          ]
        }
      })
    ).json;

    await apiRequest("generate revenue committee packet", `/committee-meetings/${meeting.id}/generate-packet`, {
      method: "POST"
    });
  }

  if (originalRole && originalRole !== "cfo") {
    await switchToRole(authState, originalRole, "restore original role after revenue smoke");
  }
}

async function main() {
  const { authState, whoami } = await ensureAuthenticated();

  await apiRequest("ops config", "/ops/config-status");
  await apiRequest("worker health", "/ops/worker-health");
  await verifyRuntimeAgentsDisabled();
  await apiRequest("microsoft status", "/integrations/microsoft/status");
  await apiRequest("microsoft validate", "/integrations/microsoft/validate", {
    method: "POST"
  });
  await apiRequest("worker summary", "/worker-jobs/summary");

  if (process.env.PILOT_SMOKE_SKIP_LIVE_MUTATIONS === "true") {
    console.log(JSON.stringify({
      label: "live mutations skipped",
      reason: "PILOT_SMOKE_SKIP_LIVE_MUTATIONS=true"
    }));
    return;
  }

  await runLiveMutations(authState, whoami);
  await runGovernanceSmoke(authState, whoami);
  await runRevenueSmoke(authState, whoami);
  await apiRequest("worker health after governance smoke", "/ops/worker-health");
  await apiRequest("worker summary after governance smoke", "/worker-jobs/summary");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
