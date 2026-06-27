import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import {
  applyL4SqliteMigrations,
  createSqliteL4PersistencePort
} from '../src/l4/l4-sqlite-persistence-adapter.mjs';

function readJson(path) {
  const raw = readFileSync(resolve(path), 'utf8').replace(/^\uFEFF/, '');
  return JSON.parse(raw);
}

function createTestPort() {
  const db = new Database(':memory:');
  applyL4SqliteMigrations(db);
  return {
    db,
    port: createSqliteL4PersistencePort(db)
  };
}

function makeTaskState(taskId = 'task-sqlite-001') {
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

function makeEvent(taskId = 'task-sqlite-001', index = 1) {
  return {
    ...readJson('fixtures/l4/event/valid-minimal.json'),
    event_id: 'event-sqlite-' + String(index).padStart(2, '0'),
    task_id: taskId,
    event_type: 'CODE_DETECTED',
    actor: 'system',
    repository: 'shunhang776/xinbaijin-mcp',
    branch: 'dev',
    created_at: '2026-06-27T00:00:00.000Z'
  };
}

function makeRunResult(taskState, runId = 'run-sqlite-001') {
  return {
    protocol: 'baijin-l4-run-result/1.0',
    run_id: runId,
    task_id: taskState.task_id,
    repository: 'shunhang776/xinbaijin-mcp',
    branch: 'dev',
    status: 'COMPLETED',
    final_state: 'ACCEPTED',
    events: [],
    machine_events: [],
    task_state: taskState,
    errors: [],
    created_at: '2026-06-27T00:00:00.000Z'
  };
}

describe('L4 SQLite persistence adapter', () => {
  it('applies migration and creates required tables', () => {
    const { db } = createTestPort();

    const rows = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
      .all()
      .map((row) => row.name);

    expect(rows).toContain('l4_task_states');
    expect(rows).toContain('l4_events');
    expect(rows).toContain('l4_run_results');
    expect(rows).toContain('l4_review_guards');

    db.close();
  });

  it('saves and loads task state through SQLite', async () => {
    const { db, port } = createTestPort();
    const taskState = makeTaskState();

    await port.saveTaskState(taskState);

    taskState.state = 'MUTATED_AFTER_SAVE';

    const loaded = await port.loadTaskState('task-sqlite-001');

    expect(loaded.task_id).toBe('task-sqlite-001');
    expect(loaded.state).toBe('WAIT_CODE');

    db.close();
  });

  it('updates task state on repeated save', async () => {
    const { db, port } = createTestPort();

    await port.saveTaskState(makeTaskState());

    await port.saveTaskState({
      ...makeTaskState(),
      state: 'ACCEPTED',
      updated_at: '2026-06-27T00:01:00.000Z'
    });

    const loaded = await port.loadTaskState('task-sqlite-001');
    expect(loaded.state).toBe('ACCEPTED');

    const row = db
      .prepare('SELECT state FROM l4_task_states WHERE task_id = ?')
      .get('task-sqlite-001');

    expect(row.state).toBe('ACCEPTED');

    db.close();
  });

  it('appends events after task state exists', async () => {
    const { db, port } = createTestPort();

    await port.saveTaskState(makeTaskState());
    await port.appendEvent(makeEvent('task-sqlite-001', 1));

    const events = await port.listEvents();

    expect(events).toHaveLength(1);
    expect(events[0].event_id).toBe('event-sqlite-01');
    expect(events[0].event_type).toBe('CODE_DETECTED');

    db.close();
  });

  it('rejects event append when task state is missing', async () => {
    const { db, port } = createTestPort();

    await expect(port.appendEvent(makeEvent('missing-task', 1))).rejects.toThrow('task_state not found');

    db.close();
  });

  it('appends run results through SQLite', async () => {
    const { db, port } = createTestPort();
    const taskState = makeTaskState();

    await port.saveTaskState(taskState);
    await port.appendRunResult(makeRunResult(taskState));

    const results = await port.listRunResults();

    expect(results).toHaveLength(1);
    expect(results[0].run_id).toBe('run-sqlite-001');
    expect(results[0].status).toBe('COMPLETED');

    db.close();
  });
});
