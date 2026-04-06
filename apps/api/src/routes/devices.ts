import type { FastifyInstance } from "fastify";
import { actorFromRequest } from "../lib/auth";

export async function registerDeviceRoutes(app: FastifyInstance): Promise<void> {
  app.get("/devices", async (request) => {
    return app.deviceAuthService.listDevices(actorFromRequest(request));
  });

  app.patch("/devices/:id", async (request) => {
    const params = request.params as { id: string };
    return app.deviceAuthService.updateDevice(actorFromRequest(request), params.id, request.body);
  });

  app.post("/devices/:id/revoke", async (request) => {
    const params = request.params as { id: string };
    return app.deviceAuthService.revokeDevice(actorFromRequest(request), params.id);
  });
}
