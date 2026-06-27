import {
  assertMcpReviewExecutionPort,
  buildMcpReviewExecutionPlan
} from './mcp-review-execution-port.mjs';
import { buildChatGptReviewResult } from './review-result.mjs';

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

function normalizeChangedFilePath(file) {
  if (typeof file === 'string') {
    return file;
  }

  if (file && typeof file === 'object') {
    return file.path || file.file || file.filename || '';
  }

  return '';
}

function isOnlyReviewJson(changedFiles) {
  if (!Array.isArray(changedFiles) || changedFiles.length === 0) {
    return false;
  }

  return changedFiles.every((file) => normalizeChangedFilePath(file) === 'review.json');
}

function makeUnsubmittedReadback() {
  return {
    verified: false,
    reviewed_commit_matches: false,
    based_on_branch_head_matches: false,
    verdict_matches: false,
    findings_match: false,
    utf8_valid: false,
    sha256: null,
    byte_length: null,
    line_ending: null,
    final_newline: null
  };
}

function makeVerifiedReadback(reviewJsonContent) {
  requireObject(reviewJsonContent, 'reviewJsonContent');

  return {
    verified: true,
    reviewed_commit_matches: true,
    based_on_branch_head_matches: true,
    verdict_matches: true,
    findings_match: true,
    utf8_valid: true,
    sha256: requireNonEmptyString(reviewJsonContent.sha256, 'reviewJsonContent.sha256'),
    byte_length: reviewJsonContent.byte_length,
    line_ending: requireNonEmptyString(reviewJsonContent.line_ending, 'reviewJsonContent.line_ending'),
    final_newline: reviewJsonContent.final_newline
  };
}

function assertHandoffMatchesInvocation(handoff, invocation, toolRepository) {
  requireObject(handoff, 'handoff');

  if (handoff.repository !== toolRepository) {
    throw new Error('handoff repository does not match invocation repository');
  }

  if (handoff.branch !== 'dev') {
    throw new Error('handoff branch must be dev');
  }

  const commit = requireCommitSha(handoff.commit || handoff.head_commit, 'handoff.commit');

  if (commit !== invocation.candidate_commit) {
    throw new Error('handoff commit does not match invocation candidate_commit');
  }

  return {
    ...handoff,
    commit
  };
}

export async function executeFakeMcpReview(invocation, port, options = {}) {
  const mcpPort = assertMcpReviewExecutionPort(port);
  const plan = buildMcpReviewExecutionPlan(invocation, {
    plan_id: options.plan_id,
    created_at: options.created_at
  });

  const toolRepository = plan.tool_repository;

  const handoff = assertHandoffMatchesInvocation(
    await mcpPort.get_latest_handoff({
      repository: toolRepository
    }),
    invocation,
    toolRepository
  );

  const changedFiles = Array.isArray(handoff.changed_files) ? handoff.changed_files : [];

  if (isOnlyReviewJson(changedFiles)) {
    const result = buildChatGptReviewResult({
      invocation,
      repository: invocation.repository,
      branch: invocation.branch,
      status: 'skipped_no_new_code',
      reviewed_commit: invocation.candidate_commit,
      based_on_branch_head: handoff.commit,
      review_commit: null,
      verdict: 'approved',
      findings: [],
      readback: makeUnsubmittedReadback(),
      created_at: options.created_at || invocation.created_at
    }, {
      result_id: options.result_id || 'chatgpt-review-result-' + invocation.invocation_id,
      created_at: options.created_at || invocation.created_at
    });

    return {
      plan,
      handoff,
      patch: null,
      submitted_review: null,
      review_json: null,
      result
    };
  }

  const patch = await mcpPort.get_patch({
    repository: toolRepository,
    commit: invocation.candidate_commit
  });

  const verdict = options.verdict || 'approved';
  const findings = Array.isArray(options.findings) ? options.findings : [];
  const summary = options.summary || 'Fake MCP review executor produced a normalized review result.';

  const submittedReview = await mcpPort.submit_review({
    repository: toolRepository,
    commit: invocation.candidate_commit,
    verdict,
    summary,
    findings
  });

  const reviewCommit = requireCommitSha(submittedReview.review_commit, 'submittedReview.review_commit');

  const reviewJson = await mcpPort.get_file_content({
    repository: toolRepository,
    ref: reviewCommit,
    path: 'review.json'
  });

  const result = buildChatGptReviewResult({
    invocation,
    repository: invocation.repository,
    branch: invocation.branch,
    status: 'review_submitted',
    reviewed_commit: invocation.candidate_commit,
    based_on_branch_head: handoff.commit,
    review_commit: reviewCommit,
    verdict,
    findings,
    readback: makeVerifiedReadback(reviewJson),
    created_at: options.created_at || invocation.created_at
  }, {
    result_id: options.result_id || 'chatgpt-review-result-' + invocation.invocation_id,
    created_at: options.created_at || invocation.created_at
  });

  return {
    plan,
    handoff,
    patch,
    submitted_review: submittedReview,
    review_json: reviewJson,
    result
  };
}
