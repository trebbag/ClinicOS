import { promptRegistry } from "@clinic-os/prompts";
import type { AgentRunInput, RuntimeAgentSpec } from "./specs";
import { OpenAIResponsesClient } from "./clients/openaiResponsesClient";
import { loadPromptFile } from "./promptLoader";

export async function runAgent(
  spec: RuntimeAgentSpec,
  input: AgentRunInput,
  apiKey: string
): Promise<unknown> {
  const promptPath = promptRegistry[spec.promptKey as keyof typeof promptRegistry];
  const prompt = await loadPromptFile(promptPath);
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is required to run runtime agents.");
  }
  const client = new OpenAIResponsesClient(apiKey);
  return client.run(spec, prompt, input);
}
