import { describe, expect, it } from "vitest";
import { loadPromptFile, resolvePromptPath } from "../promptLoader";

describe("promptLoader", () => {
  it("resolves repo-relative prompt paths", () => {
    const path = resolvePromptPath("packages/prompts/prompts/office-manager.md");
    expect(path).toContain("/packages/prompts/prompts/office-manager.md");
  });

  it("loads prompt file contents from the registry path", async () => {
    const contents = await loadPromptFile("packages/prompts/prompts/office-manager.md");
    expect(contents).toContain("office");
  });
});
