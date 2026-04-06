import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

function resolvePath(relativePath: string): string {
  return fileURLToPath(new URL(relativePath, import.meta.url));
}

export default defineConfig({
  resolve: {
    alias: {
      "@clinic-os/domain": resolvePath("./packages/domain/src/index.ts"),
      "@clinic-os/workflows": resolvePath("./packages/workflows/src/index.ts"),
      "@clinic-os/agents": resolvePath("./packages/agents/src/index.ts"),
      "@clinic-os/prompts": resolvePath("./packages/prompts/src/index.ts"),
      "@clinic-os/tools": resolvePath("./packages/tools/src/index.ts"),
      "@clinic-os/msgraph": resolvePath("./packages/msgraph/src/index.ts"),
      "@clinic-os/approvals": resolvePath("./packages/approvals/src/index.ts"),
      "@clinic-os/retrieval": resolvePath("./packages/retrieval/src/index.ts"),
      "@clinic-os/metrics": resolvePath("./packages/metrics/src/index.ts"),
      "@clinic-os/evals": resolvePath("./packages/evals/src/index.ts"),
      "@clinic-os/db": resolvePath("./packages/db/src/index.ts")
    }
  },
  test: {
    environment: "node",
    include: [
      "packages/**/src/**/__tests__/*.test.ts",
      "apps/**/src/**/__tests__/*.test.ts"
    ]
  }
});
