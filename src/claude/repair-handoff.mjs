const HANDOFF_PROTOCOL = 'baijin-claude-repair-handoff/1.0';

const DEFAULT_FORBIDDEN_ACTIONS = Object.freeze([
  'do not modify review.json',
  'do not bypass ChatGPT review',
  'do not bypass gate',
  'do not push directly to dev'
]);

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

  if (findings.length === 0) {
    throw new Error('changes_requested repair handoff requires at least one finding');
  }

  return findings.map((finding, index) => normalizeFinding(finding, index));
}

function defaultHandoffId(reviewResult) {
  return 'claude-repair-handoff-' + reviewResult.result_id;
}

export function buildClaudeRepairHandoff(reviewResult, options = {}) {
  requireObject(reviewResult, 'reviewResult');

  if (reviewResult.protocol !== 'baijin-chatgpt-review-result/1.0') {
    throw new Error('reviewResult protocol must be baijin-chatgpt-review-result/1.0');
  }

  if (reviewResult.status !== 'review_submitted') {
    throw new Error('repair handoff requires review_submitted status');
  }

  if (reviewResult.verdict !== 'changes_requested') {
    throw new Error('repair handoff requires changes_requested verdict');
  }

  const repairRound = Number.isInteger(options.repair_round) ? options.repair_round : 0;
  const maxRepairRound = Number.isInteger(options.max_repair_round) ? options.max_repair_round : 2;

  if (repairRound < 0) {
    throw new Error('repair_round must be >= 0');
  }

  if (maxRepairRound < 1) {
    throw new Error('max_repair_round must be >= 1');
  }

  if (repairRound > maxRepairRound) {
    throw new Error('repair_round must not exceed max_repair_round');
  }

  return {
    protocol: HANDOFF_PROTOCOL,
    handoff_id: options.handoff_id || defaultHandoffId(reviewResult),
    source_review_result_id: requireNonEmptyString(reviewResult.result_id, 'result_id'),
    invocation_id: requireNonEmptyString(reviewResult.invocation_id, 'invocation_id'),
    repository: requireNonEmptyString(reviewResult.repository, 'repository'),
    branch: requireNonEmptyString(reviewResult.branch, 'branch'),
    reviewed_commit: requireCommitSha(reviewResult.reviewed_commit, 'reviewed_commit'),
    review_commit: requireCommitSha(reviewResult.review_commit, 'review_commit'),
    verdict: 'changes_requested',
    findings: normalizeFindings(reviewResult.findings),
    repair_round: repairRound,
    max_repair_round: maxRepairRound,
    target_actor: 'claude-code',
    forbidden_actions: Array.isArray(options.forbidden_actions)
      ? [...options.forbidden_actions]
      : [...DEFAULT_FORBIDDEN_ACTIONS],
    created_at: options.created_at || new Date().toISOString()
  };
}
