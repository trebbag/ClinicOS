import type { FastifyInstance } from "fastify";
import { actorFromRequest } from "../lib/auth";

export async function registerDocumentRoutes(app: FastifyInstance): Promise<void> {
  app.get("/documents", async (request) => {
    const query = request.query as { status?: string; approvalClass?: string };
    return app.clinicService.listDocuments(query);
  });

  app.post("/documents", async (request) => {
    return app.clinicService.createDocument(actorFromRequest(request), request.body);
  });

  app.post("/documents/:documentId/submit", async (request) => {
    const params = request.params as { documentId: string };
    return app.clinicService.submitDocument(actorFromRequest(request), params.documentId);
  });

  app.post("/documents/:documentId/publish", async (request) => {
    const params = request.params as { documentId: string };
    return app.clinicService.publishDocument(actorFromRequest(request), params.documentId);
  });

  app.get("/documents/:documentId/approved-context", async (request) => {
    const params = request.params as { documentId: string };
    return {
      context: await app.clinicService.getApprovedDocumentContext(params.documentId)
    };
  });
}
