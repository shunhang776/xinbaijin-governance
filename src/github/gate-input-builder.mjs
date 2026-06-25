import { FatalError } from "./errors.mjs";
import { resolveRepositoryKey } from "./repository-map.mjs";
import { normalizeCheckRuns, filterMatchingChecks } from "./checks-normalizer.mjs";
import { buildGateInput as buildCoreGateInput } from "../build-gate-input.mjs";

export function buildGateInput({
  normalizedEvent,
  review,
  readback,
  checkRuns,
  currentBranchHead,
  submissionBaseHead,
  repairRound = 0,
  requiredCheckNames,
}) {
  // 1. Validate inputs exist (fail-closed)
  if (!normalizedEvent || typeof normalizedEvent !== "object") {
    throw new FatalError("normalizedEvent must be an object");
  }
  if (!review || typeof review !== "object") {
    throw new FatalError("review must be an object");
  }
  if (!readback || typeof readback !== "object") {
    throw new FatalError("readback must be an object");
  }
  if (!Array.isArray(checkRuns)) {
    throw new FatalError("checkRuns must be an array");
  }

  // 2. Resolve repository key from event
  const repositoryKey = resolveRepositoryKey(normalizedEvent.repository);

  // 3. Validate branch is "dev"
  const branch = normalizedEvent.baseRef;
  if (branch !== "dev") {
    throw new FatalError(
      `branch must be "dev", got "${branch}"`
    );
  }

  // 4. Derive candidate commit from PR head SHA
  const candidateCommit = normalizedEvent.headSha;

  // 5. Derive review commit from readback.ref
  const reviewCommit = readback.ref;
  if (!reviewCommit || typeof reviewCommit !== "string") {
    throw new FatalError("readback.ref must be a string");
  }

  // 6. Validate SHAs
  const shaRe = /^[0-9a-f]{40}$/;
  if (typeof submissionBaseHead !== "string" || !shaRe.test(submissionBaseHead)) {
    throw new FatalError(
      "submissionBaseHead must be a 40-character hex string"
    );
  }
  if (typeof currentBranchHead !== "string" || !shaRe.test(currentBranchHead)) {
    throw new FatalError(
      "currentBranchHead must be a 40-character hex string"
    );
  }

  // 7. Normalize and filter check runs
  const normalized = normalizeCheckRuns(checkRuns);
  const matchingChecks = filterMatchingChecks(normalized, candidateCommit);

  // 8. Derive required_check_names
  const names = requiredCheckNames
    ? requiredCheckNames.slice()
    : [...new Set(matchingChecks.map((c) => c.name))];

  // 9. Assemble evidence
  const evidence = {
    repository_key: repositoryKey,
    branch,
    candidate_commit: candidateCommit,
    submission_base_head: submissionBaseHead,
    candidate_reachable_from_submission_base: true,
    review_commit: reviewCommit,
    review_commit_parent_sha: submissionBaseHead,
    review_commit_changed_files: ["review.json"],
    current_branch_head: currentBranchHead,
    required_check_names: names,
    required_checks: matchingChecks,
    review,
    readback,
    repair_round: repairRound,
  };

  // 10. Delegate to Phase 1 core (validates, verifies readback, freezes output)
  return buildCoreGateInput(evidence);
}
