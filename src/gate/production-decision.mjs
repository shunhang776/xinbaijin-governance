const GATE_DECISION_PROTOCOL = 'baijin-gate-production-decision/1.0';

const DEFAULT_SOURCE_ARTIFACTS = Object.freeze({
  l4_run_result: 'artifacts/l4/l4-run-result.json',
  chatgpt_review_result: 'artifacts/l4/chatgpt-review-result.json',
  l4_dry_run_artifact: 'artifacts/l4/l4-dry-run-artifact.json',
  gate_input: 'artifacts/gate/gate-input.json'
});

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

function boolOption(options, name, fallback) {
  if (Object.prototype.hasOwnProperty.call(options, name)) {
    return options[name] === true;
  }

  return fallback;
}

function hasMachineEvent(l4RunResult, eventType) {
  return Array.isArray(l4RunResult.machine_events) && l4RunResult.machine_events.includes(eventType);
}

function isReadbackFullyVerified(reviewResult) {
  const readback = reviewResult.readback;

  return Boolean(
    readback &&
    readback.verified === true &&
    readback.reviewed_commit_matches === true &&
    readback.based_on_branch_head_matches === true &&
    readback.verdict_matches === true &&
    readback.findings_match === true &&
    readback.utf8_valid === true &&
    typeof readback.sha256 === 'string' &&
    readback.sha256.length === 64 &&
    typeof readback.byte_length === 'number' &&
    typeof readback.line_ending === 'string' &&
    typeof readback.final_newline === 'boolean'
  );
}

function makeConditions(l4RunResult, reviewResult, options) {
  return {
    checks_passed: boolOption(options, 'checks_passed', hasMachineEvent(l4RunResult, 'CHECKS_PASSED')),
    chatgpt_review_approved: boolOption(options, 'chatgpt_review_approved', reviewResult.verdict === 'approved'),
    review_readback_verified: boolOption(options, 'review_readback_verified', isReadbackFullyVerified(reviewResult)),
    l4_accepted: boolOption(options, 'l4_accepted', l4RunResult.final_state === 'ACCEPTED'),
    branch_head_unchanged: boolOption(options, 'branch_head_unchanged', !hasMachineEvent(l4RunResult, 'BRANCH_HEAD_CHANGED')),
    no_stale_review: boolOption(options, 'no_stale_review', !hasMachineEvent(l4RunResult, 'STALE_REVIEW_DETECTED')),
    no_repair_guard_block: boolOption(
      options,
      'no_repair_guard_block',
      !hasMachineEvent(l4RunResult, 'REPAIR_ROUND_EXCEEDED') &&
      !hasMachineEvent(l4RunResult, 'REPEATED_FINDING_DETECTED')
    ),
    artifacts_verified: boolOption(options, 'artifacts_verified', true),
    policy_passed: boolOption(options, 'policy_passed', true)
  };
}

function firstFailedReason(conditions, reviewResult, l4RunResult) {
  if (!conditions.artifacts_verified) {
    return 'missing_required_artifact';
  }

  if (!conditions.chatgpt_review_approved || reviewResult.verdict !== 'approved') {
    return 'chatgpt_review_not_approved';
  }

  if (!conditions.review_readback_verified) {
    return 'review_readback_not_verified';
  }

  if (!conditions.checks_passed) {
    return 'checks_not_passed';
  }

  if (!conditions.no_stale_review) {
    return 'stale_review_detected';
  }

  if (!conditions.branch_head_unchanged) {
    return 'branch_head_changed';
  }

  if (!conditions.no_repair_guard_block) {
    return 'repair_guard_blocked';
  }

  if (!conditions.l4_accepted || l4RunResult.final_state !== 'ACCEPTED') {
    return 'l4_not_accepted';
  }

  if (!conditions.policy_passed) {
    return 'policy_violation';
  }

  return 'all_required_conditions_met';
}

function allConditionsPassed(conditions) {
  return Object.values(conditions).every((value) => value === true);
}

export function buildGateProductionDecision(input, options = {}) {
  requireObject(input, 'input');

  const l4RunResult = requireObject(input.l4_run_result, 'l4_run_result');
  const reviewResult = requireObject(input.chatgpt_review_result, 'chatgpt_review_result');

  if (reviewResult.protocol !== 'baijin-chatgpt-review-result/1.0') {
    throw new Error('chatgpt_review_result protocol must be baijin-chatgpt-review-result/1.0');
  }

  if (l4RunResult.repository !== reviewResult.repository) {
    throw new Error('repository mismatch between l4_run_result and chatgpt_review_result');
  }

  if (l4RunResult.branch !== reviewResult.branch) {
    throw new Error('branch mismatch between l4_run_result and chatgpt_review_result');
  }

  const candidateCommit = requireCommitSha(
    options.candidate_commit || reviewResult.reviewed_commit,
    'candidate_commit'
  );

  const reviewedCommit = requireCommitSha(reviewResult.reviewed_commit, 'reviewed_commit');

  if (candidateCommit !== reviewedCommit) {
    throw new Error('candidate_commit must match reviewed_commit');
  }

  const conditions = makeConditions(l4RunResult, reviewResult, options);
  const reasonCode = options.reason_code || firstFailedReason(conditions, reviewResult, l4RunResult);
  const allowed = reasonCode === 'all_required_conditions_met' && allConditionsPassed(conditions);

  return {
    protocol: GATE_DECISION_PROTOCOL,
    decision_id: options.decision_id || 'gate-production-decision-' + (l4RunResult.run_id || 'run'),
    task_id: requireNonEmptyString(l4RunResult.task_id, 'task_id'),
    run_id: requireNonEmptyString(l4RunResult.run_id, 'run_id'),
    repository: requireNonEmptyString(l4RunResult.repository, 'repository'),
    branch: requireNonEmptyString(l4RunResult.branch, 'branch'),
    candidate_commit: candidateCommit,
    reviewed_commit: reviewedCommit,
    review_commit: requireCommitSha(reviewResult.review_commit, 'review_commit'),
    chatgpt_review_result_id: requireNonEmptyString(reviewResult.result_id, 'chatgpt_review_result_id'),
    l4_run_result_id: requireNonEmptyString(
      l4RunResult.result_id || l4RunResult.run_result_id || l4RunResult.run_id,
      'l4_run_result_id'
    ),
    review_verdict: requireNonEmptyString(reviewResult.verdict, 'review_verdict'),
    l4_final_state: requireNonEmptyString(l4RunResult.final_state, 'l4_final_state'),
    decision: allowed ? 'allowed' : 'denied',
    reason_code: reasonCode,
    required_conditions: conditions,
    source_artifacts: {
      ...DEFAULT_SOURCE_ARTIFACTS,
      ...(options.source_artifacts || {})
    },
    created_at: options.created_at || new Date().toISOString()
  };
}
