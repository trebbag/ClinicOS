import { randomUUID } from "node:crypto";

export type TeamsWebhookMessage = {
  title: string;
  body: string;
  facts?: Array<{
    label: string;
    value: string;
  }>;
};

export function buildTeamsWebhookPayload(message: TeamsWebhookMessage): Record<string, unknown> {
  const body: Array<Record<string, unknown>> = [
    {
      type: "TextBlock",
      text: message.title,
      weight: "Bolder",
      size: "Medium",
      wrap: true
    },
    {
      type: "TextBlock",
      text: message.body,
      wrap: true,
      spacing: "Medium"
    }
  ];

  if (message.facts?.length) {
    body.push({
      type: "FactSet",
      facts: message.facts.map((fact) => ({
        title: `${fact.label}:`,
        value: fact.value
      }))
    });
  }

  return {
    type: "message",
    attachments: [
      {
        contentType: "application/vnd.microsoft.card.adaptive",
        content: {
          $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
          type: "AdaptiveCard",
          version: "1.4",
          body
        }
      }
    ]
  };
}

export async function sendTeamsWebhookMessage(
  webhookUrl: string,
  message: TeamsWebhookMessage,
  requestImpl: typeof fetch = fetch
): Promise<{ messageId: string }> {
  const response = await requestImpl(webhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(buildTeamsWebhookPayload(message))
  });
  const responseText = await response.text();

  if (!response.ok) {
    throw new Error(`Teams webhook request failed (${response.status}): ${responseText || "Unknown response"}`);
  }

  if (responseText.includes("Microsoft Teams endpoint returned HTTP error")) {
    throw new Error(`Teams webhook request failed: ${responseText}`);
  }

  return {
    messageId: `teams-webhook-${randomUUID()}`
  };
}
