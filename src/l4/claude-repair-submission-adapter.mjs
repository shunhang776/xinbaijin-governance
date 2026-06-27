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

function normalizeResolvedFinding(finding, index) {
  requireObject(finding, 'resolved_findings[' + index + ']');

  return {
    severity: requireNonEmptyString(finding.severity, 'resolved_findings[' + index + '].severity'),
    file: requireNonEmptyString(finding.file, 'resolved_findings[' + index + '].file'),
    line: requireIntegerAtLeast(finding.line, 1, 'resolved_findings[' + index + '].line'),
    title: requireNonEmptyString(finding.title, 'resolved_findings[' + index + '].title'),
    resolution: requireNonEmptyString(finding.resolution, 'resolved_findings[' + index + '].resolution')
  };
}

function normalizeResolvedFindings(findings) {
  if (!Array.isArray(findings)) {
    throw new TypeError('resolved_findings must be an array');
  }

  if (findings.length === 0) {
    throw new Error('REPAIR_SUBMITTED requires at least one resolved finding');
  }

  return findings.map((finding, index) => normalizeResolvedFinding(finding, index));
}

function normalizeChangedFiles(files) {
  if (!Array.isArray(files)) {
    throw new TypeError('changed_files must be an array');
  }

  const normalized = files.map((file, index) => {
    return requireNonEmptyString(file, 'changed_files[' + index + ']');
  });

  if (normalized.length === 0) {
    throw new Error('REPAIR_SUBMITTED requires at least one changed file');
  }

  return [...new Set(normalized)];
}

export function buildRepairSubmittedL4EventFromClaudeSubmission(submission, options = {}) {
  requireObject(submission, 'submission');

  if (submission.protocol !== 'baijin-claude-repair-submission/1.0') {
    throw new Error('submission protocol must be baijin-claude-repair-submission/1.0');
  }

  if (submission.status !== 'repair_submitted') {
    throw new Error('REPAIR_SUBMITTED requires repair_submitted status');
  }

  if (submission.actor !== 'claude-code') {
    throw new Error('REPAIR_SUBMITTED actor must be claude-code');
  }

  const repairRound = requireIntegerAtLeast(submission.repair_round, 0, 'repair_round');
  const maxRepairRound = requireIntegerAtLeast(submission.max_repair_round, 1, 'max_repair_round');

  if (repairRound > maxRepairRound) {
    throw new Error('repair_round must not exceed max_repair_round');
  }

  const changedFiles = normalizeChangedFiles(submission.changed_files);
  const resolvedFindings = normalizeResolvedFindings(submission.resolved_findings);

  return {
    protocol: 'baijin-l4-event/1.0',
    event_id: options.event_id || 'event-' + submission.submission_id,
    task_id: requireNonEmptyString(options.task_id, 'task_id'),
    repository: requireNonEmptyString(submission.repository, 'repository'),
    branch: requireNonEmptyString(submission.branch, 'branch'),
    event_type: 'REPAIR_SUBMITTED',
    actor: 'claude-code',
    repair_round: repairRound,
    payload: {
      run_id: options.run_id || null,
      submission_id: requireNonEmptyString(submission.submission_id, 'submission_id'),
      source_handoff_id: requireNonEmptyString(submission.source_handoff_id, 'source_handoff_id'),
      source_review_result_id: requireNonEmptyString(submission.source_review_result_id, 'source_review_result_id'),
      invocation_id: requireNonEmptyString(submission.invocation_id, 'invocation_id'),
      reviewed_commit: requireCommitSha(submission.reviewed_commit, 'reviewed_commit'),
      review_commit: requireCommitSha(submission.review_commit, 'review_commit'),
      repair_base_commit: requireCommitSha(submission.repair_base_commit, 'repair_base_commit'),
      repair_commit: requireCommitSha(submission.repair_commit, 'repair_commit'),
      repair_round: repairRound,
      max_repair_round: maxRepairRound,
      status: 'repair_submitted',
      actor: 'claude-code',
      fix_summary: requireNonEmptyString(submission.fix_summary, 'fix_summary'),
      changed_files: changedFiles,
      resolved_finding_count: resolvedFindings.length,
      resolved_findings: resolvedFindings,
      forbidden_actions_observed: Array.isArray(submission.forbidden_actions_observed)
        ? [...submission.forbidden_actions_observed]
        : []
    },
    created_at: options.created_at || submission.created_at || new Date().toISOString()
  };
}

export function claudeRepairSubmissionToL4EventObjects(submission, options = {}) {
  return [
    buildRepairSubmittedL4EventFromClaudeSubmission(submission, options)
  ];
}
