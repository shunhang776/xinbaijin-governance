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
import { evaluateReviewGuard } from '../src/l4/review-guard.mjs';
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
    actor: 'system',
    repository: 'shunhang776/xinbaijin-mcp',
    branch: 'dev',
    created_at: '2026-06-27T00:00:00.000Z'
  };
}

function makeEvent(taskId, eventType, index) {
  return {
    ...readJson('fixtures/l4/event/valid-minimal.json'),
    event_id: 'event-review-guard-persist-' + taskId + '-' + String(index).padStart(2, '0') + '-' + eventType.toLowerCase().replace(/_/g, '-'),
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
    run_id: 'run-review-guard-persist-001',
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

describe('L4 pipeline review guard persistence', () => {
  it('persists a fresh review guard while allowing the pipeline to complete', async () => {
    const { db, port } = createTestPort();
    const taskId = 'task-review-guard-persist-fresh-001';
    const validateEvent = makeEventValidator();

    await port.saveTaskState(makeTaskState(taskId));

    const guard = makeGuard(taskId, {
      guard_id: 'guard-review-guard-persist-fresh-001'
    });

    const output = await runPipelineAndPersist({
      persistence: port,
      task_id: taskId,
      run_id: 'run-review-guard-persist-fresh-001',
      repository: 'shunhang776/xinbaijin-mcp',
      branch: 'dev',
      eventTemplate: makeEventTemplate(taskId),
      validateEvent,
      initialEvents: [
        makeEvent(taskId, 'CODE_DETECTED', 1),
        makeEvent(taskId, 'CHECKS_STARTED', 2),
        makeEvent(taskId, 'CHECKS_PASSED', 3)
      ],
      reviewGuards: [guard],
      tailEvents: [
        makeEvent(taskId, 'REVIEW_APPROVED', 4),
        makeEvent(taskId, 'GATE_ALLOWED', 5)
      ],
      snapshotOptions: { updated_at: '2026-06-27T00:00:00.000Z' },
      created_at: '2026-06-27T00:00:00.000Z'
    });

    const guards = await port.listReviewGuards();
    const savedTaskState = await port.loadTaskState(taskId);
    const stateField = findL4StateField(savedTaskState);
    const row = db.prepare('SELECT guard_status FROM l4_review_guards WHERE guard_id = ?').get('guard-review-guard-persist-fresh-001');

    expect(output.run_result.status).toBe('COMPLETED');
    expect(output.run_result.final_state).toBe('ACCEPTED');
    expect(output.persisted.review_guard_count).toBe(1);
    expect(guards).toHaveLength(1);
    expect(guards[0].guard_status).toBe('fresh');
    expect(row.guard_status).toBe('fresh');
    expect(savedTaskState[stateField]).toBe('ACCEPTED');

    db.close();
  });

  it('persists stale review guard and stores MANUAL_REQUIRED result', async () => {
    const { db, port } = createTestPort();
    const taskId = 'task-review-guard-persist-stale-001';
    const validateEvent = makeEventValidator();

    await port.saveTaskState(makeTaskState(taskId));

    const guard = makeGuard(taskId, {
      guard_id: 'guard-review-guard-persist-stale-001',
      reviewed_commit: SHA_B,
      based_on_branch_head: SHA_A,
      current_branch_head: SHA_A,
      verdict: 'changes_requested'
    });

    const output = await runPipelineAndPersist({
      persistence: port,
      task_id: taskId,
      run_id: 'run-review-guard-persist-stale-001',
      repository: 'shunhang776/xinbaijin-mcp',
      branch: 'dev',
      eventTemplate: makeEventTemplate(taskId),
      validateEvent,
      initialEvents: [
        makeEvent(taskId, 'CODE_DETECTED', 1),
        makeEvent(taskId, 'CHECKS_STARTED', 2),
        makeEvent(taskId, 'CHECKS_PASSED', 3)
      ],
      reviewGuards: [guard],
      snapshotOptions: { updated_at: '2026-06-27T00:00:00.000Z' },
      created_at: '2026-06-27T00:00:00.000Z'
    });

    const guards = await port.listReviewGuards();
    const savedTaskState = await port.loadTaskState(taskId);
    const stateField = findL4StateField(savedTaskState);
    const row = db.prepare('SELECT guard_status FROM l4_review_guards WHERE guard_id = ?').get('guard-review-guard-persist-stale-001');

    expect(output.pipeline_output.machine_events).toContain('STALE_REVIEW_DETECTED');
    expect(output.run_result.status).toBe('MANUAL_REQUIRED');
    expect(output.run_result.final_state).toBe('MANUAL_REQUIRED');
    expect(output.persisted.review_guard_count).toBe(1);
    expect(guards).toHaveLength(1);
    expect(guards[0].guard_status).toBe('stale_review');
    expect(row.guard_status).toBe('stale_review');
    expect(savedTaskState[stateField]).toBe('MANUAL_REQUIRED');

    db.close();
  });
});
