import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import {
  buildGateDecisionL4Event,
  gateDecisionToL4EventObjects
} from '../src/gate/gate-decision-l4-adapter.mjs';
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
    event_id: 'event-gate-decision-l4-' + String(index).padStart(2, '0') + '-' + eventType.toLowerCase().replace(/_/g, '-'),
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

describe('Gate decision to L4 adapter', () => {
  it('builds schema-valid GATE_ALLOWED event from allowed decision', () => {
    const validate = makeEventValidator();
    const decision = readJson('fixtures/gate-production-decision/valid-allowed.json');

    const event = buildGateDecisionL4Event(decision, {
      event_id: 'event-gate-allowed-001',
      created_at: '2026-06-27T00:00:00.000Z'
    });

    expect(event.protocol).toBe('baijin-l4-event/1.0');
    expect(event.event_id).toBe('event-gate-allowed-001');
    expect(event.event_type).toBe('GATE_ALLOWED');
    expect(event.actor).toBe('gate');
    expect(event.repository).toBe(decision.repository);
    expect(event.branch).toBe('dev');
    expect(event.payload.decision_id).toBe(decision.decision_id);
    expect(event.payload.gate_decision).toBe('allowed');
    expect(event.payload.reason_code).toBe('all_required_conditions_met');
    expect(validate(event), JSON.stringify(validate.errors)).toBe(true);
  });

  it('builds schema-valid GATE_DENIED event from denied decision', () => {
    const validate = makeEventValidator();
    const decision = readJson('fixtures/gate-production-decision/valid-denied.json');

    const event = buildGateDecisionL4Event(decision, {
      event_id: 'event-gate-denied-001',
      created_at: '2026-06-27T00:00:00.000Z'
    });

    expect(event.event_type).toBe('GATE_DENIED');
    expect(event.payload.gate_decision).toBe('denied');
    expect(event.payload.reason_code).toBe('chatgpt_review_not_approved');
    expect(validate(event), JSON.stringify(validate.errors)).toBe(true);
  });

  it('maps manual_required decision to GATE_DENIED event', () => {
    const validate = makeEventValidator();
    const decision = {
      ...readJson('fixtures/gate-production-decision/valid-denied.json'),
      decision_id: 'gate-production-decision-manual-required-001',
      decision: 'manual_required',
      reason_code: 'manual_override_required'
    };

    const event = buildGateDecisionL4Event(decision, {
      event_id: 'event-gate-manual-required-001',
      created_at: '2026-06-27T00:00:00.000Z'
    });

    expect(event.event_type).toBe('GATE_DENIED');
    expect(event.payload.gate_decision).toBe('manual_required');
    expect(event.payload.reason_code).toBe('manual_override_required');
    expect(validate(event), JSON.stringify(validate.errors)).toBe(true);
  });

  it('returns one L4 event object for one gate decision', () => {
    const decision = readJson('fixtures/gate-production-decision/valid-allowed.json');

    const events = gateDecisionToL4EventObjects(decision, {
      event_id: 'event-gate-list-001',
      created_at: '2026-06-27T00:00:00.000Z'
    });

    expect(events).toHaveLength(1);
    expect(events[0].event_type).toBe('GATE_ALLOWED');
  });

  it('allows L4 pipeline to reach ACCEPTED from REVIEW_APPROVED using GATE_ALLOWED', () => {
    const decision = readJson('fixtures/gate-production-decision/valid-allowed.json');
    const gateEvents = gateDecisionToL4EventObjects(decision, {
      event_id: 'event-gate-allowed-pipeline-001',
      task_id: 'task-gate-allowed-pipeline-001',
      run_id: 'run-gate-allowed-pipeline-001',
      created_at: '2026-06-27T00:00:00.000Z'
    });

    const baseTaskState = readJson('fixtures/l4/task-state/valid-minimal.json');
    const validateEvent = makeEventValidator();

    const output = runCodexResultL4Pipeline({
      baseTaskState,
      initialEvents: [
        makeEvent('task-gate-allowed-pipeline-001', 'CODE_DETECTED', 1),
        makeEvent('task-gate-allowed-pipeline-001', 'CHECKS_STARTED', 2),
        makeEvent('task-gate-allowed-pipeline-001', 'CHECKS_PASSED', 3),
        makeEvent('task-gate-allowed-pipeline-001', 'REVIEW_APPROVED', 4),
        ...gateEvents
      ],
      codexResults: [],
      reviewGuards: [],
      tailEvents: [],
      eventTemplate: makeEvent('task-gate-allowed-pipeline-001', 'TOOL_ERROR', 99),
      validateEvent,
      snapshotOptions: {
        updated_at: '2026-06-27T00:00:00.000Z'
      }
    });

    const validateTaskState = makeTaskStateValidator();
    const stateField = findL4StateField(output.task_state);

    expect(output.machine_events).toContain('GATE_ALLOWED');
    expect(output.final_state).toBe('ACCEPTED');
    expect(output.task_state[stateField]).toBe('ACCEPTED');
    expect(validateTaskState(output.task_state), JSON.stringify(validateTaskState.errors)).toBe(true);
  });

  it('moves L4 pipeline to MANUAL_REQUIRED from REVIEW_APPROVED using GATE_DENIED', () => {
    const decision = readJson('fixtures/gate-production-decision/valid-denied.json');
    const gateEvents = gateDecisionToL4EventObjects(decision, {
      event_id: 'event-gate-denied-pipeline-001',
      task_id: 'task-gate-denied-pipeline-001',
      run_id: 'run-gate-denied-pipeline-001',
      created_at: '2026-06-27T00:00:00.000Z'
    });

    const baseTaskState = readJson('fixtures/l4/task-state/valid-minimal.json');
    const validateEvent = makeEventValidator();

    const output = runCodexResultL4Pipeline({
      baseTaskState,
      initialEvents: [
        makeEvent('task-gate-denied-pipeline-001', 'CODE_DETECTED', 1),
        makeEvent('task-gate-denied-pipeline-001', 'CHECKS_STARTED', 2),
        makeEvent('task-gate-denied-pipeline-001', 'CHECKS_PASSED', 3),
        makeEvent('task-gate-denied-pipeline-001', 'REVIEW_APPROVED', 4),
        ...gateEvents
      ],
      codexResults: [],
      reviewGuards: [],
      tailEvents: [],
      eventTemplate: makeEvent('task-gate-denied-pipeline-001', 'TOOL_ERROR', 99),
      validateEvent,
      snapshotOptions: {
        updated_at: '2026-06-27T00:00:00.000Z'
      }
    });

    const validateTaskState = makeTaskStateValidator();
    const stateField = findL4StateField(output.task_state);

    expect(output.machine_events).toContain('GATE_DENIED');
    expect(output.final_state).toBe('MANUAL_REQUIRED');
    expect(output.task_state[stateField]).toBe('MANUAL_REQUIRED');
    expect(validateTaskState(output.task_state), JSON.stringify(validateTaskState.errors)).toBe(true);
  });

  it('rejects invalid protocol and unsupported decision', () => {
    const decision = readJson('fixtures/gate-production-decision/valid-allowed.json');

    expect(() => buildGateDecisionL4Event({
      ...decision,
      protocol: 'invalid'
    })).toThrow('protocol');

    expect(() => buildGateDecisionL4Event({
      ...decision,
      decision: 'unknown'
    })).toThrow('unsupported');
  });
});
