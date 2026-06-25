import { FatalError } from "./errors.mjs";

const SHA1_RE = /^[0-9a-f]{40}$/;

const VALID_STATUSES = new Set([
  "queued",
  "in_progress",
  "completed",
  "pending",
]);

const VALID_CONCLUSIONS = new Set([
  "success",
  "failure",
  "cancelled",
  "timed_out",
  "action_required",
  "neutral",
  "skipped",
  "startup_failure",
  "stale",
]);

const CHECK_PROPS = Object.freeze(["name", "commit_sha", "status", "conclusion"]);

function validateCheck(check, index) {
  if (!check || typeof check !== "object" || Array.isArray(check)) {
    throw new FatalError(`checkRuns[${index}] must be an object`);
  }

  if (typeof check.name !== "string" || !check.name) {
    throw new FatalError(
      `checkRuns[${index}] is missing a valid "name" field`
    );
  }

  if (typeof check.commit_sha !== "string" || !SHA1_RE.test(check.commit_sha)) {
    throw new FatalError(
      `checkRuns[${index}].commit_sha must be a 40-character hex string`
    );
  }

  if (!VALID_STATUSES.has(check.status)) {
    throw new FatalError(
      `checkRuns[${index}].status "${check.status}" is not a valid GitHub check status`
    );
  }

  if (
    check.conclusion !== null &&
    check.conclusion !== undefined &&
    (!VALID_CONCLUSIONS.has(check.conclusion) || typeof check.conclusion !== "string")
  ) {
    throw new FatalError(
      `checkRuns[${index}].conclusion "${check.conclusion}" is not a valid GitHub check conclusion`
    );
  }
}

export function normalizeCheckRuns(rawChecks) {
  if (!Array.isArray(rawChecks)) {
    throw new FatalError("checkRuns must be an array");
  }

  const normalized = [];
  for (let i = 0; i < rawChecks.length; i++) {
    validateCheck(rawChecks[i], i);

    const entry = {};
    for (const prop of CHECK_PROPS) {
      entry[prop] = rawChecks[i][prop];
    }

    normalized.push(Object.freeze(entry));
  }

  return Object.freeze(normalized);
}

export function filterMatchingChecks(checkRuns, candidateCommit) {
  if (!Array.isArray(checkRuns)) {
    throw new FatalError("checkRuns must be an array");
  }
  if (typeof candidateCommit !== "string" || !candidateCommit) {
    throw new FatalError("candidateCommit must be a non-empty string");
  }

  return checkRuns.filter(
    (check) => check.commit_sha === candidateCommit
  );
}
