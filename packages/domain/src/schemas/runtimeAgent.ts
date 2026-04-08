import { z } from "zod";
import { roles } from "../enums";

export const runtimeAgentModelSchema = z.enum([
  "gpt-5.4",
  "gpt-5.4-mini"
]);

export const runtimeAgentReasoningSchema = z.enum([
  "low",
  "medium",
  "high"
]);

export const runtimeAgentSpecSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  purpose: z.string().min(1),
  model: runtimeAgentModelSchema,
  reasoning: runtimeAgentReasoningSchema,
  allowedTools: z.array(z.string().min(1)).default([]),
  promptKey: z.string().min(1),
  reviewerRoles: z.array(z.enum(roles)),
  requiresApproval: z.boolean(),
  forbiddenActions: z.array(z.string().min(1)).default([]),
  outputShape: z.string().min(1)
});

export const runtimeAgentPayloadSchema = z.record(z.string(), z.unknown());

export const runtimeAgentRunCommandSchema = z.object({
  agentId: z.string().min(1).optional(),
  workflowId: z.string().min(1).optional(),
  requestId: z.string().min(1).optional(),
  payload: runtimeAgentPayloadSchema.default({})
}).refine((input) => Boolean(input.agentId || input.workflowId), {
  message: "Either agentId or workflowId is required."
});

export const runtimeAgentToolCallStatusSchema = z.enum([
  "completed",
  "failed"
]);

export const runtimeAgentToolCallSchema = z.object({
  callId: z.string().min(1),
  name: z.string().min(1),
  arguments: runtimeAgentPayloadSchema,
  status: runtimeAgentToolCallStatusSchema,
  output: z.unknown().nullable(),
  error: z.string().nullable()
});

export const runtimeAgentRunResultSchema = z.object({
  agent: runtimeAgentSpecSchema,
  requestId: z.string().min(1),
  workflowId: z.string().min(1),
  responseId: z.string().min(1),
  startedAt: z.string(),
  completedAt: z.string(),
  finalText: z.string(),
  toolCalls: z.array(runtimeAgentToolCallSchema),
  requiresApproval: z.boolean(),
  reviewerRoles: z.array(z.enum(roles))
});

export const runtimeAgentStatusSchema = z.object({
  enabled: z.boolean(),
  reason: z.string().nullable(),
  agents: z.array(runtimeAgentSpecSchema)
});

export type RuntimeAgentModel = z.infer<typeof runtimeAgentModelSchema>;
export type RuntimeAgentReasoning = z.infer<typeof runtimeAgentReasoningSchema>;
export type RuntimeAgentSpec = z.infer<typeof runtimeAgentSpecSchema>;
export type RuntimeAgentRunCommand = z.infer<typeof runtimeAgentRunCommandSchema>;
export type RuntimeAgentToolCallStatus = z.infer<typeof runtimeAgentToolCallStatusSchema>;
export type RuntimeAgentToolCall = z.infer<typeof runtimeAgentToolCallSchema>;
export type RuntimeAgentRunResult = z.infer<typeof runtimeAgentRunResultSchema>;
export type RuntimeAgentStatus = z.infer<typeof runtimeAgentStatusSchema>;
