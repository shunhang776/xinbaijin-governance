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

function requireIntegerAtLeast(value, min, name) {
  if (!Number.isInteger(value) || value < min) {
    throw new Error(name + ' must be an integer >= ' + min);
  }

  return value;
}

function normalizeFinding(finding, index) {
  requireObject(finding, 'finding');

  const prefix = 'findings[' + index + ']';

  return {
    severity: requireNonEmptyString(finding.severity, prefix + '.severity'),
    file: requireNonEmptyString(finding.file, prefix + '.file'),
    line: requireIntegerAtLeast(finding.line, 1, prefix + '.line'),
    title: requireNonEmptyString(finding.title, prefix + '.title'),
    description: requireNonEmptyString(finding.description, prefix + '.description'),
    recommendation: requireNonEmptyString(finding.recommendation, prefix + '.recommendation')
  };
}

function normalizeFindings(findings) {
  if (!Array.isArray(findings)) {
    throw new TypeError('findings must be an array');
  }

  if (findings.length === 0) {
    throw new Error('REPAIR_REQUESTED requires at least one finding');
  }

  return findings.map((finding, index) => normalizeFinding(finding, index));
}

export function buildRepairRequestedL4EventFromClaudeHandoff(handoff, options = {}) {
  requireObject(handoff, 'handoff');

  if (handoff.protocol !== 'baijin-claude-repair-handoff/1.0') {
    throw new Error('handoff protocol must be baijin-claude-repair-handoff/1.0');
  }

  if (handoff.verdict !== 'changes_requested') {
    throw new Error('REPAIR_REQUESTED requires changes_requested verdict');
  }

  if (handoff.target_actor !== 'claude-code') {
    throw new Error('REPAIR_REQUESTED target_actor must be claude-code');
  }

  const findings = normalizeFindings(handoff.findings);
  const repairRound = requireIntegerAtLeast(handoff.repair_round, 0, 'repair_round');
  const maxRepairRound = requireIntegerAtLeast(handoff.max_repair_round, 1, 'max_repair_round');

  if (repairRound > maxRepairRound) {
    throw new Error('repair_round must not exceed max_repair_round');
  }

  return {
    protocol: 'baijin-l4-event/1.0',
    event_id: options.event_id || 'event-' + handoff.handoff_id,
    task_id: requireNonEmptyString(options.task_id, 'task_id'),
    repository: requireNonEmptyString(handoff.repository, 'repository'),
    branch: requireNonEmptyString(handoff.branch, 'branch'),
    event_type: 'REPAIR_REQUESTED',
    actor: options.actor || 'claude-code',
    repair_round: repairRound,
    payload: {
      run_id: options.run_id || null,
      handoff_id: requireNonEmptyString(handoff.handoff_id, 'handoff_id'),
      source_review_result_id: requireNonEmptyString(handoff.source_review_result_id, 'source_review_result_id'),
      invocation_id: requireNonEmptyString(handoff.invocation_id, 'invocation_id'),
      reviewed_commit: requireCommitSha(handoff.reviewed_commit, 'reviewed_commit'),
      review_commit: requireCommitSha(handoff.review_commit, 'review_commit'),
      verdict: 'changes_requested',
      target_actor: 'claude-code',
      repair_round: repairRound,
      max_repair_round: maxRepairRound,
      finding_count: findings.length,
      findings
    },
    created_at: options.created_at || handoff.created_at || new Date().toISOString()
  };
}

export function claudeRepairHandoffToL4EventObjects(handoff, options = {}) {
  return [
    buildRepairRequestedL4EventFromClaudeHandoff(handoff, options)
  ];
}
