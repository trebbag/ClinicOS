import { browserApiProxyPath, buildBrowserApiUrl } from "./env";

export type ActorRole =
  | "medical_director"
  | "cfo"
  | "office_manager"
  | "hr_lead"
  | "quality_lead"
  | "patient_care_team_physician"
  | "nurse_practitioner"
  | "medical_assistant"
  | "front_desk";

export type ActorIdentity = {
  actorId: string;
  role: ActorRole;
  name: string;
};

export type BrowserAuthMode = "dev_headers" | "trusted_proxy" | "device_profiles";

export const browserAuthMode = (
  process.env.NEXT_PUBLIC_AUTH_MODE === "trusted_proxy"
    ? "trusted_proxy"
    : process.env.NEXT_PUBLIC_AUTH_MODE === "device_profiles"
      ? "device_profiles"
      : "dev_headers"
) as BrowserAuthMode;
export const apiBaseUrl = browserApiProxyPath;

export async function apiRequest<T>(
  path: string,
  actor?: ActorIdentity | null,
  init?: RequestInit
): Promise<T> {
  const headers = new Headers(init?.headers ?? {});
  if (!headers.has("Content-Type") && init?.body && !(init.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  if (browserAuthMode === "dev_headers" && actor) {
    headers.set("x-clinic-user-id", actor.actorId);
    headers.set("x-clinic-user-role", actor.role);
    headers.set("x-clinic-user-name", actor.name);
  }

  const response = await fetch(buildBrowserApiUrl(path), {
    ...init,
    credentials: "include",
    headers
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "Request failed." }));
    throw new Error(error.message ?? "Request failed.");
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}
