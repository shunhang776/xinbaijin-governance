import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  appendEvent,
  appendRunResult,
  assertL4PersistencePort,
  createMemoryL4PersistencePort,
  loadTaskState,
  saveTaskState
} from '../src/l4/l4-persistence-port.mjs';

function readJson(path) {
  const raw = readFileSync(resolve(path), 'utf8').replace(/^\uFEFF/, '');
  return JSON.parse(raw);
}

function makeTaskState(taskId = 'task-l4-001') {
  return {
    ...readJson('fixtures/l4/task-state/valid-minimal.json'),
    task_id: taskId
  };
}

function makeEvent(eventType = 'CODE_DETECTED', index = 1) {
  return {
    ...readJson('fixtures/l4/event/valid-minimal.json'),
    event_id: 'event-persistence-' + String(index).padStart(2, '0'),
    event_type: eventType,
    created_at: '2026-06-27T00:00:00.000Z'
  };
}

describe('L4 persistence port', () => {
  it('accepts a complete persistence port', () => {
    const port = createMemoryL4PersistencePort();
    expect(assertL4PersistencePort(port)).toBe(port);
  });

  it('rejects an incomplete persistence port', () => {
    expect(() => assertL4PersistencePort({})).toThrow('missing method');
  });

  it('saves and loads task state by task_id without leaking mutable references', async () => {
    const port = createMemoryL4PersistencePort();
    const taskState = makeTaskState();

    await saveTaskState(port, taskState);

    taskState.mutated_after_save = true;

    const loaded = await loadTaskState(port, 'task-l4-001');
    expect(loaded.task_id).toBe('task-l4-001');
    expect(loaded.mutated_after_save).toBeUndefined();

    loaded.mutated_after_load = true;

    const loadedAgain = await loadTaskState(port, 'task-l4-001');
    expect(loadedAgain.mutated_after_load).toBeUndefined();
  });

  it('returns null when task state does not exist', async () => {
    const port = createMemoryL4PersistencePort();
    await expect(loadTaskState(port, 'missing-task')).resolves.toBeNull();
  });

  it('appends run results without leaking mutable references', async () => {
    const port = createMemoryL4PersistencePort();

    const runResult = {
      protocol: 'baijin-l4-run-result/1.0',
      run_id: 'run-persistence-001',
      task_id: 'task-l4-001',
      repository: 'shunhang776/xinbaijin-mcp',
      branch: 'dev',
      status: 'COMPLETED',
      final_state: 'ACCEPTED',
      events: [],
      machine_events: [],
      task_state: makeTaskState(),
      errors: [],
      created_at: '2026-06-27T00:00:00.000Z'
    };

    await appendRunResult(port, runResult);

    runResult.status = 'FAILED';

    const results = await port.listRunResults();
    expect(results).toHaveLength(1);
    expect(results[0].run_id).toBe('run-persistence-001');
    expect(results[0].status).toBe('COMPLETED');
  });

  it('appends L4 events without leaking mutable references', async () => {
    const port = createMemoryL4PersistencePort();
    const event = makeEvent('CODE_DETECTED', 1);

    await appendEvent(port, event);

    event.event_type = 'TOOL_ERROR';

    const events = await port.listEvents();
    expect(events).toHaveLength(1);
    expect(events[0].event_id).toBe('event-persistence-01');
    expect(events[0].event_type).toBe('CODE_DETECTED');
  });
});
