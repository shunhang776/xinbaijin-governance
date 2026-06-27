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

function gateDecisionToEventType(decision) {
  if (decision === 'allowed') {
    return 'GATE_ALLOWED';
  }

  if (decision === 'denied' || decision === 'manual_required') {
    return 'GATE_DENIED';
  }

  throw new Error('unsupported gate decision: ' + decision);
}

export function buildGateDecisionL4Event(decision, options = {}) {
  requireObject(decision, 'decision');

  if (decision.protocol !== 'baijin-gate-production-decision/1.0') {
    throw new Error('decision protocol must be baijin-gate-production-decision/1.0');
  }

  const eventType = gateDecisionToEventType(decision.decision);

  return {
    protocol: 'baijin-l4-event/1.0',
    event_id: options.event_id || 'event-' + decision.decision_id,
    task_id: requireNonEmptyString(options.task_id || decision.task_id, 'task_id'),
    repository: requireNonEmptyString(decision.repository, 'repository'),
    branch: requireNonEmptyString(decision.branch, 'branch'),
    event_type: eventType,
    actor: options.actor || 'gate',
    repair_round: Number.isInteger(options.repair_round) ? options.repair_round : 0,
    payload: {
      run_id: options.run_id || decision.run_id,
      decision_id: requireNonEmptyString(decision.decision_id, 'decision_id'),
      gate_decision: requireNonEmptyString(decision.decision, 'decision.decision'),
      reason_code: requireNonEmptyString(decision.reason_code, 'reason_code'),
      candidate_commit: requireCommitSha(decision.candidate_commit, 'candidate_commit'),
      reviewed_commit: requireCommitSha(decision.reviewed_commit, 'reviewed_commit'),
      review_commit: requireCommitSha(decision.review_commit, 'review_commit'),
      chatgpt_review_result_id: requireNonEmptyString(decision.chatgpt_review_result_id, 'chatgpt_review_result_id'),
      l4_run_result_id: requireNonEmptyString(decision.l4_run_result_id, 'l4_run_result_id'),
      review_verdict: requireNonEmptyString(decision.review_verdict, 'review_verdict'),
      l4_final_state: requireNonEmptyString(decision.l4_final_state, 'l4_final_state'),
      required_conditions: requireObject(decision.required_conditions, 'required_conditions'),
      source_artifacts: requireObject(decision.source_artifacts, 'source_artifacts')
    },
    created_at: options.created_at || decision.created_at || new Date().toISOString()
  };
}

export function gateDecisionToL4EventObjects(decision, options = {}) {
  return [
    buildGateDecisionL4Event(decision, options)
  ];
}
