"use client";

import { useEffect, useState, type FormEvent } from "react";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { devProfiles, useAppAuth } from "../../components/auth-provider";
import type { ActorRole } from "../../lib/api";

export default function LoginPage(): JSX.Element {
  const router = useRouter();
  const {
    actor,
    authState,
    error,
    loading,
    enrollDevice,
    login,
    selectDevProfile,
    switchProfile
  } = useAppAuth();
  const [deviceLabel, setDeviceLabel] = useState("");
  const [enrollmentCode, setEnrollmentCode] = useState("");
  const [selectedProfileId, setSelectedProfileId] = useState("");
  const [selectedRole, setSelectedRole] = useState("");
  const [pin, setPin] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const selectedProfile = authState?.allowedProfiles.find((profile) => profile.id === selectedProfileId) ?? null;
  const deviceIssueMessage =
    authState?.deviceIssue === "revoked"
      ? "This browser was previously enrolled, but access has been revoked. Ask a pilot admin to mint a fresh enrollment code."
      : authState?.deviceIssue === "expired"
        ? "This browser trust expired. Re-enroll this device with a fresh enrollment code."
        : "Enter the enrollment code assigned by a pilot admin for this approved computer.";

  const isSwitchMode = authState?.authMode === "device_profiles" && Boolean(actor) && !authState.needsLogin;

  useEffect(() => {
    if (!authState?.allowedProfiles.length) {
      return;
    }
    setSelectedProfileId((current) => current || authState.allowedProfiles[0].id);
  }, [authState?.allowedProfiles]);

  useEffect(() => {
    if (!selectedProfile) {
      return;
    }
    setSelectedRole((current) =>
      current && selectedProfile.availableRoles.includes(current as typeof selectedProfile.availableRoles[number])
        ? current
        : selectedProfile.role
    );
  }, [selectedProfile]);

  useEffect(() => {
    if (actor && authState?.authMode === "dev_headers") {
      router.replace("/" as Route);
    }
  }, [actor, authState?.authMode, router]);

  async function handleEnrollment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    try {
      await enrollDevice({
        enrollmentCode,
        deviceLabel
      });
      setLocalError(null);
    } catch (submitError) {
      setLocalError(submitError instanceof Error ? submitError.message : "Unable to enroll this device.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    try {
      const handler = actor && isSwitchMode ? switchProfile : login;
      await handler({
        profileId: selectedProfileId,
        role: (selectedRole || selectedProfile?.role) as ActorRole | undefined,
        pin
      });
      setPin("");
      setLocalError(null);
      router.replace("/" as Route);
    } catch (submitError) {
      setLocalError(submitError instanceof Error ? submitError.message : "Unable to sign in.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading || !authState) {
    return (
      <div className="grid" style={{ gap: 16, padding: 24 }}>
        <div className="card">Loading sign-in...</div>
      </div>
    );
  }

  if (authState.authMode === "dev_headers") {
    return (
      <div className="grid" style={{ gap: 16, padding: 24, maxWidth: 560 }}>
        <div className="card">
          <h1>Development profile</h1>
          <p className="muted">
            Local development still uses header-based profiles. Pick the profile you want the web app to simulate.
          </p>
          <div className="stack">
            <label className="stack">
              <span className="muted">Profile</span>
              <select
                value={actor?.role ?? devProfiles[0].role}
                onChange={(event) => {
                  selectDevProfile(event.target.value as typeof devProfiles[number]["role"]);
                  router.replace("/" as Route);
                }}
              >
                {devProfiles.map((profile) => (
                  <option key={profile.role} value={profile.role}>
                    {profile.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
      </div>
    );
  }

  if (authState.authMode === "trusted_proxy") {
    return (
      <div className="grid" style={{ gap: 16, padding: 24, maxWidth: 640 }}>
        <div className="card">
          <h1>Access Clinic OS through the trusted pilot entry point</h1>
          <p className="muted">
            Trusted-proxy mode does not use local PIN sign-in. Open Clinic OS through the deployed pilot URL so the upstream identity layer can authenticate you.
          </p>
          {actor ? (
            <div className="muted">
              Current actor: {actor.name} / {actor.role}
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="grid" style={{ gap: 16, padding: 24, maxWidth: 640 }}>
      <div className="card">
        <h1>{isSwitchMode ? "Switch profile" : "Clinic OS sign-in"}</h1>
        <p className="muted">
          This pilot trusts an enrolled browser on an approved computer, then lets approved profiles sign in with a six-digit PIN.
        </p>
      </div>

      {error || localError ? <div className="card error">{localError ?? error}</div> : null}

      {authState.needsEnrollment ? (
        <div className="card">
          <h2>Enroll this device</h2>
          <p className="muted" style={{ marginBottom: 12 }}>
            {deviceIssueMessage}
          </p>
          <form className="stack" onSubmit={(event) => { void handleEnrollment(event); }}>
            <input
              value={deviceLabel}
              onChange={(event) => setDeviceLabel(event.target.value)}
              placeholder="Device label"
              required
            />
            <input
              value={enrollmentCode}
              onChange={(event) => setEnrollmentCode(event.target.value.toUpperCase())}
              placeholder="Enrollment code"
              required
            />
            <button className="button" type="submit" disabled={submitting}>
              Enroll device
            </button>
          </form>
        </div>
      ) : (
        <div className="card">
        <h2>{isSwitchMode ? "Choose another role or profile" : "Choose a profile"}</h2>
          <div className="muted" style={{ marginBottom: 12 }}>
            Trusted device: {authState.device?.deviceLabel ?? "unknown"}
          </div>
          {selectedProfile?.lockedUntil ? (
            <div className="muted" style={{ marginBottom: 12 }}>
              This profile is locked on this device until {new Date(selectedProfile.lockedUntil).toLocaleString()}.
            </div>
          ) : null}
          <form className="stack" onSubmit={(event) => { void handleLogin(event); }}>
            <label className="stack">
              <span className="muted">Allowed profiles</span>
              <select
                value={selectedProfileId}
                onChange={(event) => {
                  setSelectedProfileId(event.target.value);
                  setSelectedRole("");
                }}
                required
              >
                {authState.allowedProfiles.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.displayName} / {profile.role}{profile.isPrimary ? " (primary)" : ""}
                  </option>
                ))}
              </select>
            </label>
            {selectedProfile ? (
              <label className="stack">
                <span className="muted">Active role</span>
                <select
                  value={selectedRole}
                  onChange={(event) => setSelectedRole(event.target.value)}
                  required
                >
                  {selectedProfile.availableRoles.map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <label className="stack">
              <span className="muted">PIN</span>
              <input
                value={pin}
                onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 6))}
                inputMode="numeric"
                pattern="\d{6}"
                placeholder="6-digit PIN"
                required
              />
            </label>
            <button className="button" type="submit" disabled={submitting || Boolean(selectedProfile?.lockedUntil)}>
              {selectedProfile?.lockedUntil ? "Profile locked" : isSwitchMode ? "Switch profile" : "Sign in"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
