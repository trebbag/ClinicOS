const baseUrl = process.env.PILOT_WORKER_HEALTH_BASE_URL ?? process.env.PILOT_SMOKE_BASE_URL ?? process.argv[2];

if (!baseUrl) {
  console.error("Usage: npm run smoke:worker-health -- https://clinic-os.example.com");
  process.exit(1);
}

const trimmedBaseUrl = baseUrl.replace(/\/$/, "");
const apiBaseUrl = `${trimmedBaseUrl}/clinic-api`;
const origin = new URL(trimmedBaseUrl).origin;
const cookieJar = new Map();

function nowSuffix() {
  return new Date().toISOString().replace(/[^\d]/g, "").slice(0, 14);
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

function envKeyForRole(role) {
  return role.toUpperCase().replace(/[^A-Z0-9]+/g, "_");
}

function pinForRole(role) {
  return process.env[`PILOT_SMOKE_${envKeyForRole(role)}_PIN`]
    ?? process.env.PILOT_SMOKE_PIN
    ?? null;
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

async function ensureAuthenticated() {
  await publicRequest("web health", "/healthz");
  await publicRequest("web readiness", "/readyz");
  await apiRequest("api readiness", "/readyz");

  let authState = (await apiRequest("auth state", "/auth/state")).json;
  if (authState?.needsEnrollment) {
    const enrollmentCode = process.env.PILOT_SMOKE_ENROLLMENT_CODE;
    if (!enrollmentCode) {
      throw new Error("This browser is not enrolled. Set PILOT_SMOKE_ENROLLMENT_CODE to enroll a worker-health smoke device.");
    }

    authState = (
      await apiRequest("device enrollment", "/auth/enroll-device", {
        method: "POST",
        json: {
          enrollmentCode,
          deviceLabel: process.env.PILOT_SMOKE_DEVICE_LABEL ?? `Codex worker health ${nowSuffix()}`
        }
      })
    ).json;
  }

  if (authState?.needsLogin) {
    const role = process.env.PILOT_SMOKE_PROFILE_ROLE ?? "medical_director";
    const profile = chooseProfile(authState, process.env.PILOT_SMOKE_PROFILE_ID, role);
    if (!profile) {
      throw new Error(`No allowed profile can log in as ${role}.`);
    }

    const pin = pinForRole(role);
    if (!pin) {
      throw new Error(`No PIN available for role ${role}. Set PILOT_SMOKE_PIN or PILOT_SMOKE_${envKeyForRole(role)}_PIN.`);
    }

    authState = (
      await apiRequest("profile login", "/auth/login", {
        method: "POST",
        json: {
          profileId: profile.id,
          pin,
          role
        }
      })
    ).json;
  }

  return {
    authState,
    whoami: (await apiRequest("auth whoami", "/auth/whoami")).json
  };
}

function buildRecommendation(health) {
  if (health.operatingState === "not_polling") {
    return "Worker is not polling. Compare the recent runtime history with the Render worker logs, then run one bounded batch to confirm the queue can still drain.";
  }
  if (health.operatingState === "polling_failed") {
    return "Worker is polling but failing. Review the recent failed batch history before retrying stale processing cleanup.";
  }
  if (health.health === "critical") {
    return "Worker looks stalled. Check heartbeat freshness, run one bounded worker batch, then clean stale processing locks if the same jobs remain.";
  }
  if (health.health === "warning") {
    return "Worker is degraded but not fully stalled. Compare queued age to the thresholds and watch whether backlog continues to drain.";
  }
  if (health.health === "healthy") {
    return "Worker heartbeat and queue ages look healthy. Continue normal monitoring.";
  }
  return "Worker health is still unknown. Confirm the worker service is live and emitting heartbeat events.";
}

function summarize(health) {
  return {
    checkedAt: health.checkedAt,
    health: health.health,
    operatingState: health.operatingState,
    lastPollAttemptAt: health.lastPollAttemptAt,
    lastHeartbeatAt: health.lastHeartbeatAt,
    lastCompletedBatchAt: health.lastCompletedBatchAt,
    lastManualBatchRequestAt: health.lastManualBatchRequestAt,
    lastStaleProcessingCleanupAt: health.lastStaleProcessingCleanupAt,
    oldestQueuedMinutes: health.backlog.oldestQueuedMinutes,
    oldestProcessingMinutes: health.backlog.oldestProcessingMinutes,
    queueCounts: {
      queued: health.backlog.queued,
      processing: health.backlog.processing,
      failed: health.backlog.failed,
      deadLetter: health.backlog.deadLetter,
      succeeded: health.backlog.succeeded
    },
    thresholds: health.thresholds,
    recentRuntimeState: health.recentRuntimeState,
    recentEvents: health.recentEvents,
    recommendation: buildRecommendation(health)
  };
}

async function main() {
  await ensureAuthenticated();
  const health = (await apiRequest("worker health", "/ops/worker-health")).json;
  console.log(JSON.stringify(summarize(health), null, 2));
  if (health.health === "critical") {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
