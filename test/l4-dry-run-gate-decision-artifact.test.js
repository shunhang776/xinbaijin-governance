import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
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

function makeGateDecisionValidator() {
  return makeAjv().compile(readJson('schemas/gate-production-decision.schema.json'));
}

function makeArtifactValidator() {
  return makeAjv().compile(readJson('schemas/l4-dry-run-artifact.schema.json'));
}

function makeAcceptedRunResult() {
  return {
    protocol: 'baijin-l4-run-result/1.0',
    result_id: 'l4-run-result-gate-dry-run-001',
    run_id: 'run-gate-dry-run-001',
    task_id: 'task-gate-dry-run-001',
    repository: 'shunhang776/xinbaijin-mcp',
    branch: 'dev',
    status: 'COMPLETED',
    final_state: 'ACCEPTED',
    machine_events: [
      'CODE_DETECTED',
      'CHECKS_STARTED',
      'CHECKS_PASSED',
      'REVIEW_APPROVED',
      'GATE_ALLOWED'
    ],
    events: [],
    task_state: {},
    errors: [],
    created_at: '2026-06-27T00:00:00.000Z'
  };
}

describe('L4 dry-run Gate production decision artifact', () => {
  it('generates Gate production decision and includes it in artifact manifest', () => {
    const dir = mkdtempSync(join(tmpdir(), 'baijin-l4-gate-decision-artifact-'));
    const artifactDir = join(dir, 'artifacts', 'l4');

    try {
      mkdirSync(artifactDir, { recursive: true });

      const runResultPath = join(artifactDir, 'l4-run-result.json');
      const reviewResultPath = join(artifactDir, 'chatgpt-review-result.json');
      const gateDecisionPath = join(artifactDir, 'gate-production-decision.json');
      const artifactPath = join(artifactDir, 'l4-dry-run-artifact.json');

      writeJson(runResultPath, makeAcceptedRunResult());
      writeJson(reviewResultPath, readJson('fixtures/chatgpt-review-result/valid-approved.json'));
      writeJson(join(artifactDir, 'l4-pipeline-input.json'), {});
      writeJson(join(artifactDir, 'l4-pipeline-output.json'), {});
      writeJson(join(artifactDir, 'codex-bridge-result.json'), {});
      writeJson(join(artifactDir, 'chatgpt-review-invocation.json'), {});

      execFileSync(process.execPath, [
        'scripts/l4/build-dry-run-gate-decision.mjs',
        '--run-result',
        runResultPath,
        '--review-result',
        reviewResultPath,
        '--out',
        gateDecisionPath,
        '--decision-id',
        'gate-production-decision-artifact-001',
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
        '--gate-decision-path',
        gateDecisionPath
      ]);

      const decision = readJson(gateDecisionPath);
      const artifact = readJson(artifactPath);
      const validateDecision = makeGateDecisionValidator();
      const validateArtifact = makeArtifactValidator();

      expect(decision.protocol).toBe('baijin-gate-production-decision/1.0');
      expect(decision.decision).toBe('allowed');
      expect(decision.reason_code).toBe('all_required_conditions_met');
      expect(artifact.files.map((file) => file.kind)).toContain('gate_production_decision');
      expect(validateDecision(decision), JSON.stringify(validateDecision.errors)).toBe(true);
      expect(validateArtifact(artifact), JSON.stringify(validateArtifact.errors)).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
