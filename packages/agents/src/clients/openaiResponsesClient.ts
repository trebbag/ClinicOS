import OpenAI from "openai";
import type { RuntimeAgentSpec, AgentRunInput } from "../specs";

/**
 * This is a thin placeholder around the OpenAI Responses API.
 * Replace the request body shape as needed if the JS SDK evolves.
 */
export class OpenAIResponsesClient {
  private readonly client: OpenAI;

  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey });
  }

  async run(spec: RuntimeAgentSpec, prompt: string, input: AgentRunInput): Promise<unknown> {
    const response = await this.client.responses.create({
      model: spec.model,
      input: [
        {
          role: "system",
          content: prompt
        },
        {
          role: "user",
          content: JSON.stringify(input, null, 2)
        }
      ]
    });

    return response;
  }
}
