import type { FastifyInstance } from "fastify";
import { actorFromRequest, requireAnyRole } from "../lib/auth";

export async function registerOfficeOpsRoutes(app: FastifyInstance): Promise<void> {
  app.get("/office-ops/dashboard", async (request) => {
    const query = request.query as { date?: string };
    const targetDate = query.date ?? new Date().toISOString().slice(0, 10);
    return app.clinicService.getOfficeOpsDashboard(targetDate);
  });

  app.post("/office-ops/daily-packet", async (request) => {
    return app.clinicService.generateOfficeOpsDailyPacket(actorFromRequest(request), request.body ?? {});
  });

  app.post("/office-ops/daily-closeout", async (request) => {
    return app.clinicService.submitOfficeOpsDailyCloseout(actorFromRequest(request), request.body);
  });

  app.patch("/office-ops/checklist-runs/:runId/items/:itemId", async (request) => {
    const params = request.params as { runId: string; itemId: string };
    return app.clinicService.updateChecklistItem(
      actorFromRequest(request),
      params.runId,
      params.itemId,
      request.body
    );
  });

  app.post("/office-ops/reconcile-planner", async (request) => {
    const actor = actorFromRequest(request);
    requireAnyRole(actor, ["medical_director", "quality_lead", "office_manager", "cfo"]);
    return app.clinicService.reconcilePlannerTasks(actor);
  });
}
