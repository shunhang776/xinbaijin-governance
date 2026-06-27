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
    event_id: 'event-negative-' + String(index).padStart(2, '0') + '-' + eventType.toLowerCase().replace(/_/g, '-'),
    event_type: eventType,
    created_at: '2026-06-27T00:00:00.000Z'
  };
}

function expectManualRequired(output, taskValidate) {
  const stateField = findL4StateField(output.task_state);
  expect(output.final_state).toBe('MANUAL_REQUIRED');
  expect(output.task_state[stateField]).toBe('MANUAL_REQUIRED');
  expect(taskValidate(output.task_state), JSON.stringify(taskValidate.errors)).toBe(true);
}

describe('L4 Codex pipeline negative paths', () => {
  it('turns stale review detection into MANUAL_REQUIRED snapshot', () => {
    const eventValidate = makeEventValidator();
    const taskValidate = makeTaskStateValidator();
    const baseTaskState = readJson('fixtures/l4/task-state/valid-minimal.json');
    const eventTemplate = readJson('fixtures/l4/event/valid-minimal.json');

    const output = runCodexResultL4Pipeline({
      baseTaskState,
      eventTemplate,
      validateEvent: eventValidate,
      initialEvents: [
        makeEvent('CODE_DETECTED', 1),
        makeEvent('CHECKS_STARTED', 2),
        makeEvent('CHECKS_PASSED', 3),
        makeEvent('STALE_REVIEW_DETECTED', 4)
      ],
      snapshotOptions: { updated_at: '2026-06-27T00:00:00.000Z' }
    });

    expect(output.machine_events).toContain('STALE_REVIEW_DETECTED');
    expectManualRequired(output, taskValidate);
  });

  it('turns branch head change during repair into MANUAL_REQUIRED snapshot', () => {
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
        makeEvent('BRANCH_HEAD_CHANGED', 5)
      ],
      snapshotOptions: { updated_at: '2026-06-27T00:00:00.000Z' }
    });

    expect(output.machine_events).toContain('REPAIR_REQUESTED');
    expect(output.machine_events).toContain('BRANCH_HEAD_CHANGED');
    expectManualRequired(output, taskValidate);
  });

  it('turns repair round exceeded into MANUAL_REQUIRED snapshot', () => {
    const eventValidate = makeEventValidator();
    const taskValidate = makeTaskStateValidator();
    const baseTaskState = readJson('fixtures/l4/task-state/valid-minimal.json');
    const eventTemplate = readJson('fixtures/l4/event/valid-minimal.json');

    const output = runCodexResultL4Pipeline({
      baseTaskState,
      eventTemplate,
      validateEvent: eventValidate,
      initialEvents: [
        makeEvent('CODE_DETECTED', 1),
        makeEvent('CHECKS_STARTED', 2),
        makeEvent('CHECKS_PASSED', 3),
        makeEvent('REVIEW_DENIED', 4),
        makeEvent('REPAIR_ROUND_EXCEEDED', 5)
      ],
      snapshotOptions: { updated_at: '2026-06-27T00:00:00.000Z' }
    });

    expect(output.machine_events).toContain('REPAIR_ROUND_EXCEEDED');
    expectManualRequired(output, taskValidate);
  });
});
