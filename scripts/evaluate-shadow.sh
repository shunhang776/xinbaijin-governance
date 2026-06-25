#!/usr/bin/env bash
set -euo pipefail

# Usage: evaluate-shadow.sh <gate-input-path> <expected_result>
# expected_result: "allowed" or "denied"
# Exit 0 on expected match, Exit 1 on mismatch or tool failure.

GATE_INPUT="$1"
EXPECTED="$2"

# --- Input validation ---
if [ $# -ne 2 ]; then
  echo "ERROR: usage: evaluate-shadow.sh <gate-input-path> <allowed|denied>" >&2
  exit 1
fi

if [ "$EXPECTED" != "allowed" ] && [ "$EXPECTED" != "denied" ]; then
  echo "ERROR: expected_policy_result must be 'allowed' or 'denied', got '$EXPECTED'" >&2
  exit 1
fi

if [ ! -f "$GATE_INPUT" ]; then
  echo "ERROR: gate-input file not found: $GATE_INPUT" >&2
  exit 1
fi

# --- Tool presence check ---
TOOLS_DIR=".tools/bin"
if [ ! -x "${TOOLS_DIR}/conftest" ]; then
  echo "ERROR: conftest binary not found at ${TOOLS_DIR}/conftest. Run 'npm run tools:install' first." >&2
  exit 1
fi

# --- Run conftest ---
# Capture exit code without masking tool failures.
# conftest exits 0 when ALL tests pass (no deny rules matched = policy allows).
# conftest exits non-zero when ANY test fails (a deny rule matched = policy denies).
conftest_exit=0
"${TOOLS_DIR}/conftest" test "$GATE_INPUT" \
  --policy policies \
  --namespace baijin.gate \
  > /dev/null 2>&1 || conftest_exit=$?

# --- Determine actual policy result ---
actual="allowed"
if [ "$conftest_exit" -eq 0 ]; then
  actual="allowed"
else
  actual="denied"
fi

# --- Compare expected vs actual ---
if [ "$EXPECTED" = "denied" ] && [ "$actual" = "denied" ]; then
  echo "SHADOW_POLICY_RESULT=DENIED_EXPECTED"
  if [ -n "${GITHUB_OUTPUT:-}" ]; then
    echo "result=DENIED_EXPECTED" >> "$GITHUB_OUTPUT"
  fi
  exit 0
elif [ "$EXPECTED" = "allowed" ] && [ "$actual" = "allowed" ]; then
  echo "SHADOW_POLICY_RESULT=ALLOWED_EXPECTED"
  if [ -n "${GITHUB_OUTPUT:-}" ]; then
    echo "result=ALLOWED_EXPECTED" >> "$GITHUB_OUTPUT"
  fi
  exit 0
elif [ "$EXPECTED" = "denied" ] && [ "$actual" = "allowed" ]; then
  echo "ERROR: expected OPA to deny but policy evaluation passed (no violations found)." >&2
  echo "This means an input that should have been blocked was allowed — possible regression." >&2
  exit 1
elif [ "$EXPECTED" = "allowed" ] && [ "$actual" = "denied" ]; then
  echo "ERROR: expected OPA to allow but policy evaluation denied." >&2
  echo "This means a valid input was rejected — possible policy or evidence mismatch." >&2
  exit 1
else
  echo "ERROR: unreachable evaluation state (expected=$EXPECTED actual=$actual)" >&2
  exit 1
fi
