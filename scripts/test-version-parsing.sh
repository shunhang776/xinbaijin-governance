#!/usr/bin/env bash
# Regression tests for OPA/Conftest version parsing.
# These test the sed-based parsing functions in isolation.
set -euo pipefail

PASS=0
FAIL=0

assert_eq() {
  local label="$1" expected="$2" actual="$3"
  if [[ "${actual}" == "${expected}" ]]; then
    echo "PASS: ${label}"
    PASS=$((PASS + 1))
  else
    echo "FAIL: ${label} — expected '${expected}', got '${actual}'" >&2
    FAIL=$((FAIL + 1))
  fi
}

assert_not_eq() {
  local label="$1" unexpected="$2" actual="$3"
  if [[ "${actual}" != "${unexpected}" ]]; then
    echo "PASS: ${label}"
    PASS=$((PASS + 1))
  else
    echo "FAIL: ${label} — should not equal '${unexpected}'" >&2
    FAIL=$((FAIL + 1))
  fi
}

parse_opa_version() {
  printf '%s\n' "$1" | sed -n 's/^Version:[[:space:]]*//p' | head -n 1
}

parse_conftest_version() {
  printf '%s\n' "$1" | sed -n 's/^Conftest:[[:space:]]*//p' | head -n 1
}

parse_conftest_embedded_opa() {
  printf '%s\n' "$1" | sed -n 's/^OPA:[[:space:]]*//p' | head -n 1
}

# ── Test 1: OPA version parsing ────────────────────────────
OPA_OUTPUT="Version: 1.17.1"
assert_eq "parse standalone OPA version" "1.17.1" "$(parse_opa_version "${OPA_OUTPUT}")"

OPA_OUTPUT_MULTI="Some prefix
Version: 1.17.1
Some suffix"
assert_eq "parse OPA version from multi-line" "1.17.1" "$(parse_opa_version "${OPA_OUTPUT_MULTI}")"

# ── Test 2: Conftest two-line output ───────────────────────
CONFTEST_OUTPUT="Conftest: 0.68.2
OPA: 1.15.2"
assert_eq "parse Conftest version from two-line output" "0.68.2" "$(parse_conftest_version "${CONFTEST_OUTPUT}")"
assert_eq "parse Conftest embedded OPA version" "1.15.2" "$(parse_conftest_embedded_opa "${CONFTEST_OUTPUT}")"

# ── Test 3: Embedded OPA ≠ standalone OPA is NOT an error ──
assert_not_eq "embedded OPA does not equal hypothetical standalone OPA" "1.17.1" "$(parse_conftest_embedded_opa "${CONFTEST_OUTPUT}")"

# ── Test 4: Different versions are detected as different ────
CONFTEST_WRONG="Conftest: 0.99.0
OPA: 1.15.2"
assert_eq "detect wrong Conftest version" "0.99.0" "$(parse_conftest_version "${CONFTEST_WRONG}")"
assert_not_eq "wrong Conftest does not match expected" "0.68.2" "$(parse_conftest_version "${CONFTEST_WRONG}")"

# ── Test 5: Missing fields produce empty output ─────────────
CONFTEST_NO_OPA="Conftest: 0.68.2"
assert_eq "missing embedded OPA yields empty" "" "$(parse_conftest_embedded_opa "${CONFTEST_NO_OPA}")"

CONFTEST_NO_SELF="OPA: 1.15.2"
assert_eq "missing Conftest self-version yields empty" "" "$(parse_conftest_version "${CONFTEST_NO_SELF}")"

# ── Test 6: Empty input ────────────────────────────────────
assert_eq "empty OPA input yields empty" "" "$(parse_opa_version "")"
assert_eq "empty Conftest input yields empty" "" "$(parse_conftest_version "")"
assert_eq "empty Conftest embedded yields empty" "" "$(parse_conftest_embedded_opa "")"

# ── Test 7: Version with leading whitespace ─────────────────
OPA_WS="Version:  1.17.1"
assert_eq "OPA version with extra whitespace" "1.17.1" "$(parse_opa_version "${OPA_WS}")"

CONFTEST_WS="Conftest:  0.68.2
OPA:  1.15.2"
assert_eq "Conftest version with extra whitespace" "0.68.2" "$(parse_conftest_version "${CONFTEST_WS}")"
assert_eq "Conftest embedded OPA with extra whitespace" "1.15.2" "$(parse_conftest_embedded_opa "${CONFTEST_WS}")"

# ── Summary ────────────────────────────────────────────────
echo ""
echo "---"
echo "Version parsing tests: ${PASS} passed, ${FAIL} failed"
if [[ ${FAIL} -gt 0 ]]; then
  exit 1
fi
echo "VERSION_PARSING_TESTS=PASS"
