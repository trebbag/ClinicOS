import type { DocumentRecord } from "@clinic-os/domain";

export function buildApprovedDocumentContext(documents: DocumentRecord[]): string {
  return documents
    .map((doc) => `# ${doc.title}\nstatus=${doc.status}\nowner=${doc.ownerRole}\n\n${doc.body}`)
    .join("\n\n---\n\n");
}
