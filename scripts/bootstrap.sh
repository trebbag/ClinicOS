#!/usr/bin/env bash
set -euo pipefail

echo "Installing dependencies..."
npm install

if [ ! -f .env ]; then
  cp .env.example .env
  echo ".env created from .env.example"
fi

echo "Bootstrap complete."
echo "Next steps:"
echo "  1) docker compose up -d postgres"
echo "  2) npm run dev:api"
echo "  3) npm run dev:web"
echo "  4) npm run dev:worker"
