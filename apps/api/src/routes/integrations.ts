import type { FastifyInstance } from "fastify";
import { actorFromRequest, requireAnyRole } from "../lib/auth";

export async function registerIntegrationRoutes(app: FastifyInstance): Promise<void> {
  app.get("/integrations/microsoft/status", async (request) => {
    const actor = actorFromRequest(request);
    requireAnyRole(actor, ["medical_director", "quality_lead", "office_manager", "cfo"]);
    return app.clinicService.getMicrosoftIntegrationStatus();
  });

  app.post("/integrations/microsoft/validate", async (request) => {
    const actor = actorFromRequest(request);
    requireAnyRole(actor, ["medical_director", "quality_lead", "office_manager", "cfo"]);
    return app.clinicService.validateMicrosoftIntegration(actor);
  });
}
