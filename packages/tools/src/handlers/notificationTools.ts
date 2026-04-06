export async function sendTeamsNotification(input: {
  channel: string;
  message: string;
}) {
  return {
    status: "notification_queued",
    ...input
  };
}
