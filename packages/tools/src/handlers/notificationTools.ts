import type { ActorContext } from "@clinic-os/domain";

type NotificationToolService = {
  sendTeamsNotification(actor: ActorContext, input: {
    channel: string;
    message: string;
  }): Promise<unknown>;
};

export async function sendTeamsNotification(input: {
  channel: string;
  message: string;
}, context?: {
  service?: NotificationToolService;
  actor?: ActorContext;
}) {
  if (context?.service && context.actor) {
    return context.service.sendTeamsNotification(context.actor, input);
  }

  return {
    status: "notification_queued",
    ...input
  };
}
