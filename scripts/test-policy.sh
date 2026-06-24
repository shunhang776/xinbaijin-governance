#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OPA="${ROOT}/.tools/bin/opa"
CONFTEST="${ROOT}/.tools/bin/conftest"

OS="$(uname -s)"
IS_CI="${CI:-false}"
IS_GHA="${GITHUB_ACTIONS:-false}"
IS_REQUIRED_ENV="false"

if [[ "${OS}" == "Linux" || "${IS_CI}" == "true" || "${IS_GHA}" == "true" ]]; then
  IS_REQUIRED_ENV="true"
fi

# ── OPA check ──────────────────────────────────────────────
if [[ ! -x "${OPA}" ]]; then
  if [[ "${IS_REQUIRED_ENV}" == "true" ]]; then
    echo "ERROR: OPA is required in CI but was not found at ${OPA}" >&2
    echo "OPA=MISSING" >&2
    exit 1
  fi
  echo "OPA=LOCAL_NOT_EXECUTED"
else
  echo "OPA=$(command -v "${OPA}")"
  "${OPA}" version
fi

# ── Conftest check ─────────────────────────────────────────
if [[ ! -x "${CONFTEST}" ]]; then
  if [[ "${IS_REQUIRED_ENV}" == "true" ]]; then
    echo "ERROR: Conftest is required in CI but was not found at ${CONFTEST}" >&2
    echo "CONFTEST=MISSING" >&2
    exit 1
  fi
  echo "CONFTEST=LOCAL_NOT_EXECUTED"
else
  echo "CONFTEST=$(command -v "${CONFTEST}")"
  "${CONFTEST}" --version
fi

# ── Both missing on non-required env → early exit ──────────
if [[ ! -x "${OPA}" || ! -x "${CONFTEST}" ]]; then
  echo "POLICY_TESTS=LOCAL_NOT_EXECUTED"
  echo "Policy tests must run on ubuntu-latest CI."
  exit 0
fi

# ── Actual policy tests ────────────────────────────────────
"${OPA}" fmt --fail "${ROOT}/policies"
"${OPA}" test "${ROOT}/policies" --verbose

for fixture in "${ROOT}"/fixtures/gate/valid/*.json; do
  "${CONFTEST}" test "${fixture}" --policy "${ROOT}/policies" --namespace baijin.gate
done

for fixture in "${ROOT}"/fixtures/gate/denied-policy/*.json; do
  if "${CONFTEST}" test "${fixture}" --policy "${ROOT}/policies" --namespace baijin.gate; then
    echo "ERROR: Conftest should have rejected ${fixture}" >&2
    exit 1
  fi
done

echo "OPA=PASS"
echo "CONFTEST=PASS"
echo "POLICY_TESTS=PASS"
