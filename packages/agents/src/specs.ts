import type { RuntimeAgentRunResult, RuntimeAgentSpec, RuntimeAgentToolCall } from "@clinic-os/domain";

export type AgentRunInput = {
  requestId: string;
  workflowId: string;
  payload: Record<string, unknown>;
};

export type { RuntimeAgentSpec, RuntimeAgentRunResult, RuntimeAgentToolCall };
