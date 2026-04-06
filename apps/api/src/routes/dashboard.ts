import type { FastifyInstance } from "fastify";

export async function registerDashboardRoutes(app: FastifyInstance): Promise<void> {
  app.get("/dashboard/overview", async () => app.clinicService.getOverviewStats());
}
