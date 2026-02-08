#!/usr/bin/env bash
set -euo pipefail

# Usage: run_parallel.sh <TASK_ID> -- <cmd1> ::: <cmd2> ::: <cmd3>
# Example:
#   ./scripts/run_parallel.sh 20260208-1500_build_hayoon -- "npm test" ::: "npm run lint"

TASK_ID="${1:-}"
shift || true
if [[ -z "${TASK_ID}" ]]; then
  echo "Usage: run_parallel.sh <TASK_ID> -- <cmd1> ::: <cmd2> ..." >&2
  exit 2
fi
if [[ "${1:-}" != "--" ]]; then
  echo "Usage: run_parallel.sh <TASK_ID> -- <cmd1> ::: <cmd2> ..." >&2
  exit 2
fi
shift

CMDS=()
CUR=""
for token in "$@"; do
  if [[ "${token}" == ":::" ]]; then
    CMDS+=("${CUR}")
    CUR=""
  else
    CUR="${CUR} ${token}"
  fi
done
if [[ -n "${CUR// /}" ]]; then
  CMDS+=("${CUR}")
fi

pids=()
idx=0
for cmd in "${CMDS[@]}"; do
  idx=$((idx+1))
  bash -lc "$(printf './scripts/run_task.sh %q bash -lc %q' "${TASK_ID}_p${idx}" "${cmd# }")" &
  pids+=($!)
done

fail=0
for pid in "${pids[@]}"; do
  if ! wait "${pid}"; then
    fail=1
  fi
done
exit ${fail}
