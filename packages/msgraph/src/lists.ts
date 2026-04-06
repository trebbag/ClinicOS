import type { GraphClient } from "./client";

export async function createListItem(
  client: GraphClient,
  siteId: string,
  listId: string,
  fields: Record<string, unknown>
): Promise<{ itemId: string }> {
  const result = await client.request<{ id: string }>(
    `/sites/${siteId}/lists/${listId}/items`,
    {
      method: "POST",
      body: JSON.stringify({
        fields
      })
    }
  );

  return {
    itemId: result.id
  };
}
