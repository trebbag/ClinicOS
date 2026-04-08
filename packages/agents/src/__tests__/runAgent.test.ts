import { describe, expect, it, vi } from "vitest";
import { getRuntimeAgentById, runAgent } from "..";

describe("runAgent", () => {
  it("executes allowed tool calls and returns the final assistant summary", async () => {
    const spec = getRuntimeAgentById("office_manager_copilot");
    expect(spec).toBeTruthy();

    const client = {
      createInitialResponse: vi.fn().mockResolvedValue({
        id: "resp_initial",
        output: [
          {
            type: "function_call",
            call_id: "call_action_item",
            name: "create_action_item",
            arguments: JSON.stringify({
              title: "Follow up with staffing vendor",
              ownerRole: "office_manager",
              dueDate: "2026-04-09"
            })
          }
        ]
      }),
      continueWithToolOutputs: vi.fn().mockResolvedValue({
        id: "resp_final",
        output_text: "Created the follow-up action item and flagged it for office-ops review.",
        output: [
          {
            type: "message",
            content: [
              {
                type: "output_text",
                text: "Created the follow-up action item and flagged it for office-ops review."
              }
            ]
          }
        ]
      })
    };

    const result = await runAgent(
      spec!,
      {
        requestId: "req_runtime_agent",
        workflowId: "office_manager_daily",
        payload: {
          objective: "Create an office-ops follow-up"
        }
      },
      "test-api-key",
      {
        client
      }
    );

    expect(client.createInitialResponse).toHaveBeenCalledOnce();
    expect(client.continueWithToolOutputs).toHaveBeenCalledOnce();
    expect(result.responseId).toBe("resp_final");
    expect(result.finalText).toContain("follow-up action item");
    expect(result.toolCalls).toHaveLength(1);
    expect(result.toolCalls[0]?.name).toBe("create_action_item");
    expect(result.toolCalls[0]?.status).toBe("completed");
  });

  it("rejects tool calls that are outside the agent allowlist", async () => {
    const spec = getRuntimeAgentById("office_manager_copilot");
    expect(spec).toBeTruthy();

    const client = {
      createInitialResponse: vi.fn().mockResolvedValue({
        id: "resp_initial",
        output: [
          {
            type: "function_call",
            call_id: "call_publish",
            name: "publish_approved_document",
            arguments: JSON.stringify({
              documentId: "doc_123",
              approvalEvidenceId: "approval_123"
            })
          }
        ]
      }),
      continueWithToolOutputs: vi.fn()
    };

    await expect(
      runAgent(
        spec!,
        {
          requestId: "req_runtime_agent",
          workflowId: "office_manager_daily",
          payload: {
            objective: "Attempt a disallowed publish"
          }
        },
        "test-api-key",
        {
          client
        }
      )
    ).rejects.toThrow("disallowed tool");

    expect(client.continueWithToolOutputs).not.toHaveBeenCalled();
  });
});
