import type { GraphClient } from "./client";

export async function createPlannerTask(
  client: GraphClient,
  planId: string,
  title: string,
  bucketId?: string,
  details?: string,
  dueDateTime?: string
): Promise<{ taskId: string }> {
  const payload: Record<string, unknown> = {
    planId,
    title
  };

  if (bucketId) {
    payload.bucketId = bucketId;
  }

  if (dueDateTime) {
    payload.dueDateTime = dueDateTime;
  }

  const result = await client.request<{ id: string }>("/planner/tasks", {
    method: "POST",
    body: JSON.stringify(payload)
  });

  if (details) {
    const currentDetails = await client.request<{
      "@odata.etag"?: string;
    }>(`/planner/tasks/${result.id}/details`);
    const etag = currentDetails["@odata.etag"];

    if (!etag) {
      throw new Error(`Planner task details for ${result.id} did not return an ETag.`);
    }

    await client.request<void>(`/planner/tasks/${result.id}/details`, {
      method: "PATCH",
      headers: {
        "If-Match": etag
      },
      body: JSON.stringify({
        description: details,
        previewType: "description"
      })
    });
  }

  return {
    taskId: result.id
  };
}

export async function getPlannerTask(
  client: GraphClient,
  taskId: string
): Promise<{
  taskId: string;
  percentComplete: number;
  completedDateTime: string | null;
  dueDateTime: string | null;
}> {
  const result = await client.request<{
    id: string;
    percentComplete?: number;
    completedDateTime?: string | null;
    dueDateTime?: string | null;
  }>(`/planner/tasks/${taskId}`);

  return {
    taskId: result.id,
    percentComplete: result.percentComplete ?? 0,
    completedDateTime: result.completedDateTime ?? null,
    dueDateTime: result.dueDateTime ?? null
  };
}
