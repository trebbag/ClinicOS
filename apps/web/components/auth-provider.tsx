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
  availableRoles: ActorRole[];
  isPrimary: boolean;
  lockedUntil: string | null;
};

export type AppCapability =
  | "dashboard.view"
  | "approvals.view"
  | "office_ops.view"
  | "office_ops.manage"
  | "office_ops.reconcile_planner"
  | "quality.view"
  | "quality.manage"
  | "committees.view"
  | "committees.manage"
  | "service_lines.view"
  | "service_lines.manage"
  | "practice_agreements.view"
  | "practice_agreements.manage"
  | "telehealth.view"
  | "telehealth.manage"
  | "controlled_substances.view"
  | "controlled_substances.manage"
  | "delegation.view"
  | "delegation.manage"
  | "standards.view"
  | "standards.manage"
  | "public_assets.view"
  | "public_assets.manage"
  | "scorecards.view"
  | "pilot_ops.view"
  | "runtime_agents.view"
  | "runtime_agents.run"
  | "ops.view_config"
  | "ops.run_cleanup"
  | "integrations.view_status"
  | "integrations.validate"
  | "worker_jobs.view"
  | "worker_jobs.retry"
  | "auth.manage_profiles"
  | "auth.manage_devices"
  | "auth.mint_enrollment_codes"
  | "audit.view_auth_events";

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
  capabilities: AppCapability[];
};

export const adminProfileRoles: ActorRole[] = [
  "medical_director",
  "quality_lead",
  "office_manager",
  "hr_lead",
  "cfo"
];

export const allActorRoles: ActorRole[] = [
  "medical_director",
  "quality_lead",
  "office_manager",
  "hr_lead",
  "cfo",
  "patient_care_team_physician",
  "nurse_practitioner",
  "medical_assistant",
  "front_desk"
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

type NavigationLink = {
  href:
    | "/"
    | "/medical-director"
    | "/office-manager"
    | "/pilot-ops"
    | "/quality"
    | "/committees"
    | "/service-lines"
    | "/practice-agreements"
    | "/telehealth"
    | "/controlled-substances"
    | "/delegation"
    | "/standards"
    | "/scorecards"
    | "/public-assets"
    | "/runtime-agents";
  label: string;
  allowedRoles: ActorRole[];
  requiredCapability?: AppCapability;
};

export const navigationLinks: NavigationLink[] = [
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
    allowedRoles: adminProfileRoles,
    requiredCapability: "pilot_ops.view" as const
  },
  {
    href: "/runtime-agents" as const,
    label: "Runtime Agents",
    allowedRoles: adminProfileRoles,
    requiredCapability: "runtime_agents.view" as const
  },
  {
    href: "/quality" as const,
    label: "Quality",
    allowedRoles: ["quality_lead"] as ActorRole[]
  },
  {
    href: "/committees" as const,
    label: "Committees",
    allowedRoles: ["medical_director", "quality_lead", "hr_lead", "cfo"] as ActorRole[],
    requiredCapability: "committees.view" as const
  },
  {
    href: "/service-lines" as const,
    label: "Service Lines",
    allowedRoles: ["medical_director", "quality_lead", "office_manager", "hr_lead", "cfo"] as ActorRole[],
    requiredCapability: "service_lines.view" as const
  },
  {
    href: "/practice-agreements" as const,
    label: "Practice Agreements",
    allowedRoles: ["medical_director", "quality_lead", "patient_care_team_physician", "hr_lead"] as ActorRole[],
    requiredCapability: "practice_agreements.view" as const
  },
  {
    href: "/telehealth" as const,
    label: "Telehealth",
    allowedRoles: ["medical_director", "quality_lead", "patient_care_team_physician"] as ActorRole[],
    requiredCapability: "telehealth.view" as const
  },
  {
    href: "/controlled-substances" as const,
    label: "Controlled Substances",
    allowedRoles: ["medical_director", "quality_lead", "patient_care_team_physician"] as ActorRole[],
    requiredCapability: "controlled_substances.view" as const
  },
  {
    href: "/delegation" as const,
    label: "Delegation",
    allowedRoles: ["medical_director", "quality_lead", "office_manager", "patient_care_team_physician", "nurse_practitioner", "medical_assistant"] as ActorRole[],
    requiredCapability: "delegation.view" as const
  },
  {
    href: "/standards" as const,
    label: "Standards",
    allowedRoles: ["medical_director", "quality_lead", "hr_lead", "cfo"] as ActorRole[],
    requiredCapability: "standards.view" as const
  },
  {
    href: "/public-assets" as const,
    label: "Public Assets",
    allowedRoles: ["medical_director", "quality_lead", "cfo"] as ActorRole[],
    requiredCapability: "public_assets.view" as const
  },
  {
    href: "/scorecards" as const,
    label: "Scorecards",
    allowedRoles: ["office_manager", "hr_lead", "medical_director"] as ActorRole[]
  }
];

const devProfileStorageKey = "clinic-os.dev-profile";

function getStoredDevProfile(): ActorIdentity {
  if (typeof window === "undefined") {
    return devProfiles[0];
  }

  const stored = window.localStorage.getItem(devProfileStorageKey);
  const match = devProfiles.find((profile) => profile.role === stored);
  return match ?? devProfiles[0];
}

export function canAccessRoute(
  role: ActorRole | null,
  href: string,
  capabilities: AppCapability[] = []
): boolean {
  if (!role) {
    return false;
  }
  const link = navigationLinks.find((candidate) => candidate.href === href);
  if (!link) {
    return true;
  }
  return link.allowedRoles.includes(role)
    && (!link.requiredCapability || capabilities.includes(link.requiredCapability));
}

type AppAuthContextValue = {
  authState: AuthStateResponse | null;
  actor: ActorIdentity | null;
  capabilities: AppCapability[];
  loading: boolean;
  error: string | null;
  refreshAuth: () => Promise<void>;
  hasCapability: (capability: AppCapability) => boolean;
  selectDevProfile: (role: ActorRole) => void;
  enrollDevice: (input: { enrollmentCode: string; deviceLabel: string }) => Promise<void>;
  login: (input: { profileId: string; role?: ActorRole; pin: string }) => Promise<void>;
  switchProfile: (input: { profileId: string; role?: ActorRole; pin: string }) => Promise<void>;
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
    capabilities: authState?.capabilities ?? [],
    loading,
    error,
    refreshAuth,
    hasCapability: (capability) => (authState?.capabilities ?? []).includes(capability),
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
