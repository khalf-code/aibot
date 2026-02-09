#!/usr/bin/env bash
# Deploy OpenClaw to Kubernetes via Helm
# Usage: ./deploy-helm.sh <name> [extra-helm-args...]
#
# The name is used for both the Helm release and the Kubernetes namespace.
#
# TOKEN HANDLING:
# - Fresh install: generates new token, displays it
# - Upgrade: reads existing token from secret, displays it
# This ensures the displayed token always matches the actual secret.
#
# AUTOMATION:
# - Waits for pods to be ready
# - Kills any existing port-forward for this deployment
# - Starts port-forward in background
# - Verifies connectivity before showing URL
#
# Examples:
#   ./deploy-helm.sh prod
#   ./deploy-helm.sh staging
#   ./deploy-helm.sh test --set worker.replicas=5

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CHART_DIR="${SCRIPT_DIR}/../../deploy/helm/openclaw"
LOCAL_PORT=18789

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <name> [extra-helm-args...]"
  echo ""
  echo "The name is used for both the Helm release and namespace."
  echo ""
  echo "Examples:"
  echo "  $0 prod                           # Deploy to 'prod' namespace"
  echo "  $0 staging                        # Deploy to 'staging' namespace"
  echo "  $0 test --set worker.replicas=5   # Deploy with custom worker count"
  exit 1
fi

NAME="$1"
shift

# Check if this is a fresh install or upgrade
SECRET_NAME="${NAME}-openclaw-gateway-token"
EXISTING_TOKEN=""
if kubectl get secret "${SECRET_NAME}" -n "${NAME}" &>/dev/null; then
  # Upgrade: read existing token from secret
  EXISTING_TOKEN="$(kubectl -n "${NAME}" get secret "${SECRET_NAME}" -o jsonpath='{.data.token}' | base64 -d)"
  echo "Upgrading existing deployment (keeping current token)..."
else
  # Fresh install: generate new token
  EXISTING_TOKEN="$(openssl rand -hex 32)"
  echo "Fresh install (generating new token)..."
fi

GATEWAY_TOKEN="${EXISTING_TOKEN}"
SVC_NAME="${NAME}-openclaw-gateway"

echo "  Name: ${NAME}"
echo ""

# Install or upgrade
helm upgrade --install "${NAME}" "${CHART_DIR}" \
  --namespace "${NAME}" \
  --create-namespace \
  --set gateway.token="${GATEWAY_TOKEN}" \
  "$@"

echo ""
echo "Waiting for gateway pod to be ready..."
kubectl -n "${NAME}" rollout status statefulset/"${NAME}-openclaw-gateway" --timeout=120s

# Kill any existing port-forward for this service
echo "Setting up port-forward..."
pkill -f "port-forward.*${SVC_NAME}" 2>/dev/null || true
sleep 1

# Start port-forward in background
kubectl -n "${NAME}" port-forward "svc/${SVC_NAME}" "${LOCAL_PORT}:18789" &>/dev/null &
PF_PID=$!

# Wait for port-forward to be ready
echo "Waiting for port-forward to be ready..."
for i in {1..30}; do
  if curl -s -o /dev/null -w "" "http://localhost:${LOCAL_PORT}/" 2>/dev/null; then
    break
  fi
  sleep 0.5
done

# Verify connectivity
if ! curl -s -o /dev/null "http://localhost:${LOCAL_PORT}/" 2>/dev/null; then
  echo "Warning: Port-forward may not be ready. Check manually."
fi

URL="http://localhost:${LOCAL_PORT}/overview?token=${GATEWAY_TOKEN}"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Deployment complete!"
echo ""
echo "Gateway Token:"
echo "  ${GATEWAY_TOKEN}"
echo ""
echo "Control UI (port-forward running in background, PID ${PF_PID}):"
echo "  ${URL}"
echo ""
echo "Check status:"
echo "  kubectl -n ${NAME} get pods"
echo "  kubectl -n ${NAME} get hpa"
echo ""
echo "Stop port-forward:"
echo "  kill ${PF_PID}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
