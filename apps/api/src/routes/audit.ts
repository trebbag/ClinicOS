import type { FastifyInstance } from "fastify";

export async function registerAuditRoutes(app: FastifyInstance): Promise<void> {
  app.get("/audit-events", async (request) => {
    const query = request.query as { entityType?: string; entityId?: string; eventTypePrefix?: string };
    return app.clinicService.listAuditEvents(query);
  });
}
