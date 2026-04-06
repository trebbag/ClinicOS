import { describe, expect, it, vi } from "vitest";
import type { GraphClient } from "../client";
import { createPlannerTask, getPlannerTask } from "../planner";
import { buildTeamsWebhookPayload, sendTeamsWebhookMessage } from "../teams";
import { createListItem } from "../lists";

describe("Microsoft Graph wrappers", () => {
  it("posts Planner tasks and patches details with the expected shape", async () => {
    const request = vi.fn()
      .mockResolvedValueOnce({ id: "task-123" })
      .mockResolvedValueOnce({ "@odata.etag": "W/\\\"etag-123\\\"" })
      .mockResolvedValueOnce(undefined);
    const client = { request } as unknown as GraphClient;

    const result = await createPlannerTask(
      client,
      "plan-1",
      "Follow up on issue",
      "bucket-1",
      "Call vendor and confirm ETA",
      "2026-03-28T12:00:00.000Z"
    );

    expect(result).toEqual({ taskId: "task-123" });
    expect(request).toHaveBeenNthCalledWith(1, "/planner/tasks", {
      method: "POST",
      body: JSON.stringify({
        planId: "plan-1",
        title: "Follow up on issue",
        bucketId: "bucket-1",
        dueDateTime: "2026-03-28T12:00:00.000Z"
      })
    });
    expect(request).toHaveBeenNthCalledWith(2, "/planner/tasks/task-123/details");
    expect(request).toHaveBeenNthCalledWith(3, "/planner/tasks/task-123/details", {
      method: "PATCH",
      headers: {
        "If-Match": "W/\\\"etag-123\\\""
      },
      body: JSON.stringify({
        description: "Call vendor and confirm ETA",
        previewType: "description"
      })
    });
  });

  it("reads Planner tasks with completion state", async () => {
    const request = vi.fn().mockResolvedValue({
      id: "task-123",
      percentComplete: 100,
      completedDateTime: "2026-03-28T12:30:00.000Z",
      dueDateTime: "2026-03-28T12:00:00.000Z"
    });
    const client = { request } as unknown as GraphClient;

    const result = await getPlannerTask(client, "task-123");

    expect(result).toEqual({
      taskId: "task-123",
      percentComplete: 100,
      completedDateTime: "2026-03-28T12:30:00.000Z",
      dueDateTime: "2026-03-28T12:00:00.000Z"
    });
    expect(request).toHaveBeenCalledWith("/planner/tasks/task-123");
  });

  it("posts Teams webhook payloads as adaptive cards", async () => {
    const requestImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: vi.fn().mockResolvedValue("1")
    });

    const result = await sendTeamsWebhookMessage(
      "https://contoso.example/webhook",
      {
        title: "Approval reminder",
        body: "A policy is waiting for review.",
        facts: [
          {
            label: "Document ID",
            value: "doc-123"
          }
        ]
      },
      requestImpl as unknown as typeof fetch
    );

    expect(result.messageId.startsWith("teams-webhook-")).toBe(true);
    expect(requestImpl).toHaveBeenCalledWith("https://contoso.example/webhook", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        type: "message",
        attachments: [
          {
            contentType: "application/vnd.microsoft.card.adaptive",
            content: {
              $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
              type: "AdaptiveCard",
              version: "1.4",
              body: [
                {
                  type: "TextBlock",
                  text: "Approval reminder",
                  weight: "Bolder",
                  size: "Medium",
                  wrap: true
                },
                {
                  type: "TextBlock",
                  text: "A policy is waiting for review.",
                  wrap: true,
                  spacing: "Medium"
                },
                {
                  type: "FactSet",
                  facts: [
                    {
                      title: "Document ID:",
                      value: "doc-123"
                    }
                  ]
                }
              ]
            }
          }
        ]
      })
    });
  });

  it("builds webhook payloads without facts when none are supplied", () => {
    expect(buildTeamsWebhookPayload({
      title: "Office ops update",
      body: "Closeout is overdue."
    })).toEqual({
      type: "message",
      attachments: [
        {
          contentType: "application/vnd.microsoft.card.adaptive",
          content: {
            $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
            type: "AdaptiveCard",
            version: "1.4",
            body: [
              {
                type: "TextBlock",
                text: "Office ops update",
                weight: "Bolder",
                size: "Medium",
                wrap: true
              },
              {
                type: "TextBlock",
                text: "Closeout is overdue.",
                wrap: true,
                spacing: "Medium"
              }
            ]
          }
        }
      ]
    });
  });

  it("creates list items under the requested site and list", async () => {
    const request = vi.fn().mockResolvedValue({ id: "item-123" });
    const client = { request } as unknown as GraphClient;

    const result = await createListItem(client, "site-1", "list-1", {
      Title: "Broken room tablet",
      Status: "open"
    });

    expect(result).toEqual({ itemId: "item-123" });
    expect(request).toHaveBeenCalledWith("/sites/site-1/lists/list-1/items", {
      method: "POST",
      body: JSON.stringify({
        fields: {
          Title: "Broken room tablet",
          Status: "open"
        }
      })
    });
  });
});
