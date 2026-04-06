import type { FastifyInstance } from "fastify";
import { env } from "../env";

export async function registerHealthRoutes(app: FastifyInstance): Promise<void> {
  app.get("/health", async () => ({
    ok: true,
    service: "clinic-os-api",
    checkedAt: new Date().toISOString()
  }));

  app.get("/healthz", async () => ({
    ok: true,
    service: "clinic-os-api",
    checkedAt: new Date().toISOString()
  }));

  app.get("/readyz", async (_request, reply) => {
    const status = await app.clinicService.getRuntimeConfigStatus({
      nodeEnv: env.nodeEnv,
      publicAppOrigin: env.publicAppOrigin || null,
      databaseReady: await app.databaseReadyCheck()
    });
    reply.status(status.startupReady ? 200 : 503);
    return status;
  });
}
