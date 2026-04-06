function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

export const browserApiProxyPath =
  process.env.NEXT_PUBLIC_API_PROXY_PATH?.replace(/\/$/, "") || "/clinic-api";

export function buildBrowserApiUrl(path: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${browserApiProxyPath}${normalizedPath}`;
}

export function getInternalApiBaseUrl(): string {
  return (
    process.env.INTERNAL_API_BASE_URL
    || process.env.NEXT_PUBLIC_API_BASE_URL
    || "http://127.0.0.1:4000"
  ).replace(/\/$/, "");
}

export function getPublicAppOrigin(): string {
  return process.env.PUBLIC_APP_ORIGIN || "http://localhost:3000";
}

export function assertWebProductionConfig(): void {
  if (process.env.NODE_ENV === "production") {
    required("PUBLIC_APP_ORIGIN");
    required("INTERNAL_API_BASE_URL");
  }
}
