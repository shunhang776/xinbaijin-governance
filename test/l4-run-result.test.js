import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { buildL4RunResult, deriveL4RunStatus } from '../src/l4/l4-run-result.mjs';
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

function makeRunResultValidator() {
  return makeAjv().compile(readJson('schemas/l4-run-result.schema.json'));
}

function makeTaskStateValidator() {
  return makeAjv().compile(readJson('schemas/l4-task-state.schema.json'));
}

function makeEvent(eventType, index) {
  return {
    ...readJson('fixtures/l4/event/valid-minimal.json'),
    event_id: 'event-run-result-' + String(index).padStart(2, '0') + '-' + eventType.toLowerCase().replace(/_/g, '-'),
    event_type: eventType,
    created_at: '2026-06-27T00:00:00.000Z'
  };
}

describe('L4 run result', () => {
  it('derives run status from final state', () => {
    expect(deriveL4RunStatus('ACCEPTED')).toBe('COMPLETED');
    expect(deriveL4RunStatus('MANUAL_REQUIRED')).toBe('MANUAL_REQUIRED');
    expect(deriveL4RunStatus('WAIT_REVIEW')).toBe('IN_PROGRESS');
  });

  it('builds a schema-valid run result for an accepted L4 pipeline', () => {
    const eventValidate = makeEventValidator();
    const runResultValidate = makeRunResultValidator();
    const taskStateValidate = makeTaskStateValidator();

    const baseTaskState = readJson('fixtures/l4/task-state/valid-minimal.json');
    const eventTemplate = readJson('fixtures/l4/event/valid-minimal.json');
    const repairResult = readJson('fixtures/codex-bridge-result/valid-repair-result.json');

    const pipelineOutput = runCodexResultL4Pipeline({
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

    const runResult = buildL4RunResult(pipelineOutput, {
      run_id: 'run-accepted-001',
      task_id: 'task-l4-001',
      repository: 'shunhang776/xinbaijin-mcp',
      branch: 'dev',
      created_at: '2026-06-27T00:00:00.000Z'
    });

    expect(runResult.status).toBe('COMPLETED');
    expect(runResult.final_state).toBe('ACCEPTED');
    expect(runResultValidate(runResult), JSON.stringify(runResultValidate.errors)).toBe(true);
    expect(taskStateValidate(runResult.task_state), JSON.stringify(taskStateValidate.errors)).toBe(true);
  });

  it('builds a schema-valid run result for a manual-required L4 pipeline', () => {
    const eventValidate = makeEventValidator();
    const runResultValidate = makeRunResultValidator();

    const baseTaskState = readJson('fixtures/l4/task-state/valid-minimal.json');
    const eventTemplate = readJson('fixtures/l4/event/valid-minimal.json');
    const blockedResult = {
      ...readJson('fixtures/codex-bridge-result/valid-repair-result.json'),
      status: 'BLOCKED',
      conclusion: 'CODEX_REPAIR_BRIDGE_BLOCKED'
    };

    const pipelineOutput = runCodexResultL4Pipeline({
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

    const runResult = buildL4RunResult(pipelineOutput, {
      run_id: 'run-manual-001',
      task_id: 'task-l4-001',
      repository: 'shunhang776/xinbaijin-mcp',
      branch: 'dev',
      created_at: '2026-06-27T00:00:00.000Z'
    });

    expect(runResult.status).toBe('MANUAL_REQUIRED');
    expect(runResult.final_state).toBe('MANUAL_REQUIRED');
    expect(runResultValidate(runResult), JSON.stringify(runResultValidate.errors)).toBe(true);
  });

  it('rejects invalid run results missing run_id', () => {
    const validate = makeRunResultValidator();

    const invalid = {
      protocol: 'baijin-l4-run-result/1.0',
      task_id: 'task-l4-001',
      repository: 'shunhang776/xinbaijin-mcp',
      branch: 'dev',
      status: 'COMPLETED',
      final_state: 'ACCEPTED',
      events: [],
      machine_events: [],
      task_state: {},
      errors: [],
      created_at: '2026-06-27T00:00:00.000Z'
    };

    expect(validate(invalid)).toBe(false);
  });
});
