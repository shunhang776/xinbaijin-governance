import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { claudeRepairHandoffToL4EventObjects } from '../src/l4/claude-repair-handoff-adapter.mjs';
import { claudeRepairSubmissionToL4EventObjects } from '../src/l4/claude-repair-submission-adapter.mjs';
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

function makeEvent(taskId, eventType, index) {
  return {
    protocol: 'baijin-l4-event/1.0',
    event_id: 'event-repair-loop-' + String(index).padStart(2, '0') + '-' + eventType.toLowerCase().replace(/_/g, '-'),
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

describe('Claude repair loop L4 pipeline integration', () => {
  it('re-enters checks and review after REPAIR_SUBMITTED and reaches ACCEPTED', () => {
    const taskId = 'task-claude-repair-loop-001';
    const runId = 'run-claude-repair-loop-001';
    const handoff = readJson('fixtures/claude-repair-handoff/valid-minimal.json');
    const submission = readJson('fixtures/claude-repair-submission/valid-minimal.json');
    const baseTaskState = readJson('fixtures/l4/task-state/valid-minimal.json');
    const validateEvent = makeEventValidator();

    const repairRequestedEvents = claudeRepairHandoffToL4EventObjects(handoff, {
      event_id: 'event-repair-loop-requested-001',
      task_id: taskId,
      run_id: runId,
      created_at: '2026-06-27T00:00:00.000Z'
    });

    const repairSubmittedEvents = claudeRepairSubmissionToL4EventObjects(submission, {
      event_id: 'event-repair-loop-submitted-001',
      task_id: taskId,
      run_id: runId,
      created_at: '2026-06-27T00:00:00.000Z'
    });

    const initialEvents = [
      makeEvent(taskId, 'CODE_DETECTED', 1),
      makeEvent(taskId, 'CHECKS_STARTED', 2),
      makeEvent(taskId, 'CHECKS_PASSED', 3),
      makeEvent(taskId, 'REVIEW_DENIED', 4),
      ...repairRequestedEvents,
      ...repairSubmittedEvents,
      makeEvent(taskId, 'CHECKS_STARTED', 7),
      makeEvent(taskId, 'CHECKS_PASSED', 8),
      makeEvent(taskId, 'REVIEW_APPROVED', 9),
      makeEvent(taskId, 'GATE_ALLOWED', 10)
    ];

    const output = runCodexResultL4Pipeline({
      baseTaskState,
      initialEvents,
      codexResults: [],
      reviewGuards: [],
      tailEvents: [],
      eventTemplate: makeEvent(taskId, 'TOOL_ERROR', 99),
      validateEvent,
      snapshotOptions: {
        updated_at: '2026-06-27T00:00:00.000Z'
      }
    });

    const validateTaskState = makeTaskStateValidator();
    const stateField = findL4StateField(output.task_state);

    expect(repairRequestedEvents).toHaveLength(1);
    expect(repairSubmittedEvents).toHaveLength(1);
    expect(validateEvent(repairRequestedEvents[0]), JSON.stringify(validateEvent.errors)).toBe(true);
    expect(validateEvent(repairSubmittedEvents[0]), JSON.stringify(validateEvent.errors)).toBe(true);

    expect(output.machine_events).toEqual([
      'CODE_DETECTED',
      'CHECKS_STARTED',
      'CHECKS_PASSED',
      'REVIEW_DENIED',
      'REPAIR_REQUESTED',
      'REPAIR_SUBMITTED',
      'CHECKS_STARTED',
      'CHECKS_PASSED',
      'REVIEW_APPROVED',
      'GATE_ALLOWED'
    ]);

    expect(output.final_state).toBe('ACCEPTED');
    expect(output.task_state[stateField]).toBe('ACCEPTED');
    expect(validateTaskState(output.task_state), JSON.stringify(validateTaskState.errors)).toBe(true);
  });
});
