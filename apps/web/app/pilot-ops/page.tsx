"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { allActorRoles, useAppAuth, type AppCapability } from "../../components/auth-provider";
import { apiRequest, type ActorRole } from "../../lib/api";

type WhoAmI = {
  actor: {
    actorId: string;
    role: string;
    name?: string;
  };
  grantedRoles?: string[];
  authMode: "dev_headers" | "trusted_proxy" | "device_profiles";
  authenticatedAt: string;
  capabilities: AppCapability[];
};

type SurfaceStatus = {
  key: string;
  label: string;
  status: string;
  verificationMode: "live_probe" | "config_only";
  configured: boolean;
  reachable: boolean;
  detail: string | null;
};

type MicrosoftStatus = {
  provider: "microsoft";
  mode: "stub" | "live";
  configComplete: boolean;
  readyForLive: boolean;
  pilotUsable: boolean;
  publicationMode: "local_stub" | "sharepoint_live";
  missingConfigKeys: string[];
  latestValidation: {
    id: string;
    overallStatus: string;
    checkedAt: string;
    checkedById: string;
    checkedByRole: string;
    surfaces: SurfaceStatus[];
  } | null;
};

type ConfigStatus = {
  authMode: "dev_headers" | "trusted_proxy" | "device_profiles";
  nodeEnv: string;
  publicationMode: "local_stub" | "sharepoint_live";
  pilotUsable: boolean;
  startupReady: boolean;
  publicAppOrigin: string | null;
  blockingIssues: string[];
  worker: {
    queued: number;
    processing: number;
    failed: number;
    deadLetter: number;
    succeeded: number;
  };
  hardening: {
    currentAuthMode: "dev_headers" | "trusted_proxy" | "device_profiles";
    runtimeAgentsExplicitlyDisabled: boolean;
    runtimeAgentsConfigValue: string | null;
    trustedProxyConfigured: boolean;
    trustedProxyReady: boolean;
    recommendedTargetAuthMode: "dev_headers" | "trusted_proxy" | "device_profiles";
    latestPromotion: {
      id: string;
      environmentKey: string;
      status: string;
      targetAuthMode: string;
      runtimeAgentsDisabled: boolean;
      latestSmokeAt: string | null;
      rollbackVerifiedAt: string | null;
      notes: string | null;
    } | null;
    latestAlertDispatchAt: string | null;
    latestRollbackVerificationAt: string | null;
    latestSmokeAt: string | null;
  };
};

type DeploymentPromotion = {
  id: string;
  environmentKey: string;
  status: "draft" | "in_review" | "ready" | "completed";
  targetAuthMode: "dev_headers" | "trusted_proxy" | "device_profiles";
  runtimeAgentsDisabled: boolean;
  latestSmokeAt: string | null;
  rollbackVerifiedAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

type MaintenanceSummary = {
  checkedAt: string;
  thresholds: {
    authArtifactRetentionDays: number;
    workerJobRetentionDays: number;
    staleProcessingMinutes: number;
  };
  auth: {
    activeDevices: number;
    activeSessions: number;
    expiredActiveSessions: number;
    purgeableRevokedSessions: number;
    activeEnrollmentCodes: number;
    purgeableEnrollmentCodes: number;
    lockedProfileAssignments: number;
  };
  worker: {
    queued: number;
    processing: number;
    staleProcessing: number;
    failed: number;
    deadLetter: number;
    purgeableSucceeded: number;
    purgeableDeadLetter: number;
  };
  microsoft: {
    mode: "stub" | "live";
    readyForLive: boolean;
  };
};

type WorkerHealth = {
  checkedAt: string;
  health: "unknown" | "healthy" | "warning" | "critical";
  pollIntervalMs: number;
  heartbeatIntervalMs: number;
  thresholds: {
    stalledHeartbeatMinutes: number;
    staleProcessingMinutes: number;
  };
  lastStartedAt: string | null;
  lastHeartbeatAt: string | null;
  lastCompletedBatchAt: string | null;
  lastCompletedBatch: {
    processed: number;
    succeeded: number;
    failed: number;
  } | null;
  lastFailedBatchAt: string | null;
  lastFailedBatchMessage: string | null;
  lastManualBatchRequestAt: string | null;
  lastStaleProcessingCleanupAt: string | null;
  recentEvents: Array<{
    eventType: string;
    createdAt: string;
    detail: string | null;
  }>;
  backlog: {
    queued: number;
    processing: number;
    failed: number;
    deadLetter: number;
    succeeded: number;
    oldestQueuedAt: string | null;
    oldestQueuedType: string | null;
    oldestQueuedMinutes: number | null;
    oldestProcessingAt: string | null;
    oldestProcessingType: string | null;
    oldestProcessingMinutes: number | null;
  };
};

type OpsAlert = {
  key: string;
  scope: "runtime" | "microsoft" | "worker" | "auth" | "office_ops" | "scorecards";
  severity: "info" | "warning" | "critical";
  title: string;
  detail: string;
  action: string | null;
  count: number | null;
  createdAt: string;
};

type OpsAlertSummary = {
  checkedAt: string;
  criticalCount: number;
  warningCount: number;
  infoCount: number;
  alerts: OpsAlert[];
};

type CleanupResult = {
  checkedAt: string;
  dryRun: boolean;
  targets: string[];
  revokedExpiredSessions: number;
  purgedRevokedSessions: number;
  purgedEnrollmentCodes: number;
  requeuedStaleProcessingJobs: number;
  purgedSucceededWorkerJobs: number;
  purgedDeadLetterWorkerJobs: number;
};

type WorkerRunResult = {
  triggeredAt: string;
  summary: {
    processed: number;
    succeeded: number;
    failed: number;
  };
};

type AlertDispatchResult = {
  checkedAt: string;
  cooldownMinutes: number;
  criticalAlerts: number;
  delivered: number;
  skippedCooldown: number;
  skippedUnavailable: number;
  dispatchedKeys: string[];
};

type RoleCapabilityRecord = {
  role: ActorRole | string;
  capabilities: AppCapability[];
};

type OverviewStats = {
  overdueActionItems: number;
  overdueScorecardReviews: number;
  openIssues: number;
};

type UserProfile = {
  id: string;
  displayName: string;
  role: ActorRole;
  grantedRoles: ActorRole[];
  status: "active" | "inactive";
  createdAt: string;
  updatedAt: string;
};

type DeviceRecord = {
  id: string;
  deviceLabel: string;
  status: "active" | "revoked" | "expired";
  primaryProfileId: string;
  trustExpiresAt: string;
  lastSeenAt: string | null;
  allowedProfiles: Array<{
    id: string;
    displayName: string;
    role: ActorRole;
    isPrimary: boolean;
    lockedUntil: string | null;
  }>;
  activeSessionProfileIds: string[];
};

type EnrollmentCode = {
  id: string;
  code: string;
  expiresAt: string;
  primaryProfileId: string;
  allowedProfileIds: string[];
};

type AuditEvent = {
  id: string;
  eventType: string;
  entityType: string;
  entityId: string;
  actorName: string | null;
  createdAt: string;
  payload: Record<string, unknown>;
};

type ProfileEditState = {
  displayName: string;
  role: ActorRole;
  grantedRoles: ActorRole[];
  status: "active" | "inactive";
  pin: string;
};

type DeviceEditState = {
  deviceLabel: string;
  status: "active" | "revoked" | "expired";
  primaryProfileId: string;
  allowedProfileIds: string[];
};

export default function PilotOpsPage(): JSX.Element {
  const { actor, hasCapability } = useAppAuth();
  const [whoami, setWhoami] = useState<WhoAmI | null>(null);
  const [integrationStatus, setIntegrationStatus] = useState<MicrosoftStatus | null>(null);
  const [configStatus, setConfigStatus] = useState<ConfigStatus | null>(null);
  const [maintenanceSummary, setMaintenanceSummary] = useState<MaintenanceSummary | null>(null);
  const [workerHealth, setWorkerHealth] = useState<WorkerHealth | null>(null);
  const [opsAlerts, setOpsAlerts] = useState<OpsAlertSummary | null>(null);
  const [cleanupResult, setCleanupResult] = useState<CleanupResult | null>(null);
  const [workerRunResult, setWorkerRunResult] = useState<WorkerRunResult | null>(null);
  const [alertDispatchResult, setAlertDispatchResult] = useState<AlertDispatchResult | null>(null);
  const [roleCapabilities, setRoleCapabilities] = useState<RoleCapabilityRecord[]>([]);
  const [overview, setOverview] = useState<OverviewStats | null>(null);
  const [deploymentPromotions, setDeploymentPromotions] = useState<DeploymentPromotion[]>([]);
  const [authEvents, setAuthEvents] = useState<AuditEvent[]>([]);
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [devices, setDevices] = useState<DeviceRecord[]>([]);
  const [latestEnrollmentCode, setLatestEnrollmentCode] = useState<EnrollmentCode | null>(null);
  const [profileEdits, setProfileEdits] = useState<Record<string, ProfileEditState>>({});
  const [deviceEdits, setDeviceEdits] = useState<Record<string, DeviceEditState>>({});
  const [newProfileName, setNewProfileName] = useState("");
  const [newProfileRole, setNewProfileRole] = useState<ActorRole>("office_manager");
  const [newProfilePin, setNewProfilePin] = useState("");
  const [primaryProfileId, setPrimaryProfileId] = useState("");
  const [backupProfileIdOne, setBackupProfileIdOne] = useState("");
  const [backupProfileIdTwo, setBackupProfileIdTwo] = useState("");
  const [promotionEnvironmentKey, setPromotionEnvironmentKey] = useState("render_production");
  const [promotionStatus, setPromotionStatus] = useState<DeploymentPromotion["status"]>("draft");
  const [promotionTargetAuthMode, setPromotionTargetAuthMode] = useState<DeploymentPromotion["targetAuthMode"]>("trusted_proxy");
  const [promotionRuntimeAgentsDisabled, setPromotionRuntimeAgentsDisabled] = useState(true);
  const [promotionLatestSmokeAt, setPromotionLatestSmokeAt] = useState("");
  const [promotionRollbackVerifiedAt, setPromotionRollbackVerifiedAt] = useState("");
  const [promotionNotes, setPromotionNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeProfiles = useMemo(
    () => profiles.filter((profile) => profile.status === "active"),
    [profiles]
  );

  async function load() {
    if (!actor) {
      return;
    }

    try {
      const [currentUser, microsoft, runtimeStatus, maintenance, workerRuntime, alerts, capabilityRows, overviewStats, promotionRows, profileRows, deviceRows, authAudit] = await Promise.all([
        apiRequest<WhoAmI>("/auth/whoami", actor),
        apiRequest<MicrosoftStatus>("/integrations/microsoft/status", actor),
        apiRequest<ConfigStatus>("/ops/config-status", actor),
        apiRequest<MaintenanceSummary>("/ops/maintenance-summary", actor),
        apiRequest<WorkerHealth>("/ops/worker-health", actor),
        apiRequest<OpsAlertSummary>("/ops/alerts", actor),
        apiRequest<RoleCapabilityRecord[]>("/ops/role-capabilities", actor),
        apiRequest<OverviewStats>("/dashboard/overview", actor),
        apiRequest<DeploymentPromotion[]>("/ops/deployment-promotions", actor),
        apiRequest<UserProfile[]>("/user-profiles", actor),
        apiRequest<DeviceRecord[]>("/devices", actor),
        apiRequest<AuditEvent[]>("/audit-events?eventTypePrefix=auth.", actor)
      ]);
      setWhoami(currentUser);
      setIntegrationStatus(microsoft);
      setConfigStatus(runtimeStatus);
      setMaintenanceSummary(maintenance);
      setWorkerHealth(workerRuntime);
      setOpsAlerts(alerts);
      setRoleCapabilities(capabilityRows);
      setOverview(overviewStats);
      setDeploymentPromotions(promotionRows);
      setAuthEvents(authAudit.slice(0, 12));
      setProfiles(profileRows);
      setDevices(deviceRows);
      setProfileEdits((current) => {
        const next = { ...current };
        for (const profile of profileRows) {
          next[profile.id] = current[profile.id] ?? {
            displayName: profile.displayName,
            role: profile.role,
            grantedRoles: profile.grantedRoles,
            status: profile.status,
            pin: ""
          };
        }
        return next;
      });
      setDeviceEdits((current) => {
        const next = { ...current };
        for (const device of deviceRows) {
          next[device.id] = current[device.id] ?? {
            deviceLabel: device.deviceLabel,
            status: device.status,
            primaryProfileId: device.primaryProfileId,
            allowedProfileIds: device.allowedProfiles.map((profile) => profile.id)
          };
        }
        return next;
      });
      if (!primaryProfileId && profileRows.length > 0) {
        setPrimaryProfileId(profileRows[0].id);
      }
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load pilot operations status.");
    }
  }

  useEffect(() => {
    if (!actor || !hasCapability("pilot_ops.view")) {
      return;
    }

    void load();
  }, [actor, hasCapability]);

  async function handleValidate() {
    if (!actor) {
      return;
    }

    setLoading(true);
    try {
      await apiRequest("/integrations/microsoft/validate", actor, {
        method: "POST"
      });
      await load();
    } catch (validationError) {
      setError(validationError instanceof Error ? validationError.message : "Unable to validate Microsoft integration.");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreatePromotion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!actor) {
      return;
    }

    setLoading(true);
    try {
      await apiRequest("/ops/deployment-promotions", actor, {
        method: "POST",
        body: JSON.stringify({
          environmentKey: promotionEnvironmentKey,
          status: promotionStatus,
          targetAuthMode: promotionTargetAuthMode,
          runtimeAgentsDisabled: promotionRuntimeAgentsDisabled,
          latestSmokeAt: promotionLatestSmokeAt ? new Date(`${promotionLatestSmokeAt}T12:00:00.000Z`).toISOString() : null,
          rollbackVerifiedAt: promotionRollbackVerifiedAt ? new Date(`${promotionRollbackVerifiedAt}T12:00:00.000Z`).toISOString() : null,
          notes: promotionNotes || null
        })
      });
      setPromotionNotes("");
      setPromotionLatestSmokeAt("");
      setPromotionRollbackVerifiedAt("");
      setPromotionStatus("draft");
      await load();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to create deployment promotion record.");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!actor) {
      return;
    }

    setLoading(true);
    try {
      await apiRequest("/user-profiles", actor, {
        method: "POST",
        body: JSON.stringify({
          displayName: newProfileName,
          role: newProfileRole,
          grantedRoles: [newProfileRole],
          pin: newProfilePin,
          status: "active"
        })
      });
      setNewProfileName("");
      setNewProfilePin("");
      await load();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to create user profile.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveProfile(profileId: string) {
    if (!actor) {
      return;
    }

    const edit = profileEdits[profileId];
    if (!edit) {
      return;
    }

    setLoading(true);
    try {
      await apiRequest(`/user-profiles/${profileId}`, actor, {
        method: "PATCH",
        body: JSON.stringify({
          displayName: edit.displayName,
          role: edit.role,
          grantedRoles: edit.grantedRoles,
          status: edit.status,
          pin: edit.pin || undefined
        })
      });
      setProfileEdits((current) => ({
        ...current,
        [profileId]: {
          ...current[profileId],
          pin: ""
        }
      }));
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to update user profile.");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateEnrollmentCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!actor) {
      return;
    }

    const allowedProfileIds = [primaryProfileId, backupProfileIdOne, backupProfileIdTwo].filter(Boolean);

    setLoading(true);
    try {
      const created = await apiRequest<EnrollmentCode>("/auth/enrollment-codes", actor, {
        method: "POST",
        body: JSON.stringify({
          primaryProfileId,
          allowedProfileIds
        })
      });
      setLatestEnrollmentCode(created);
      await load();
    } catch (codeError) {
      setError(codeError instanceof Error ? codeError.message : "Unable to create enrollment code.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveDevice(deviceId: string) {
    if (!actor) {
      return;
    }

    const edit = deviceEdits[deviceId];
    if (!edit) {
      return;
    }

    setLoading(true);
    try {
      await apiRequest(`/devices/${deviceId}`, actor, {
        method: "PATCH",
        body: JSON.stringify({
          deviceLabel: edit.deviceLabel,
          status: edit.status,
          primaryProfileId: edit.primaryProfileId,
          allowedProfileIds: edit.allowedProfileIds
        })
      });
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to update enrolled device.");
    } finally {
      setLoading(false);
    }
  }

  async function handleRevokeDevice(deviceId: string) {
    if (!actor) {
      return;
    }

    setLoading(true);
    try {
      await apiRequest(`/devices/${deviceId}/revoke`, actor, {
        method: "POST"
      });
      await load();
    } catch (revokeError) {
      setError(revokeError instanceof Error ? revokeError.message : "Unable to revoke device.");
    } finally {
      setLoading(false);
    }
  }

  async function handleCleanup(dryRun: boolean) {
    if (!actor) {
      return;
    }

    setLoading(true);
    try {
      const result = await apiRequest<CleanupResult>("/ops/cleanup", actor, {
        method: "POST",
        body: JSON.stringify({
          dryRun
        })
      });
      setCleanupResult(result);
      await load();
    } catch (cleanupError) {
      setError(cleanupError instanceof Error ? cleanupError.message : "Unable to run pilot cleanup.");
    } finally {
      setLoading(false);
    }
  }

  async function handleRunWorkerBatch() {
    if (!actor) {
      return;
    }

    setLoading(true);
    try {
      const result = await apiRequest<WorkerRunResult>("/worker-jobs/run-once", actor, {
        method: "POST"
      });
      setWorkerRunResult(result);
      await load();
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : "Unable to run a worker batch.");
    } finally {
      setLoading(false);
    }
  }

  async function handleDispatchCriticalAlerts() {
    if (!actor) {
      return;
    }

    setLoading(true);
    try {
      const result = await apiRequest<AlertDispatchResult>("/ops/alerts/dispatch", actor, {
        method: "POST"
      });
      setAlertDispatchResult(result);
      await load();
    } catch (dispatchError) {
      setError(dispatchError instanceof Error ? dispatchError.message : "Unable to dispatch critical alerts.");
    } finally {
      setLoading(false);
    }
  }

  function toggleDeviceProfile(deviceId: string, profileId: string): void {
    setDeviceEdits((current) => {
      const edit = current[deviceId];
      if (!edit) {
        return current;
      }
      const exists = edit.allowedProfileIds.includes(profileId);
      const allowedProfileIds = exists
        ? edit.allowedProfileIds.filter((id) => id !== profileId)
        : [...edit.allowedProfileIds, profileId].slice(0, 3);
      const primaryProfileId = allowedProfileIds.includes(edit.primaryProfileId)
        ? edit.primaryProfileId
        : allowedProfileIds[0] ?? "";
      return {
        ...current,
        [deviceId]: {
          ...edit,
          allowedProfileIds,
          primaryProfileId
        }
      };
    });
  }

  const surfaces = integrationStatus?.latestValidation?.surfaces ?? [];

  return (
    <div className="grid" style={{ gap: 16 }}>
      <div className="card">
        <h1>Pilot ops</h1>
        <p className="muted">
          Pilot-readiness control surface for auth mode, stub-versus-live operating mode, worker health, device enrollment, and profile management.
        </p>
        <div className="muted">
          Active profile: {actor ? `${actor.name} / ${actor.role}` : "No active profile"}
        </div>
        <div className="actions">
          <button
            className="button"
            onClick={() => { void handleValidate(); }}
            disabled={loading || !actor || integrationStatus?.mode === "stub"}
          >
            Validate Microsoft targets
          </button>
        </div>
      </div>

      {actor && !hasCapability("pilot_ops.view") ? (
        <div className="card error">Pilot ops is only available to admin-capable profiles.</div>
      ) : null}

      {error ? <div className="card error">{error}</div> : null}

      <div className="grid cols-3">
        <div className="card">
          <div className="muted">Pilot auth</div>
          <div style={{ fontSize: "1.5rem", fontWeight: 700 }}>{configStatus?.authMode ?? whoami?.authMode ?? authStateFallback(actor)}</div>
          <div className="muted" style={{ marginTop: 8 }}>
            Actor: {whoami?.actor.name ?? actor?.name ?? "unknown"}
          </div>
        </div>
        <div className="card">
          <div className="muted">Integration mode</div>
          <div style={{ fontSize: "1.5rem", fontWeight: 700 }}>{integrationStatus?.mode ?? "unknown"}</div>
          <div className="muted" style={{ marginTop: 8 }}>
            {integrationStatus?.mode === "stub"
              ? "Local pilot mode is active."
              : integrationStatus?.readyForLive
                ? "Ready for live validation and smoke testing."
                : "Live validation still required."}
          </div>
        </div>
        <div className="card">
          <div className="muted">Worker health</div>
          <div style={{ fontSize: "1.5rem", fontWeight: 700 }}>{workerHealth?.health ?? "unknown"}</div>
          <div className="muted" style={{ marginTop: 8 }}>
            Last heartbeat: {workerHealth?.lastHeartbeatAt ? new Date(workerHealth.lastHeartbeatAt).toLocaleString() : "Not recorded yet"}
          </div>
        </div>
      </div>

      <div className="grid cols-3">
        <div className="card">
          <div className="muted">Critical alerts</div>
          <div style={{ fontSize: "1.5rem", fontWeight: 700 }}>{opsAlerts?.criticalCount ?? 0}</div>
        </div>
        <div className="card">
          <div className="muted">Warnings</div>
          <div style={{ fontSize: "1.5rem", fontWeight: 700 }}>{opsAlerts?.warningCount ?? 0}</div>
        </div>
        <div className="card">
          <div className="muted">Info alerts</div>
          <div style={{ fontSize: "1.5rem", fontWeight: 700 }}>{opsAlerts?.infoCount ?? 0}</div>
        </div>
      </div>

      <div className="card">
        <h2>Worker runtime</h2>
        <div className="actions">
          <button
            className="button secondary"
            onClick={() => { void handleRunWorkerBatch(); }}
            disabled={loading || !actor || !hasCapability("worker_jobs.retry")}
          >
            Run one worker batch now
          </button>
          <button
            className="button secondary"
            onClick={() => { void handleDispatchCriticalAlerts(); }}
            disabled={loading || !actor || !hasCapability("ops.run_cleanup")}
          >
            Dispatch critical alerts
          </button>
        </div>
        <div className="grid cols-3">
          <div>
            <div className="muted">Backlog</div>
            <div style={{ fontSize: "1.4rem", fontWeight: 700 }}>
              {(workerHealth?.backlog.queued ?? 0) + (workerHealth?.backlog.processing ?? 0)}
            </div>
            <div className="muted">
              queued {workerHealth?.backlog.queued ?? 0}, processing {workerHealth?.backlog.processing ?? 0}
            </div>
          </div>
          <div>
            <div className="muted">Last heartbeat</div>
            <div style={{ fontSize: "1.4rem", fontWeight: 700 }}>
              {workerHealth?.lastHeartbeatAt ? new Date(workerHealth.lastHeartbeatAt).toLocaleTimeString() : "Never"}
            </div>
            <div className="muted">
              Last manual batch {workerHealth?.lastManualBatchRequestAt ? new Date(workerHealth.lastManualBatchRequestAt).toLocaleString() : "never"}.
            </div>
          </div>
          <div>
            <div className="muted">Last completed batch</div>
            <div style={{ fontSize: "1.4rem", fontWeight: 700 }}>
              {workerHealth?.lastCompletedBatchAt ? new Date(workerHealth.lastCompletedBatchAt).toLocaleTimeString() : "Never"}
            </div>
            <div className="muted">
              {workerHealth?.lastCompletedBatch
                ? `${workerHealth.lastCompletedBatch.processed} processed / ${workerHealth.lastCompletedBatch.succeeded} succeeded / ${workerHealth.lastCompletedBatch.failed} failed`
                : "No batch completion recorded yet."}
            </div>
          </div>
          <div>
            <div className="muted">Oldest queued job</div>
            <div style={{ fontSize: "1.4rem", fontWeight: 700 }}>
              {workerHealth?.backlog.oldestQueuedMinutes != null ? `${workerHealth.backlog.oldestQueuedMinutes} min` : "None"}
            </div>
            <div className="muted">
              {workerHealth?.backlog.oldestQueuedType
                ? `${workerHealth.backlog.oldestQueuedType} since ${new Date(workerHealth.backlog.oldestQueuedAt ?? "").toLocaleString()}`
                : "No queued jobs."}
            </div>
          </div>
        </div>
        <div className="table" style={{ marginTop: 12 }}>
          <div className="table-row table-head">
            <span>Signal</span>
            <span>Value</span>
            <span>Detail</span>
          </div>
          <div className="table-row">
            <span>Heartbeat cadence</span>
            <span>{Math.round((workerHealth?.heartbeatIntervalMs ?? 0) / 1000)} sec</span>
            <span>
              Poll interval {Math.round((workerHealth?.pollIntervalMs ?? 0) / 1000)} sec.
              {" "}Stalled after about {workerHealth?.thresholds.stalledHeartbeatMinutes ?? 0} min without a heartbeat.
            </span>
          </div>
          <div className="table-row">
            <span>Oldest processing lock</span>
            <span>{workerHealth?.backlog.oldestProcessingMinutes != null ? `${workerHealth.backlog.oldestProcessingMinutes} min` : "None"}</span>
            <span>
              {workerHealth?.backlog.oldestProcessingType ?? "No processing jobs."}
              {" "}Locks older than {workerHealth?.thresholds.staleProcessingMinutes ?? 0} min are treated as stale.
            </span>
          </div>
          <div className="table-row">
            <span>Recent batch failure</span>
            <span>{workerHealth?.lastFailedBatchAt ? new Date(workerHealth.lastFailedBatchAt).toLocaleString() : "None"}</span>
            <span>{workerHealth?.lastFailedBatchMessage ?? "No recent worker batch failure recorded."}</span>
          </div>
          <div className="table-row">
            <span>Last stale-lock cleanup</span>
            <span>{workerHealth?.lastStaleProcessingCleanupAt ? new Date(workerHealth.lastStaleProcessingCleanupAt).toLocaleString() : "Never"}</span>
            <span>Use cleanup when stale processing jobs remain after a bounded batch run.</span>
          </div>
        </div>
        {workerHealth?.recentEvents.length ? (
          <div className="table" style={{ marginTop: 12 }}>
            <div className="table-row table-head">
              <span>Recent runtime events</span>
              <span>When</span>
              <span>Detail</span>
            </div>
            {workerHealth.recentEvents.map((event) => (
              <div key={`${event.eventType}-${event.createdAt}`} className="table-row">
                <span>{event.eventType}</span>
                <span>{new Date(event.createdAt).toLocaleString()}</span>
                <span>{event.detail ?? "No extra detail recorded."}</span>
              </div>
            ))}
          </div>
        ) : null}
        {workerRunResult ? (
          <div className="card" style={{ marginTop: 12 }}>
            <strong>Last manual worker batch</strong>
            <div className="muted">
              Triggered {new Date(workerRunResult.triggeredAt).toLocaleString()}.
              {" "}Processed {workerRunResult.summary.processed}, succeeded {workerRunResult.summary.succeeded}, failed {workerRunResult.summary.failed}.
            </div>
          </div>
        ) : null}
        {alertDispatchResult ? (
          <div className="card" style={{ marginTop: 12 }}>
            <strong>Last critical alert dispatch</strong>
            <div className="muted">
              Checked {new Date(alertDispatchResult.checkedAt).toLocaleString()}.
              {" "}Delivered {alertDispatchResult.delivered} of {alertDispatchResult.criticalAlerts} critical alerts.
              {" "}Cooldown skips: {alertDispatchResult.skippedCooldown}. Unavailable integrations: {alertDispatchResult.skippedUnavailable}.
            </div>
          </div>
        ) : null}
      </div>

      <div className="card">
        <h2>Operator alerts</h2>
        {opsAlerts?.alerts.length ? (
          <div className="table">
            <div className="table-row table-head">
              <span>Severity</span>
              <span>Scope</span>
              <span>Title</span>
              <span>Detail</span>
              <span>Action</span>
            </div>
            {opsAlerts.alerts.map((alert) => (
              <div key={alert.key} className="table-row">
                <span><span className={`badge badge-${alert.severity}`}>{alert.severity}</span></span>
                <span>{alert.scope.replaceAll("_", " ")}</span>
                <span>{alert.title}{typeof alert.count === "number" ? ` (${alert.count})` : ""}</span>
                <span>{alert.detail}</span>
                <span>{alert.action ?? "No action recommended."}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="muted">No active operator alerts are currently reported.</div>
        )}
      </div>

      <div className="grid cols-3">
        <div className="card">
          <div className="muted">Open issues</div>
          <div style={{ fontSize: "1.5rem", fontWeight: 700 }}>{overview?.openIssues ?? 0}</div>
        </div>
        <div className="card">
          <div className="muted">Overdue action items</div>
          <div style={{ fontSize: "1.5rem", fontWeight: 700 }}>{overview?.overdueActionItems ?? 0}</div>
        </div>
        <div className="card">
          <div className="muted">Overdue scorecard reviews</div>
          <div style={{ fontSize: "1.5rem", fontWeight: 700 }}>{overview?.overdueScorecardReviews ?? 0}</div>
        </div>
      </div>

      <div className="card">
        <h2>Deployment readiness</h2>
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
          <div className="muted" style={{ marginTop: 12 }}>
            No pilot-blocking runtime issues are currently reported.
          </div>
        )}
        <div className="muted" style={{ marginTop: 12 }}>
          Public origin: {configStatus?.publicAppOrigin ?? "not set"}
        </div>
        <div className="table" style={{ marginTop: 12 }}>
          <div className="table-row table-head">
            <span>Hardening signal</span>
            <span>Value</span>
            <span>Detail</span>
          </div>
          <div className="table-row">
            <span>Runtime-agent freeze</span>
            <span>{configStatus?.hardening.runtimeAgentsExplicitlyDisabled ? "explicit" : "not explicit"}</span>
            <span>Config value: {configStatus?.hardening.runtimeAgentsConfigValue ?? "unset"}</span>
          </div>
          <div className="table-row">
            <span>Trusted proxy readiness</span>
            <span>{configStatus?.hardening.trustedProxyReady ? "ready" : "not ready"}</span>
            <span>
              Current auth {configStatus?.hardening.currentAuthMode ?? "unknown"}.
              {" "}Recommended target {configStatus?.hardening.recommendedTargetAuthMode ?? "trusted_proxy"}.
            </span>
          </div>
          <div className="table-row">
            <span>Latest smoke / rollback proof</span>
            <span>{configStatus?.hardening.latestSmokeAt ? new Date(configStatus.hardening.latestSmokeAt).toLocaleDateString() : "missing"}</span>
            <span>
              Rollback verified {configStatus?.hardening.latestRollbackVerificationAt ? new Date(configStatus.hardening.latestRollbackVerificationAt).toLocaleDateString() : "not yet"}.
              {" "}Alert dispatch {configStatus?.hardening.latestAlertDispatchAt ? new Date(configStatus.hardening.latestAlertDispatchAt).toLocaleString() : "none recorded"}.
            </span>
          </div>
        </div>
      </div>

      <div className="card">
        <h2>Deployment promotion checklist</h2>
        <div className="muted" style={{ marginBottom: 12 }}>
          Track post-pilot hardening steps without leaving Clinic OS: auth-mode target, smoke evidence, rollback verification, and explicit agent freeze.
        </div>
        <form className="grid two-column" onSubmit={(event) => { void handleCreatePromotion(event); }}>
          <input value={promotionEnvironmentKey} onChange={(event) => setPromotionEnvironmentKey(event.target.value)} placeholder="Environment key" />
          <select value={promotionStatus} onChange={(event) => setPromotionStatus(event.target.value as DeploymentPromotion["status"])}>
            <option value="draft">Draft</option>
            <option value="in_review">In review</option>
            <option value="ready">Ready</option>
            <option value="completed">Completed</option>
          </select>
          <select value={promotionTargetAuthMode} onChange={(event) => setPromotionTargetAuthMode(event.target.value as DeploymentPromotion["targetAuthMode"])}>
            <option value="device_profiles">device_profiles</option>
            <option value="trusted_proxy">trusted_proxy</option>
            <option value="dev_headers">dev_headers</option>
          </select>
          <label className="muted">
            <input type="checkbox" checked={promotionRuntimeAgentsDisabled} onChange={(event) => setPromotionRuntimeAgentsDisabled(event.target.checked)} />
            {" "}Runtime agents explicitly disabled
          </label>
          <input type="date" value={promotionLatestSmokeAt} onChange={(event) => setPromotionLatestSmokeAt(event.target.value)} />
          <input type="date" value={promotionRollbackVerifiedAt} onChange={(event) => setPromotionRollbackVerifiedAt(event.target.value)} />
          <textarea value={promotionNotes} onChange={(event) => setPromotionNotes(event.target.value)} rows={3} placeholder="Notes for smoke, rollback, or auth hardening status" style={{ gridColumn: "1 / -1" }} />
          <button className="button" type="submit" disabled={loading || !actor || !hasCapability("ops.run_cleanup")}>
            Save promotion record
          </button>
        </form>
        <div className="table" style={{ marginTop: 12 }}>
          <div className="table-row table-head">
            <span>Environment</span>
            <span>Status</span>
            <span>Target auth</span>
            <span>Proof</span>
          </div>
          {deploymentPromotions.map((record) => (
            <div key={record.id} className="table-row">
              <span>{record.environmentKey}</span>
              <span><span className={`badge badge-${record.status}`}>{record.status}</span></span>
              <span>
                {record.targetAuthMode}
                {" "}/ agents {record.runtimeAgentsDisabled ? "off" : "not frozen"}
              </span>
              <span>
                smoke {record.latestSmokeAt ? toLocaleDate(record.latestSmokeAt) : "missing"}
                {" "}· rollback {record.rollbackVerifiedAt ? toLocaleDate(record.rollbackVerifiedAt) : "missing"}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <h2>Microsoft readiness</h2>
        <div className="actions">
          <span className={`badge badge-${integrationStatus?.latestValidation?.overallStatus ?? "missing_config"}`}>
            {integrationStatus?.latestValidation?.overallStatus ?? "not validated"}
          </span>
          <span className={`badge badge-${integrationStatus?.configComplete ? "ready" : "missing_config"}`}>
            {integrationStatus?.configComplete ? "config complete" : "config incomplete"}
          </span>
        </div>
        {integrationStatus?.missingConfigKeys.length ? (
          <div className="muted" style={{ marginTop: 12 }}>
            Missing config: {integrationStatus.missingConfigKeys.join(", ")}
          </div>
        ) : null}
        {integrationStatus?.latestValidation ? (
          <div className="muted" style={{ marginTop: 12 }}>
            Last checked by {integrationStatus.latestValidation.checkedById} at{" "}
            {new Date(integrationStatus.latestValidation.checkedAt).toLocaleString()}
          </div>
        ) : (
          <div className="muted" style={{ marginTop: 12 }}>
            {integrationStatus?.mode === "stub"
              ? "Stub mode does not require Microsoft validation for the first pilot."
              : "No persisted Microsoft validation has been run yet. Live mode uses Graph for SharePoint, Lists, and Planner plus Teams webhook delivery."}
          </div>
        )}
      </div>

      <div className="card">
        <h2>Surface validation</h2>
        <div className="table">
          <div className="table-row table-head">
            <span>Surface</span>
            <span>Status</span>
            <span>Validation</span>
            <span>Configured</span>
            <span>Detail</span>
          </div>
          {surfaces.map((surface) => (
            <div key={surface.key} className="table-row">
              <span>{surface.label}</span>
              <span><span className={`badge badge-${surface.status}`}>{surface.status}</span></span>
              <span>{surface.verificationMode === "config_only" ? "config-only" : "live probe"}</span>
              <span>{surface.configured ? "yes" : "no"}</span>
              <span>{surface.detail ?? "Reachable"}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <h2>Recent auth activity</h2>
        <ul>
          {authEvents.map((event) => (
            <li key={event.id}>
              <strong>{event.eventType}</strong> on {event.entityType} {event.entityId}
              <div className="muted">
                {event.actorName ?? "Unknown actor"} at {new Date(event.createdAt).toLocaleString()}
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="grid cols-2">
        <div className="card">
          <h2>Operational maintenance</h2>
          <div className="actions">
            <button
              className="button secondary"
              onClick={() => { void handleCleanup(true); }}
              disabled={loading || !actor || !hasCapability("ops.run_cleanup")}
            >
              Preview cleanup
            </button>
            <button
              className="button"
              onClick={() => { void handleCleanup(false); }}
              disabled={loading || !actor || !hasCapability("ops.run_cleanup")}
            >
              Run default cleanup
            </button>
          </div>
          <div className="table" style={{ marginTop: 12 }}>
            <div className="table-row table-head">
              <span>Area</span>
              <span>Current</span>
              <span>Cleanup-ready</span>
            </div>
            <div className="table-row">
              <span>Enrollment codes</span>
              <span>{maintenanceSummary?.auth.activeEnrollmentCodes ?? 0} active</span>
              <span>{maintenanceSummary?.auth.purgeableEnrollmentCodes ?? 0}</span>
            </div>
            <div className="table-row">
              <span>Device sessions</span>
              <span>{maintenanceSummary?.auth.activeSessions ?? 0} active</span>
              <span>
                {(maintenanceSummary?.auth.expiredActiveSessions ?? 0) + (maintenanceSummary?.auth.purgeableRevokedSessions ?? 0)}
              </span>
            </div>
            <div className="table-row">
              <span>Worker jobs</span>
              <span>{maintenanceSummary?.worker.processing ?? 0} processing</span>
              <span>{maintenanceSummary?.worker.staleProcessing ?? 0} stale</span>
            </div>
          </div>
          <div className="muted" style={{ marginTop: 12 }}>
            Retention: auth artifacts {maintenanceSummary?.thresholds.authArtifactRetentionDays ?? 0} days, worker jobs {maintenanceSummary?.thresholds.workerJobRetentionDays ?? 0} days, stale processing {maintenanceSummary?.thresholds.staleProcessingMinutes ?? 0} minutes.
          </div>
          {cleanupResult ? (
            <div className="card" style={{ marginTop: 12 }}>
              <strong>{cleanupResult.dryRun ? "Cleanup preview" : "Cleanup result"}</strong>
              <div className="muted">
                {cleanupResult.requeuedStaleProcessingJobs} stale worker jobs requeued, {cleanupResult.revokedExpiredSessions} expired sessions revoked, {cleanupResult.purgedEnrollmentCodes} enrollment codes purged.
              </div>
            </div>
          ) : null}
        </div>

        <div className="card">
          <h2>Role capabilities</h2>
          <div className="table">
            <div className="table-row table-head">
              <span>Role</span>
              <span>Capabilities</span>
            </div>
            {roleCapabilities.map((entry) => (
              <div key={entry.role} className="table-row">
                <span>{entry.role}</span>
                <span>{entry.capabilities.join(", ") || "none"}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid cols-2">
        <div className="card">
          <h2>Create profile</h2>
          <form className="stack" onSubmit={(event) => { void handleCreateProfile(event); }}>
            <input
              value={newProfileName}
              onChange={(event) => setNewProfileName(event.target.value)}
              placeholder="Display name"
              required
            />
            <select value={newProfileRole} onChange={(event) => setNewProfileRole(event.target.value as ActorRole)}>
              {allActorRoles.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
            <input
              value={newProfilePin}
              onChange={(event) => setNewProfilePin(event.target.value.replace(/\D/g, "").slice(0, 6))}
              inputMode="numeric"
              pattern="\d{6}"
              placeholder="6-digit PIN"
              required
            />
            <button className="button" type="submit" disabled={loading || !actor}>
              Create profile
            </button>
          </form>
        </div>

        <div className="card">
          <h2>Mint device enrollment code</h2>
          <form className="stack" onSubmit={(event) => { void handleCreateEnrollmentCode(event); }}>
            <select value={primaryProfileId} onChange={(event) => setPrimaryProfileId(event.target.value)} required>
              <option value="">Primary profile</option>
              {activeProfiles.map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {profile.displayName} / {profile.role}
                </option>
              ))}
            </select>
            <select value={backupProfileIdOne} onChange={(event) => setBackupProfileIdOne(event.target.value)}>
              <option value="">Backup profile 1</option>
              {activeProfiles.filter((profile) => profile.id !== primaryProfileId).map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {profile.displayName} / {profile.role}
                </option>
              ))}
            </select>
            <select value={backupProfileIdTwo} onChange={(event) => setBackupProfileIdTwo(event.target.value)}>
              <option value="">Backup profile 2</option>
              {activeProfiles.filter((profile) => ![primaryProfileId, backupProfileIdOne].includes(profile.id)).map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {profile.displayName} / {profile.role}
                </option>
              ))}
            </select>
            <button className="button" type="submit" disabled={loading || !actor || !primaryProfileId}>
              Create enrollment code
            </button>
          </form>
          {latestEnrollmentCode ? (
            <div className="card" style={{ marginTop: 12 }}>
              <strong>Latest code:</strong> {latestEnrollmentCode.code}
              <div className="muted">
                Expires at {new Date(latestEnrollmentCode.expiresAt).toLocaleString()}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <div className="card">
        <h2>User profiles</h2>
        <div className="table">
          <div className="table-row table-head">
            <span>Name</span>
            <span>Default role</span>
            <span>Granted roles</span>
            <span>Status</span>
            <span>PIN</span>
            <span>Action</span>
          </div>
          {profiles.map((profile) => (
            <div key={profile.id} className="table-row">
              <span>
                <input
                  value={profileEdits[profile.id]?.displayName ?? profile.displayName}
                  onChange={(event) => setProfileEdits((current) => ({
                    ...current,
                    [profile.id]: {
                      ...(current[profile.id] ?? {
                        displayName: profile.displayName,
                        role: profile.role,
                        grantedRoles: profile.grantedRoles,
                        status: profile.status,
                        pin: ""
                      }),
                      displayName: event.target.value
                    }
                  }))}
                />
              </span>
              <span>
                <select
                  value={profileEdits[profile.id]?.role ?? profile.role}
                  onChange={(event) => setProfileEdits((current) => {
                    const nextRole = event.target.value as ActorRole;
                    const previous = current[profile.id] ?? {
                      displayName: profile.displayName,
                      role: profile.role,
                      grantedRoles: profile.grantedRoles,
                      status: profile.status,
                      pin: ""
                    };
                    return {
                      ...current,
                      [profile.id]: {
                        ...previous,
                        role: nextRole,
                        grantedRoles: Array.from(new Set([nextRole, ...previous.grantedRoles]))
                      }
                    };
                  })}
                >
                  {allActorRoles.map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </select>
              </span>
              <span className="stack">
                <span className="muted">Granted roles</span>
                <div className="grid" style={{ gap: 6 }}>
                  {allActorRoles.map((role) => {
                    const edit = profileEdits[profile.id] ?? {
                      displayName: profile.displayName,
                      role: profile.role,
                      grantedRoles: profile.grantedRoles,
                      status: profile.status,
                      pin: ""
                    };
                    const checked = edit.grantedRoles.includes(role);
                    return (
                      <label key={role} className="muted" style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(event) => setProfileEdits((current) => {
                            const previous = current[profile.id] ?? edit;
                            const nextGrantedRoles = event.target.checked
                              ? Array.from(new Set([...previous.grantedRoles, role, previous.role]))
                              : previous.grantedRoles.filter((candidate) => candidate !== role || candidate === previous.role);
                            return {
                              ...current,
                              [profile.id]: {
                                ...previous,
                                grantedRoles: nextGrantedRoles.includes(previous.role)
                                  ? nextGrantedRoles
                                  : [previous.role, ...nextGrantedRoles]
                              }
                            };
                          })}
                        />
                        {role}
                      </label>
                    );
                  })}
                </div>
              </span>
              <span>
                <select
                  value={profileEdits[profile.id]?.status ?? profile.status}
                  onChange={(event) => setProfileEdits((current) => ({
                    ...current,
                    [profile.id]: {
                      ...(current[profile.id] ?? {
                        displayName: profile.displayName,
                        role: profile.role,
                        grantedRoles: profile.grantedRoles,
                        status: profile.status,
                        pin: ""
                      }),
                      status: event.target.value as "active" | "inactive"
                    }
                  }))}
                >
                  <option value="active">active</option>
                  <option value="inactive">inactive</option>
                </select>
              </span>
              <span>
                <input
                  value={profileEdits[profile.id]?.pin ?? ""}
                  onChange={(event) => setProfileEdits((current) => ({
                    ...current,
                    [profile.id]: {
                      ...(current[profile.id] ?? {
                        displayName: profile.displayName,
                        role: profile.role,
                        grantedRoles: profile.grantedRoles,
                        status: profile.status,
                        pin: ""
                      }),
                      pin: event.target.value.replace(/\D/g, "").slice(0, 6)
                    }
                  }))}
                  placeholder="Optional new PIN"
                />
              </span>
              <span>
                <button className="button secondary" onClick={() => { void handleSaveProfile(profile.id); }} disabled={loading || !actor}>
                  Save
                </button>
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <h2>Trusted devices</h2>
        <div className="table">
          <div className="table-row table-head">
            <span>Device</span>
            <span>Status</span>
            <span>Primary</span>
            <span>Allowed profiles</span>
            <span>Actions</span>
          </div>
          {devices.map((device) => (
            <div key={device.id} className="table-row">
              <span className="stack">
                <input
                  value={deviceEdits[device.id]?.deviceLabel ?? device.deviceLabel}
                  onChange={(event) => setDeviceEdits((current) => ({
                    ...current,
                    [device.id]: {
                      ...(current[device.id] ?? {
                        deviceLabel: device.deviceLabel,
                        status: device.status,
                        primaryProfileId: device.primaryProfileId,
                        allowedProfileIds: device.allowedProfiles.map((profile) => profile.id)
                      }),
                      deviceLabel: event.target.value
                    }
                  }))}
                />
                <span className="muted">
                  Trust expires {new Date(device.trustExpiresAt).toLocaleString()}
                  {device.lastSeenAt ? ` · last seen ${new Date(device.lastSeenAt).toLocaleString()}` : ""}
                </span>
              </span>
              <span>
                <select
                  value={deviceEdits[device.id]?.status ?? device.status}
                  onChange={(event) => setDeviceEdits((current) => ({
                    ...current,
                    [device.id]: {
                      ...(current[device.id] ?? {
                        deviceLabel: device.deviceLabel,
                        status: device.status,
                        primaryProfileId: device.primaryProfileId,
                        allowedProfileIds: device.allowedProfiles.map((profile) => profile.id)
                      }),
                      status: event.target.value as DeviceRecord["status"]
                    }
                  }))}
                >
                  <option value="active">active</option>
                  <option value="revoked">revoked</option>
                  <option value="expired">expired</option>
                </select>
              </span>
              <span>
                <select
                  value={deviceEdits[device.id]?.primaryProfileId ?? device.primaryProfileId}
                  onChange={(event) => setDeviceEdits((current) => ({
                    ...current,
                    [device.id]: {
                      ...(current[device.id] ?? {
                        deviceLabel: device.deviceLabel,
                        status: device.status,
                        primaryProfileId: device.primaryProfileId,
                        allowedProfileIds: device.allowedProfiles.map((profile) => profile.id)
                      }),
                      primaryProfileId: event.target.value
                    }
                  }))}
                >
                  {(deviceEdits[device.id]?.allowedProfileIds ?? device.allowedProfiles.map((profile) => profile.id)).map((profileId) => {
                    const profile = profiles.find((candidate) => candidate.id === profileId);
                    if (!profile) {
                      return null;
                    }
                    return (
                      <option key={profile.id} value={profile.id}>
                        {profile.displayName}
                      </option>
                    );
                  })}
                </select>
              </span>
              <span className="stack">
                {activeProfiles.map((profile) => {
                  const selected = (deviceEdits[device.id]?.allowedProfileIds ?? device.allowedProfiles.map((item) => item.id)).includes(profile.id);
                  return (
                    <label key={profile.id} className="muted">
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => toggleDeviceProfile(device.id, profile.id)}
                      />{" "}
                      {profile.displayName}
                    </label>
                  );
                })}
              </span>
              <span className="actions">
                <button className="button secondary" onClick={() => { void handleSaveDevice(device.id); }} disabled={loading || !actor}>
                  Save
                </button>
                <button className="button secondary" onClick={() => { void handleRevokeDevice(device.id); }} disabled={loading || !actor}>
                  Revoke
                </button>
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function authStateFallback(actor: { role: string } | null): string {
  return actor ? "session" : "unknown";
}

function toLocaleDate(value: string): string {
  return new Date(value).toLocaleDateString();
}
