import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import {
  evaluateClaudeRepairHandoffGuard,
  repairGuardToL4EventObjects
} from '../src/l4/repair-guard.mjs';
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
    event_id: 'event-repair-guard-' + String(index).padStart(2, '0') + '-' + eventType.toLowerCase().replace(/_/g, '-'),
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

describe('repair guard protection', () => {
  it('allows fresh repair handoff without guard event', () => {
    const handoff = readJson('fixtures/claude-repair-handoff/valid-minimal.json');
    const guard = evaluateClaudeRepairHandoffGuard(handoff);

    expect(guard.guard_status).toBe('fresh');
    expect(guard.event_type).toBeNull();
    expect(repairGuardToL4EventObjects(guard, makeEvent('task-repair-guard-fresh-001', 'TOOL_ERROR', 99))).toEqual([]);
  });

  it('turns max repair round into REPAIR_ROUND_EXCEEDED and MANUAL_REQUIRED', () => {
    const taskId = 'task-repair-round-exceeded-001';
    const handoff = {
      ...readJson('fixtures/claude-repair-handoff/valid-minimal.json'),
      repair_round: 2,
      max_repair_round: 2
    };

    const guard = evaluateClaudeRepairHandoffGuard(handoff);
    const guardEvents = repairGuardToL4EventObjects(
      guard,
      makeEvent(taskId, 'TOOL_ERROR', 99),
      {
        event_id: 'event-repair-round-exceeded-001',
        created_at: '2026-06-27T00:00:00.000Z'
      }
    );

    const validateEvent = makeEventValidator();
    const validateTaskState = makeTaskStateValidator();
    const baseTaskState = readJson('fixtures/l4/task-state/valid-minimal.json');

    const output = runCodexResultL4Pipeline({
      baseTaskState,
      initialEvents: [
        makeEvent(taskId, 'CODE_DETECTED', 1),
        makeEvent(taskId, 'CHECKS_STARTED', 2),
        makeEvent(taskId, 'CHECKS_PASSED', 3),
        makeEvent(taskId, 'REVIEW_DENIED', 4),
        ...guardEvents
      ],
      codexResults: [],
      reviewGuards: [],
      tailEvents: [],
      eventTemplate: makeEvent(taskId, 'TOOL_ERROR', 99),
      validateEvent,
      snapshotOptions: {
        updated_at: '2026-06-27T00:00:00.000Z'
      }
    });

    const stateField = findL4StateField(output.task_state);

    expect(guard.guard_status).toBe('repair_round_exceeded');
    expect(guard.event_type).toBe('REPAIR_ROUND_EXCEEDED');
    expect(guardEvents).toHaveLength(1);
    expect(validateEvent(guardEvents[0]), JSON.stringify(validateEvent.errors)).toBe(true);
    expect(output.machine_events).toContain('REPAIR_ROUND_EXCEEDED');
    expect(output.final_state).toBe('MANUAL_REQUIRED');
    expect(output.task_state[stateField]).toBe('MANUAL_REQUIRED');
    expect(validateTaskState(output.task_state), JSON.stringify(validateTaskState.errors)).toBe(true);
  });

  it('turns repeated finding into REPEATED_FINDING_DETECTED and MANUAL_REQUIRED', () => {
    const taskId = 'task-repeated-finding-001';
    const handoff = readJson('fixtures/claude-repair-handoff/valid-minimal.json');

    const guard = evaluateClaudeRepairHandoffGuard(handoff, {
      previous_findings: handoff.findings
    });

    const guardEvents = repairGuardToL4EventObjects(
      guard,
      makeEvent(taskId, 'TOOL_ERROR', 99),
      {
        event_id: 'event-repeated-finding-detected-001',
        created_at: '2026-06-27T00:00:00.000Z'
      }
    );

    const validateEvent = makeEventValidator();
    const validateTaskState = makeTaskStateValidator();
    const baseTaskState = readJson('fixtures/l4/task-state/valid-minimal.json');

    const output = runCodexResultL4Pipeline({
      baseTaskState,
      initialEvents: [
        makeEvent(taskId, 'CODE_DETECTED', 1),
        makeEvent(taskId, 'CHECKS_STARTED', 2),
        makeEvent(taskId, 'CHECKS_PASSED', 3),
        makeEvent(taskId, 'REVIEW_DENIED', 4),
        ...guardEvents
      ],
      codexResults: [],
      reviewGuards: [],
      tailEvents: [],
      eventTemplate: makeEvent(taskId, 'TOOL_ERROR', 99),
      validateEvent,
      snapshotOptions: {
        updated_at: '2026-06-27T00:00:00.000Z'
      }
    });

    const stateField = findL4StateField(output.task_state);

    expect(guard.guard_status).toBe('repeated_finding_detected');
    expect(guard.event_type).toBe('REPEATED_FINDING_DETECTED');
    expect(guardEvents).toHaveLength(1);
    expect(validateEvent(guardEvents[0]), JSON.stringify(validateEvent.errors)).toBe(true);
    expect(output.machine_events).toContain('REPEATED_FINDING_DETECTED');
    expect(output.final_state).toBe('MANUAL_REQUIRED');
    expect(output.task_state[stateField]).toBe('MANUAL_REQUIRED');
    expect(validateTaskState(output.task_state), JSON.stringify(validateTaskState.errors)).toBe(true);
  });
});
