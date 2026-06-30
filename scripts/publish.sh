#!/usr/bin/env bash
# Build production images and push to Docker Hub.
#
# Usage:
#   ./scripts/publish.sh [tag]              # default tag: latest
#   TAG=v1.0.0 ./scripts/publish.sh
#   NEXT_PUBLIC_API_URL=https://api.example.com ./scripts/publish.sh v1.0.0
#
# Environment:
#   DOCKER_USER              Docker Hub namespace (default: cramd)
#   REPO                     Image name base (default: lookingglass)
#   TAG                      Image tag (default: latest, overridable by first arg)
#   NEXT_PUBLIC_API_URL      Baked into frontend at build time (default: http://localhost:5001)
#   NEXT_PUBLIC_VICTORIALOGS_URL
#   NEXT_PUBLIC_GRAFANA_URL
#   NEXT_PUBLIC_VM_DIRECT_URL
#   VICTORIALOGS_URL         Used as fallback for NEXT_PUBLIC_VICTORIALOGS_URL
#   GRAFANA_URL              Used as fallback for NEXT_PUBLIC_GRAFANA_URL
#   VM_DIRECT_URL            Used as fallback for NEXT_PUBLIC_VM_DIRECT_URL
#   PUSH_UNIFIED_ALIASES     Also push cramd/lookingglass:backend|:frontend (default: 1 when TAG=latest)
#
# Requires: docker login (docker.io)

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

DOCKER_USER="${DOCKER_USER:-cramd}"
REPO="${REPO:-lookingglass}"
TAG="${TAG:-latest}"
DRY_RUN=false
NO_PUSH=false

usage() {
  sed -n '2,22p' "$0" | sed 's/^# \?//'
}

run() {
  if [[ "$DRY_RUN" == true ]]; then
    echo "+ $*"
  else
    "$@"
  fi
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    -h|--help)
      usage
      exit 0
      ;;
    -n|--dry-run)
      DRY_RUN=true
      shift
      ;;
    --no-push)
      NO_PUSH=true
      shift
      ;;
    -*)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 1
      ;;
    *)
      TAG="$1"
      shift
      ;;
  esac
done

export NEXT_PUBLIC_API_URL="${NEXT_PUBLIC_API_URL:-http://localhost:5001}"
export NEXT_PUBLIC_VICTORIALOGS_URL="${NEXT_PUBLIC_VICTORIALOGS_URL:-${VICTORIALOGS_URL:-http://192.168.0.100:9428}}"
export NEXT_PUBLIC_GRAFANA_URL="${NEXT_PUBLIC_GRAFANA_URL:-${GRAFANA_URL:-http://192.168.0.100:3001}}"
export NEXT_PUBLIC_VM_DIRECT_URL="${NEXT_PUBLIC_VM_DIRECT_URL:-${VM_DIRECT_URL:-http://192.168.0.100:8428}}"

if [[ -z "${PUSH_UNIFIED_ALIASES:-}" ]]; then
  if [[ "$TAG" == "latest" ]]; then
    PUSH_UNIFIED_ALIASES=1
  else
    PUSH_UNIFIED_ALIASES=0
  fi
fi

BACKEND_LOCAL="${COMPOSE_PROJECT_NAME:-lookingglass}-backend:latest"
FRONTEND_LOCAL="${COMPOSE_PROJECT_NAME:-lookingglass}-frontend:latest"
BACKEND_REMOTE="${DOCKER_USER}/${REPO}-backend:${TAG}"
FRONTEND_REMOTE="${DOCKER_USER}/${REPO}-frontend:${TAG}"

echo "Building production images..."
echo "  frontend NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}"
run docker compose -f docker-compose.prod.yml build backend frontend

echo "Tagging images as ${BACKEND_REMOTE} and ${FRONTEND_REMOTE}..."
run docker tag "$BACKEND_LOCAL" "$BACKEND_REMOTE"
run docker tag "$FRONTEND_LOCAL" "$FRONTEND_REMOTE"

if [[ "$PUSH_UNIFIED_ALIASES" == "1" ]]; then
  echo "Tagging unified aliases ${DOCKER_USER}/${REPO}:backend and :frontend..."
  run docker tag "$BACKEND_LOCAL" "${DOCKER_USER}/${REPO}:backend"
  run docker tag "$FRONTEND_LOCAL" "${DOCKER_USER}/${REPO}:frontend"
fi

if [[ "$NO_PUSH" == true ]]; then
  echo "Build and tag complete (--no-push)."
  exit 0
fi

echo "Pushing to Docker Hub..."
run docker push "$BACKEND_REMOTE"
run docker push "$FRONTEND_REMOTE"

if [[ "$PUSH_UNIFIED_ALIASES" == "1" ]]; then
  run docker push "${DOCKER_USER}/${REPO}:backend"
  run docker push "${DOCKER_USER}/${REPO}:frontend"
fi

echo "Done."
echo "  docker pull ${BACKEND_REMOTE}"
echo "  docker pull ${FRONTEND_REMOTE}"
