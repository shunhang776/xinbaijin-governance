import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import {
  buildRepairSubmittedL4EventFromClaudeSubmission,
  claudeRepairSubmissionToL4EventObjects
} from '../src/l4/claude-repair-submission-adapter.mjs';

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

describe('Claude repair submission to L4 adapter', () => {
  it('builds schema-valid REPAIR_SUBMITTED L4 event from Claude repair submission', () => {
    const validate = makeEventValidator();
    const submission = readJson('fixtures/claude-repair-submission/valid-minimal.json');

    const event = buildRepairSubmittedL4EventFromClaudeSubmission(submission, {
      event_id: 'event-repair-submitted-001',
      task_id: 'task-repair-submitted-001',
      run_id: 'run-repair-submitted-001',
      created_at: '2026-06-27T00:00:00.000Z'
    });

    expect(event.protocol).toBe('baijin-l4-event/1.0');
    expect(event.event_id).toBe('event-repair-submitted-001');
    expect(event.event_type).toBe('REPAIR_SUBMITTED');
    expect(event.actor).toBe('claude-code');
    expect(event.repair_round).toBe(0);
    expect(event.repository).toBe(submission.repository);
    expect(event.branch).toBe('dev');
    expect(event.payload.run_id).toBe('run-repair-submitted-001');
    expect(event.payload.submission_id).toBe(submission.submission_id);
    expect(event.payload.source_handoff_id).toBe(submission.source_handoff_id);
    expect(event.payload.repair_commit).toBe(submission.repair_commit);
    expect(event.payload.changed_files).toEqual(['worker.js']);
    expect(event.payload.resolved_finding_count).toBe(1);
    expect(event.payload.resolved_findings).toHaveLength(1);
    expect(validate(event), JSON.stringify(validate.errors)).toBe(true);
  });

  it('returns one L4 event object for one Claude repair submission', () => {
    const submission = readJson('fixtures/claude-repair-submission/valid-minimal.json');

    const events = claudeRepairSubmissionToL4EventObjects(submission, {
      event_id: 'event-repair-submitted-list-001',
      task_id: 'task-repair-submitted-list-001',
      run_id: 'run-repair-submitted-list-001',
      created_at: '2026-06-27T00:00:00.000Z'
    });

    expect(events).toHaveLength(1);
    expect(events[0].event_type).toBe('REPAIR_SUBMITTED');
  });

  it('rejects non-Claude actor submission fixture', () => {
    const submission = readJson('fixtures/claude-repair-submission/invalid-wrong-actor.json');

    expect(() => buildRepairSubmittedL4EventFromClaudeSubmission(submission, {
      event_id: 'event-invalid-actor-001',
      task_id: 'task-invalid-actor-001',
      run_id: 'run-invalid-actor-001'
    })).toThrow('claude-code');
  });

  it('rejects empty resolved findings and empty changed files', () => {
    const submission = readJson('fixtures/claude-repair-submission/valid-minimal.json');

    expect(() => buildRepairSubmittedL4EventFromClaudeSubmission({
      ...submission,
      resolved_findings: []
    }, {
      event_id: 'event-empty-resolved-findings-001',
      task_id: 'task-empty-resolved-findings-001',
      run_id: 'run-empty-resolved-findings-001'
    })).toThrow('resolved finding');

    expect(() => buildRepairSubmittedL4EventFromClaudeSubmission({
      ...submission,
      changed_files: []
    }, {
      event_id: 'event-empty-changed-files-001',
      task_id: 'task-empty-changed-files-001',
      run_id: 'run-empty-changed-files-001'
    })).toThrow('changed file');
  });

  it('rejects invalid repair round', () => {
    const submission = readJson('fixtures/claude-repair-submission/valid-minimal.json');

    expect(() => buildRepairSubmittedL4EventFromClaudeSubmission({
      ...submission,
      repair_round: 3,
      max_repair_round: 2
    }, {
      event_id: 'event-invalid-round-001',
      task_id: 'task-invalid-round-001',
      run_id: 'run-invalid-round-001'
    })).toThrow('repair_round');
  });
});
