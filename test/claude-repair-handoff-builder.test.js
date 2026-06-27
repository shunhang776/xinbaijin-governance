import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { buildClaudeRepairHandoff } from '../src/claude/repair-handoff.mjs';

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
  return makeAjv().compile(readJson('schemas/claude-repair-handoff.schema.json'));
}

describe('Claude repair handoff builder', () => {
  it('builds a schema-valid repair handoff from changes_requested review result', () => {
    const validate = makeValidator();
    const reviewResult = readJson('fixtures/chatgpt-review-result/valid-changes-requested.json');

    const handoff = buildClaudeRepairHandoff(reviewResult, {
      handoff_id: 'claude-repair-handoff-builder-001',
      repair_round: 0,
      max_repair_round: 2,
      created_at: '2026-06-27T00:00:00.000Z'
    });

    expect(handoff.protocol).toBe('baijin-claude-repair-handoff/1.0');
    expect(handoff.handoff_id).toBe('claude-repair-handoff-builder-001');
    expect(handoff.source_review_result_id).toBe(reviewResult.result_id);
    expect(handoff.invocation_id).toBe(reviewResult.invocation_id);
    expect(handoff.repository).toBe('shunhang776/xinbaijin-mcp');
    expect(handoff.branch).toBe('dev');
    expect(handoff.verdict).toBe('changes_requested');
    expect(handoff.findings).toHaveLength(1);
    expect(handoff.target_actor).toBe('claude-code');
    expect(handoff.forbidden_actions).toContain('do not modify review.json');
    expect(validate(handoff), JSON.stringify(validate.errors)).toBe(true);
  });

  it('rejects approved review result', () => {
    const reviewResult = readJson('fixtures/chatgpt-review-result/valid-approved.json');

    expect(() => buildClaudeRepairHandoff(reviewResult)).toThrow('changes_requested');
  });

  it('rejects changes_requested review result without findings', () => {
    const reviewResult = {
      ...readJson('fixtures/chatgpt-review-result/valid-changes-requested.json'),
      findings: []
    };

    expect(() => buildClaudeRepairHandoff(reviewResult)).toThrow('at least one finding');
  });

  it('rejects invalid repair round values', () => {
    const reviewResult = readJson('fixtures/chatgpt-review-result/valid-changes-requested.json');

    expect(() => buildClaudeRepairHandoff(reviewResult, {
      repair_round: 3,
      max_repair_round: 2
    })).toThrow('repair_round');

    expect(() => buildClaudeRepairHandoff(reviewResult, {
      repair_round: -1,
      max_repair_round: 2
    })).toThrow('repair_round');
  });

  it('allows custom forbidden actions', () => {
    const validate = makeValidator();
    const reviewResult = readJson('fixtures/chatgpt-review-result/valid-changes-requested.json');

    const handoff = buildClaudeRepairHandoff(reviewResult, {
      handoff_id: 'claude-repair-handoff-custom-forbidden-001',
      forbidden_actions: [
        'do not edit review.json',
        'do not push directly to dev'
      ],
      created_at: '2026-06-27T00:00:00.000Z'
    });

    expect(handoff.forbidden_actions).toEqual([
      'do not edit review.json',
      'do not push directly to dev'
    ]);
    expect(validate(handoff), JSON.stringify(validate.errors)).toBe(true);
  });
});
