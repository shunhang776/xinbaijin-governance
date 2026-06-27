import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import {
  applyL4SqliteMigrations,
  createSqliteL4PersistencePort
} from '../src/l4/l4-sqlite-persistence-adapter.mjs';
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

function makeTaskStateValidator() {
  return makeAjv().compile(readJson('schemas/l4-task-state.schema.json'));
}

function createTestPort() {
  const db = new Database(':memory:');
  applyL4SqliteMigrations(db);
  return {
    db,
    port: createSqliteL4PersistencePort(db)
  };
}

function makeTaskState(taskId) {
  return {
    ...readJson('fixtures/l4/task-state/valid-minimal.json'),
    task_id: taskId,
    repository: 'shunhang776/xinbaijin-mcp',
    branch: 'dev',
    state: 'WAIT_CODE',
    repair_round: 0,
    max_repair_round: 2,
    created_at: '2026-06-27T00:00:00.000Z',
    updated_at: '2026-06-27T00:00:00.000Z'
  };
}

function makeEventTemplate(taskId) {
  return {
    ...readJson('fixtures/l4/event/valid-minimal.json'),
    event_id: 'event-template-' + taskId,
    task_id: taskId,
    actor: 'codex',
    repository: 'shunhang776/xinbaijin-mcp',
    branch: 'dev',
    created_at: '2026-06-27T00:00:00.000Z'
  };
}

function makeEvent(taskId, eventType, index) {
  return {
    ...readJson('fixtures/l4/event/valid-minimal.json'),
    event_id: 'event-sqlite-e2e-' + taskId + '-' + String(index).padStart(2, '0') + '-' + eventType.toLowerCase().replace(/_/g, '-'),
    task_id: taskId,
    event_type: eventType,
    actor: 'system',
    repository: 'shunhang776/xinbaijin-mcp',
    branch: 'dev',
    created_at: '2026-06-27T00:00:00.000Z'
  };
}

describe('L4 pipeline with SQLite persistence adapter', () => {
  it('persists an accepted L4 pipeline into SQLite tables', async () => {
    const { db, port } = createTestPort();
    const taskId = 'task-sqlite-e2e-accepted-001';
    const validateEvent = makeEventValidator();
    const validateRunResult = makeRunResultValidator();
    const validateTaskState = makeTaskStateValidator();

    const taskState = makeTaskState(taskId);
    await port.saveTaskState(taskState);

    const repairResult = readJson('fixtures/codex-bridge-result/valid-repair-result.json');

    const output = await runPipelineAndPersist({
      persistence: port,
      task_id: taskId,
      run_id: 'run-sqlite-e2e-accepted-001',
      repository: 'shunhang776/xinbaijin-mcp',
      branch: 'dev',
      eventTemplate: makeEventTemplate(taskId),
      validateEvent,
      initialEvents: [
        makeEvent(taskId, 'CODE_DETECTED', 1),
        makeEvent(taskId, 'CHECKS_STARTED', 2),
        makeEvent(taskId, 'CHECKS_PASSED', 3),
        makeEvent(taskId, 'REVIEW_DENIED', 4)
      ],
      codexResults: [repairResult],
      tailEvents: [
        makeEvent(taskId, 'REPAIR_SUBMITTED', 5),
        makeEvent(taskId, 'CHECKS_STARTED', 6),
        makeEvent(taskId, 'CHECKS_PASSED', 7),
        makeEvent(taskId, 'REVIEW_APPROVED', 8),
        makeEvent(taskId, 'GATE_ALLOWED', 9)
      ],
      snapshotOptions: { updated_at: '2026-06-27T00:00:00.000Z' },
      created_at: '2026-06-27T00:00:00.000Z'
    });

    const savedTaskState = await port.loadTaskState(taskId);
    const stateField = findL4StateField(savedTaskState);
    const events = await port.listEvents();
    const runResults = await port.listRunResults();

    const taskRow = db.prepare('SELECT state FROM l4_task_states WHERE task_id = ?').get(taskId);
    const runRow = db.prepare('SELECT status, final_state FROM l4_run_results WHERE run_id = ?').get('run-sqlite-e2e-accepted-001');
    const eventCount = db.prepare('SELECT COUNT(*) AS count FROM l4_events WHERE task_id = ?').get(taskId).count;

    expect(output.run_result.status).toBe('COMPLETED');
    expect(output.run_result.final_state).toBe('ACCEPTED');
    expect(savedTaskState[stateField]).toBe('ACCEPTED');
    expect(taskRow.state).toBe('ACCEPTED');
    expect(runRow.status).toBe('COMPLETED');
    expect(runRow.final_state).toBe('ACCEPTED');
    expect(eventCount).toBe(output.persisted.event_count);
    expect(events).toHaveLength(output.persisted.event_count);
    expect(runResults).toHaveLength(1);
    expect(validateRunResult(output.run_result), JSON.stringify(validateRunResult.errors)).toBe(true);
    expect(validateTaskState(savedTaskState), JSON.stringify(validateTaskState.errors)).toBe(true);

    db.close();
  });

  it('persists a blocked L4 pipeline as MANUAL_REQUIRED in SQLite', async () => {
    const { db, port } = createTestPort();
    const taskId = 'task-sqlite-e2e-manual-001';
    const validateEvent = makeEventValidator();
    const validateRunResult = makeRunResultValidator();

    await port.saveTaskState(makeTaskState(taskId));

    const blockedResult = {
      ...readJson('fixtures/codex-bridge-result/valid-repair-result.json'),
      status: 'BLOCKED',
      conclusion: 'CODEX_REPAIR_BRIDGE_BLOCKED'
    };

    const output = await runPipelineAndPersist({
      persistence: port,
      task_id: taskId,
      run_id: 'run-sqlite-e2e-manual-001',
      repository: 'shunhang776/xinbaijin-mcp',
      branch: 'dev',
      eventTemplate: makeEventTemplate(taskId),
      validateEvent,
      initialEvents: [
        makeEvent(taskId, 'CODE_DETECTED', 1),
        makeEvent(taskId, 'CHECKS_STARTED', 2),
        makeEvent(taskId, 'CHECKS_PASSED', 3),
        makeEvent(taskId, 'REVIEW_DENIED', 4)
      ],
      codexResults: [blockedResult],
      snapshotOptions: { updated_at: '2026-06-27T00:00:00.000Z' },
      created_at: '2026-06-27T00:00:00.000Z'
    });

    const savedTaskState = await port.loadTaskState(taskId);
    const stateField = findL4StateField(savedTaskState);
    const runRow = db.prepare('SELECT status, final_state FROM l4_run_results WHERE run_id = ?').get('run-sqlite-e2e-manual-001');

    expect(output.run_result.status).toBe('MANUAL_REQUIRED');
    expect(output.run_result.final_state).toBe('MANUAL_REQUIRED');
    expect(savedTaskState[stateField]).toBe('MANUAL_REQUIRED');
    expect(runRow.status).toBe('MANUAL_REQUIRED');
    expect(runRow.final_state).toBe('MANUAL_REQUIRED');
    expect(validateRunResult(output.run_result), JSON.stringify(validateRunResult.errors)).toBe(true);

    db.close();
  });
});
