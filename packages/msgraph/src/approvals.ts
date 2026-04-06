import type { GraphClient } from "./client";

export async function requestHumanApproval(
  _client: GraphClient,
  _title: string,
  _details: string,
  _assigneeRole: string
): Promise<{ approvalId: string }> {
  throw new Error("requestHumanApproval not implemented");
}
