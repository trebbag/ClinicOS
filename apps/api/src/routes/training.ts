import type { FastifyInstance } from "fastify";
import { actorFromRequest } from "../lib/auth";

export async function registerTrainingRoutes(app: FastifyInstance): Promise<void> {
  app.get("/training/dashboard", async (request) => {
    const query = request.query as { employeeId: string; employeeRole: string };
    return app.clinicService.getTrainingDashboard(query.employeeId, query.employeeRole);
  });

  app.post("/training-requirements", async (request) => {
    return app.clinicService.createTrainingRequirement(actorFromRequest(request), request.body);
  });

  app.post("/training-completions", async (request) => {
    return app.clinicService.createTrainingCompletion(actorFromRequest(request), request.body);
  });
}
