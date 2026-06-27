import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { buildClaudeRepairSubmission } from '../src/claude/repair-submission.mjs';

const REPAIR_COMMIT = 'dddddddddddddddddddddddddddddddddddddddd';

function readJson(path) {
  const raw = readFileSync(resolve(path), 'utf8').replace(/^\uFEFF/, '');
  return JSON.parse(raw);
}

function makeAjv() {
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);
  return ajv;
}

function makeValidator() {
  return makeAjv().compile(readJson('schemas/claude-repair-submission.schema.json'));
}

describe('Claude repair submission builder', () => {
  it('builds a schema-valid repair submission from Claude repair handoff', () => {
    const validate = makeValidator();
    const handoff = readJson('fixtures/claude-repair-handoff/valid-minimal.json');

    const submission = buildClaudeRepairSubmission(handoff, {
      submission_id: 'claude-repair-submission-builder-001',
      repair_commit: REPAIR_COMMIT,
      fix_summary: 'Fixed the affected worker logic according to the ChatGPT review finding.',
      changed_files: ['worker.js'],
      resolved_findings: [
        {
          severity: 'medium',
          file: 'worker.js',
          line: 12,
          title: 'Sample finding',
          resolution: 'Adjusted the worker logic and added the missing guard.'
        }
      ],
      created_at: '2026-06-27T00:00:00.000Z'
    });

    expect(submission.protocol).toBe('baijin-claude-repair-submission/1.0');
    expect(submission.submission_id).toBe('claude-repair-submission-builder-001');
    expect(submission.source_handoff_id).toBe(handoff.handoff_id);
    expect(submission.source_review_result_id).toBe(handoff.source_review_result_id);
    expect(submission.invocation_id).toBe(handoff.invocation_id);
    expect(submission.repository).toBe(handoff.repository);
    expect(submission.branch).toBe('dev');
    expect(submission.reviewed_commit).toBe(handoff.reviewed_commit);
    expect(submission.review_commit).toBe(handoff.review_commit);
    expect(submission.repair_base_commit).toBe(handoff.reviewed_commit);
    expect(submission.repair_commit).toBe(REPAIR_COMMIT);
    expect(submission.status).toBe('repair_submitted');
    expect(submission.actor).toBe('claude-code');
    expect(submission.changed_files).toEqual(['worker.js']);
    expect(submission.resolved_findings).toHaveLength(1);
    expect(validate(submission), JSON.stringify(validate.errors)).toBe(true);
  });

  it('can derive changed files and resolved findings from handoff findings', () => {
    const validate = makeValidator();
    const handoff = readJson('fixtures/claude-repair-handoff/valid-minimal.json');

    const submission = buildClaudeRepairSubmission(handoff, {
      submission_id: 'claude-repair-submission-derived-001',
      repair_commit: REPAIR_COMMIT,
      fix_summary: 'Resolved all requested findings.',
      created_at: '2026-06-27T00:00:00.000Z'
    });

    expect(submission.changed_files).toEqual(['worker.js']);
    expect(submission.resolved_findings).toHaveLength(1);
    expect(submission.resolved_findings[0].resolution).toBe('Resolved all requested findings.');
    expect(validate(submission), JSON.stringify(validate.errors)).toBe(true);
  });

  it('rejects approved handoff fixture', () => {
    const handoff = readJson('fixtures/claude-repair-handoff/invalid-approved-verdict.json');

    expect(() => buildClaudeRepairSubmission(handoff, {
      repair_commit: REPAIR_COMMIT,
      fix_summary: 'Should not build from approved handoff.'
    })).toThrow('changes_requested');
  });

  it('rejects missing repair commit and missing fix summary', () => {
    const handoff = readJson('fixtures/claude-repair-handoff/valid-minimal.json');

    expect(() => buildClaudeRepairSubmission(handoff, {
      fix_summary: 'Missing repair commit.'
    })).toThrow('repair_commit');

    expect(() => buildClaudeRepairSubmission(handoff, {
      repair_commit: REPAIR_COMMIT
    })).toThrow('fix_summary');
  });

  it('rejects empty changed files and invalid repair round', () => {
    const handoff = readJson('fixtures/claude-repair-handoff/valid-minimal.json');

    expect(() => buildClaudeRepairSubmission(handoff, {
      repair_commit: REPAIR_COMMIT,
      fix_summary: 'Invalid empty changed files.',
      changed_files: []
    })).toThrow('changed_files');

    expect(() => buildClaudeRepairSubmission({
      ...handoff,
      repair_round: 3,
      max_repair_round: 2
    }, {
      repair_commit: REPAIR_COMMIT,
      fix_summary: 'Invalid repair round.'
    })).toThrow('repair_round');
  });

  it('preserves forbidden action observations', () => {
    const validate = makeValidator();
    const handoff = readJson('fixtures/claude-repair-handoff/valid-minimal.json');

    const submission = buildClaudeRepairSubmission(handoff, {
      submission_id: 'claude-repair-submission-forbidden-observed-001',
      repair_commit: REPAIR_COMMIT,
      fix_summary: 'Resolved finding but recorded a policy observation.',
      forbidden_actions_observed: [
        'attempted direct push was blocked by policy'
      ],
      created_at: '2026-06-27T00:00:00.000Z'
    });

    expect(submission.forbidden_actions_observed).toEqual([
      'attempted direct push was blocked by policy'
    ]);
    expect(validate(submission), JSON.stringify(validate.errors)).toBe(true);
  });
});
