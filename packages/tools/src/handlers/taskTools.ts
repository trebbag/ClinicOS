import type { ActorContext } from "@clinic-os/domain";

type TaskToolService = {
  createActionItem(actor: ActorContext, input: unknown): Promise<unknown>;
};

export async function createActionItem(input: {
  title: string;
  ownerRole: string;
  dueDate: string;
}, context?: {
  service?: TaskToolService;
  actor?: ActorContext;
}) {
  if (context?.service && context.actor) {
    return context.service.createActionItem(context.actor, {
      kind: "action_item",
      title: input.title,
      ownerRole: input.ownerRole,
      dueDate: input.dueDate
    });
  }

  return {
    status: "action_item_created",
    ...input
  };
}
