import type { FastifyInstance } from "fastify";
import { actorFromRequest } from "../lib/auth";

export async function registerMetricRoutes(app: FastifyInstance): Promise<void> {
  app.get("/scorecards", async () => {
    return app.clinicService.listScorecards();
  });

  app.get("/scorecards/history", async (request) => {
    const query = request.query as { employeeId: string; employeeRole: string };
    return app.clinicService.getScorecardHistory(query.employeeId, query.employeeRole);
  });

  app.post("/scorecard-imports", async (request) => {
    return app.clinicService.importScorecards(actorFromRequest(request), request.body);
  });
}
