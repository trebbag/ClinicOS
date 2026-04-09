import type { FastifyInstance } from "fastify";
import { actorFromRequest, requireCapability } from "../lib/auth";

export async function registerTrainingRoutes(app: FastifyInstance): Promise<void> {
  app.get("/training/dashboard", async (request) => {
    const query = request.query as { employeeId: string; employeeRole: string };
    return app.clinicService.getTrainingDashboard(query.employeeId, query.employeeRole);
  });

  app.get("/training/analytics", async (request) => {
    const actor = actorFromRequest(request);
    requireCapability(actor, "scorecards.view");
    const query = request.query as {
      employeeId?: string;
      employeeRole?: string;
      ownerRole?: string;
      status?: string;
    };
    return app.clinicService.getTrainingAnalytics(query);
  });

  app.get("/training-plans", async (request) => {
    const query = request.query as {
      employeeId?: string;
      employeeRole?: string;
      ownerRole?: string;
      status?: string;
    };
    return app.clinicService.listTrainingPlans(query);
  });

  app.post("/training-plans", async (request) => {
    return app.clinicService.createTrainingPlan(actorFromRequest(request), request.body);
  });

  app.post("/training-plans/bootstrap-defaults", async (request) => {
    return app.clinicService.bootstrapTrainingPlans(actorFromRequest(request), request.body);
  });

  app.patch("/training-plans/:id", async (request) => {
    const params = request.params as { id: string };
    return app.clinicService.updateTrainingPlan(actorFromRequest(request), params.id, request.body);
  });

  app.post("/training-requirements", async (request) => {
    return app.clinicService.createTrainingRequirement(actorFromRequest(request), request.body);
  });

  app.post("/training-completions", async (request) => {
    return app.clinicService.createTrainingCompletion(actorFromRequest(request), request.body);
  });
}
