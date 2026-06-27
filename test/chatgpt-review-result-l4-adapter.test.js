import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import {
  chatGptReviewResultToL4EventObjects,
  chatGptReviewResultToReviewGuard
} from '../src/l4/chatgpt-review-result-adapter.mjs';
import { runCodexResultL4Pipeline } from '../src/l4/l4-codex-pipeline.mjs';
import { findL4StateField } from '../src/l4/task-state-snapshot.mjs';

const SHA_A = '1111111111111111111111111111111111111111';
const SHA_B = '2222222222222222222222222222222222222222';

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

function makeTaskState(taskId = 'task-chatgpt-review-result-l4-001') {
  return {
    ...readJson('fixtures/l4/task-state/valid-minimal.json'),
    task_id: taskId,
    repository: 'shunhang776/xinbaijin-mcp',
    branch: 'dev'
  };
}

function makeEventTemplate(taskId = 'task-chatgpt-review-result-l4-001') {
  return {
    ...readJson('fixtures/l4/event/valid-minimal.json'),
    event_id: 'event-template-chatgpt-review-result-l4',
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
    event_id: 'event-chatgpt-review-result-l4-' + String(index).padStart(2, '0') + '-' + eventType.toLowerCase().replace(/_/g, '-'),
    task_id: taskId,
    event_type: eventType,
    actor: 'system',
    repository: 'shunhang776/xinbaijin-mcp',
    branch: 'dev',
    created_at: '2026-06-27T00:00:00.000Z'
  };
}

describe('ChatGPT review result to L4 adapter', () => {
  it('maps approved ChatGPT review result to fresh guard and REVIEW_APPROVED event', () => {
    const taskId = 'task-chatgpt-review-approved-001';
    const result = readJson('fixtures/chatgpt-review-result/valid-approved.json');
    const validateEvent = makeEventValidator();

    const output = chatGptReviewResultToL4EventObjects(result, makeEventTemplate(taskId), {
      task_id: taskId,
      run_id: 'run-chatgpt-review-approved-001',
      current_branch_head: result.based_on_branch_head,
      created_at: '2026-06-27T00:00:00.000Z'
    });

    expect(output.guard.guard_status).toBe('fresh');
    expect(output.events).toHaveLength(1);
    expect(output.events[0].event_type).toBe('REVIEW_APPROVED');
    expect(validateEvent(output.events[0]), JSON.stringify(validateEvent.errors)).toBe(true);
  });

  it('maps changes_requested ChatGPT review result to REVIEW_DENIED event', () => {
    const taskId = 'task-chatgpt-review-denied-001';
    const result = readJson('fixtures/chatgpt-review-result/valid-changes-requested.json');
    const validateEvent = makeEventValidator();

    const output = chatGptReviewResultToL4EventObjects(result, makeEventTemplate(taskId), {
      task_id: taskId,
      run_id: 'run-chatgpt-review-denied-001',
      current_branch_head: result.based_on_branch_head,
      created_at: '2026-06-27T00:00:00.000Z'
    });

    expect(output.guard.guard_status).toBe('fresh');
    expect(output.events).toHaveLength(1);
    expect(output.events[0].event_type).toBe('REVIEW_DENIED');
    expect(validateEvent(output.events[0]), JSON.stringify(validateEvent.errors)).toBe(true);
  });

  it('maps stale review result to STALE_REVIEW_DETECTED instead of verdict event', () => {
    const taskId = 'task-chatgpt-review-stale-001';
    const result = {
      ...readJson('fixtures/chatgpt-review-result/valid-approved.json'),
      reviewed_commit: SHA_B,
      based_on_branch_head: SHA_A
    };

    const output = chatGptReviewResultToL4EventObjects(result, makeEventTemplate(taskId), {
      task_id: taskId,
      run_id: 'run-chatgpt-review-stale-001',
      current_branch_head: SHA_A,
      created_at: '2026-06-27T00:00:00.000Z'
    });

    expect(output.guard.guard_status).toBe('stale_review');
    expect(output.events).toHaveLength(1);
    expect(output.events[0].event_type).toBe('STALE_REVIEW_DETECTED');
  });

  it('maps branch head change to BRANCH_HEAD_CHANGED instead of verdict event', () => {
    const taskId = 'task-chatgpt-review-head-changed-001';
    const result = readJson('fixtures/chatgpt-review-result/valid-approved.json');

    const guard = chatGptReviewResultToReviewGuard(result, {
      task_id: taskId,
      run_id: 'run-chatgpt-review-head-changed-001',
      current_branch_head: SHA_B,
      created_at: '2026-06-27T00:00:00.000Z'
    });

    const output = chatGptReviewResultToL4EventObjects(result, makeEventTemplate(taskId), {
      task_id: taskId,
      run_id: 'run-chatgpt-review-head-changed-001',
      current_branch_head: SHA_B,
      created_at: '2026-06-27T00:00:00.000Z'
    });

    expect(guard.guard_status).toBe('branch_head_changed');
    expect(output.guard.guard_status).toBe('branch_head_changed');
    expect(output.events).toHaveLength(1);
    expect(output.events[0].event_type).toBe('BRANCH_HEAD_CHANGED');
  });

  it('drives L4 pipeline from approved review result into ACCEPTED', () => {
    const taskId = 'task-chatgpt-review-pipeline-accepted-001';
    const validateEvent = makeEventValidator();
    const validateTaskState = makeTaskStateValidator();
    const result = readJson('fixtures/chatgpt-review-result/valid-approved.json');

    const mapped = chatGptReviewResultToL4EventObjects(result, makeEventTemplate(taskId), {
      task_id: taskId,
      run_id: 'run-chatgpt-review-pipeline-accepted-001',
      current_branch_head: result.based_on_branch_head,
      created_at: '2026-06-27T00:00:00.000Z'
    });

    const output = runCodexResultL4Pipeline({
      baseTaskState: makeTaskState(taskId),
      eventTemplate: makeEventTemplate(taskId),
      validateEvent,
      initialEvents: [
        makeEvent(taskId, 'CODE_DETECTED', 1),
        makeEvent(taskId, 'CHECKS_STARTED', 2),
        makeEvent(taskId, 'CHECKS_PASSED', 3)
      ],
      tailEvents: [
        ...mapped.events,
        makeEvent(taskId, 'GATE_ALLOWED', 4)
      ],
      snapshotOptions: { updated_at: '2026-06-27T00:00:00.000Z' }
    });

    const stateField = findL4StateField(output.task_state);

    expect(output.machine_events).toContain('REVIEW_APPROVED');
    expect(output.final_state).toBe('ACCEPTED');
    expect(output.task_state[stateField]).toBe('ACCEPTED');
    expect(validateTaskState(output.task_state), JSON.stringify(validateTaskState.errors)).toBe(true);
  });
});
