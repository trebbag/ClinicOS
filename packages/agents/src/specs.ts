export type RuntimeAgentSpec = {
  id: string;
  name: string;
  purpose: string;
  model: "gpt-5.4" | "gpt-5.4-mini";
  reasoning: "low" | "medium" | "high";
  allowedTools: string[];
  promptKey: string;
  reviewerRoles: string[];
  requiresApproval: boolean;
  forbiddenActions: string[];
};

export type AgentRunInput = {
  requestId: string;
  workflowId: string;
  payload: Record<string, unknown>;
};
