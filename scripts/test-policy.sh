#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OPA="${ROOT}/.tools/bin/opa"
CONFTEST="${ROOT}/.tools/bin/conftest"

if [[ ! -x "${OPA}" || ! -x "${CONFTEST}" ]]; then
  echo "LOCAL_NOT_EXECUTED: OPA/Conftest Linux binaries are not available on this platform."
  echo "Policy tests must run on ubuntu-latest CI. Use 'npm run test:ci' in GitHub Actions."
  exit 0
fi

"${OPA}" fmt --fail "${ROOT}/policies"
"${OPA}" test "${ROOT}/policies" --verbose

for fixture in "${ROOT}"/fixtures/gate/valid/*.json; do
  "${CONFTEST}" test "${fixture}" --policy "${ROOT}/policies" --namespace baijin.gate
 done

for fixture in "${ROOT}"/fixtures/gate/denied-policy/*.json; do
  if "${CONFTEST}" test "${fixture}" --policy "${ROOT}/policies" --namespace baijin.gate; then
    echo "Expected Conftest to reject ${fixture}" >&2
    exit 1
  fi
 done

echo "Policy tests passed."
