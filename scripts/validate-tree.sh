#!/usr/bin/env bash
set -euo pipefail

required=(
  "AGENTS.md"
  "PLANS.md"
  ".codex/config.toml"
  ".agents/skills/policy-pack/SKILL.md"
  "apps/web/app/page.tsx"
  "apps/api/src/server.ts"
  "apps/worker/src/index.ts"
  "packages/domain/src/index.ts"
  "packages/workflows/src/engine.ts"
  "packages/agents/src/registry.ts"
  "packages/tools/src/businessTools.ts"
  "packages/approvals/src/matrix.ts"
  "packages/metrics/src/calculate.ts"
  "packages/db/prisma/schema.prisma"
)

missing=0
for path in "${required[@]}"; do
  if [ ! -f "$path" ]; then
    echo "Missing: $path"
    missing=1
  fi
done

if [ "$missing" -ne 0 ]; then
  echo "Tree validation failed."
  exit 1
fi

echo "Tree looks complete."
