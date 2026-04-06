import type { FastifyInstance } from "fastify";
import { actorFromRequest, requireCapability } from "../lib/auth";

export async function registerIntegrationRoutes(app: FastifyInstance): Promise<void> {
  app.get("/integrations/microsoft/status", async (request) => {
    const actor = actorFromRequest(request);
    requireCapability(actor, "integrations.view_status");
    return app.clinicService.getMicrosoftIntegrationStatus();
  });

  app.post("/integrations/microsoft/validate", async (request) => {
    const actor = actorFromRequest(request);
    requireCapability(actor, "integrations.validate");
    return app.clinicService.validateMicrosoftIntegration(actor);
  });
}
