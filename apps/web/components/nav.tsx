"use client";

import Link from "next/link";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { navigationLinks, useAppAuth, devProfiles } from "./auth-provider";

export function Nav(): JSX.Element {
  const router = useRouter();
  const { actor, authState, capabilities, selectDevProfile, lock, logout } = useAppAuth();

  const visibleLinks = navigationLinks.filter((link) =>
    actor
    && link.allowedRoles.includes(actor.role)
    && (!link.requiredCapability || capabilities.includes(link.requiredCapability))
  );

  return (
    <nav className="nav">
      <strong>Clinic OS</strong>
      {visibleLinks.map((link) => (
        <Link key={link.href} href={link.href as Route}>
          {link.label}
        </Link>
      ))}
      <span style={{ marginLeft: "auto" }} />
      {authState?.authMode === "dev_headers" ? (
        <label className="stack" style={{ minWidth: 220 }}>
          <span className="muted">Development profile</span>
          <select
            value={actor?.role ?? devProfiles[0].role}
            onChange={(event) => selectDevProfile(event.target.value as typeof devProfiles[number]["role"])}
          >
            {devProfiles.map((profile) => (
              <option key={profile.role} value={profile.role}>
                {profile.name}
              </option>
            ))}
          </select>
        </label>
      ) : actor ? (
        <div className="actions">
          <span className="muted">
            {actor.name} / {actor.role}
          </span>
          <button
            className="button secondary"
            onClick={() => {
              router.push("/login" as Route);
            }}
          >
            Switch role/profile
          </button>
          <button
            className="button secondary"
            onClick={async () => {
              await lock();
              router.push("/login" as Route);
            }}
          >
            Lock
          </button>
          <button
            className="button secondary"
            onClick={async () => {
              await logout();
              router.push("/login" as Route);
            }}
          >
            Logout
          </button>
        </div>
      ) : (
        <span className="muted">No active profile</span>
      )}
    </nav>
  );
}
