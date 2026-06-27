const RESULT_PROTOCOL = 'baijin-chatgpt-review-result/1.0';

const VALID_STATUS = new Set([
  'review_submitted',
  'blocked',
  'skipped_no_new_code'
]);

const VALID_VERDICT = new Set([
  'approved',
  'changes_requested',
  'blocked'
]);

const REQUIRED_READBACK_FIELDS = [
  'verified',
  'reviewed_commit_matches',
  'based_on_branch_head_matches',
  'verdict_matches',
  'findings_match',
  'utf8_valid',
  'sha256',
  'byte_length',
  'line_ending',
  'final_newline'
];

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

function optionalCommitSha(value, name) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  return requireCommitSha(value, name);
}

function requireDateTimeString(value, name) {
  return requireNonEmptyString(value, name);
}

function normalizeStatus(value) {
  const status = requireNonEmptyString(value, 'status');

  if (!VALID_STATUS.has(status)) {
    throw new Error('status must be review_submitted, blocked, or skipped_no_new_code');
  }

  return status;
}

function normalizeVerdict(value) {
  const verdict = requireNonEmptyString(value, 'verdict');

  if (!VALID_VERDICT.has(verdict)) {
    throw new Error('verdict must be approved, changes_requested, or blocked');
  }

  return verdict;
}

function normalizeFinding(finding, index) {
  requireObject(finding, 'finding');

  const prefix = 'findings[' + index + ']';

  return {
    severity: requireNonEmptyString(finding.severity, prefix + '.severity'),
    file: requireNonEmptyString(finding.file, prefix + '.file'),
    line: Number.isInteger(finding.line) && finding.line >= 1
      ? finding.line
      : (() => { throw new Error(prefix + '.line must be an integer >= 1'); })(),
    title: requireNonEmptyString(finding.title, prefix + '.title'),
    description: requireNonEmptyString(finding.description, prefix + '.description'),
    recommendation: requireNonEmptyString(finding.recommendation, prefix + '.recommendation')
  };
}

function normalizeFindings(findings) {
  if (!Array.isArray(findings)) {
    throw new TypeError('findings must be an array');
  }

  return findings.map((finding, index) => normalizeFinding(finding, index));
}

function normalizeReadback(readback, status) {
  requireObject(readback, 'readback');

  for (const field of REQUIRED_READBACK_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(readback, field)) {
      throw new Error('readback.' + field + ' is required');
    }
  }

  const normalized = {
    verified: Boolean(readback.verified),
    reviewed_commit_matches: Boolean(readback.reviewed_commit_matches),
    based_on_branch_head_matches: Boolean(readback.based_on_branch_head_matches),
    verdict_matches: Boolean(readback.verdict_matches),
    findings_match: Boolean(readback.findings_match),
    utf8_valid: Boolean(readback.utf8_valid),
    sha256: readback.sha256 === null ? null : requireNonEmptyString(readback.sha256, 'readback.sha256'),
    byte_length: readback.byte_length,
    line_ending: readback.line_ending,
    final_newline: readback.final_newline
  };

  if (normalized.sha256 !== null && !/^[0-9a-f]{64}$/.test(normalized.sha256)) {
    throw new Error('readback.sha256 must be a lowercase 64-char sha256');
  }

  if (normalized.byte_length !== null && (!Number.isInteger(normalized.byte_length) || normalized.byte_length < 0)) {
    throw new Error('readback.byte_length must be null or integer >= 0');
  }

  if (!['LF', 'CRLF', 'MIXED', 'NONE', 'UNKNOWN', null].includes(normalized.line_ending)) {
    throw new Error('readback.line_ending is invalid');
  }

  if (![true, false, null].includes(normalized.final_newline)) {
    throw new Error('readback.final_newline must be boolean or null');
  }

  if (status === 'review_submitted') {
    const allVerified = normalized.verified
      && normalized.reviewed_commit_matches
      && normalized.based_on_branch_head_matches
      && normalized.verdict_matches
      && normalized.findings_match
      && normalized.utf8_valid
      && normalized.sha256 !== null
      && normalized.byte_length !== null
      && normalized.line_ending !== null
      && normalized.final_newline !== null;

    if (!allVerified) {
      throw new Error('review_submitted requires fully verified readback');
    }
  }

  return normalized;
}

function defaultResultId(input) {
  return 'chatgpt-review-result-' + input.invocation_id;
}

export function buildChatGptReviewResult(input, options = {}) {
  requireObject(input, 'input');

  const invocation = requireObject(input.invocation, 'input.invocation');
  const status = normalizeStatus(input.status || 'review_submitted');
  const verdict = normalizeVerdict(input.verdict);

  const reviewedCommit = requireCommitSha(input.reviewed_commit, 'reviewed_commit');
  const basedOnBranchHead = requireCommitSha(input.based_on_branch_head, 'based_on_branch_head');
  const reviewCommit = optionalCommitSha(input.review_commit, 'review_commit');

  if (status === 'review_submitted' && reviewCommit === null) {
    throw new Error('review_submitted requires review_commit');
  }

  if (invocation.repository !== input.repository) {
    throw new Error('repository does not match invocation');
  }

  if (invocation.branch !== input.branch) {
    throw new Error('branch does not match invocation');
  }

  if (invocation.candidate_commit !== reviewedCommit) {
    throw new Error('reviewed_commit does not match invocation candidate_commit');
  }

  return {
    protocol: RESULT_PROTOCOL,
    result_id: options.result_id || defaultResultId(invocation),
    invocation_id: requireNonEmptyString(invocation.invocation_id, 'invocation_id'),
    repository: requireNonEmptyString(input.repository, 'repository'),
    branch: requireNonEmptyString(input.branch, 'branch'),
    status,
    reviewed_commit: reviewedCommit,
    based_on_branch_head: basedOnBranchHead,
    review_commit: reviewCommit,
    verdict,
    findings: normalizeFindings(input.findings || []),
    readback: normalizeReadback(input.readback, status),
    created_at: requireDateTimeString(options.created_at || input.created_at || new Date().toISOString(), 'created_at')
  };
}
