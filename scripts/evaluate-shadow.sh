#!/usr/bin/env bash
set -euo pipefail

# Usage: evaluate-shadow.sh <gate-input-path> <expected_result>
# expected_result: "allowed" or "denied"
#
# Uses conftest --output json with node-based JSON parsing to
# distinguish three outcomes:
#   1. actual=allowed   — policy ran, zero failures
#   2. actual=denied    — policy ran, one or more failures
#   3. tool_error       — conftest missing, output not JSON,
#                          Rego exceptions, or file not found
#
# Exit 0 when expected matches actual (both allowed or both denied).
# Exit 1 on mismatch or tool_error.

GATE_INPUT="$1"
EXPECTED="$2"
CONFTEST_BIN="${CONFTEST_BIN:-.tools/bin/conftest}"

# ── Input validation ──────────────────────────────────────────
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
  echo "TOOL_ERROR: missing gate-input file" >&2
  exit 1
fi

# ── Conftest binary check ─────────────────────────────────────
if [ ! -x "$CONFTEST_BIN" ]; then
  echo "ERROR: conftest binary not found at $CONFTEST_BIN" >&2
  echo "TOOL_ERROR: conftest binary missing" >&2
  exit 1
fi

# ── Run conftest with JSON output ─────────────────────────────
conftest_output=""
conftest_exit=0
conftest_output=$("$CONFTEST_BIN" test "$GATE_INPUT" \
  --policy policies \
  --namespace baijin.gate \
  --output json 2>&1) || conftest_exit=$?

# ── Parse JSON with node: single pass, exit code = result ─────
# node exits: 0=allowed, 1=denied, 2=unparseable, 3=not-array, 4=Rego-exception
# Use || to capture exit code without triggering set -e on non-zero
actual=""
parse_exit=0
actual=$(echo "$conftest_output" | node -e '
    const { stdin } = require("node:process");
    let raw = "";
    stdin.setEncoding("utf8");
    stdin.on("data", (chunk) => { raw += chunk; });
    stdin.on("end", () => {
      try {
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) {
          process.stderr.write("TOOL_ERROR: conftest output is not a JSON array\n");
          process.exit(3);
        }
        let failures = 0;
        let exceptions = 0;
        for (const entry of parsed) {
          if (entry.exceptions && Array.isArray(entry.exceptions)) {
            exceptions += entry.exceptions.length;
          }
          if (entry.failures && Array.isArray(entry.failures)) {
            failures += entry.failures.length;
          }
        }
        if (exceptions > 0) {
          process.stderr.write("TOOL_ERROR: Rego evaluation reported " + exceptions + " exception(s)\n");
          process.exit(4);
        }
        if (failures === 0) {
          console.log("allowed");
        } else {
          process.stderr.write("Policy denied with " + failures + " violation(s)\n");
          console.log("denied");
        }
      } catch (e) {
        process.stderr.write("TOOL_ERROR: conftest output is not valid JSON: " + e.message + "\n");
        process.exit(2);
      }
    });
  '
) || parse_exit=$?

# ── Handle tool_error exits ───────────────────────────────────
if [ "$parse_exit" -eq 2 ] || [ "$parse_exit" -eq 3 ] || [ "$parse_exit" -eq 4 ]; then
  # stderr already has the error message from node
  echo "TOOL_ERROR: policy evaluation could not complete (conftest exit=$conftest_exit, parse exit=$parse_exit)" >&2
  echo "Raw conftest output:" >&2
  echo "$conftest_output" >&2
  exit 1
fi

if [ "$parse_exit" -ne 0 ]; then
  echo "ERROR: unexpected parse exit code: $parse_exit" >&2
  echo "TOOL_ERROR: unexpected parse failure" >&2
  exit 1
fi

# actual is "allowed" or "denied" on stdout
# ── Compare expected vs actual ─────────────────────────────────
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
