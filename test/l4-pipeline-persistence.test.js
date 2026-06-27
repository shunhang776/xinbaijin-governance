import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { createMemoryL4PersistencePort } from '../src/l4/l4-persistence-port.mjs';
import { runPipelineAndPersist } from '../src/l4/l4-pipeline-persistence.mjs';
import { findL4StateField } from '../src/l4/task-state-snapshot.mjs';

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

function makeRunResultValidator() {
  return makeAjv().compile(readJson('schemas/l4-run-result.schema.json'));
}

function makeTaskState(taskId = 'task-l4-001') {
  return {
    ...readJson('fixtures/l4/task-state/valid-minimal.json'),
    task_id: taskId
  };
}

function makeEvent(eventType, index) {
  return {
    ...readJson('fixtures/l4/event/valid-minimal.json'),
    event_id: 'event-persist-pipeline-' + String(index).padStart(2, '0') + '-' + eventType.toLowerCase().replace(/_/g, '-'),
    event_type: eventType,
    created_at: '2026-06-27T00:00:00.000Z'
  };
}

describe('L4 pipeline persistence orchestration', () => {
  it('runs an accepted pipeline and persists events, task state, and run result', async () => {
    const validateEvent = makeEventValidator();
    const validateRunResult = makeRunResultValidator();

    const baseTaskState = makeTaskState();
    const persistence = createMemoryL4PersistencePort({
      taskStates: [baseTaskState]
    });

    const eventTemplate = readJson('fixtures/l4/event/valid-minimal.json');
    const repairResult = readJson('fixtures/codex-bridge-result/valid-repair-result.json');

    const output = await runPipelineAndPersist({
      persistence,
      task_id: 'task-l4-001',
      run_id: 'run-persist-accepted-001',
      repository: 'shunhang776/xinbaijin-mcp',
      branch: 'dev',
      eventTemplate,
      validateEvent,
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
      snapshotOptions: { updated_at: '2026-06-27T00:00:00.000Z' },
      created_at: '2026-06-27T00:00:00.000Z'
    });

    const events = await persistence.listEvents();
    const runResults = await persistence.listRunResults();
    const savedTaskState = await persistence.loadTaskState('task-l4-001');
    const stateField = findL4StateField(savedTaskState);

    expect(output.run_result.status).toBe('COMPLETED');
    expect(output.run_result.final_state).toBe('ACCEPTED');
    expect(output.persisted.event_count).toBe(output.pipeline_output.events.length);
    expect(events).toHaveLength(output.pipeline_output.events.length);
    expect(runResults).toHaveLength(1);
    expect(savedTaskState[stateField]).toBe('ACCEPTED');
    expect(validateRunResult(output.run_result), JSON.stringify(validateRunResult.errors)).toBe(true);
  });

  it('runs a blocked pipeline and persists MANUAL_REQUIRED run result', async () => {
    const validateEvent = makeEventValidator();
    const validateRunResult = makeRunResultValidator();

    const baseTaskState = makeTaskState();
    const persistence = createMemoryL4PersistencePort({
      taskStates: [baseTaskState]
    });

    const eventTemplate = readJson('fixtures/l4/event/valid-minimal.json');
    const blockedResult = {
      ...readJson('fixtures/codex-bridge-result/valid-repair-result.json'),
      status: 'BLOCKED',
      conclusion: 'CODEX_REPAIR_BRIDGE_BLOCKED'
    };

    const output = await runPipelineAndPersist({
      persistence,
      task_id: 'task-l4-001',
      run_id: 'run-persist-manual-001',
      repository: 'shunhang776/xinbaijin-mcp',
      branch: 'dev',
      eventTemplate,
      validateEvent,
      initialEvents: [
        makeEvent('CODE_DETECTED', 1),
        makeEvent('CHECKS_STARTED', 2),
        makeEvent('CHECKS_PASSED', 3),
        makeEvent('REVIEW_DENIED', 4)
      ],
      codexResults: [blockedResult],
      snapshotOptions: { updated_at: '2026-06-27T00:00:00.000Z' },
      created_at: '2026-06-27T00:00:00.000Z'
    });

    const runResults = await persistence.listRunResults();
    const savedTaskState = await persistence.loadTaskState('task-l4-001');
    const stateField = findL4StateField(savedTaskState);

    expect(output.run_result.status).toBe('MANUAL_REQUIRED');
    expect(output.run_result.final_state).toBe('MANUAL_REQUIRED');
    expect(runResults).toHaveLength(1);
    expect(savedTaskState[stateField]).toBe('MANUAL_REQUIRED');
    expect(validateRunResult(output.run_result), JSON.stringify(validateRunResult.errors)).toBe(true);
  });

  it('fails before running when task state cannot be loaded', async () => {
    const persistence = createMemoryL4PersistencePort();
    const validateEvent = makeEventValidator();
    const eventTemplate = readJson('fixtures/l4/event/valid-minimal.json');

    await expect(runPipelineAndPersist({
      persistence,
      task_id: 'missing-task',
      run_id: 'run-missing-task-001',
      repository: 'shunhang776/xinbaijin-mcp',
      branch: 'dev',
      eventTemplate,
      validateEvent,
      created_at: '2026-06-27T00:00:00.000Z'
    })).rejects.toThrow('task_state not found');
  });
});
