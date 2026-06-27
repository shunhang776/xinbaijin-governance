import { buildGateProductionDecision } from './production-decision.mjs';

function requireObject(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(name + ' must be an object');
  }

  return value;
}

function requireNonEmptyString(value, name) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(name + ' must be a non-empty string');
  }

  return value;
}

function requireCommitSha(value, name) {
  requireNonEmptyString(value, name);

  if (!/^[0-9a-f]{40}$/.test(value)) {
    throw new Error(name + ' must be a lowercase 40-char commit sha');
  }

  return value;
}

function hasMachineEvent(l4RunResult, eventType) {
  return Array.isArray(l4RunResult.machine_events) && l4RunResult.machine_events.includes(eventType);
}

function inferBranchHeadUnchanged(l4RunResult, options) {
  if (Object.prototype.hasOwnProperty.call(options, 'branch_head_unchanged')) {
    return options.branch_head_unchanged === true;
  }

  return !hasMachineEvent(l4RunResult, 'BRANCH_HEAD_CHANGED');
}

function inferNoStaleReview(l4RunResult, options) {
  if (Object.prototype.hasOwnProperty.call(options, 'no_stale_review')) {
    return options.no_stale_review === true;
  }

  return !hasMachineEvent(l4RunResult, 'STALE_REVIEW_DETECTED');
}

function inferNoRepairGuardBlock(l4RunResult, options) {
  if (Object.prototype.hasOwnProperty.call(options, 'no_repair_guard_block')) {
    return options.no_repair_guard_block === true;
  }

  return (
    !hasMachineEvent(l4RunResult, 'REPAIR_ROUND_EXCEEDED') &&
    !hasMachineEvent(l4RunResult, 'REPEATED_FINDING_DETECTED')
  );
}

function inferChecksPassed(l4RunResult, options) {
  if (Object.prototype.hasOwnProperty.call(options, 'checks_passed')) {
    return options.checks_passed === true;
  }

  return hasMachineEvent(l4RunResult, 'CHECKS_PASSED');
}

export function adaptL4AndChatGptReviewToGateDecision(input, options = {}) {
  requireObject(input, 'input');

  const l4RunResult = requireObject(input.l4_run_result, 'l4_run_result');
  const chatgptReviewResult = requireObject(input.chatgpt_review_result, 'chatgpt_review_result');

  if (chatgptReviewResult.protocol !== 'baijin-chatgpt-review-result/1.0') {
    throw new Error('chatgpt_review_result protocol must be baijin-chatgpt-review-result/1.0');
  }

  if (l4RunResult.repository !== chatgptReviewResult.repository) {
    throw new Error('repository mismatch between l4_run_result and chatgpt_review_result');
  }

  if (l4RunResult.branch !== chatgptReviewResult.branch) {
    throw new Error('branch mismatch between l4_run_result and chatgpt_review_result');
  }

  const candidateCommit = requireCommitSha(
    options.candidate_commit || chatgptReviewResult.reviewed_commit,
    'candidate_commit'
  );

  if (candidateCommit !== chatgptReviewResult.reviewed_commit) {
    throw new Error('candidate_commit must match chatgpt_review_result.reviewed_commit');
  }

  return buildGateProductionDecision({
    l4_run_result: l4RunResult,
    chatgpt_review_result: chatgptReviewResult
  }, {
    ...options,
    candidate_commit: candidateCommit,
    checks_passed: inferChecksPassed(l4RunResult, options),
    branch_head_unchanged: inferBranchHeadUnchanged(l4RunResult, options),
    no_stale_review: inferNoStaleReview(l4RunResult, options),
    no_repair_guard_block: inferNoRepairGuardBlock(l4RunResult, options)
  });
}

export function adaptL4AndChatGptReviewToGateDecisionObjects(input, options = {}) {
  return [
    adaptL4AndChatGptReviewToGateDecision(input, options)
  ];
}
