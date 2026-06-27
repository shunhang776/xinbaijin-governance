import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

function readJson(path) {
  const raw = readFileSync(resolve(path), 'utf8').replace(/^\uFEFF/, '');
  return JSON.parse(raw);
}

function writeJson(path, value) {
  writeFileSync(resolve(path), JSON.stringify(value, null, 2) + '\n', 'utf8');
}

function makeAjv() {
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);
  return ajv;
}

function makeArtifactValidator() {
  return makeAjv().compile(readJson('schemas/l4-dry-run-artifact.schema.json'));
}

function makeRunResult() {
  return {
    protocol: 'baijin-l4-run-result/1.0',
    run_id: 'run-review-invocation-artifact-001',
    task_id: 'task-review-invocation-artifact-001',
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
}

describe('L4 dry-run artifact with ChatGPT review invocation', () => {
  it('includes bridge result and ChatGPT review invocation files in artifact manifest', () => {
    const dir = mkdtempSync(join(tmpdir(), 'baijin-l4-review-invocation-artifact-'));
    const runResultPath = join(dir, 'l4-run-result.json');
    const artifactPath = join(dir, 'l4-dry-run-artifact.json');

    try {
      writeJson(runResultPath, makeRunResult());

      const stdout = execFileSync(process.execPath, [
        'scripts/l4/build-dry-run-artifact.mjs',
        '--run-result',
        runResultPath,
        '--out',
        artifactPath
      ], {
        encoding: 'utf8'
      });

      const summary = JSON.parse(stdout);
      const artifact = readJson(artifactPath);
      const validate = makeArtifactValidator();

      expect(summary.ok).toBe(true);
      expect(summary.file_count).toBe(5);

      expect(artifact.files.map((file) => file.kind)).toContain('bridge_result');
      expect(artifact.files.map((file) => file.kind)).toContain('chatgpt_review_invocation');
      expect(artifact.files.map((file) => file.path)).toContain('artifacts/l4/codex-bridge-result.json');
      expect(artifact.files.map((file) => file.path)).toContain('artifacts/l4/chatgpt-review-invocation.json');

      expect(validate(artifact), JSON.stringify(validate.errors)).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
