import { assertWebProductionConfig, getInternalApiBaseUrl, getPublicAppOrigin } from "../../lib/env";

export async function GET(): Promise<Response> {
  try {
    assertWebProductionConfig();

    const upstream = await fetch(`${getInternalApiBaseUrl()}/readyz`, {
      headers: {
        origin: getPublicAppOrigin()
      },
      cache: "no-store"
    });
    const payload = await upstream.json().catch(() => ({
      ok: upstream.ok,
      service: "clinic-os-web",
      checkedAt: new Date().toISOString()
    }));

    return Response.json(
      {
        ok: upstream.ok,
        service: "clinic-os-web",
        checkedAt: new Date().toISOString(),
        api: payload
      },
      { status: upstream.ok ? 200 : 503 }
    );
  } catch (error) {
    return Response.json(
      {
        ok: false,
        service: "clinic-os-web",
        checkedAt: new Date().toISOString(),
        error: error instanceof Error ? error.message : String(error)
      },
      { status: 503 }
    );
  }
}
