const GUARD_PROTOCOL = 'baijin-l4-review-guard/1.0';
const VALID_VERDICTS = new Set(['approved', 'changes_requested', 'blocked']);

function requireObject(value, name) {
  if (!value || typeof value !== 'object') {
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
  if (value == null || value === '') {
    return null;
  }

  return requireCommitSha(value, name);
}

function requireVerdict(value) {
  requireNonEmptyString(value, 'verdict');

  if (!VALID_VERDICTS.has(value)) {
    throw new Error('verdict must be approved, changes_requested, or blocked');
  }

  return value;
}

function defaultGuardId(input) {
  return 'guard-' + input.task_id + '-' + input.current_branch_head.slice(0, 12);
}

export function evaluateReviewGuard(input, options = {}) {
  requireObject(input, 'input');

  const normalized = {
    protocol: GUARD_PROTOCOL,
    guard_id: input.guard_id || options.guard_id || null,
    task_id: requireNonEmptyString(input.task_id, 'task_id'),
    run_id: input.run_id || null,
    repository: requireNonEmptyString(input.repository, 'repository'),
    branch: requireNonEmptyString(input.branch, 'branch'),
    reviewed_commit: requireCommitSha(input.reviewed_commit, 'reviewed_commit'),
    based_on_branch_head: requireCommitSha(input.based_on_branch_head, 'based_on_branch_head'),
    current_branch_head: requireCommitSha(input.current_branch_head, 'current_branch_head'),
    review_commit: optionalCommitSha(input.review_commit, 'review_commit'),
    verdict: requireVerdict(input.verdict),
    guard_status: 'fresh',
    created_at: input.created_at || options.created_at || new Date().toISOString()
  };

  normalized.guard_id = normalized.guard_id || defaultGuardId(normalized);

  if (normalized.based_on_branch_head !== normalized.current_branch_head) {
    normalized.guard_status = 'branch_head_changed';
    return normalized;
  }

  if (normalized.reviewed_commit !== normalized.current_branch_head) {
    normalized.guard_status = 'stale_review';
    return normalized;
  }

  return normalized;
}

export function reviewGuardToL4EventType(guard) {
  requireObject(guard, 'guard');

  if (guard.guard_status === 'fresh') {
    return null;
  }

  if (guard.guard_status === 'stale_review') {
    return 'STALE_REVIEW_DETECTED';
  }

  if (guard.guard_status === 'branch_head_changed') {
    return 'BRANCH_HEAD_CHANGED';
  }

  if (guard.guard_status === 'manual_required') {
    return 'TOOL_ERROR';
  }

  throw new Error('unknown guard_status: ' + guard.guard_status);
}

export function assertFreshReviewGuard(guard) {
  requireObject(guard, 'guard');

  if (guard.guard_status !== 'fresh') {
    throw new Error('review guard is not fresh: ' + guard.guard_status);
  }

  return guard;
}
