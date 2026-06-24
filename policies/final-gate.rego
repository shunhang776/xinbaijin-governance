package baijin.gate

import rego.v1

default allow := false

repository_map := {
	"xinbaijin": "shunhang776/xinbaijin",
	"xinbaijin-mcp": "shunhang776/xinbaijin-mcp",
}

required_top_level := {
	"protocol",
	"repository_key",
	"repository_full_name",
	"branch",
	"candidate_commit",
	"submission_base_head",
	"candidate_reachable_from_submission_base",
	"review_commit",
	"review_commit_parent_sha",
	"review_commit_changed_files",
	"current_branch_head",
	"required_check_names",
	"required_checks",
	"review",
	"readback",
	"repair_round",
}

required_review_fields := {
	"protocol",
	"repository",
	"branch",
	"reviewed_commit",
	"based_on_branch_head",
	"verdict",
	"summary",
	"findings",
	"reviewer",
	"reviewed_at",
}

required_readback_fields := {
	"protocol",
	"repository",
	"ref",
	"path",
	"encoding",
	"github_blob_sha",
	"sha256",
	"byte_length",
	"has_trailing_newline",
	"line_ending",
	"content",
	"parsed_review",
	"integrity_verified",
}

missing_top_level contains field if {
	field := required_top_level[_]
	object.get(input, field, "__missing__") == "__missing__"
}

missing_review_field contains field if {
	review := object.get(input, "review", {})
	field := required_review_fields[_]
	object.get(review, field, "__missing__") == "__missing__"
}

missing_readback_field contains field if {
	readback := object.get(input, "readback", {})
	field := required_readback_fields[_]
	object.get(readback, field, "__missing__") == "__missing__"
}

deny contains sprintf("missing top-level field: %s", [field]) if {
	field := missing_top_level[_]
}

deny contains sprintf("missing review field: %s", [field]) if {
	field := missing_review_field[_]
}

deny contains sprintf("missing readback field: %s", [field]) if {
	field := missing_readback_field[_]
}

deny contains "unknown repository key" if {
	object.get(repository_map, input.repository_key, "__missing__") == "__missing__"
}

deny contains "repository key/full-name mapping mismatch" if {
	expected := repository_map[input.repository_key]
	input.repository_full_name != expected
}

deny contains "branch must be dev" if {
	input.branch != "dev"
}

deny contains "candidate commit is not reachable from submission base" if {
	input.candidate_reachable_from_submission_base != true
}

deny contains "review commit parent does not equal captured submission base" if {
	input.review_commit_parent_sha != input.submission_base_head
}

deny contains "review commit changed files are not exactly review.json" if {
	input.review_commit_changed_files != ["review.json"]
}

deny contains "branch head drifted after review publication" if {
	input.current_branch_head != input.review_commit
}

deny contains "review repository mismatch" if {
	input.review.repository != input.repository_full_name
}

deny contains "review branch mismatch" if {
	input.review.branch != input.branch
}

deny contains "reviewed_commit mismatch" if {
	input.review.reviewed_commit != input.candidate_commit
}

deny contains "based_on_branch_head mismatch" if {
	input.review.based_on_branch_head != input.submission_base_head
}

deny contains "review verdict is not approved" if {
	input.review.verdict != "approved"
}

deny contains sprintf("approved review contains blocking finding: %s", [finding.severity]) if {
	some finding in input.review.findings
	finding.severity in {"critical", "high", "medium"}
}

deny contains "readback repository mismatch" if {
	input.readback.repository != input.repository_full_name
}

deny contains "readback ref is not the review commit" if {
	input.readback.ref != input.review_commit
}

deny contains "readback path is not review.json" if {
	input.readback.path != "review.json"
}

deny contains "readback encoding is not utf-8" if {
	input.readback.encoding != "utf-8"
}

deny contains "readback line ending is not LF" if {
	input.readback.line_ending != "lf"
}

deny contains "readback file lacks trailing newline" if {
	input.readback.has_trailing_newline != true
}

deny contains "readback integrity was not independently verified" if {
	input.readback.integrity_verified != true
}

deny contains "readback parsed review differs from submitted review" if {
	input.readback.parsed_review != input.review
}

deny contains "repair round out of valid range" if {
	input.repair_round < 0
}

deny contains "repair round exceeds limit" if {
	input.repair_round > 2
}

matching_checks(name) := [check |
	some check in input.required_checks
	check.name == name
	check.commit_sha == input.candidate_commit
]

deny contains sprintf("required check count must be exactly one: %s", [name]) if {
	some name in input.required_check_names
	count(matching_checks(name)) != 1
}

deny contains sprintf("required check is not completed: %s", [name]) if {
	some name in input.required_check_names
	checks := matching_checks(name)
	count(checks) == 1
	checks[0].status != "completed"
}

deny contains sprintf("required check did not succeed: %s", [name]) if {
	some name in input.required_check_names
	checks := matching_checks(name)
	count(checks) == 1
	checks[0].conclusion != "success"
}

allow if {
	count(deny) == 0
}
