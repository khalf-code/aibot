#!/usr/bin/env bash
set -euo pipefail

TASK_ID="${1:-}"
shift || true
if [[ -z "${TASK_ID}" ]]; then
  echo "Usage: run_task.sh <TASK_ID> <cmd...>" >&2
  exit 2
fi
if [[ $# -lt 1 ]]; then
  echo "Usage: run_task.sh <TASK_ID> <cmd...>" >&2
  exit 2
fi

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_DIR="${ROOT_DIR}/share/logs"
mkdir -p "${LOG_DIR}"

CMD_NAME="$(echo "$*" | tr ' /' '__' | cut -c1-60)"
LOG_FILE="${LOG_DIR}/${TASK_ID}__${CMD_NAME}.log"

echo "[run_task] task=${TASK_ID} cmd=$*" | tee "${LOG_FILE}"
set +e
"$@" 2>&1 | tee -a "${LOG_FILE}"
EC=${PIPESTATUS[0]}
set -e
if [[ ${EC} -eq 0 ]]; then
  mv "${LOG_FILE}" "${LOG_FILE%.log}__ok.log"
else
  mv "${LOG_FILE}" "${LOG_FILE%.log}__fail.log"
fi
exit ${EC}
