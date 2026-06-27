export const MCP_REVIEW_EXECUTION_METHODS = Object.freeze([
  'get_latest_handoff',
  'get_patch',
  'get_file_content',
  'submit_review'
]);

const REPOSITORY_MAP = Object.freeze({
  'shunhang776/xinbaijin': Object.freeze({
    tool_repository: 'xinbaijin',
    trigger_key: 'REVIEW_CLAUDE_LATEST_HANDOFF',
    exact_trigger_text: '审查 Claude 最新交接'
  }),
  'shunhang776/xinbaijin-mcp': Object.freeze({
    tool_repository: 'xinbaijin-mcp',
    trigger_key: 'REVIEW_MCP_LATEST_HANDOFF',
    exact_trigger_text: '审查 MCP 最新交接'
  })
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

export function assertMcpReviewExecutionPort(port) {
  requireObject(port, 'port');

  for (const method of MCP_REVIEW_EXECUTION_METHODS) {
    if (typeof port[method] !== 'function') {
      throw new TypeError('MCP review execution port missing method: ' + method);
    }
  }

  return port;
}

export function mapInvocationRepositoryToToolRepository(repository) {
  const mapping = REPOSITORY_MAP[repository];

  if (!mapping) {
    throw new Error('unsupported review repository: ' + repository);
  }

  return mapping.tool_repository;
}

export function getExpectedReviewInvocationMapping(repository) {
  const mapping = REPOSITORY_MAP[repository];

  if (!mapping) {
    throw new Error('unsupported review repository: ' + repository);
  }

  return mapping;
}

export function assertValidReviewInvocationForMcpExecution(invocation) {
  requireObject(invocation, 'invocation');

  if (invocation.protocol !== 'baijin-chatgpt-review-invocation/1.0') {
    throw new Error('invalid invocation protocol');
  }

  if (invocation.reviewer !== 'chatgpt-baijin-reviewer') {
    throw new Error('invocation reviewer must be chatgpt-baijin-reviewer');
  }

  if (invocation.branch !== 'dev') {
    throw new Error('MCP review execution requires dev branch');
  }

  requireCommitSha(invocation.candidate_commit, 'candidate_commit');

  const mapping = getExpectedReviewInvocationMapping(invocation.repository);

  if (invocation.trigger_key !== mapping.trigger_key) {
    throw new Error('invocation trigger_key does not match repository');
  }

  if (invocation.exact_trigger_text !== mapping.exact_trigger_text) {
    throw new Error('invocation exact_trigger_text does not match repository');
  }

  return invocation;
}

export function buildMcpReviewExecutionPlan(invocation, options = {}) {
  assertValidReviewInvocationForMcpExecution(invocation);

  const mapping = getExpectedReviewInvocationMapping(invocation.repository);

  return {
    protocol: 'baijin-mcp-review-execution-plan/1.0',
    plan_id: options.plan_id || 'mcp-review-plan-' + invocation.invocation_id,
    invocation_id: invocation.invocation_id,
    repository: invocation.repository,
    tool_repository: mapping.tool_repository,
    branch: invocation.branch,
    candidate_commit: invocation.candidate_commit,
    trigger_key: invocation.trigger_key,
    exact_trigger_text: invocation.exact_trigger_text,
    reviewer: invocation.reviewer,
    required_tools: [...MCP_REVIEW_EXECUTION_METHODS],
    steps: [
      {
        order: 1,
        tool: 'get_latest_handoff',
        repository: mapping.tool_repository
      },
      {
        order: 2,
        action: 'verify_handoff_repository_branch_commit'
      },
      {
        order: 3,
        tool: 'get_patch',
        repository: mapping.tool_repository,
        commit: invocation.candidate_commit
      },
      {
        order: 4,
        action: 'review_all_changed_files'
      },
      {
        order: 5,
        tool: 'get_file_content',
        repository: mapping.tool_repository,
        condition: 'required for encoding, JSON, Unicode, Base64, escaping, quotes, final newline, LF, CRLF, or mixed line endings'
      },
      {
        order: 6,
        tool: 'submit_review',
        repository: mapping.tool_repository,
        commit: invocation.candidate_commit
      },
      {
        order: 7,
        tool: 'get_file_content',
        repository: mapping.tool_repository,
        path: 'review.json',
        ref: 'review_commit'
      },
      {
        order: 8,
        action: 'readback_verify'
      },
      {
        order: 9,
        action: 'emit_chatgpt_review_result'
      }
    ],
    created_at: options.created_at || new Date().toISOString()
  };
}
