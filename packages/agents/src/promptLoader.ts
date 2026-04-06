import { readFile } from "node:fs/promises";
import { isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../../../", import.meta.url));

export function resolvePromptPath(promptPath: string): string {
  return isAbsolute(promptPath) ? promptPath : resolve(repoRoot, promptPath);
}

export async function loadPromptFile(promptPath: string): Promise<string> {
  return readFile(resolvePromptPath(promptPath), "utf8");
}
