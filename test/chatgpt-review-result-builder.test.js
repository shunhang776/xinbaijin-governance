import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { buildChatGptReviewResult } from '../src/chatgpt/review-result.mjs';

function readJson(path) {
  const raw = readFileSync(resolve(path), 'utf8').replace(/^\uFEFF/, '');
  return JSON.parse(raw);
}

function makeAjv() {
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);
  return ajv;
}

function makeValidator() {
  return makeAjv().compile(readJson('schemas/chatgpt-review-result.schema.json'));
}

function makeInvocation() {
  return readJson('fixtures/chatgpt-review-invocation/valid-mcp.json');
}

function makeReadback() {
  return {
    verified: true,
    reviewed_commit_matches: true,
    based_on_branch_head_matches: true,
    verdict_matches: true,
    findings_match: true,
    utf8_valid: true,
    sha256: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    byte_length: 512,
    line_ending: 'LF',
    final_newline: true
  };
}

describe('ChatGPT review result builder', () => {
  it('builds a schema-valid approved review result', () => {
    const validate = makeValidator();
    const invocation = makeInvocation();

    const result = buildChatGptReviewResult({
      invocation,
      repository: invocation.repository,
      branch: invocation.branch,
      status: 'review_submitted',
      reviewed_commit: invocation.candidate_commit,
      based_on_branch_head: invocation.candidate_commit,
      review_commit: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      verdict: 'approved',
      findings: [],
      readback: makeReadback(),
      created_at: '2026-06-27T00:00:00.000Z'
    }, {
      result_id: 'chatgpt-review-result-builder-approved-001',
      created_at: '2026-06-27T00:00:00.000Z'
    });

    expect(result.protocol).toBe('baijin-chatgpt-review-result/1.0');
    expect(result.invocation_id).toBe(invocation.invocation_id);
    expect(result.repository).toBe('shunhang776/xinbaijin-mcp');
    expect(result.branch).toBe('dev');
    expect(result.verdict).toBe('approved');
    expect(result.findings).toEqual([]);
    expect(result.readback.verified).toBe(true);
    expect(validate(result), JSON.stringify(validate.errors)).toBe(true);
  });

  it('builds a schema-valid changes_requested review result with findings', () => {
    const validate = makeValidator();
    const invocation = makeInvocation();

    const result = buildChatGptReviewResult({
      invocation,
      repository: invocation.repository,
      branch: invocation.branch,
      status: 'review_submitted',
      reviewed_commit: invocation.candidate_commit,
      based_on_branch_head: invocation.candidate_commit,
      review_commit: 'cccccccccccccccccccccccccccccccccccccccc',
      verdict: 'changes_requested',
      findings: [
        {
          severity: 'medium',
          file: 'worker.js',
          line: 12,
          title: 'Sample finding',
          description: 'Sample review finding for builder validation.',
          recommendation: 'Fix the affected logic before continuing the L4 loop.'
        }
      ],
      readback: makeReadback(),
      created_at: '2026-06-27T00:00:00.000Z'
    }, {
      result_id: 'chatgpt-review-result-builder-changes-001',
      created_at: '2026-06-27T00:00:00.000Z'
    });

    expect(result.verdict).toBe('changes_requested');
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0].file).toBe('worker.js');
    expect(validate(result), JSON.stringify(validate.errors)).toBe(true);
  });

  it('rejects review_submitted without review_commit', () => {
    const invocation = makeInvocation();

    expect(() => buildChatGptReviewResult({
      invocation,
      repository: invocation.repository,
      branch: invocation.branch,
      status: 'review_submitted',
      reviewed_commit: invocation.candidate_commit,
      based_on_branch_head: invocation.candidate_commit,
      review_commit: null,
      verdict: 'approved',
      findings: [],
      readback: makeReadback()
    })).toThrow('review_commit');
  });

  it('rejects unverified readback for review_submitted', () => {
    const invocation = makeInvocation();

    expect(() => buildChatGptReviewResult({
      invocation,
      repository: invocation.repository,
      branch: invocation.branch,
      status: 'review_submitted',
      reviewed_commit: invocation.candidate_commit,
      based_on_branch_head: invocation.candidate_commit,
      review_commit: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      verdict: 'approved',
      findings: [],
      readback: {
        ...makeReadback(),
        verified: false
      }
    })).toThrow('fully verified readback');
  });

  it('rejects invocation mismatch and invalid findings', () => {
    const invocation = makeInvocation();

    expect(() => buildChatGptReviewResult({
      invocation,
      repository: 'shunhang776/xinbaijin',
      branch: invocation.branch,
      status: 'review_submitted',
      reviewed_commit: invocation.candidate_commit,
      based_on_branch_head: invocation.candidate_commit,
      review_commit: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      verdict: 'approved',
      findings: [],
      readback: makeReadback()
    })).toThrow('repository');

    expect(() => buildChatGptReviewResult({
      invocation,
      repository: invocation.repository,
      branch: invocation.branch,
      status: 'review_submitted',
      reviewed_commit: invocation.candidate_commit,
      based_on_branch_head: invocation.candidate_commit,
      review_commit: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      verdict: 'changes_requested',
      findings: [
        {
          severity: 'medium',
          file: 'worker.js',
          line: 0,
          title: 'Bad line',
          description: 'Invalid line should be rejected.',
          recommendation: 'Use a valid line.'
        }
      ],
      readback: makeReadback()
    })).toThrow('line');
  });
});
