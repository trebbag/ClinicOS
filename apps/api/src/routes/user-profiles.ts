import type { FastifyInstance } from "fastify";
import { actorFromRequest } from "../lib/auth";

export async function registerUserProfileRoutes(app: FastifyInstance): Promise<void> {
  app.get("/user-profiles", async (request) => {
    return app.deviceAuthService.listUserProfiles(actorFromRequest(request));
  });

  app.post("/user-profiles", async (request) => {
    return app.deviceAuthService.createUserProfile(actorFromRequest(request), request.body);
  });

  app.patch("/user-profiles/:id", async (request) => {
    const params = request.params as { id: string };
    return app.deviceAuthService.updateUserProfile(actorFromRequest(request), params.id, request.body);
  });
}
