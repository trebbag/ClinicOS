"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from "react";
import type { Route } from "next";
import { usePathname, useRouter } from "next/navigation";
import { apiRequest, type ActorIdentity, type ActorRole, type BrowserAuthMode } from "../lib/api";
import { Nav } from "./nav";

export type AuthProfileSummary = {
  id: string;
  displayName: string;
  role: ActorRole;
  isPrimary: boolean;
  lockedUntil: string | null;
};

type AuthStateResponse = {
  authMode: BrowserAuthMode;
  device: {
    id: string;
    deviceLabel: string;
    status: string;
    trustExpiresAt: string;
    lastSeenAt: string | null;
  } | null;
  currentProfile: AuthProfileSummary | null;
  allowedProfiles: AuthProfileSummary[];
  needsEnrollment: boolean;
  needsLogin: boolean;
  sessionExpiresAt: string | null;
  deviceIssue: "not_enrolled" | "revoked" | "expired" | null;
  actor: {
    actorId: string;
    role: ActorRole;
    name?: string;
  } | null;
};

export const adminRoles: ActorRole[] = [
  "medical_director",
  "quality_lead",
  "office_manager",
  "hr_lead",
  "cfo"
];

export const devProfiles: ActorIdentity[] = [
  {
    actorId: "medical-director-dev",
    role: "medical_director",
    name: "Medical Director"
  },
  {
    actorId: "quality-lead-dev",
    role: "quality_lead",
    name: "Quality Lead"
  },
  {
    actorId: "office-manager-dev",
    role: "office_manager",
    name: "Office Manager"
  },
  {
    actorId: "hr-lead-dev",
    role: "hr_lead",
    name: "HR Lead"
  },
  {
    actorId: "cfo-dev",
    role: "cfo",
    name: "Finance Reviewer"
  }
];

export const navigationLinks = [
  {
    href: "/" as const,
    label: "Overview",
    allowedRoles: ["medical_director", "quality_lead", "office_manager", "hr_lead", "cfo"] as ActorRole[]
  },
  {
    href: "/medical-director" as const,
    label: "Approvals",
    allowedRoles: ["medical_director", "cfo"] as ActorRole[]
  },
  {
    href: "/office-manager" as const,
    label: "Office Manager",
    allowedRoles: ["office_manager"] as ActorRole[]
  },
  {
    href: "/pilot-ops" as const,
    label: "Pilot Ops",
    allowedRoles: adminRoles
  },
  {
    href: "/quality" as const,
    label: "Quality",
    allowedRoles: ["quality_lead"] as ActorRole[]
  },
  {
    href: "/scorecards" as const,
    label: "Scorecards",
    allowedRoles: ["office_manager", "hr_lead", "medical_director"] as ActorRole[]
  }
] as const;

const devProfileStorageKey = "clinic-os.dev-profile";

function getStoredDevProfile(): ActorIdentity {
  if (typeof window === "undefined") {
    return devProfiles[0];
  }

  const stored = window.localStorage.getItem(devProfileStorageKey);
  const match = devProfiles.find((profile) => profile.role === stored);
  return match ?? devProfiles[0];
}

export function canAccessRoute(role: ActorRole | null, href: string): boolean {
  if (!role) {
    return false;
  }
  const link = navigationLinks.find((candidate) => candidate.href === href);
  if (!link) {
    return true;
  }
  return link.allowedRoles.includes(role);
}

type AppAuthContextValue = {
  authState: AuthStateResponse | null;
  actor: ActorIdentity | null;
  loading: boolean;
  error: string | null;
  refreshAuth: () => Promise<void>;
  selectDevProfile: (role: ActorRole) => void;
  enrollDevice: (input: { enrollmentCode: string; deviceLabel: string }) => Promise<void>;
  login: (input: { profileId: string; pin: string }) => Promise<void>;
  switchProfile: (input: { profileId: string; pin: string }) => Promise<void>;
  lock: () => Promise<void>;
  logout: () => Promise<void>;
};

const AppAuthContext = createContext<AppAuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }): JSX.Element {
  const [authState, setAuthState] = useState<AuthStateResponse | null>(null);
  const [actor, setActor] = useState<ActorIdentity | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshAuth = useCallback(async () => {
    setLoading(true);
    try {
      const nextState = await apiRequest<AuthStateResponse>("/auth/state");
      setAuthState(nextState);
      if (nextState.authMode === "dev_headers") {
        setActor(getStoredDevProfile());
      } else if (nextState.actor) {
        setActor({
          actorId: nextState.actor.actorId,
          role: nextState.actor.role,
          name: nextState.actor.name ?? nextState.actor.actorId
        });
      } else {
        setActor(null);
      }
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load authentication state.");
      setAuthState(null);
      setActor(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshAuth();
  }, [refreshAuth]);

  const selectDevProfile = useCallback((role: ActorRole) => {
    const profile = devProfiles.find((candidate) => candidate.role === role) ?? devProfiles[0];
    if (typeof window !== "undefined") {
      window.localStorage.setItem(devProfileStorageKey, profile.role);
    }
    setActor(profile);
  }, []);

  const runAuthMutation = useCallback(async (path: string, body?: unknown) => {
    await apiRequest(path, undefined, {
      method: "POST",
      body: body ? JSON.stringify(body) : undefined
    });
    await refreshAuth();
  }, [refreshAuth]);

  const value = useMemo<AppAuthContextValue>(() => ({
    authState,
    actor,
    loading,
    error,
    refreshAuth,
    selectDevProfile,
    enrollDevice: async (input) => {
      await runAuthMutation("/auth/enroll-device", input);
    },
    login: async (input) => {
      await runAuthMutation("/auth/login", input);
    },
    switchProfile: async (input) => {
      await runAuthMutation("/auth/switch-profile", input);
    },
    lock: async () => {
      await runAuthMutation("/auth/lock");
    },
    logout: async () => {
      await runAuthMutation("/auth/logout");
    }
  }), [actor, authState, error, loading, refreshAuth, runAuthMutation, selectDevProfile]);

  return <AppAuthContext.Provider value={value}>{children}</AppAuthContext.Provider>;
}

export function useAppAuth(): AppAuthContextValue {
  const value = useContext(AppAuthContext);
  if (!value) {
    throw new Error("useAppAuth must be used within AuthProvider.");
  }
  return value;
}

export function AuthShell({ children }: { children: ReactNode }): JSX.Element {
  const { authState, actor, loading } = useAppAuth();
  const pathname = usePathname();
  const router = useRouter();

  const isLoginRoute = pathname === "/login";

  useEffect(() => {
    if (loading || !authState) {
      return;
    }

    if (authState.authMode === "device_profiles") {
      if (!isLoginRoute && (authState.needsEnrollment || authState.needsLogin || !actor)) {
        router.replace("/login" as Route);
        return;
      }
    }
  }, [actor, authState, isLoginRoute, loading, router]);

  if (loading || !authState) {
    return (
      <main className="card" style={{ margin: 24 }}>
        Loading Clinic OS...
      </main>
    );
  }

  if (authState.authMode === "device_profiles" && !isLoginRoute && (authState.needsEnrollment || authState.needsLogin || !actor)) {
    return (
      <main className="card" style={{ margin: 24 }}>
        Redirecting to sign in...
      </main>
    );
  }

  return (
    <>
      {isLoginRoute ? null : <Nav />}
      <main>{children}</main>
    </>
  );
}
