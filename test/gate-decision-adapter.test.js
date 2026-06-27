import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import {
  adaptL4AndChatGptReviewToGateDecision,
  adaptL4AndChatGptReviewToGateDecisionObjects
} from '../src/gate/gate-decision-adapter.mjs';

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
    result_id: 'l4-run-result-adapter-accepted-001',
    run_id: 'run-gate-adapter-001',
    task_id: 'task-gate-adapter-001',
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

describe('Gate decision adapter', () => {
  it('adapts accepted L4 run result and approved ChatGPT review result to allowed gate decision', () => {
    const validate = makeValidator();
    const reviewResult = readJson('fixtures/chatgpt-review-result/valid-approved.json');
    const l4RunResult = makeAcceptedRunResult();

    const decision = adaptL4AndChatGptReviewToGateDecision({
      l4_run_result: l4RunResult,
      chatgpt_review_result: reviewResult
    }, {
      decision_id: 'gate-production-decision-adapter-allowed-001',
      created_at: '2026-06-27T00:00:00.000Z'
    });

    expect(decision.protocol).toBe('baijin-gate-production-decision/1.0');
    expect(decision.decision).toBe('allowed');
    expect(decision.reason_code).toBe('all_required_conditions_met');
    expect(decision.candidate_commit).toBe(reviewResult.reviewed_commit);
    expect(decision.reviewed_commit).toBe(reviewResult.reviewed_commit);
    expect(decision.chatgpt_review_result_id).toBe(reviewResult.result_id);
    expect(decision.l4_run_result_id).toBe(l4RunResult.result_id);
    expect(validate(decision), JSON.stringify(validate.errors)).toBe(true);
  });

  it('adapts non-approved ChatGPT review result to denied gate decision', () => {
    const validate = makeValidator();
    const reviewResult = readJson('fixtures/chatgpt-review-result/valid-changes-requested.json');
    const l4RunResult = makeAcceptedRunResult({
      result_id: 'l4-run-result-adapter-denied-001',
      status: 'MANUAL_REQUIRED',
      final_state: 'MANUAL_REQUIRED',
      machine_events: [
        'CODE_DETECTED',
        'CHECKS_STARTED',
        'CHECKS_PASSED',
        'REVIEW_DENIED'
      ]
    });

    const decision = adaptL4AndChatGptReviewToGateDecision({
      l4_run_result: l4RunResult,
      chatgpt_review_result: reviewResult
    }, {
      decision_id: 'gate-production-decision-adapter-denied-001',
      created_at: '2026-06-27T00:00:00.000Z'
    });

    expect(decision.decision).toBe('denied');
    expect(decision.reason_code).toBe('chatgpt_review_not_approved');
    expect(decision.required_conditions.chatgpt_review_approved).toBe(false);
    expect(validate(decision), JSON.stringify(validate.errors)).toBe(true);
  });

  it('adapts stale review machine event to denied stale_review_detected decision', () => {
    const validate = makeValidator();
    const reviewResult = readJson('fixtures/chatgpt-review-result/valid-approved.json');
    const l4RunResult = makeAcceptedRunResult({
      result_id: 'l4-run-result-adapter-stale-001',
      status: 'MANUAL_REQUIRED',
      final_state: 'MANUAL_REQUIRED',
      machine_events: [
        'CODE_DETECTED',
        'CHECKS_STARTED',
        'CHECKS_PASSED',
        'STALE_REVIEW_DETECTED'
      ]
    });

    const decision = adaptL4AndChatGptReviewToGateDecision({
      l4_run_result: l4RunResult,
      chatgpt_review_result: reviewResult
    }, {
      decision_id: 'gate-production-decision-adapter-stale-001',
      created_at: '2026-06-27T00:00:00.000Z'
    });

    expect(decision.decision).toBe('denied');
    expect(decision.reason_code).toBe('stale_review_detected');
    expect(decision.required_conditions.no_stale_review).toBe(false);
    expect(validate(decision), JSON.stringify(validate.errors)).toBe(true);
  });

  it('returns one decision object from object adapter', () => {
    const reviewResult = readJson('fixtures/chatgpt-review-result/valid-approved.json');
    const l4RunResult = makeAcceptedRunResult();

    const decisions = adaptL4AndChatGptReviewToGateDecisionObjects({
      l4_run_result: l4RunResult,
      chatgpt_review_result: reviewResult
    }, {
      decision_id: 'gate-production-decision-adapter-list-001',
      created_at: '2026-06-27T00:00:00.000Z'
    });

    expect(decisions).toHaveLength(1);
    expect(decisions[0].decision).toBe('allowed');
  });

  it('rejects repository, branch, and candidate commit mismatches', () => {
    const reviewResult = readJson('fixtures/chatgpt-review-result/valid-approved.json');

    expect(() => adaptL4AndChatGptReviewToGateDecision({
      l4_run_result: makeAcceptedRunResult({
        repository: 'shunhang776/xinbaijin'
      }),
      chatgpt_review_result: reviewResult
    })).toThrow('repository mismatch');

    expect(() => adaptL4AndChatGptReviewToGateDecision({
      l4_run_result: makeAcceptedRunResult({
        branch: 'main'
      }),
      chatgpt_review_result: reviewResult
    })).toThrow('branch mismatch');

    expect(() => adaptL4AndChatGptReviewToGateDecision({
      l4_run_result: makeAcceptedRunResult(),
      chatgpt_review_result: reviewResult
    }, {
      candidate_commit: '9999999999999999999999999999999999999999'
    })).toThrow('candidate_commit');
  });
});
