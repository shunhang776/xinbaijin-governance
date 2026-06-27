const SUBMISSION_PROTOCOL = 'baijin-claude-repair-submission/1.0';

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

function uniqueNonEmptyStrings(values, name) {
  if (!Array.isArray(values)) {
    throw new TypeError(name + ' must be an array');
  }

  const normalized = values.map((value, index) => {
    return requireNonEmptyString(value, name + '[' + index + ']');
  });

  return [...new Set(normalized)];
}

function normalizeResolvedFindingFromFinding(finding, index, resolution) {
  requireObject(finding, 'finding');

  const prefix = 'resolved_findings[' + index + ']';

  return {
    severity: requireNonEmptyString(finding.severity, prefix + '.severity'),
    file: requireNonEmptyString(finding.file, prefix + '.file'),
    line: requireIntegerAtLeast(finding.line, 1, prefix + '.line'),
    title: requireNonEmptyString(finding.title, prefix + '.title'),
    resolution: requireNonEmptyString(resolution, prefix + '.resolution')
  };
}

function normalizeResolvedFindings(handoff, options) {
  const findings = handoff.findings;

  if (!Array.isArray(findings) || findings.length === 0) {
    throw new Error('repair submission requires at least one source finding');
  }

  if (Array.isArray(options.resolved_findings)) {
    if (options.resolved_findings.length === 0) {
      throw new Error('resolved_findings must not be empty');
    }

    return options.resolved_findings.map((finding, index) => {
      requireObject(finding, 'resolved_findings[' + index + ']');

      return {
        severity: requireNonEmptyString(finding.severity, 'resolved_findings[' + index + '].severity'),
        file: requireNonEmptyString(finding.file, 'resolved_findings[' + index + '].file'),
        line: requireIntegerAtLeast(finding.line, 1, 'resolved_findings[' + index + '].line'),
        title: requireNonEmptyString(finding.title, 'resolved_findings[' + index + '].title'),
        resolution: requireNonEmptyString(finding.resolution, 'resolved_findings[' + index + '].resolution')
      };
    });
  }

  const defaultResolution = options.resolution || options.fix_summary;

  return findings.map((finding, index) => {
    return normalizeResolvedFindingFromFinding(finding, index, defaultResolution);
  });
}

function defaultSubmissionId(handoff, repairCommit) {
  return 'claude-repair-submission-' + handoff.handoff_id + '-' + repairCommit.slice(0, 12);
}

export function buildClaudeRepairSubmission(handoff, options = {}) {
  requireObject(handoff, 'handoff');

  if (handoff.protocol !== 'baijin-claude-repair-handoff/1.0') {
    throw new Error('handoff protocol must be baijin-claude-repair-handoff/1.0');
  }

  if (handoff.verdict !== 'changes_requested') {
    throw new Error('repair submission requires changes_requested handoff');
  }

  if (handoff.target_actor !== 'claude-code') {
    throw new Error('repair submission requires claude-code target_actor');
  }

  const repairRound = requireIntegerAtLeast(handoff.repair_round, 0, 'repair_round');
  const maxRepairRound = requireIntegerAtLeast(handoff.max_repair_round, 1, 'max_repair_round');

  if (repairRound > maxRepairRound) {
    throw new Error('repair_round must not exceed max_repair_round');
  }

  const repairCommit = requireCommitSha(options.repair_commit, 'repair_commit');
  const repairBaseCommit = requireCommitSha(
    options.repair_base_commit || handoff.reviewed_commit,
    'repair_base_commit'
  );

  const changedFiles = uniqueNonEmptyStrings(
    options.changed_files || handoff.findings.map((finding) => finding.file),
    'changed_files'
  );

  if (changedFiles.length === 0) {
    throw new Error('changed_files must not be empty');
  }

  const fixSummary = requireNonEmptyString(options.fix_summary, 'fix_summary');
  const resolvedFindings = normalizeResolvedFindings(handoff, {
    ...options,
    fix_summary: fixSummary
  });

  return {
    protocol: SUBMISSION_PROTOCOL,
    submission_id: options.submission_id || defaultSubmissionId(handoff, repairCommit),
    source_handoff_id: requireNonEmptyString(handoff.handoff_id, 'handoff_id'),
    source_review_result_id: requireNonEmptyString(handoff.source_review_result_id, 'source_review_result_id'),
    invocation_id: requireNonEmptyString(handoff.invocation_id, 'invocation_id'),
    repository: requireNonEmptyString(handoff.repository, 'repository'),
    branch: requireNonEmptyString(handoff.branch, 'branch'),
    reviewed_commit: requireCommitSha(handoff.reviewed_commit, 'reviewed_commit'),
    review_commit: requireCommitSha(handoff.review_commit, 'review_commit'),
    repair_base_commit: repairBaseCommit,
    repair_commit: repairCommit,
    repair_round: repairRound,
    max_repair_round: maxRepairRound,
    status: 'repair_submitted',
    actor: 'claude-code',
    fix_summary: fixSummary,
    changed_files: changedFiles,
    resolved_findings: resolvedFindings,
    forbidden_actions_observed: Array.isArray(options.forbidden_actions_observed)
      ? [...options.forbidden_actions_observed]
      : [],
    created_at: options.created_at || new Date().toISOString()
  };
}
