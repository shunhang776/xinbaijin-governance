import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { evaluateReviewGuard } from '../src/l4/review-guard.mjs';
import { runCodexResultL4Pipeline } from '../src/l4/l4-codex-pipeline.mjs';
import { findL4StateField } from '../src/l4/task-state-snapshot.mjs';

const SHA_A = '1111111111111111111111111111111111111111';
const SHA_B = '2222222222222222222222222222222222222222';
const REVIEW_SHA = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';

function readJson(path) {
  const raw = readFileSync(resolve(path), 'utf8').replace(/^\uFEFF/, '');
  return JSON.parse(raw);
}

function makeAjv() {
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);
  return ajv;
}

function makeEventValidator() {
  return makeAjv().compile(readJson('schemas/l4-event.schema.json'));
}

function makeTaskStateValidator() {
  return makeAjv().compile(readJson('schemas/l4-task-state.schema.json'));
}

function makeTaskState(taskId = 'task-review-guard-pipeline-001') {
  return {
    ...readJson('fixtures/l4/task-state/valid-minimal.json'),
    task_id: taskId,
    repository: 'shunhang776/xinbaijin-mcp',
    branch: 'dev'
  };
}

function makeEventTemplate(taskId = 'task-review-guard-pipeline-001') {
  return {
    ...readJson('fixtures/l4/event/valid-minimal.json'),
    event_id: 'event-template-review-guard',
    task_id: taskId,
    actor: 'system',
    repository: 'shunhang776/xinbaijin-mcp',
    branch: 'dev',
    created_at: '2026-06-27T00:00:00.000Z'
  };
}

function makeEvent(taskId, eventType, index) {
  return {
    ...readJson('fixtures/l4/event/valid-minimal.json'),
    event_id: 'event-review-guard-pipeline-' + String(index).padStart(2, '0') + '-' + eventType.toLowerCase().replace(/_/g, '-'),
    task_id: taskId,
    event_type: eventType,
    actor: 'system',
    repository: 'shunhang776/xinbaijin-mcp',
    branch: 'dev',
    created_at: '2026-06-27T00:00:00.000Z'
  };
}

function makeGuard(taskId, overrides = {}) {
  return evaluateReviewGuard({
    task_id: taskId,
    run_id: 'run-review-guard-pipeline-001',
    repository: 'shunhang776/xinbaijin-mcp',
    branch: 'dev',
    reviewed_commit: SHA_A,
    based_on_branch_head: SHA_A,
    current_branch_head: SHA_A,
    review_commit: REVIEW_SHA,
    verdict: 'approved',
    created_at: '2026-06-27T00:00:00.000Z',
    ...overrides
  });
}

describe('L4 review guard pipeline integration', () => {
  it('does not inject guard events when review guard is fresh', () => {
    const taskId = 'task-review-guard-pipeline-fresh-001';
    const validateEvent = makeEventValidator();
    const validateTaskState = makeTaskStateValidator();

    const output = runCodexResultL4Pipeline({
      baseTaskState: makeTaskState(taskId),
      eventTemplate: makeEventTemplate(taskId),
      validateEvent,
      initialEvents: [
        makeEvent(taskId, 'CODE_DETECTED', 1),
        makeEvent(taskId, 'CHECKS_STARTED', 2),
        makeEvent(taskId, 'CHECKS_PASSED', 3)
      ],
      reviewGuards: [
        makeGuard(taskId)
      ],
      tailEvents: [
        makeEvent(taskId, 'REVIEW_APPROVED', 4),
        makeEvent(taskId, 'GATE_ALLOWED', 5)
      ],
      snapshotOptions: { updated_at: '2026-06-27T00:00:00.000Z' }
    });

    const stateField = findL4StateField(output.task_state);

    expect(output.machine_events).not.toContain('STALE_REVIEW_DETECTED');
    expect(output.machine_events).not.toContain('BRANCH_HEAD_CHANGED');
    expect(output.final_state).toBe('ACCEPTED');
    expect(output.task_state[stateField]).toBe('ACCEPTED');
    expect(validateTaskState(output.task_state), JSON.stringify(validateTaskState.errors)).toBe(true);
  });

  it('injects STALE_REVIEW_DETECTED and reaches MANUAL_REQUIRED', () => {
    const taskId = 'task-review-guard-pipeline-stale-001';
    const validateEvent = makeEventValidator();
    const validateTaskState = makeTaskStateValidator();

    const output = runCodexResultL4Pipeline({
      baseTaskState: makeTaskState(taskId),
      eventTemplate: makeEventTemplate(taskId),
      validateEvent,
      initialEvents: [
        makeEvent(taskId, 'CODE_DETECTED', 1),
        makeEvent(taskId, 'CHECKS_STARTED', 2),
        makeEvent(taskId, 'CHECKS_PASSED', 3)
      ],
      reviewGuards: [
        makeGuard(taskId, {
          reviewed_commit: SHA_B,
          based_on_branch_head: SHA_A,
          current_branch_head: SHA_A
        })
      ],
      snapshotOptions: { updated_at: '2026-06-27T00:00:00.000Z' }
    });

    const stateField = findL4StateField(output.task_state);

    expect(output.machine_events).toContain('STALE_REVIEW_DETECTED');
    expect(output.final_state).toBe('MANUAL_REQUIRED');
    expect(output.task_state[stateField]).toBe('MANUAL_REQUIRED');
    expect(validateTaskState(output.task_state), JSON.stringify(validateTaskState.errors)).toBe(true);
  });

  it('injects BRANCH_HEAD_CHANGED and reaches MANUAL_REQUIRED', () => {
    const taskId = 'task-review-guard-pipeline-head-changed-001';
    const validateEvent = makeEventValidator();
    const validateTaskState = makeTaskStateValidator();

    const output = runCodexResultL4Pipeline({
      baseTaskState: makeTaskState(taskId),
      eventTemplate: makeEventTemplate(taskId),
      validateEvent,
      initialEvents: [
        makeEvent(taskId, 'CODE_DETECTED', 1),
        makeEvent(taskId, 'CHECKS_STARTED', 2),
        makeEvent(taskId, 'CHECKS_PASSED', 3)
      ],
      reviewGuards: [
        makeGuard(taskId, {
          reviewed_commit: SHA_B,
          based_on_branch_head: SHA_A,
          current_branch_head: SHA_B
        })
      ],
      snapshotOptions: { updated_at: '2026-06-27T00:00:00.000Z' }
    });

    const stateField = findL4StateField(output.task_state);

    expect(output.machine_events).toContain('BRANCH_HEAD_CHANGED');
    expect(output.final_state).toBe('MANUAL_REQUIRED');
    expect(output.task_state[stateField]).toBe('MANUAL_REQUIRED');
    expect(validateTaskState(output.task_state), JSON.stringify(validateTaskState.errors)).toBe(true);
  });
});
