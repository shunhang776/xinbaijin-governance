#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
EVALUATE="${SCRIPT_DIR}/evaluate-shadow.sh"
cd "$REPO_ROOT"

PASS_COUNT=0
FAIL_COUNT=0

pass() {
  echo "  PASS: $1"
  PASS_COUNT=$((PASS_COUNT + 1))
}

fail() {
  echo "  FAIL: $1" >&2
  FAIL_COUNT=$((FAIL_COUNT + 1))
}

assert_exit() {
  local desc="$1" expected_exit="$2"
  shift 2
  local actual_exit=0
  "$@" > /dev/null 2>&1 || actual_exit=$?
  if [ "$actual_exit" -eq "$expected_exit" ]; then
    pass "$desc (exit $actual_exit)"
  else
    fail "$desc (expected exit $expected_exit, got $actual_exit)"
  fi
}

echo "=== Shadow Policy Tests ==="
echo ""

# --- Detect conftest availability ---
HAVE_CONFTEST=false
if [ -x ".tools/bin/conftest" ]; then
  if .tools/bin/conftest --version > /dev/null 2>&1; then
    HAVE_CONFTEST=true
  fi
fi

if $HAVE_CONFTEST; then
  echo "conftest: found — running policy comparison tests"

  # 1: expected=denied + policy denied → success
  echo "[1] expected=denied, actual=denied -> exit 0"
  assert_exit "not-approved.json with expected=denied" 0 \
    bash "$EVALUATE" "fixtures/gate/denied-policy/not-approved.json" "denied"

  # 2: expected=denied + policy allowed → failure
  echo "[2] expected=denied, actual=allowed -> exit 1"
  assert_exit "approved.json with expected=denied" 1 \
    bash "$EVALUATE" "fixtures/gate/valid/approved.json" "denied"

  # 3: expected=allowed + policy allowed → success
  echo "[3] expected=allowed, actual=allowed -> exit 0"
  assert_exit "approved.json with expected=allowed" 0 \
    bash "$EVALUATE" "fixtures/gate/valid/approved.json" "allowed"

  # 4: expected=allowed + policy denied → failure
  echo "[4] expected=allowed, actual=denied -> exit 1"
  assert_exit "not-approved.json with expected=allowed" 1 \
    bash "$EVALUATE" "fixtures/gate/denied-policy/not-approved.json" "allowed"
else
  echo "conftest: not available on this platform"
  echo "  Skipping policy comparison tests [1-4]"
  echo "  (will run in GitHub Actions CI on ubuntu-latest)"
fi

# 5: missing gate-input file → failure
echo "[5] missing gate-input file -> exit 1"
assert_exit "nonexistent file" 1 \
  bash "$EVALUATE" "/nonexistent/path/gate-input.json" "denied"

# 6: missing required argument → failure
echo "[6] only one argument -> exit 1"
assert_exit "only one argument" 1 \
  bash "$EVALUATE" "fixtures/gate/valid/approved.json"

# 7: invalid expected value → failure
echo "[7] invalid expected='bogus' -> exit 1"
assert_exit "invalid expected value" 1 \
  bash "$EVALUATE" "fixtures/gate/valid/approved.json" "bogus"

# 8: no executable '|| true' in evaluate-shadow.sh
echo "[8] no executable '|| true' in evaluate-shadow.sh"
if grep -nE '^\s*[^#]*\|\|[[:space:]]*true[[:space:]]*$' "$EVALUATE" > /dev/null 2>&1; then
  fail "executable || true found in evaluate-shadow.sh"
  grep -nE '^\s*[^#]*\|\|[[:space:]]*true' "$EVALUATE"
elif grep -nE '^\s*[^#]*\|\|[[:space:]]*true' "$EVALUATE" > /dev/null 2>&1; then
  fail "executable || true found in evaluate-shadow.sh"
  grep -nE '^\s*[^#]*\|\|[[:space:]]*true' "$EVALUATE"
else
  pass "no executable || true in evaluate-shadow.sh"
fi

# 9: no 'continue-on-error: true' in shadow workflow
echo "[9] no 'continue-on-error' in reusable-final-gate-shadow.yml"
WORKFLOW="${REPO_ROOT}/.github/workflows/reusable-final-gate-shadow.yml"
if [ -f "$WORKFLOW" ]; then
  if grep -in 'continue-on-error[[:space:]]*:[[:space:]]*true' "$WORKFLOW" > /dev/null 2>&1; then
    fail "continue-on-error: true found in shadow workflow"
    grep -in 'continue-on-error[[:space:]]*:[[:space:]]*true' "$WORKFLOW"
  else
    pass "no continue-on-error: true in shadow workflow"
  fi
else
  echo "  SKIP: workflow file not found at $WORKFLOW"
fi

# Summary
echo ""
echo "=== Results ==="
echo "Passed: $PASS_COUNT"
echo "Failed: $FAIL_COUNT"

if [ "$FAIL_COUNT" -gt 0 ]; then
  exit 1
fi
exit 0
