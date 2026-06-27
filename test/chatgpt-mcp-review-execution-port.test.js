import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  assertMcpReviewExecutionPort,
  buildMcpReviewExecutionPlan,
  mapInvocationRepositoryToToolRepository
} from '../src/chatgpt/mcp-review-execution-port.mjs';

function readJson(path) {
  const raw = readFileSync(resolve(path), 'utf8').replace(/^\uFEFF/, '');
  return JSON.parse(raw);
}

function makePort(overrides = {}) {
  return {
    get_latest_handoff: async () => ({}),
    get_patch: async () => ({}),
    get_file_content: async () => ({}),
    submit_review: async () => ({}),
    ...overrides
  };
}

describe('ChatGPT MCP review execution port', () => {
  it('accepts a complete MCP review execution port', () => {
    const port = makePort();

    expect(assertMcpReviewExecutionPort(port)).toBe(port);
  });

  it('rejects an incomplete MCP review execution port', () => {
    expect(() => assertMcpReviewExecutionPort({})).toThrow('missing method');
    expect(() => assertMcpReviewExecutionPort(makePort({
      submit_review: undefined
    }))).toThrow('submit_review');
  });

  it('maps invocation repository to explicit MCP tool repository', () => {
    expect(mapInvocationRepositoryToToolRepository('shunhang776/xinbaijin')).toBe('xinbaijin');
    expect(mapInvocationRepositoryToToolRepository('shunhang776/xinbaijin-mcp')).toBe('xinbaijin-mcp');

    expect(() => mapInvocationRepositoryToToolRepository('shunhang776/unknown')).toThrow('unsupported');
  });

  it('builds MCP review execution plan for MCP repository invocation', () => {
    const invocation = readJson('fixtures/chatgpt-review-invocation/valid-mcp.json');

    const plan = buildMcpReviewExecutionPlan(invocation, {
      plan_id: 'plan-mcp-001',
      created_at: '2026-06-27T00:00:00.000Z'
    });

    expect(plan.protocol).toBe('baijin-mcp-review-execution-plan/1.0');
    expect(plan.plan_id).toBe('plan-mcp-001');
    expect(plan.repository).toBe('shunhang776/xinbaijin-mcp');
    expect(plan.tool_repository).toBe('xinbaijin-mcp');
    expect(plan.branch).toBe('dev');
    expect(plan.candidate_commit).toBe(invocation.candidate_commit);
    expect(plan.required_tools).toEqual([
      'get_latest_handoff',
      'get_patch',
      'get_file_content',
      'submit_review'
    ]);
    expect(plan.steps.map((step) => step.tool).filter(Boolean)).toContain('submit_review');
    expect(plan.steps.map((step) => step.action).filter(Boolean)).toContain('readback_verify');
  });

  it('builds MCP review execution plan for Claude repository invocation', () => {
    const invocation = readJson('fixtures/chatgpt-review-invocation/valid-claude.json');

    const plan = buildMcpReviewExecutionPlan(invocation, {
      plan_id: 'plan-claude-001',
      created_at: '2026-06-27T00:00:00.000Z'
    });

    expect(plan.repository).toBe('shunhang776/xinbaijin');
    expect(plan.tool_repository).toBe('xinbaijin');
    expect(plan.trigger_key).toBe('REVIEW_CLAUDE_LATEST_HANDOFF');
    expect(plan.exact_trigger_text).toBe('审查 Claude 最新交接');
  });

  it('rejects branch, trigger, and commit mismatches', () => {
    const invocation = readJson('fixtures/chatgpt-review-invocation/valid-mcp.json');

    expect(() => buildMcpReviewExecutionPlan({
      ...invocation,
      branch: 'main'
    })).toThrow('dev branch');

    expect(() => buildMcpReviewExecutionPlan({
      ...invocation,
      trigger_key: 'REVIEW_CLAUDE_LATEST_HANDOFF'
    })).toThrow('trigger_key');

    expect(() => buildMcpReviewExecutionPlan({
      ...invocation,
      candidate_commit: 'bad'
    })).toThrow('candidate_commit');
  });
});
