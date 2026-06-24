package baijin.gate_test

import rego.v1
import data.baijin.gate

base_review := {
  "protocol": "xinbaijin-review/1.0",
  "repository": "shunhang776/xinbaijin-mcp",
  "branch": "dev",
  "reviewed_commit": "1111111111111111111111111111111111111111",
  "based_on_branch_head": "2222222222222222222222222222222222222222",
  "verdict": "approved",
  "summary": "ok",
  "findings": [],
  "reviewer": "ChatGPT",
  "reviewed_at": "2026-06-24T12:00:00.000Z",
}

base_input := {
  "protocol": "xinbaijin-gate-input/1.0",
  "repository_key": "xinbaijin-mcp",
  "repository_full_name": "shunhang776/xinbaijin-mcp",
  "branch": "dev",
  "candidate_commit": "1111111111111111111111111111111111111111",
  "submission_base_head": "2222222222222222222222222222222222222222",
  "candidate_reachable_from_submission_base": true,
  "review_commit": "3333333333333333333333333333333333333333",
  "review_commit_parent_sha": "2222222222222222222222222222222222222222",
  "review_commit_changed_files": ["review.json"],
  "current_branch_head": "3333333333333333333333333333333333333333",
  "required_check_names": ["baijin/build-test"],
  "required_checks": [{
    "name": "baijin/build-test",
    "commit_sha": "1111111111111111111111111111111111111111",
    "status": "completed",
    "conclusion": "success",
  }],
  "review": base_review,
  "readback": {
    "protocol": "xinbaijin-file/1.0",
    "repository": "shunhang776/xinbaijin-mcp",
    "ref": "3333333333333333333333333333333333333333",
    "path": "review.json",
    "encoding": "utf-8",
    "github_blob_sha": "4444444444444444444444444444444444444444",
    "sha256": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    "byte_length": 1,
    "has_trailing_newline": true,
    "line_ending": "lf",
    "content": "x",
    "parsed_review": base_review,
    "integrity_verified": true,
  },
  "repair_round": 0,
}

test_valid_input_is_allowed if {
  gate.allow with input as base_input
}

test_branch_drift_is_denied if {
  mutated := object.union(base_input, {"current_branch_head": "5555555555555555555555555555555555555555"})
  not gate.allow with input as mutated
}

test_stale_review_is_denied if {
  stale_review := object.union(base_review, {"reviewed_commit": "5555555555555555555555555555555555555555"})
  mutated := object.union(base_input, {"review": stale_review})
  not gate.allow with input as mutated
}

test_failed_check_is_denied if {
  failed := [{
    "name": "baijin/build-test",
    "commit_sha": "1111111111111111111111111111111111111111",
    "status": "completed",
    "conclusion": "failure",
  }]
  mutated := object.union(base_input, {"required_checks": failed})
  not gate.allow with input as mutated
}

test_blocking_finding_is_denied if {
  finding := {
    "severity": "high",
    "file": "worker.js",
    "line": 1,
    "title": "risk",
    "description": "risk",
    "recommendation": "fix",
  }
  review := object.union(base_review, {"findings": [finding]})
  readback := object.union(base_input.readback, {"parsed_review": review})
  mutated := object.union(base_input, {"review": review, "readback": readback})
  not gate.allow with input as mutated
}

test_missing_top_level_field_is_denied if {
  mutated := object.remove(base_input, ["review_commit"])
  not gate.allow with input as mutated
}
