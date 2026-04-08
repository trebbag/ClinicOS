import { runtimeAgentRunResultSchema, type RuntimeAgentRunResult, type RuntimeAgentSpec, type RuntimeAgentToolCall } from "@clinic-os/domain";
import { promptRegistry } from "@clinic-os/prompts";
import type { AgentRunInput } from "./specs";
import { OpenAIResponsesClient } from "./clients/openaiResponsesClient";
import { loadPromptFile } from "./promptLoader";
import {
  executeRuntimeFunctionCall,
  extractResponseText,
  isFunctionCallItem,
  listAllowedToolDefinitions,
  type RuntimeAgentToolContext
} from "./toolRunner";

type RuntimeAgentModelClient = Pick<OpenAIResponsesClient, "createInitialResponse" | "continueWithToolOutputs">;

export async function runAgent(
  spec: RuntimeAgentSpec,
  input: AgentRunInput,
  apiKey: string,
  options?: {
    client?: RuntimeAgentModelClient;
    toolContext?: RuntimeAgentToolContext;
    maxIterations?: number;
  }
): Promise<RuntimeAgentRunResult> {
  const promptPath = promptRegistry[spec.promptKey as keyof typeof promptRegistry];
  const prompt = await loadPromptFile(promptPath);
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is required to run runtime agents.");
  }
  const client = options?.client ?? new OpenAIResponsesClient(apiKey);
  const maxIterations = options?.maxIterations ?? 5;
  const toolCalls: RuntimeAgentToolCall[] = [];
  const allowedTools = new Set(spec.allowedTools);
  const startedAt = new Date().toISOString();

  let response = await client.createInitialResponse(
    spec,
    prompt,
    input,
    listAllowedToolDefinitions(spec.allowedTools)
  );

  for (let iteration = 0; iteration < maxIterations; iteration += 1) {
    const functionCalls = (response.output ?? []).filter(isFunctionCallItem);
    if (functionCalls.length === 0) {
      return runtimeAgentRunResultSchema.parse({
        agent: spec,
        requestId: input.requestId,
        workflowId: input.workflowId,
        responseId: response.id,
        startedAt,
        completedAt: new Date().toISOString(),
        finalText: extractResponseText(response),
        toolCalls,
        requiresApproval: spec.requiresApproval,
        reviewerRoles: spec.reviewerRoles
      });
    }

    const toolOutputs = [];
    for (const functionCall of functionCalls) {
      const result = await executeRuntimeFunctionCall(functionCall, allowedTools, options?.toolContext);
      toolCalls.push(result.toolCall);
      toolOutputs.push(result.outputItem);
    }

    response = await client.continueWithToolOutputs(spec, response.id, toolOutputs);
  }

  throw new Error(`Runtime agent ${spec.id} exceeded the maximum tool-call iterations.`);
}
