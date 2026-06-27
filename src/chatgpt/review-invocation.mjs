const INVOCATION_PROTOCOL = 'baijin-chatgpt-review-invocation/1.0';

const REVIEW_TARGETS = Object.freeze({
  'shunhang776/xinbaijin': Object.freeze({
    trigger_key: 'REVIEW_CLAUDE_LATEST_HANDOFF',
    exact_trigger_text: '审查 Claude 最新交接'
  }),
  'shunhang776/xinbaijin-mcp': Object.freeze({
    trigger_key: 'REVIEW_MCP_LATEST_HANDOFF',
    exact_trigger_text: '审查 MCP 最新交接'
  })
});

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

function getReviewTarget(repository) {
  const target = REVIEW_TARGETS[repository];

  if (!target) {
    throw new Error('unsupported review repository: ' + repository);
  }

  return target;
}

function defaultInvocationId(request) {
  const repoName = request.repository.split('/').pop();
  return 'invocation-' + repoName + '-' + request.candidate_commit.slice(0, 12);
}

export function buildChatGptReviewInvocation(request, options = {}) {
  requireObject(request, 'request');

  if (request.bridge_type !== 'review_bridge') {
    throw new Error('ChatGPT review invocation requires review_bridge request');
  }

  const repository = requireNonEmptyString(request.repository, 'repository');
  const branch = requireNonEmptyString(request.branch, 'branch');

  if (branch !== 'dev') {
    throw new Error('ChatGPT review invocation requires dev branch');
  }

  const candidateCommit = requireCommitSha(request.candidate_commit, 'candidate_commit');
  const target = getReviewTarget(repository);

  if (request.trigger_key && request.trigger_key !== target.trigger_key) {
    throw new Error('trigger_key does not match repository');
  }

  return {
    protocol: INVOCATION_PROTOCOL,
    invocation_id: options.invocation_id || defaultInvocationId({
      repository,
      candidate_commit: candidateCommit
    }),
    repository,
    branch,
    candidate_commit: candidateCommit,
    trigger_key: target.trigger_key,
    exact_trigger_text: target.exact_trigger_text,
    reviewer: 'chatgpt-baijin-reviewer',
    created_at: options.created_at || new Date().toISOString()
  };
}
