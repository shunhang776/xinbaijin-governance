import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { findL4StateField } from '../src/l4/task-state-snapshot.mjs';
import { runCodexResultL4Pipeline } from '../src/l4/l4-codex-pipeline.mjs';

function readJson(path) {
  const raw = readFileSync(resolve(path), 'utf8').replace(/^\\uFEFF/, '');
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

function makeEvent(eventType, index) {
  return {
    ...readJson('fixtures/l4/event/valid-minimal.json'),
    event_id: 'event-pipeline-' + String(index).padStart(2, '0') + '-' + eventType.toLowerCase().replace(/_/g, '-'),
    event_type: eventType,
    created_at: '2026-06-27T00:00:00.000Z'
  };
}

describe('L4 Codex pipeline', () => {
  it('converts review bridge result into validated event objects and WAIT_REVIEW snapshot', () => {
    const eventValidate = makeEventValidator();
    const taskValidate = makeTaskStateValidator();
    const baseTaskState = readJson('fixtures/l4/task-state/valid-minimal.json');
    const eventTemplate = readJson('fixtures/l4/event/valid-minimal.json');
    const reviewResult = readJson('fixtures/codex-bridge-result/valid-review-result.json');

    const output = runCodexResultL4Pipeline({
      baseTaskState,
      eventTemplate,
      validateEvent: eventValidate,
      initialEvents: [
        makeEvent('CODE_DETECTED', 1),
        makeEvent('CHECKS_STARTED', 2),
        makeEvent('CHECKS_PASSED', 3)
      ],
      codexResults: [reviewResult],
      snapshotOptions: { updated_at: '2026-06-27T00:00:00.000Z' }
    });

    const stateField = findL4StateField(output.task_state);
    expect(output.machine_events).toContain('REVIEW_REQUESTED');
    expect(output.final_state).toBe('WAIT_REVIEW');
    expect(output.task_state[stateField]).toBe('WAIT_REVIEW');
    expect(taskValidate(output.task_state), JSON.stringify(taskValidate.errors)).toBe(true);
  });

  it('runs repair bridge result through repair and approval into ACCEPTED snapshot', () => {
    const eventValidate = makeEventValidator();
    const taskValidate = makeTaskStateValidator();
    const baseTaskState = readJson('fixtures/l4/task-state/valid-minimal.json');
    const eventTemplate = readJson('fixtures/l4/event/valid-minimal.json');
    const repairResult = readJson('fixtures/codex-bridge-result/valid-repair-result.json');

    const output = runCodexResultL4Pipeline({
      baseTaskState,
      eventTemplate,
      validateEvent: eventValidate,
      initialEvents: [
        makeEvent('CODE_DETECTED', 1),
        makeEvent('CHECKS_STARTED', 2),
        makeEvent('CHECKS_PASSED', 3),
        makeEvent('REVIEW_DENIED', 4)
      ],
      codexResults: [repairResult],
      tailEvents: [
        makeEvent('REPAIR_SUBMITTED', 5),
        makeEvent('CHECKS_STARTED', 6),
        makeEvent('CHECKS_PASSED', 7),
        makeEvent('REVIEW_APPROVED', 8),
        makeEvent('GATE_ALLOWED', 9)
      ],
      snapshotOptions: { updated_at: '2026-06-27T00:00:00.000Z' }
    });

    const stateField = findL4StateField(output.task_state);
    expect(output.machine_events).toContain('REPAIR_REQUESTED');
    expect(output.final_state).toBe('ACCEPTED');
    expect(output.task_state[stateField]).toBe('ACCEPTED');
    expect(taskValidate(output.task_state), JSON.stringify(taskValidate.errors)).toBe(true);
  });

  it('turns blocked Codex result into MANUAL_REQUIRED snapshot', () => {
    const eventValidate = makeEventValidator();
    const taskValidate = makeTaskStateValidator();
    const baseTaskState = readJson('fixtures/l4/task-state/valid-minimal.json');
    const eventTemplate = readJson('fixtures/l4/event/valid-minimal.json');
    const blockedResult = {
      ...readJson('fixtures/codex-bridge-result/valid-repair-result.json'),
      status: 'BLOCKED',
      conclusion: 'CODEX_REPAIR_BRIDGE_BLOCKED'
    };

    const output = runCodexResultL4Pipeline({
      baseTaskState,
      eventTemplate,
      validateEvent: eventValidate,
      initialEvents: [
        makeEvent('CODE_DETECTED', 1),
        makeEvent('CHECKS_STARTED', 2),
        makeEvent('CHECKS_PASSED', 3),
        makeEvent('REVIEW_DENIED', 4)
      ],
      codexResults: [blockedResult],
      snapshotOptions: { updated_at: '2026-06-27T00:00:00.000Z' }
    });

    const stateField = findL4StateField(output.task_state);
    expect(output.machine_events).toContain('TOOL_ERROR');
    expect(output.final_state).toBe('MANUAL_REQUIRED');
    expect(output.task_state[stateField]).toBe('MANUAL_REQUIRED');
    expect(taskValidate(output.task_state), JSON.stringify(taskValidate.errors)).toBe(true);
  });
});
