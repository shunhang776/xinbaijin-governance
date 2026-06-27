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

function makeHandoffValidator() {
  return makeAjv().compile(readJson('schemas/claude-repair-handoff.schema.json'));
}

function makeArtifactValidator() {
  return makeAjv().compile(readJson('schemas/l4-dry-run-artifact.schema.json'));
}

function makeRunResult() {
  return {
    protocol: 'baijin-l4-run-result/1.0',
    run_id: 'run-claude-handoff-artifact-001',
    task_id: 'task-claude-handoff-artifact-001',
    repository: 'shunhang776/xinbaijin-mcp',
    branch: 'dev',
    status: 'MANUAL_REQUIRED',
    final_state: 'MANUAL_REQUIRED',
    events: [],
    machine_events: [],
    task_state: {},
    errors: [],
    created_at: '2026-06-27T00:00:00.000Z'
  };
}

describe('L4 dry-run Claude repair handoff artifact', () => {
  it('generates Claude repair handoff and includes it in artifact manifest', () => {
    const dir = mkdtempSync(join(tmpdir(), 'baijin-l4-claude-repair-handoff-artifact-'));
    const artifactDir = join(dir, 'artifacts', 'l4');

    try {
      require('node:fs').mkdirSync(artifactDir, { recursive: true });

      const reviewResultPath = join(artifactDir, 'chatgpt-review-result.json');
      const handoffPath = join(artifactDir, 'claude-repair-handoff.json');
      const runResultPath = join(artifactDir, 'l4-run-result.json');
      const artifactPath = join(artifactDir, 'l4-dry-run-artifact.json');

      writeJson(reviewResultPath, readJson('fixtures/chatgpt-review-result/valid-changes-requested.json'));
      writeJson(runResultPath, makeRunResult());

      writeJson(join(artifactDir, 'l4-pipeline-input.json'), {});
      writeJson(join(artifactDir, 'l4-pipeline-output.json'), {});
      writeJson(join(artifactDir, 'codex-bridge-result.json'), {});
      writeJson(join(artifactDir, 'chatgpt-review-invocation.json'), {});

      execFileSync(process.execPath, [
        'scripts/l4/build-dry-run-repair-handoff.mjs',
        '--review-result',
        reviewResultPath,
        '--out',
        handoffPath,
        '--handoff-id',
        'claude-repair-handoff-artifact-001',
        '--created-at',
        '2026-06-27T00:00:00.000Z'
      ]);

      execFileSync(process.execPath, [
        'scripts/l4/build-dry-run-artifact.mjs',
        '--run-result',
        runResultPath,
        '--out',
        artifactPath,
        '--input-path',
        join(artifactDir, 'l4-pipeline-input.json'),
        '--output-path',
        join(artifactDir, 'l4-pipeline-output.json'),
        '--run-result-path',
        runResultPath,
        '--bridge-result-path',
        join(artifactDir, 'codex-bridge-result.json'),
        '--review-invocation-path',
        join(artifactDir, 'chatgpt-review-invocation.json'),
        '--review-result-path',
        reviewResultPath,
        '--repair-handoff-path',
        handoffPath
      ]);

      const handoff = readJson(handoffPath);
      const artifact = readJson(artifactPath);
      const validateHandoff = makeHandoffValidator();
      const validateArtifact = makeArtifactValidator();

      expect(handoff.protocol).toBe('baijin-claude-repair-handoff/1.0');
      expect(handoff.verdict).toBe('changes_requested');
      expect(handoff.findings).toHaveLength(1);
      expect(artifact.files.map((file) => file.kind)).toContain('claude_repair_handoff');
      expect(validateHandoff(handoff), JSON.stringify(validateHandoff.errors)).toBe(true);
      expect(validateArtifact(artifact), JSON.stringify(validateArtifact.errors)).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
