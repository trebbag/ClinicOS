import type { ActorContext } from "@clinic-os/domain";

type DocumentToolService = {
  createDocument(actor: ActorContext, input: unknown): Promise<unknown>;
  publishDocument(actor: ActorContext, documentId: string): Promise<unknown>;
};

export async function saveDraftDocument(input: {
  title: string;
  ownerRole: string;
  body: string;
}, context?: {
  service?: DocumentToolService;
  actor?: ActorContext;
}) {
  if (context?.service && context.actor) {
    return context.service.createDocument(context.actor, {
      title: input.title,
      ownerRole: input.ownerRole,
      approvalClass: "action_request",
      artifactType: "tool_draft",
      summary: "",
      serviceLines: [],
      body: input.body
    });
  }

  return {
    status: "draft_saved",
    ...input
  };
}

export async function publishApprovedDocument(input: {
  documentId: string;
  approvalEvidenceId: string;
}, context?: {
  service?: DocumentToolService;
  actor?: ActorContext;
}) {
  if (context?.service && context.actor) {
    return context.service.publishDocument(context.actor, input.documentId);
  }

  return {
    status: "publish_requested",
    ...input
  };
}
