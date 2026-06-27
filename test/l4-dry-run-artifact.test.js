import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { buildDryRunArtifact } from '../scripts/l4/build-dry-run-artifact.mjs';

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
  return makeAjv().compile(readJson('schemas/l4-dry-run-artifact.schema.json'));
}

function makeRunResult() {
  return {
    protocol: 'baijin-l4-run-result/1.0',
    run_id: 'run-dry-run-artifact-001',
    task_id: 'task-dry-run-artifact-001',
    repository: 'shunhang776/xinbaijin-mcp',
    branch: 'dev',
    status: 'COMPLETED',
    final_state: 'ACCEPTED',
    events: [],
    machine_events: [],
    task_state: {
      task_id: 'task-dry-run-artifact-001',
      repository: 'shunhang776/xinbaijin-mcp',
      branch: 'dev',
      state: 'ACCEPTED'
    },
    errors: [],
    created_at: '2026-06-27T00:00:00.000Z'
  };
}

describe('L4 dry-run artifact schema and builder', () => {
  it('builds a schema-valid dry-run artifact manifest', () => {
    const validate = makeValidator();
    const artifact = buildDryRunArtifact(makeRunResult(), {
      artifact_id: 'artifact-dry-run-001',
      input_path: 'artifacts/l4/l4-pipeline-input.json',
      output_path: 'artifacts/l4/l4-pipeline-output.json',
      run_result_path: 'artifacts/l4/l4-run-result.json',
      created_at: '2026-06-27T00:00:00.000Z'
    });

    expect(artifact.protocol).toBe('baijin-l4-dry-run-artifact/1.0');
    expect(artifact.artifact_id).toBe('artifact-dry-run-001');
    expect(artifact.status).toBe('COMPLETED');
    expect(artifact.final_state).toBe('ACCEPTED');
    expect(artifact.files.map((file) => file.kind)).toEqual([
      'pipeline_input',
      'pipeline_output',
      'run_result'
    ]);
    expect(validate(artifact), JSON.stringify(validate.errors)).toBe(true);
  });

  it('rejects artifact manifest without required files', () => {
    const validate = makeValidator();
    const artifact = buildDryRunArtifact(makeRunResult());
    artifact.files = [];

    expect(validate(artifact)).toBe(false);
  });

  it('writes dry-run artifact manifest from CLI', () => {
    const dir = mkdtempSync(join(tmpdir(), 'baijin-l4-dry-run-artifact-'));
    const runResultPath = join(dir, 'l4-run-result.json');
    const outPath = join(dir, 'l4-dry-run-artifact.json');

    try {
      const runResult = makeRunResult();
      require('node:fs').writeFileSync(runResultPath, JSON.stringify(runResult, null, 2) + '\n', 'utf8');

      const stdout = execFileSync(process.execPath, [
        'scripts/l4/build-dry-run-artifact.mjs',
        '--run-result',
        runResultPath,
        '--out',
        outPath
      ], {
        encoding: 'utf8'
      });

      const summary = JSON.parse(stdout);
      const artifact = readJson(outPath);
      const validate = makeValidator();

      expect(summary.ok).toBe(true);
      expect(summary.status).toBe('COMPLETED');
      expect(artifact.run_id).toBe('run-dry-run-artifact-001');
      expect(validate(artifact), JSON.stringify(validate.errors)).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
