#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

TARGET="${1:-}"

if [[ -z "$TARGET" ]]; then
  echo "Usage: ./scripts/deploy.sh [local-prod|prod]"
  echo ""
  echo "  local-prod : Builds and runs the production containers locally on this Mac"
  echo "  prod       : Syncs code, builds, and runs the production containers on Proxmox node 192.168.0.90 (CT 124 - .100)"
  exit 1
fi

if [[ "$TARGET" == "local-prod" ]]; then
  echo "Deploying to local-prod (Mac)..."
  docker compose -f docker-compose.prod.yml build
  docker compose -f docker-compose.prod.yml up -d
  echo "Deployed to local-prod!"

elif [[ "$TARGET" == "prod" ]]; then
  echo "Deploying to prod (Proxmox 192.168.0.90, CT 124)..."
  echo "Packaging source code..."
  tar -czf /tmp/repo.tar.gz --exclude node_modules --exclude .next --exclude .git --exclude dist -C "$ROOT" .
  
  echo "Transferring to Proxmox node..."
  scp /tmp/repo.tar.gz root@192.168.0.90:/tmp/repo.tar.gz
  
  echo "Pushing into LXC CT 124 and rebuilding..."
  ssh root@192.168.0.90 "pct push 124 /tmp/repo.tar.gz /opt/repo.tar.gz && pct exec 124 -- bash -lc 'tar -xzf /opt/repo.tar.gz -C /opt/lookingglass && cd /opt/lookingglass && docker compose -f docker-compose.prod.yml build && docker compose -f docker-compose.prod.yml up -d'"
  
  echo "Deployed to prod!"
  rm /tmp/repo.tar.gz

else
  echo "Unknown target: $TARGET"
  echo "Usage: ./scripts/deploy.sh [local-prod|prod]"
  exit 1
fi
