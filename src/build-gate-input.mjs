import { verifyReadbackIntegrity } from "./readback-integrity.mjs";

export const REPOSITORY_MAP = Object.freeze(
  Object.assign(Object.create(null), {
    xinbaijin: "shunhang776/xinbaijin",
    "xinbaijin-mcp": "shunhang776/xinbaijin-mcp"
  })
);

export function buildGateInput(evidence) {
  if (!evidence || typeof evidence !== "object" || Array.isArray(evidence)) {
    throw new TypeError("evidence must be an object");
  }
  if (!Object.hasOwn(REPOSITORY_MAP, evidence.repository_key)) {
    throw new Error(`Unknown repository key: ${String(evidence.repository_key)}`);
  }
  const repositoryFullName = REPOSITORY_MAP[evidence.repository_key];

  const verifiedReadback = verifyReadbackIntegrity({
    readback: evidence.readback,
    expectedReview: evidence.review,
    expectedRepository: repositoryFullName,
    reviewCommit: evidence.review_commit
  });

  return Object.freeze({
    protocol: "xinbaijin-gate-input/1.0",
    repository_key: evidence.repository_key,
    repository_full_name: repositoryFullName,
    branch: evidence.branch,
    candidate_commit: evidence.candidate_commit,
    submission_base_head: evidence.submission_base_head,
    candidate_reachable_from_submission_base: evidence.candidate_reachable_from_submission_base,
    review_commit: evidence.review_commit,
    review_commit_parent_sha: evidence.review_commit_parent_sha,
    review_commit_changed_files: [...evidence.review_commit_changed_files],
    current_branch_head: evidence.current_branch_head,
    required_check_names: [...evidence.required_check_names],
    required_checks: evidence.required_checks.map((check) => ({ ...check })),
    review: structuredClone(evidence.review),
    readback: verifiedReadback,
    repair_round: evidence.repair_round
  });
}
