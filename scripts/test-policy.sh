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

EXPECTED_OPA_VERSION="$(cd "${ROOT}" && node -p "require('./versions.json').opa")"
EXPECTED_CONFTEST_VERSION="$(cd "${ROOT}" && node -p "require('./versions.json').conftest")"

# ── OPA check (diagnostics → stderr) ───────────────────────
if [[ ! -x "${OPA}" ]]; then
	if [[ "${IS_REQUIRED_ENV}" == "true" ]]; then
		echo "ERROR: OPA is required in CI but was not found at ${OPA}" >&2
		exit 1
	fi
	echo "OPA=LOCAL_NOT_EXECUTED"
	echo "[diagnostic] OPA=LOCAL_NOT_EXECUTED" >&2
else
	OPA_OUTPUT="$("${OPA}" version)"
	STANDALONE_OPA_VERSION="$(
		printf '%s\n' "${OPA_OUTPUT}" \
		| sed -n 's/^Version:[[:space:]]*//p' \
		| head -n 1
	)"
	if [[ -z "${STANDALONE_OPA_VERSION}" ]]; then
		echo "ERROR: failed to parse OPA version from output:" >&2
		printf '%s\n' "${OPA_OUTPUT}" >&2
		exit 1
	fi
	if [[ "${STANDALONE_OPA_VERSION}" != "${EXPECTED_OPA_VERSION}" ]]; then
		echo "ERROR: OPA version mismatch: expected ${EXPECTED_OPA_VERSION}, got ${STANDALONE_OPA_VERSION}" >&2
		exit 1
	fi
	echo "[diagnostic] OPA_VERSION=${STANDALONE_OPA_VERSION}" >&2
fi

# ── Conftest check (diagnostics → stderr) ──────────────────
if [[ ! -x "${CONFTEST}" ]]; then
	if [[ "${IS_REQUIRED_ENV}" == "true" ]]; then
		echo "ERROR: Conftest is required in CI but was not found at ${CONFTEST}" >&2
		exit 1
	fi
	echo "CONFTEST=LOCAL_NOT_EXECUTED"
	echo "[diagnostic] CONFTEST=LOCAL_NOT_EXECUTED" >&2
else
	CONFTEST_OUTPUT="$("${CONFTEST}" --version)"
	CONFTEST_VERSION="$(
		printf '%s\n' "${CONFTEST_OUTPUT}" \
		| sed -n 's/^Conftest:[[:space:]]*//p' \
		| head -n 1
	)"
	CONFTEST_EMBEDDED_OPA_VERSION="$(
		printf '%s\n' "${CONFTEST_OUTPUT}" \
		| sed -n 's/^OPA:[[:space:]]*//p' \
		| head -n 1
	)"
	if [[ -z "${CONFTEST_VERSION}" ]]; then
		echo "ERROR: failed to parse Conftest version from output:" >&2
		printf '%s\n' "${CONFTEST_OUTPUT}" >&2
		exit 1
	fi
	if [[ -z "${CONFTEST_EMBEDDED_OPA_VERSION}" ]]; then
		echo "ERROR: failed to parse Conftest embedded OPA version from output:" >&2
		printf '%s\n' "${CONFTEST_OUTPUT}" >&2
		exit 1
	fi
	if [[ "${CONFTEST_VERSION}" != "${EXPECTED_CONFTEST_VERSION}" ]]; then
		echo "ERROR: Conftest version mismatch: expected ${EXPECTED_CONFTEST_VERSION}, got ${CONFTEST_VERSION}" >&2
		exit 1
	fi
	echo "[diagnostic] CONFTEST_VERSION=${CONFTEST_VERSION}" >&2
	echo "[diagnostic] CONFTEST_EMBEDDED_OPA_VERSION=${CONFTEST_EMBEDDED_OPA_VERSION}" >&2
fi

# ── Both missing on non-required env → early exit ──────────
if [[ ! -x "${OPA}" || ! -x "${CONFTEST}" ]]; then
	echo "POLICY_TESTS=LOCAL_NOT_EXECUTED"
	echo "[diagnostic] POLICY_TESTS=LOCAL_NOT_EXECUTED" >&2
	echo "Policy tests must run on ubuntu-latest CI."
	exit 0
fi

# ── Actual policy tests ────────────────────────────────────
echo "[diagnostic] Running opa fmt check..." >&2
"${OPA}" fmt --diff --fail "${ROOT}/policies"

echo "[diagnostic] Running opa test..." >&2
"${OPA}" test "${ROOT}/policies" --verbose

for fixture in "${ROOT}"/fixtures/gate/valid/*.json; do
	echo "[diagnostic] Conftest: asserting ${fixture} passes" >&2
	"${CONFTEST}" test "${fixture}" --policy "${ROOT}/policies" --namespace baijin.gate
done

for fixture in "${ROOT}"/fixtures/gate/denied-policy/*.json; do
	echo "[diagnostic] Conftest: asserting ${fixture} is denied" >&2
	if "${CONFTEST}" test "${fixture}" --policy "${ROOT}/policies" --namespace baijin.gate; then
		echo "ERROR: Conftest should have rejected ${fixture}" >&2
		exit 1
	fi
done

echo "OPA=PASS"
echo "CONFTEST=PASS"
echo "POLICY_TESTS=PASS"
