const REQUIRED_CONDITION_KEYS = Object.freeze([
  'checks_passed',
  'chatgpt_review_approved',
  'review_readback_verified',
  'l4_accepted',
  'branch_head_unchanged',
  'no_stale_review',
  'no_repair_guard_block',
  'artifacts_verified',
  'policy_passed'
]);

function requireObject(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(name + ' must be an object');
  }

  return value;
}

function requireString(value, name) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(name + ' must be a non-empty string');
  }

  return value;
}

export function normalizeGateRequiredConditions(conditions) {
  requireObject(conditions, 'conditions');

  const normalized = {};

  for (const key of REQUIRED_CONDITION_KEYS) {
    if (typeof conditions[key] !== 'boolean') {
      throw new Error('conditions.' + key + ' must be a boolean');
    }

    normalized[key] = conditions[key];
  }

  return normalized;
}

export function allGateRequiredConditionsPassed(conditions) {
  const normalized = normalizeGateRequiredConditions(conditions);

  return REQUIRED_CONDITION_KEYS.every((key) => normalized[key] === true);
}

export function getGateProductionReasonCode(conditions, context = {}) {
  const normalized = normalizeGateRequiredConditions(conditions);
  const reviewVerdict = requireString(context.review_verdict || 'unknown', 'review_verdict');
  const l4FinalState = requireString(context.l4_final_state || 'unknown', 'l4_final_state');

  if (context.manual_override_required === true) {
    return 'manual_override_required';
  }

  if (normalized.artifacts_verified !== true) {
    return 'missing_required_artifact';
  }

  if (normalized.chatgpt_review_approved !== true || reviewVerdict !== 'approved') {
    return 'chatgpt_review_not_approved';
  }

  if (normalized.review_readback_verified !== true) {
    return 'review_readback_not_verified';
  }

  if (normalized.checks_passed !== true) {
    return 'checks_not_passed';
  }

  if (normalized.no_stale_review !== true) {
    return 'stale_review_detected';
  }

  if (normalized.branch_head_unchanged !== true) {
    return 'branch_head_changed';
  }

  if (normalized.no_repair_guard_block !== true) {
    return 'repair_guard_blocked';
  }

  if (normalized.l4_accepted !== true || l4FinalState !== 'ACCEPTED') {
    return 'l4_not_accepted';
  }

  if (normalized.policy_passed !== true) {
    return 'policy_violation';
  }

  return 'all_required_conditions_met';
}

export function evaluateGateProductionRules(input) {
  requireObject(input, 'input');

  const conditions = normalizeGateRequiredConditions(input.required_conditions);
  const reasonCode = getGateProductionReasonCode(conditions, {
    review_verdict: input.review_verdict,
    l4_final_state: input.l4_final_state,
    manual_override_required: input.manual_override_required
  });

  if (reasonCode === 'all_required_conditions_met' && allGateRequiredConditionsPassed(conditions)) {
    return {
      decision: 'allowed',
      reason_code: reasonCode
    };
  }

  if (
    reasonCode === 'manual_override_required' ||
    reasonCode === 'missing_required_artifact'
  ) {
    return {
      decision: 'manual_required',
      reason_code: reasonCode
    };
  }

  return {
    decision: 'denied',
    reason_code: reasonCode
  };
}
