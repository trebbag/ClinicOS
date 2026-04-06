import type { DocumentRecord } from "@clinic-os/domain";

export interface ApprovedDocumentRetriever {
  listApprovedDocuments(): Promise<DocumentRecord[]>;
  getApprovedDocument(id: string): Promise<DocumentRecord | null>;
}
