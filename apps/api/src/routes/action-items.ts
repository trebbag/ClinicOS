import type { FastifyInstance } from "fastify";
import { actorFromRequest } from "../lib/auth";

export async function registerActionItemRoutes(app: FastifyInstance): Promise<void> {
  app.get("/action-items", async (request) => {
    const query = request.query as { ownerRole?: string; status?: string; kind?: string };
    return app.clinicService.listActionItems(query);
  });

  app.post("/action-items", async (request) => {
    return app.clinicService.createActionItem(actorFromRequest(request), request.body);
  });

  app.patch("/action-items/:id", async (request) => {
    const params = request.params as { id: string };
    return app.clinicService.updateActionItem(actorFromRequest(request), params.id, request.body);
  });
}
