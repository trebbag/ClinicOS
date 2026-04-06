import type { FastifyInstance } from "fastify";
import { actorFromRequest, requireCapability } from "../lib/auth";

export async function registerAuditRoutes(app: FastifyInstance): Promise<void> {
  app.get("/audit-events", async (request) => {
    const actor = actorFromRequest(request);
    requireCapability(actor, "audit.view_auth_events");
    const query = request.query as { entityType?: string; entityId?: string; eventTypePrefix?: string };
    return app.clinicService.listAuditEvents(query);
  });
}
