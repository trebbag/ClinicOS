import { assertWebProductionConfig } from "../../lib/env";

export async function GET(): Promise<Response> {
  assertWebProductionConfig();

  return Response.json({
    ok: true,
    service: "clinic-os-web",
    checkedAt: new Date().toISOString()
  });
}
