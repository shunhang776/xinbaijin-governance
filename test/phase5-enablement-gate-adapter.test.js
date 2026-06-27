import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { buildPhase5Enablement } from '../src/phase5/enablement.mjs';
import {
  buildPhase5EnablementGateL4Event,
  phase5EnablementToGateL4EventObjects
} from '../src/phase5/enablement-gate-adapter.mjs';
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
    event_id: 'event-phase5-gate-pipeline-' + String(index).padStart(2, '0') + '-' + eventType.toLowerCase().replace(/_/g, '-'),
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

function makeProductionEnablement() {
  return buildPhase5Enablement({
    enablement_id: 'phase5-enablement-gate-adapter-production-001',
    repository: 'shunhang776/xinbaijin-mcp',
    mode: 'production_enforcer',
    production_enabled: true,
    required_boundaries: {
      rollback_plan_defined: true,
      audit_log_defined: true,
      protected_branch_rules_defined: true,
      manual_required_process_defined: true
    },
    approvals: {
      owner_approval: true,
      gate_owner_approval: true,
      rollback_owner_approval: true
    },
    created_at: '2026-06-27T00:00:00.000Z'
  });
}

describe('Phase5 enablement Gate L4 adapter', () => {
  it('builds schema-valid GATE_ALLOWED event when Phase5 is production ready', () => {
    const validate = makeEventValidator();
    const enablement = makeProductionEnablement();

    const event = buildPhase5EnablementGateL4Event(enablement, {
      event_id: 'event-phase5-production-ready-001',
      task_id: 'task-phase5-production-ready-001',
      run_id: 'run-phase5-production-ready-001',
      created_at: '2026-06-27T00:00:00.000Z'
    });

    expect(event.protocol).toBe('baijin-l4-event/1.0');
    expect(event.event_type).toBe('GATE_ALLOWED');
    expect(event.actor).toBe('gate');
    expect(event.payload.enablement_id).toBe(enablement.enablement_id);
    expect(event.payload.readiness_status).toBe('production_ready');
    expect(event.payload.ready_for_production).toBe(true);
    expect(event.payload.blocker_count).toBe(0);
    expect(validate(event), JSON.stringify(validate.errors)).toBe(true);
  });

  it('builds schema-valid GATE_DENIED event when Phase5 is not production ready', () => {
    const validate = makeEventValidator();
    const enablement = readJson('fixtures/phase5-enablement/valid-draft-disabled.json');

    const event = buildPhase5EnablementGateL4Event(enablement, {
      event_id: 'event-phase5-not-ready-001',
      task_id: 'task-phase5-not-ready-001',
      run_id: 'run-phase5-not-ready-001',
      created_at: '2026-06-27T00:00:00.000Z'
    });

    expect(event.event_type).toBe('GATE_DENIED');
    expect(event.payload.readiness_status).toBe('not_ready');
    expect(event.payload.ready_for_production).toBe(false);
    expect(event.payload.blocker_count).toBeGreaterThan(0);
    expect(validate(event), JSON.stringify(validate.errors)).toBe(true);
  });

  it('returns one L4 Gate event object for one Phase5 enablement', () => {
    const enablement = makeProductionEnablement();

    const events = phase5EnablementToGateL4EventObjects(enablement, {
      event_id: 'event-phase5-gate-list-001',
      task_id: 'task-phase5-gate-list-001',
      run_id: 'run-phase5-gate-list-001',
      created_at: '2026-06-27T00:00:00.000Z'
    });

    expect(events).toHaveLength(1);
    expect(events[0].event_type).toBe('GATE_ALLOWED');
  });

  it('drives L4 from REVIEW_APPROVED to ACCEPTED when Phase5 is production ready', () => {
    const taskId = 'task-phase5-production-ready-pipeline-001';
    const enablement = makeProductionEnablement();
    const gateEvents = phase5EnablementToGateL4EventObjects(enablement, {
      event_id: 'event-phase5-production-ready-pipeline-001',
      task_id: taskId,
      run_id: 'run-phase5-production-ready-pipeline-001',
      created_at: '2026-06-27T00:00:00.000Z'
    });

    const validateEvent = makeEventValidator();
    const baseTaskState = readJson('fixtures/l4/task-state/valid-minimal.json');

    const output = runCodexResultL4Pipeline({
      baseTaskState,
      initialEvents: [
        makeEvent(taskId, 'CODE_DETECTED', 1),
        makeEvent(taskId, 'CHECKS_STARTED', 2),
        makeEvent(taskId, 'CHECKS_PASSED', 3),
        makeEvent(taskId, 'REVIEW_APPROVED', 4),
        ...gateEvents
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

    const validateTaskState = makeTaskStateValidator();
    const stateField = findL4StateField(output.task_state);

    expect(output.machine_events).toContain('GATE_ALLOWED');
    expect(output.final_state).toBe('ACCEPTED');
    expect(output.task_state[stateField]).toBe('ACCEPTED');
    expect(validateTaskState(output.task_state), JSON.stringify(validateTaskState.errors)).toBe(true);
  });

  it('drives L4 from REVIEW_APPROVED to MANUAL_REQUIRED when Phase5 is not production ready', () => {
    const taskId = 'task-phase5-not-ready-pipeline-001';
    const enablement = readJson('fixtures/phase5-enablement/valid-draft-disabled.json');
    const gateEvents = phase5EnablementToGateL4EventObjects(enablement, {
      event_id: 'event-phase5-not-ready-pipeline-001',
      task_id: taskId,
      run_id: 'run-phase5-not-ready-pipeline-001',
      created_at: '2026-06-27T00:00:00.000Z'
    });

    const validateEvent = makeEventValidator();
    const baseTaskState = readJson('fixtures/l4/task-state/valid-minimal.json');

    const output = runCodexResultL4Pipeline({
      baseTaskState,
      initialEvents: [
        makeEvent(taskId, 'CODE_DETECTED', 1),
        makeEvent(taskId, 'CHECKS_STARTED', 2),
        makeEvent(taskId, 'CHECKS_PASSED', 3),
        makeEvent(taskId, 'REVIEW_APPROVED', 4),
        ...gateEvents
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

    const validateTaskState = makeTaskStateValidator();
    const stateField = findL4StateField(output.task_state);

    expect(output.machine_events).toContain('GATE_DENIED');
    expect(output.final_state).toBe('MANUAL_REQUIRED');
    expect(output.task_state[stateField]).toBe('MANUAL_REQUIRED');
    expect(validateTaskState(output.task_state), JSON.stringify(validateTaskState.errors)).toBe(true);
  });

  it('rejects invalid enablement protocol and missing task id', () => {
    const enablement = makeProductionEnablement();

    expect(() => buildPhase5EnablementGateL4Event({
      ...enablement,
      protocol: 'invalid'
    }, {
      task_id: 'task-invalid-protocol-001'
    })).toThrow('protocol');

    expect(() => buildPhase5EnablementGateL4Event(enablement)).toThrow('task_id');
  });
});
