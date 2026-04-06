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
    ?? state.allowedProfiles.find((profile) => preferredRole && profile.role === preferredRole)
    ?? state.allowedProfiles.find((profile) => profile.isPrimary)
    ?? state.allowedProfiles[0]
    ?? null;
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

  const officeManagerPin = process.env.PILOT_SMOKE_OFFICE_MANAGER_PIN;
  const medicalDirectorPin = process.env.PILOT_SMOKE_MEDICAL_DIRECTOR_PIN;
  const officeManagerProfile = authState.allowedProfiles.find((profile) => profile.role === "office_manager");
  const medicalDirectorProfile = authState.allowedProfiles.find((profile) => profile.role === "medical_director");

  if (!officeManagerPin || !medicalDirectorPin || !officeManagerProfile || !medicalDirectorProfile) {
    console.log(JSON.stringify({
      label: "publish smoke skipped",
      reason: "PILOT_SMOKE_OFFICE_MANAGER_PIN and PILOT_SMOKE_MEDICAL_DIRECTOR_PIN plus both allowed profiles are required."
    }));
    return;
  }

  await apiRequest("switch to office manager", "/auth/switch-profile", {
    method: "POST",
    json: {
      profileId: officeManagerProfile.id,
      pin: officeManagerPin
    }
  });

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

  await apiRequest("office manager approve", `/approvals/${officeManagerApproval.id}/decide`, {
    method: "POST",
    json: { decision: "approved" }
  });

  await apiRequest("switch to medical director", "/auth/switch-profile", {
    method: "POST",
    json: {
      profileId: medicalDirectorProfile.id,
      pin: medicalDirectorPin
    }
  });

  await apiRequest("medical director approve", `/approvals/${medicalDirectorApproval.id}/decide`, {
    method: "POST",
    json: { decision: "approved" }
  });

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

  if (whoami?.actor?.role !== "medical_director") {
    await apiRequest("restore primary profile", "/auth/switch-profile", {
      method: "POST",
      json: {
        profileId: chooseProfile(authState, process.env.PILOT_SMOKE_PROFILE_ID, process.env.PILOT_SMOKE_PROFILE_ROLE)?.id,
        pin: process.env.PILOT_SMOKE_PIN
      }
    });
  }
}

async function main() {
  const { authState, whoami } = await ensureAuthenticated();

  await apiRequest("ops config", "/ops/config-status");
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
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
