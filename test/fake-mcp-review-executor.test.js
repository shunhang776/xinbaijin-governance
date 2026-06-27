import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { executeFakeMcpReview } from '../src/chatgpt/fake-mcp-review-executor.mjs';

const REVIEW_COMMIT = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const SHA256 = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';

function readJson(path) {
  const raw = readFileSync(resolve(path), 'utf8').replace(/^\uFEFF/, '');
  return JSON.parse(raw);
}

function makeAjv() {
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);
  return ajv;
}

function makeResultValidator() {
  return makeAjv().compile(readJson('schemas/chatgpt-review-result.schema.json'));
}

function makePort(invocation, calls, overrides = {}) {
  return {
    async get_latest_handoff(args) {
      calls.push({
        tool: 'get_latest_handoff',
        args
      });

      return {
        repository: 'xinbaijin-mcp',
        branch: 'dev',
        commit: invocation.candidate_commit,
        commit_message: 'test commit',
        changed_files: ['worker.js']
      };
    },

    async get_patch(args) {
      calls.push({
        tool: 'get_patch',
        args
      });

      return {
        repository: args.repository,
        commit: args.commit,
        patch: 'diff --git a/worker.js b/worker.js'
      };
    },

    async get_file_content(args) {
      calls.push({
        tool: 'get_file_content',
        args
      });

      return {
        repository: args.repository,
        ref: args.ref,
        path: args.path,
        content: '{}',
        sha256: SHA256,
        byte_length: 512,
        line_ending: 'LF',
        final_newline: true
      };
    },

    async submit_review(args) {
      calls.push({
        tool: 'submit_review',
        args
      });

      return {
        repository: args.repository,
        reviewed_commit: args.commit,
        review_commit: REVIEW_COMMIT
      };
    },

    ...overrides
  };
}

describe('fake MCP review executor', () => {
  it('runs approved fake MCP review flow and emits schema-valid ChatGPT review result', async () => {
    const invocation = readJson('fixtures/chatgpt-review-invocation/valid-mcp.json');
    const calls = [];
    const port = makePort(invocation, calls);
    const validate = makeResultValidator();

    const output = await executeFakeMcpReview(invocation, port, {
      result_id: 'chatgpt-review-result-fake-approved-001',
      created_at: '2026-06-27T00:00:00.000Z'
    });

    expect(output.plan.tool_repository).toBe('xinbaijin-mcp');
    expect(output.result.protocol).toBe('baijin-chatgpt-review-result/1.0');
    expect(output.result.status).toBe('review_submitted');
    expect(output.result.verdict).toBe('approved');
    expect(output.result.review_commit).toBe(REVIEW_COMMIT);
    expect(output.result.readback.verified).toBe(true);
    expect(validate(output.result), JSON.stringify(validate.errors)).toBe(true);

    expect(calls.map((call) => call.tool)).toEqual([
      'get_latest_handoff',
      'get_patch',
      'submit_review',
      'get_file_content'
    ]);

    expect(calls.every((call) => call.args.repository === 'xinbaijin-mcp')).toBe(true);
  });

  it('runs changes_requested fake MCP review flow with findings', async () => {
    const invocation = readJson('fixtures/chatgpt-review-invocation/valid-mcp.json');
    const calls = [];
    const port = makePort(invocation, calls);
    const validate = makeResultValidator();

    const output = await executeFakeMcpReview(invocation, port, {
      result_id: 'chatgpt-review-result-fake-changes-001',
      verdict: 'changes_requested',
      findings: [
        {
          severity: 'medium',
          file: 'worker.js',
          line: 12,
          title: 'Sample finding',
          description: 'Sample finding produced by fake executor.',
          recommendation: 'Fix the affected logic.'
        }
      ],
      created_at: '2026-06-27T00:00:00.000Z'
    });

    expect(output.result.verdict).toBe('changes_requested');
    expect(output.result.findings).toHaveLength(1);
    expect(output.submitted_review.review_commit).toBe(REVIEW_COMMIT);
    expect(validate(output.result), JSON.stringify(validate.errors)).toBe(true);

    const submitCall = calls.find((call) => call.tool === 'submit_review');
    expect(submitCall.args.verdict).toBe('changes_requested');
    expect(submitCall.args.findings).toHaveLength(1);
  });

  it('skips submit_review when latest handoff only changes review.json', async () => {
    const invocation = readJson('fixtures/chatgpt-review-invocation/valid-mcp.json');
    const calls = [];
    const port = makePort(invocation, calls, {
      async get_latest_handoff(args) {
        calls.push({
          tool: 'get_latest_handoff',
          args
        });

        return {
          repository: 'xinbaijin-mcp',
          branch: 'dev',
          commit: invocation.candidate_commit,
          commit_message: 'review only',
          changed_files: ['review.json']
        };
      }
    });

    const output = await executeFakeMcpReview(invocation, port, {
      result_id: 'chatgpt-review-result-fake-skipped-001',
      created_at: '2026-06-27T00:00:00.000Z'
    });

    expect(output.result.status).toBe('skipped_no_new_code');
    expect(output.result.review_commit).toBeNull();
    expect(output.submitted_review).toBeNull();
    expect(calls.map((call) => call.tool)).toEqual([
      'get_latest_handoff'
    ]);
  });

  it('rejects repository, branch, and commit mismatches from latest handoff', async () => {
    const invocation = readJson('fixtures/chatgpt-review-invocation/valid-mcp.json');

    await expect(executeFakeMcpReview(invocation, makePort(invocation, [], {
      async get_latest_handoff() {
        return {
          repository: 'xinbaijin',
          branch: 'dev',
          commit: invocation.candidate_commit,
          changed_files: ['worker.js']
        };
      }
    }))).rejects.toThrow('repository');

    await expect(executeFakeMcpReview(invocation, makePort(invocation, [], {
      async get_latest_handoff() {
        return {
          repository: 'xinbaijin-mcp',
          branch: 'main',
          commit: invocation.candidate_commit,
          changed_files: ['worker.js']
        };
      }
    }))).rejects.toThrow('branch');

    await expect(executeFakeMcpReview(invocation, makePort(invocation, [], {
      async get_latest_handoff() {
        return {
          repository: 'xinbaijin-mcp',
          branch: 'dev',
          commit: '2222222222222222222222222222222222222222',
          changed_files: ['worker.js']
        };
      }
    }))).rejects.toThrow('candidate_commit');
  });
});
