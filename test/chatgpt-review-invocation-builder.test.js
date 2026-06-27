import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { buildChatGptReviewInvocation } from '../src/chatgpt/review-invocation.mjs';

function readJson(path) {
  const raw = readFileSync(resolve(path), 'utf8').replace(/^\uFEFF/, '');
  return JSON.parse(raw);
}

function makeValidator() {
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);
  return ajv.compile(readJson('schemas/chatgpt-review-invocation.schema.json'));
}

describe('ChatGPT review invocation builder', () => {
  it('builds a schema-valid MCP review invocation from review bridge request', () => {
    const validate = makeValidator();
    const request = readJson('fixtures/codex-bridge-request/valid-review-bridge.json');

    const invocation = buildChatGptReviewInvocation(request, {
      invocation_id: 'invocation-builder-mcp-001',
      created_at: '2026-06-27T00:00:00.000Z'
    });

    expect(invocation.protocol).toBe('baijin-chatgpt-review-invocation/1.0');
    expect(invocation.repository).toBe('shunhang776/xinbaijin-mcp');
    expect(invocation.branch).toBe('dev');
    expect(invocation.trigger_key).toBe('REVIEW_MCP_LATEST_HANDOFF');
    expect(invocation.exact_trigger_text).toBe('审查 MCP 最新交接');
    expect(invocation.reviewer).toBe('chatgpt-baijin-reviewer');
    expect(validate(invocation), JSON.stringify(validate.errors)).toBe(true);
  });

  it('builds a schema-valid Claude review invocation from review bridge request', () => {
    const validate = makeValidator();

    const request = {
      protocol: 'baijin-codex-bridge-request/1.0',
      request_id: 'request-claude-review-001',
      bridge_type: 'review_bridge',
      repository: 'shunhang776/xinbaijin',
      branch: 'dev',
      codex_role: 'bridge',
      candidate_commit: '2222222222222222222222222222222222222222',
      trigger_key: 'REVIEW_CLAUDE_LATEST_HANDOFF',
      expected_next_actor: 'chatgpt-baijin-reviewer',
      created_at: '2026-06-27T00:00:00.000Z'
    };

    const invocation = buildChatGptReviewInvocation(request, {
      invocation_id: 'invocation-builder-claude-001',
      created_at: '2026-06-27T00:00:00.000Z'
    });

    expect(invocation.repository).toBe('shunhang776/xinbaijin');
    expect(invocation.branch).toBe('dev');
    expect(invocation.trigger_key).toBe('REVIEW_CLAUDE_LATEST_HANDOFF');
    expect(invocation.exact_trigger_text).toBe('审查 Claude 最新交接');
    expect(validate(invocation), JSON.stringify(validate.errors)).toBe(true);
  });

  it('rejects non-review bridge requests', () => {
    const request = readJson('fixtures/codex-bridge-request/valid-repair-bridge.json');

    expect(() => buildChatGptReviewInvocation(request)).toThrow('review_bridge');
  });

  it('rejects repository and trigger mismatches', () => {
    const request = {
      ...readJson('fixtures/codex-bridge-request/valid-review-bridge.json'),
      trigger_key: 'REVIEW_CLAUDE_LATEST_HANDOFF'
    };

    expect(() => buildChatGptReviewInvocation(request)).toThrow('trigger_key');
  });

  it('rejects non-dev branch and invalid commit sha', () => {
    const request = readJson('fixtures/codex-bridge-request/valid-review-bridge.json');

    expect(() => buildChatGptReviewInvocation({
      ...request,
      branch: 'main'
    })).toThrow('dev branch');

    expect(() => buildChatGptReviewInvocation({
      ...request,
      candidate_commit: 'bad'
    })).toThrow('candidate_commit');
  });
});
