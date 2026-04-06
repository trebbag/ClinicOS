import type { GraphClient } from "./client";

export async function uploadApprovedDocument(
  client: GraphClient,
  siteId: string,
  folderPath: string,
  filename: string,
  content: string
): Promise<{ itemId: string; webUrl: string }> {
  const normalizedFolder = folderPath.replace(/^\/+|\/+$/g, "");
  const normalizedFilename = filename.replace(/^\/+/, "");
  const encodedPath = encodeURIComponent(`${normalizedFolder}/${normalizedFilename}`).replace(/%2F/g, "/");

  return client.request<{ id: string; webUrl: string }>(
    `/sites/${siteId}/drive/root:/${encodedPath}:/content`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "text/markdown"
      },
      body: content
    }
  ).then((item) => ({
    itemId: item.id,
    webUrl: item.webUrl
  }));
}
