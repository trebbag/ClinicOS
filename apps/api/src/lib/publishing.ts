import type { DocumentRecord, PublicationMode } from "@clinic-os/domain";
import { GraphClient, uploadApprovedDocument } from "@clinic-os/msgraph";
import { env } from "../env";

export type PublishedDocumentResult = {
  externalId: string | null;
  path: string;
};

export interface ApprovedDocumentPublisher {
  publish(document: DocumentRecord): Promise<PublishedDocumentResult>;
}

export class LocalApprovedDocumentPublisher implements ApprovedDocumentPublisher {
  async publish(document: DocumentRecord): Promise<PublishedDocumentResult> {
    return {
      externalId: null,
      path: `local://approved-documents/${document.id}/v${document.version}`
    };
  }
}

export class SharePointApprovedDocumentPublisher implements ApprovedDocumentPublisher {
  private readonly client = new GraphClient({
    tenantId: env.microsoft.tenantId,
    clientId: env.microsoft.clientId,
    clientSecret: env.microsoft.clientSecret
  });

  async publish(document: DocumentRecord): Promise<PublishedDocumentResult> {
    const filename = `${document.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-v${document.version}.md`;
    const result = await uploadApprovedDocument(
      this.client,
      env.microsoft.sharepointSiteId,
      env.microsoft.sharepointPolicyFolder,
      filename,
      document.body
    );

    return {
      externalId: result.itemId,
      path: result.webUrl
    };
  }
}

export function getApprovedDocumentPublisherMode(publisher?: ApprovedDocumentPublisher): PublicationMode {
  if (publisher instanceof SharePointApprovedDocumentPublisher) {
    return "sharepoint_live";
  }

  if (publisher instanceof LocalApprovedDocumentPublisher) {
    return "local_stub";
  }

  if (
    env.microsoft.integrationMode === "live"
    &&
    env.microsoft.tenantId &&
    env.microsoft.clientId &&
    env.microsoft.clientSecret &&
    env.microsoft.sharepointSiteId
  ) {
    return "sharepoint_live";
  }

  return "local_stub";
}

export function buildApprovedDocumentPublisher(): ApprovedDocumentPublisher {
  if (getApprovedDocumentPublisherMode() === "sharepoint_live") {
    return new SharePointApprovedDocumentPublisher();
  }

  return new LocalApprovedDocumentPublisher();
}
