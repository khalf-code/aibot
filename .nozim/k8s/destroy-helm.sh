#!/usr/bin/env bash
# Destroy OpenClaw Helm deployment
# Usage: ./destroy-helm.sh <name> [--delete-namespace]
#
# Examples:
#   ./destroy-helm.sh test                  # Uninstall release, keep namespace
#   ./destroy-helm.sh test --delete-namespace   # Uninstall and delete namespace

set -euo pipefail

DELETE_NS=false

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <name> [--delete-namespace]"
  echo ""
  echo "Options:"
  echo "  --delete-namespace    Also delete the Kubernetes namespace"
  echo ""
  echo "Examples:"
  echo "  $0 test                       # Uninstall release, keep namespace"
  echo "  $0 test --delete-namespace    # Uninstall and delete namespace"
  exit 1
fi

NAME="$1"
shift

# Parse options
while [[ $# -gt 0 ]]; do
  case "$1" in
    --delete-namespace)
      DELETE_NS=true
      shift
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done

echo "Destroying OpenClaw deployment..."
echo "  Name: ${NAME}"
echo ""

# Uninstall Helm release
if helm status "${NAME}" -n "${NAME}" &>/dev/null; then
  helm uninstall "${NAME}" -n "${NAME}"
  echo "Helm release '${NAME}' uninstalled."
else
  echo "Helm release '${NAME}' not found in namespace '${NAME}'."
fi

# Optionally delete namespace
if [[ "${DELETE_NS}" == "true" ]]; then
  if kubectl get namespace "${NAME}" &>/dev/null; then
    kubectl delete namespace "${NAME}"
    echo "Namespace '${NAME}' deleted."
  else
    echo "Namespace '${NAME}' not found."
  fi
fi

echo ""
echo "Done."
