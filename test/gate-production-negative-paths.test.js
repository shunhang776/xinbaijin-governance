import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { adaptL4AndChatGptReviewToGateDecision } from '../src/gate/gate-decision-adapter.mjs';
import { gateDecisionToL4EventObjects } from '../src/gate/gate-decision-l4-adapter.mjs';
import { runCodexResultL4Pipeline } from '../src/l4/l4-codex-pipeline.mjs';

function readJson(path) {
  const raw = readFileSync(resolve(path), 'utf8').replace(/^\uFEFF/, '');
  return JSON.parse(raw);
}

function makeAjv() {
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);
  return ajv;
}

function makeGateDecisionValidator() {
  return makeAjv().compile(readJson('schemas/gate-production-decision.schema.json'));
}

function makeEventValidator() {
  return makeAjv().compile(readJson('schemas/l4-event.schema.json'));
}

function makeTaskStateValidator() {
  return makeAjv().compile(readJson('schemas/l4-task-state.schema.json'));
}

function findL4StateField(snapshot) {
  for (const key of ['l4_state', 'state', 'status']) {
    if (typeof snapshot[key] === 'string') {
      return key;
    }
  }

  throw new Error('cannot find L4 state field');
}

function makeRunResult(overrides = {}) {
  return {
    protocol: 'baijin-l4-run-result/1.0',
    result_id: 'l4-run-result-negative-path-001',
    run_id: 'run-gate-negative-path-001',
    task_id: 'task-gate-negative-path-001',
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

function makeEvent(taskId, eventType, index) {
  return {
    protocol: 'baijin-l4-event/1.0',
    event_id: 'event-gate-negative-' + String(index).padStart(2, '0') + '-' + eventType.toLowerCase().replace(/_/g, '-'),
    task_id: taskId,
    event_type: eventType,
    actor: 'system',
    repository: 'shunhang776/xinbaijin-mcp',
    branch: 'dev',
    repair_round: 0,
    payload: {},
    created_at: '2026-06-27T00:00:00.000Z'
  };
}

describe('Gate production negative paths', () => {
  it('denies production when ChatGPT review is not approved', () => {
    const validate = makeGateDecisionValidator();
    const reviewResult = readJson('fixtures/chatgpt-review-result/valid-changes-requested.json');
    const l4RunResult = makeRunResult({
      result_id: 'l4-run-result-negative-not-approved-001',
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
      decision_id: 'gate-production-negative-not-approved-001',
      created_at: '2026-06-27T00:00:00.000Z'
    });

    expect(decision.decision).toBe('denied');
    expect(decision.reason_code).toBe('chatgpt_review_not_approved');
    expect(decision.required_conditions.chatgpt_review_approved).toBe(false);
    expect(validate(decision), JSON.stringify(validate.errors)).toBe(true);
  });

  it('denies production when review readback is not verified', () => {
    const validate = makeGateDecisionValidator();
    const approved = readJson('fixtures/chatgpt-review-result/valid-approved.json');
    const reviewResult = {
      ...approved,
      readback: {
        ...approved.readback,
        verified: false
      }
    };

    const decision = adaptL4AndChatGptReviewToGateDecision({
      l4_run_result: makeRunResult({
        result_id: 'l4-run-result-negative-readback-001'
      }),
      chatgpt_review_result: reviewResult
    }, {
      decision_id: 'gate-production-negative-readback-001',
      created_at: '2026-06-27T00:00:00.000Z'
    });

    expect(decision.decision).toBe('denied');
    expect(decision.reason_code).toBe('review_readback_not_verified');
    expect(decision.required_conditions.review_readback_verified).toBe(false);
    expect(validate(decision), JSON.stringify(validate.errors)).toBe(true);
  });

  it('denies production when stale review is detected', () => {
    const validate = makeGateDecisionValidator();
    const reviewResult = readJson('fixtures/chatgpt-review-result/valid-approved.json');
    const l4RunResult = makeRunResult({
      result_id: 'l4-run-result-negative-stale-001',
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
      decision_id: 'gate-production-negative-stale-001',
      created_at: '2026-06-27T00:00:00.000Z'
    });

    expect(decision.decision).toBe('denied');
    expect(decision.reason_code).toBe('stale_review_detected');
    expect(decision.required_conditions.no_stale_review).toBe(false);
    expect(validate(decision), JSON.stringify(validate.errors)).toBe(true);
  });

  it('denies production when branch head changed', () => {
    const validate = makeGateDecisionValidator();
    const reviewResult = readJson('fixtures/chatgpt-review-result/valid-approved.json');
    const l4RunResult = makeRunResult({
      result_id: 'l4-run-result-negative-branch-head-001',
      status: 'MANUAL_REQUIRED',
      final_state: 'MANUAL_REQUIRED',
      machine_events: [
        'CODE_DETECTED',
        'CHECKS_STARTED',
        'CHECKS_PASSED',
        'BRANCH_HEAD_CHANGED'
      ]
    });

    const decision = adaptL4AndChatGptReviewToGateDecision({
      l4_run_result: l4RunResult,
      chatgpt_review_result: reviewResult
    }, {
      decision_id: 'gate-production-negative-branch-head-001',
      created_at: '2026-06-27T00:00:00.000Z'
    });

    expect(decision.decision).toBe('denied');
    expect(decision.reason_code).toBe('branch_head_changed');
    expect(decision.required_conditions.branch_head_unchanged).toBe(false);
    expect(validate(decision), JSON.stringify(validate.errors)).toBe(true);
  });

  it('maps denied production gate decision to GATE_DENIED and MANUAL_REQUIRED', () => {
    const reviewResult = readJson('fixtures/chatgpt-review-result/valid-approved.json');
    const l4RunResult = makeRunResult({
      result_id: 'l4-run-result-negative-event-001',
      status: 'MANUAL_REQUIRED',
      final_state: 'MANUAL_REQUIRED',
      machine_events: [
        'CODE_DETECTED',
        'CHECKS_STARTED',
        'CHECKS_PASSED',
        'BRANCH_HEAD_CHANGED'
      ]
    });

    const decision = adaptL4AndChatGptReviewToGateDecision({
      l4_run_result: l4RunResult,
      chatgpt_review_result: reviewResult
    }, {
      decision_id: 'gate-production-negative-event-001',
      created_at: '2026-06-27T00:00:00.000Z'
    });

    const gateEvents = gateDecisionToL4EventObjects(decision, {
      event_id: 'event-gate-negative-denied-001',
      task_id: 'task-gate-negative-event-001',
      run_id: 'run-gate-negative-event-001',
      created_at: '2026-06-27T00:00:00.000Z'
    });

    const validateEvent = makeEventValidator();
    const validateTaskState = makeTaskStateValidator();
    const baseTaskState = readJson('fixtures/l4/task-state/valid-minimal.json');

    const output = runCodexResultL4Pipeline({
      baseTaskState,
      initialEvents: [
        makeEvent('task-gate-negative-event-001', 'CODE_DETECTED', 1),
        makeEvent('task-gate-negative-event-001', 'CHECKS_STARTED', 2),
        makeEvent('task-gate-negative-event-001', 'CHECKS_PASSED', 3),
        makeEvent('task-gate-negative-event-001', 'REVIEW_APPROVED', 4),
        ...gateEvents
      ],
      codexResults: [],
      reviewGuards: [],
      tailEvents: [],
      eventTemplate: makeEvent('task-gate-negative-event-001', 'TOOL_ERROR', 99),
      validateEvent,
      snapshotOptions: {
        updated_at: '2026-06-27T00:00:00.000Z'
      }
    });

    const stateField = findL4StateField(output.task_state);

    expect(decision.decision).toBe('denied');
    expect(decision.reason_code).toBe('branch_head_changed');
    expect(gateEvents).toHaveLength(1);
    expect(gateEvents[0].event_type).toBe('GATE_DENIED');
    expect(validateEvent(gateEvents[0]), JSON.stringify(validateEvent.errors)).toBe(true);
    expect(output.machine_events).toContain('GATE_DENIED');
    expect(output.final_state).toBe('MANUAL_REQUIRED');
    expect(output.task_state[stateField]).toBe('MANUAL_REQUIRED');
    expect(validateTaskState(output.task_state), JSON.stringify(validateTaskState.errors)).toBe(true);
  });
});
