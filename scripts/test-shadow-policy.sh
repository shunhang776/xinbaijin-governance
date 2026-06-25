#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
EVALUATE="${SCRIPT_DIR}/evaluate-shadow.sh"
cd "$REPO_ROOT"

PASS_COUNT=0
FAIL_COUNT=0
TMPDIR="${TMPDIR:-/tmp}"

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

assert_stdout() {
  local desc="$1" pattern="$2"
  shift 2
  local stdout
  stdout=$("$@" 2>/dev/null) || true
  if echo "$stdout" | grep -q "$pattern"; then
    pass "$desc"
  else
    fail "$desc (pattern '$pattern' not found in output: $stdout)"
  fi
}

cleanup() {
  rm -rf "$MOCK_DIR" 2>/dev/null || true
}
trap cleanup EXIT

MOCK_DIR=$(mktemp -d "$TMPDIR/shadow-test-XXXXXX")
export CONFTEST_BIN="${MOCK_DIR}/conftest"

# ── Helpers for policy-accepted and policy-denied JSON ─────────
ACCEPTED_JSON='[{"filename":"test.json","namespace":"baijin.gate","successes":1,"failures":[],"warnings":[],"exceptions":[]}]'
DENIED_JSON='[{"filename":"test.json","namespace":"baijin.gate","successes":0,"failures":[{"msg":"deny message"}],"warnings":[],"exceptions":[]}]'
EXCEPTION_JSON='[{"filename":"test.json","namespace":"baijin.gate","successes":0,"failures":[],"warnings":[],"exceptions":[{"message":"rego eval error"}]}]'

# ── Mock conftest that echoes the given JSON to stdout ────────
make_mock() {
  local json="$1"
  cat > "$MOCK_DIR/conftest" <<SCRIPTEOF
#!/usr/bin/env bash
echo '$json'
SCRIPTEOF
  chmod +x "$MOCK_DIR/conftest"
}

make_mock_raw() {
  local content="$1"
  cat > "$MOCK_DIR/conftest" <<SCRIPTEOF
#!/usr/bin/env bash
$content
SCRIPTEOF
  chmod +x "$MOCK_DIR/conftest"
}

echo "=== Shadow Policy Tests ==="
echo ""

# ═══════════════════════════════════════════════════════════════
# Tests 1-4: Core expected-vs-actual comparison
# ═══════════════════════════════════════════════════════════════
echo "--- Core comparison tests ---"

# 1: expected=denied + actual=denied → success
make_mock "$DENIED_JSON"
echo "[1] expected=denied, actual=denied -> exit 0"
assert_exit "denied matches denied" 0 \
  bash "$EVALUATE" "fixtures/gate/denied-policy/not-approved.json" "denied"

# 2: expected=denied + actual=allowed → failure
make_mock "$ACCEPTED_JSON"
echo "[2] expected=denied, actual=allowed -> exit 1"
assert_exit "denied does not match allowed" 1 \
  bash "$EVALUATE" "fixtures/gate/valid/approved.json" "denied"

# 3: expected=allowed + actual=allowed → success
make_mock "$ACCEPTED_JSON"
echo "[3] expected=allowed, actual=allowed -> exit 0"
assert_stdout "allowed matches allowed" "ALLOWED_EXPECTED" \
  bash "$EVALUATE" "fixtures/gate/valid/approved.json" "allowed"

# 4: expected=allowed + actual=denied → failure
make_mock "$DENIED_JSON"
echo "[4] expected=allowed, actual=denied -> exit 1"
assert_exit "allowed does not match denied" 1 \
  bash "$EVALUATE" "fixtures/gate/denied-policy/not-approved.json" "allowed"

# ═══════════════════════════════════════════════════════════════
# Tests 5-8: Tool error scenarios (must NOT be treated as denied)
# ═══════════════════════════════════════════════════════════════
echo "--- Tool error tests ---"

# 5: Conftest binary missing → tool_error, NOT denied
echo "[5] conftest binary missing -> tool_error (exit 1)"
rm -f "$MOCK_DIR/conftest"
unset CONFTEST_BIN
assert_exit "missing conftest is tool_error" 1 \
  bash "$EVALUATE" "fixtures/gate/valid/approved.json" "denied"
export CONFTEST_BIN="${MOCK_DIR}/conftest"

# 6: Conftest outputs invalid JSON → tool_error, NOT denied
make_mock_raw 'echo "this is not json at all {{{"'
echo "[6] invalid conftest JSON -> tool_error (exit 1)"
assert_exit "unparseable JSON is tool_error" 1 \
  bash "$EVALUATE" "fixtures/gate/valid/approved.json" "denied"

# 7: Conftest outputs Rego exceptions → tool_error, NOT denied
make_mock "$EXCEPTION_JSON"
echo "[7] Rego exceptions -> tool_error (exit 1)"
assert_exit "Rego exception is tool_error" 1 \
  bash "$EVALUATE" "fixtures/gate/denied-policy/not-approved.json" "denied"

# 8: Missing gate-input file → tool_error, NOT denied
make_mock "$ACCEPTED_JSON"
echo "[8] missing gate-input file -> tool_error (exit 1)"
assert_exit "missing file is tool_error" 1 \
  bash "$EVALUATE" "/nonexistent/path/gate-input.json" "denied"

# ═══════════════════════════════════════════════════════════════
# Tests 9-13: Input validation + static checks
# ═══════════════════════════════════════════════════════════════
echo "--- Input validation + static checks ---"

# 9: Missing expected argument
make_mock "$ACCEPTED_JSON"
echo "[9] only one argument -> exit 1"
assert_exit "missing expected arg" 1 \
  bash "$EVALUATE" "fixtures/gate/valid/approved.json"

# 10: Invalid expected value
echo "[10] invalid expected='bogus' -> exit 1"
assert_exit "invalid expected value" 1 \
  bash "$EVALUATE" "fixtures/gate/valid/approved.json" "bogus"

# 11: No executable '|| true' in evaluate script
echo "[11] no executable '|| true' in evaluate-shadow.sh"
if grep -nE '^\s*[^#]*\|\|[[:space:]]*true' "$EVALUATE" > /dev/null 2>&1; then
  fail "executable || true found in evaluate-shadow.sh"
  grep -nE '^\s*[^#]*\|\|[[:space:]]*true' "$EVALUATE"
else
  pass "no executable || true in evaluate-shadow.sh"
fi

# 12: No continue-on-error in shadow workflow
echo "[12] no 'continue-on-error' in shadow workflow"
WORKFLOW="${REPO_ROOT}/.github/workflows/reusable-final-gate-shadow.yml"
if grep -in 'continue-on-error[[:space:]]*:[[:space:]]*true' "$WORKFLOW" > /dev/null 2>&1; then
  fail "continue-on-error: true found in shadow workflow"
else
  pass "no continue-on-error: true in shadow workflow"
fi

# 13: Production final-gate not modified
echo "[13] reusable-final-gate.yml not modified"
PROD_GATE="${REPO_ROOT}/.github/workflows/reusable-final-gate.yml"
if git diff --name-only HEAD -- "$PROD_GATE" | grep -q '.'; then
  fail "reusable-final-gate.yml was modified"
else
  pass "reusable-final-gate.yml unchanged"
fi

# ═══════════════════════════════════════════════════════════════
# Real conftest tests (if available on this platform)
# ═══════════════════════════════════════════════════════════════
echo "--- Real conftest tests ---"
unset CONFTEST_BIN
if [ -x ".tools/bin/conftest" ] && .tools/bin/conftest --version > /dev/null 2>&1; then
  echo "conftest: available — running real policy evaluation tests"

  # 14: Real conftest with denied fixture (should produce failures > 0)
  echo "[14] real conftest: denied fixture -> actual=denied"
  assert_exit "expected denied + real deny = success" 0 \
    bash "$EVALUATE" "fixtures/gate/denied-policy/not-approved.json" "denied"

  # 15: Real conftest with allowed fixture (should produce zero failures)
  echo "[15] real conftest: allowed fixture -> actual=allowed"
  assert_exit "expected allowed + real allow = success" 0 \
    bash "$EVALUATE" "fixtures/gate/valid/approved.json" "allowed"
else
  echo "conftest: not available on this platform — skipping real policy tests [14-15]"
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
