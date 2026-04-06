import type { ActorContext } from "@clinic-os/domain";

type ApprovalToolService = {
  submitDocument(actor: ActorContext, documentId: string): Promise<unknown>;
};

export async function submitDocumentForReview(input: {
  documentId: string;
  approvalClass: string;
}, context?: {
  service?: ApprovalToolService;
  actor?: ActorContext;
}) {
  if (context?.service && context.actor) {
    return context.service.submitDocument(context.actor, input.documentId);
  }

  return {
    status: "approval_requested",
    ...input
  };
}
