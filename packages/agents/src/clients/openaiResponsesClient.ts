import OpenAI from "openai";
import type { RuntimeAgentSpec, AgentRunInput } from "../specs";

export type RuntimeModelResponse = {
  id: string;
  status?: string;
  output?: Array<Record<string, unknown>>;
  output_text?: string | null;
};

export class OpenAIResponsesClient {
  private readonly client: OpenAI;

  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey });
  }

  async createInitialResponse(
    spec: RuntimeAgentSpec,
    prompt: string,
    input: AgentRunInput,
    tools: Array<{
      type: "function";
      name: string;
      description: string;
      parameters: Record<string, unknown>;
      strict: true;
    }>
  ): Promise<RuntimeModelResponse> {
    return this.client.responses.create({
      model: spec.model,
      store: false,
      instructions: prompt,
      input: JSON.stringify(input, null, 2),
      reasoning: {
        effort: spec.reasoning
      },
      tool_choice: "auto",
      text: {
        format: {
          type: "text"
        }
      },
      tools
    }) as unknown as Promise<RuntimeModelResponse>;
  }

  async continueWithToolOutputs(
    spec: RuntimeAgentSpec,
    previousResponseId: string,
    input: Array<{
      type: "function_call_output";
      call_id: string;
      output: string;
    }>
  ): Promise<RuntimeModelResponse> {
    return this.client.responses.create({
      model: spec.model,
      store: false,
      previous_response_id: previousResponseId,
      input,
      reasoning: {
        effort: spec.reasoning
      }
    }) as unknown as Promise<RuntimeModelResponse>;
  }
}
