import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { buildGateProductionDecision } from '../src/gate/production-decision.mjs';

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
  return makeAjv().compile(readJson('schemas/gate-production-decision.schema.json'));
}

function makeAcceptedRunResult(overrides = {}) {
  return {
    protocol: 'baijin-l4-run-result/1.0',
    result_id: 'l4-run-result-accepted-001',
    run_id: 'run-gate-production-001',
    task_id: 'task-gate-production-001',
    repository: 'shunhang776/xinbaijin-mcp',
    branch: 'dev',
    status: 'COMPLETED',
    final_state: 'ACCEPTED',
    machine_events: [
      'CODE_DETECTED',
      'CHECKS_STARTED',
      'CHECKS_PASSED',
      'REVIEW_APPROVED',
      'GATE_ALLOWED'
    ],
    events: [],
    task_state: {},
    errors: [],
    created_at: '2026-06-27T00:00:00.000Z',
    ...overrides
  };
}

describe('Gate production decision builder', () => {
  it('builds a schema-valid allowed production gate decision', () => {
    const validate = makeValidator();
    const reviewResult = readJson('fixtures/chatgpt-review-result/valid-approved.json');
    const l4RunResult = makeAcceptedRunResult();

    const decision = buildGateProductionDecision({
      l4_run_result: l4RunResult,
      chatgpt_review_result: reviewResult
    }, {
      decision_id: 'gate-production-decision-builder-allowed-001',
      candidate_commit: reviewResult.reviewed_commit,
      created_at: '2026-06-27T00:00:00.000Z'
    });

    expect(decision.protocol).toBe('baijin-gate-production-decision/1.0');
    expect(decision.decision).toBe('allowed');
    expect(decision.reason_code).toBe('all_required_conditions_met');
    expect(decision.review_verdict).toBe('approved');
    expect(decision.l4_final_state).toBe('ACCEPTED');
    expect(Object.values(decision.required_conditions).every(Boolean)).toBe(true);
    expect(validate(decision), JSON.stringify(validate.errors)).toBe(true);
  });

  it('denies production gate when ChatGPT review is not approved', () => {
    const validate = makeValidator();
    const reviewResult = readJson('fixtures/chatgpt-review-result/valid-changes-requested.json');
    const l4RunResult = makeAcceptedRunResult({
      status: 'MANUAL_REQUIRED',
      final_state: 'MANUAL_REQUIRED',
      machine_events: [
        'CODE_DETECTED',
        'CHECKS_STARTED',
        'CHECKS_PASSED',
        'REVIEW_DENIED'
      ]
    });

    const decision = buildGateProductionDecision({
      l4_run_result: l4RunResult,
      chatgpt_review_result: reviewResult
    }, {
      decision_id: 'gate-production-decision-builder-denied-review-001',
      candidate_commit: reviewResult.reviewed_commit,
      created_at: '2026-06-27T00:00:00.000Z'
    });

    expect(decision.decision).toBe('denied');
    expect(decision.reason_code).toBe('chatgpt_review_not_approved');
    expect(decision.required_conditions.chatgpt_review_approved).toBe(false);
    expect(validate(decision), JSON.stringify(validate.errors)).toBe(true);
  });

  it('denies production gate when readback is not fully verified', () => {
    const validate = makeValidator();
    const reviewResult = {
      ...readJson('fixtures/chatgpt-review-result/valid-approved.json'),
      readback: {
        ...readJson('fixtures/chatgpt-review-result/valid-approved.json').readback,
        verified: false
      }
    };
    const l4RunResult = makeAcceptedRunResult();

    const decision = buildGateProductionDecision({
      l4_run_result: l4RunResult,
      chatgpt_review_result: reviewResult
    }, {
      decision_id: 'gate-production-decision-builder-denied-readback-001',
      candidate_commit: reviewResult.reviewed_commit,
      created_at: '2026-06-27T00:00:00.000Z'
    });

    expect(decision.decision).toBe('denied');
    expect(decision.reason_code).toBe('review_readback_not_verified');
    expect(decision.required_conditions.review_readback_verified).toBe(false);
    expect(validate(decision), JSON.stringify(validate.errors)).toBe(true);
  });

  it('denies production gate when L4 is not accepted', () => {
    const validate = makeValidator();
    const reviewResult = readJson('fixtures/chatgpt-review-result/valid-approved.json');
    const l4RunResult = makeAcceptedRunResult({
      status: 'IN_PROGRESS',
      final_state: 'REVIEW_APPROVED',
      machine_events: [
        'CODE_DETECTED',
        'CHECKS_STARTED',
        'CHECKS_PASSED',
        'REVIEW_APPROVED'
      ]
    });

    const decision = buildGateProductionDecision({
      l4_run_result: l4RunResult,
      chatgpt_review_result: reviewResult
    }, {
      decision_id: 'gate-production-decision-builder-denied-l4-001',
      candidate_commit: reviewResult.reviewed_commit,
      created_at: '2026-06-27T00:00:00.000Z'
    });

    expect(decision.decision).toBe('denied');
    expect(decision.reason_code).toBe('l4_not_accepted');
    expect(decision.required_conditions.l4_accepted).toBe(false);
    expect(validate(decision), JSON.stringify(validate.errors)).toBe(true);
  });

  it('rejects repository mismatch', () => {
    const reviewResult = readJson('fixtures/chatgpt-review-result/valid-approved.json');
    const l4RunResult = makeAcceptedRunResult({
      repository: 'shunhang776/xinbaijin'
    });

    expect(() => buildGateProductionDecision({
      l4_run_result: l4RunResult,
      chatgpt_review_result: reviewResult
    }, {
      candidate_commit: reviewResult.reviewed_commit
    })).toThrow('repository mismatch');
  });

  it('rejects candidate commit mismatch', () => {
    const reviewResult = readJson('fixtures/chatgpt-review-result/valid-approved.json');
    const l4RunResult = makeAcceptedRunResult();

    expect(() => buildGateProductionDecision({
      l4_run_result: l4RunResult,
      chatgpt_review_result: reviewResult
    }, {
      candidate_commit: '9999999999999999999999999999999999999999'
    })).toThrow('candidate_commit');
  });
});
