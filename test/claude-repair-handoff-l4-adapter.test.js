import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import {
  buildRepairRequestedL4EventFromClaudeHandoff,
  claudeRepairHandoffToL4EventObjects
} from '../src/l4/claude-repair-handoff-adapter.mjs';

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

describe('Claude repair handoff to L4 adapter', () => {
  it('builds schema-valid REPAIR_REQUESTED L4 event from Claude repair handoff', () => {
    const validate = makeEventValidator();
    const handoff = readJson('fixtures/claude-repair-handoff/valid-minimal.json');

    const event = buildRepairRequestedL4EventFromClaudeHandoff(handoff, {
      event_id: 'event-repair-requested-001',
      task_id: 'task-repair-requested-001',
      run_id: 'run-repair-requested-001',
      created_at: '2026-06-27T00:00:00.000Z'
    });

    expect(event.protocol).toBe('baijin-l4-event/1.0');
    expect(event.event_id).toBe('event-repair-requested-001');
    expect(event.event_type).toBe('REPAIR_REQUESTED');
    expect(event.actor).toBe('claude-code');
    expect(event.repair_round).toBe(0);
    expect(event.repository).toBe(handoff.repository);
    expect(event.branch).toBe('dev');
    expect(event.payload.run_id).toBe('run-repair-requested-001');
    expect(event.payload.handoff_id).toBe(handoff.handoff_id);
    expect(event.payload.source_review_result_id).toBe(handoff.source_review_result_id);
    expect(event.payload.reviewed_commit).toBe(handoff.reviewed_commit);
    expect(event.payload.review_commit).toBe(handoff.review_commit);
    expect(event.payload.finding_count).toBe(1);
    expect(event.payload.findings).toHaveLength(1);
    expect(validate(event), JSON.stringify(validate.errors)).toBe(true);
  });

  it('returns one L4 event object for one Claude repair handoff', () => {
    const handoff = readJson('fixtures/claude-repair-handoff/valid-minimal.json');

    const events = claudeRepairHandoffToL4EventObjects(handoff, {
      event_id: 'event-repair-requested-list-001',
      task_id: 'task-repair-requested-list-001',
      run_id: 'run-repair-requested-list-001',
      created_at: '2026-06-27T00:00:00.000Z'
    });

    expect(events).toHaveLength(1);
    expect(events[0].event_type).toBe('REPAIR_REQUESTED');
  });

  it('rejects approved handoff fixture', () => {
    const handoff = readJson('fixtures/claude-repair-handoff/invalid-approved-verdict.json');

    expect(() => buildRepairRequestedL4EventFromClaudeHandoff(handoff, {
      event_id: 'event-invalid-approved-001',
      task_id: 'task-invalid-approved-001',
      run_id: 'run-invalid-approved-001'
    })).toThrow('changes_requested');
  });

  it('rejects empty findings and invalid repair round', () => {
    const handoff = readJson('fixtures/claude-repair-handoff/valid-minimal.json');

    expect(() => buildRepairRequestedL4EventFromClaudeHandoff({
      ...handoff,
      findings: []
    }, {
      event_id: 'event-empty-findings-001',
      task_id: 'task-empty-findings-001',
      run_id: 'run-empty-findings-001'
    })).toThrow('at least one finding');

    expect(() => buildRepairRequestedL4EventFromClaudeHandoff({
      ...handoff,
      repair_round: 3,
      max_repair_round: 2
    }, {
      event_id: 'event-invalid-round-001',
      task_id: 'task-invalid-round-001',
      run_id: 'run-invalid-round-001'
    })).toThrow('repair_round');
  });
});
