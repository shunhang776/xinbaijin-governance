import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { buildDryRunSummary } from '../scripts/l4/write-dry-run-summary.mjs';

function readJson(path) {
  const raw = readFileSync(resolve(path), 'utf8').replace(/^\uFEFF/, '');
  return JSON.parse(raw);
}

function writeJson(path, value) {
  writeFileSync(resolve(path), JSON.stringify(value, null, 2) + '\n', 'utf8');
}

function makeArtifact() {
  return {
    protocol: 'baijin-l4-dry-run-artifact/1.0',
    artifact_id: 'artifact-summary-001',
    run_id: 'run-summary-001',
    task_id: 'task-summary-001',
    repository: 'shunhang776/xinbaijin-mcp',
    branch: 'dev',
    status: 'COMPLETED',
    final_state: 'ACCEPTED',
    files: [
      {
        kind: 'pipeline_input',
        path: 'artifacts/l4/l4-pipeline-input.json'
      },
      {
        kind: 'pipeline_output',
        path: 'artifacts/l4/l4-pipeline-output.json'
      },
      {
        kind: 'run_result',
        path: 'artifacts/l4/l4-run-result.json'
      }
    ],
    created_at: '2026-06-27T00:00:00.000Z'
  };
}

function makeRunResult() {
  return {
    protocol: 'baijin-l4-run-result/1.0',
    run_id: 'run-summary-001',
    task_id: 'task-summary-001',
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

describe('L4 dry-run summary', () => {
  it('builds markdown summary text', () => {
    const summary = buildDryRunSummary(makeArtifact(), makeRunResult());

    expect(summary).toContain('## L4 Pipeline Dry Run');
    expect(summary).toContain('`COMPLETED`');
    expect(summary).toContain('`ACCEPTED`');
    expect(summary).toContain('artifact-summary-001');
    expect(summary).toContain('l4-run-result.json');
  });

  it('writes summary from CLI', () => {
    const dir = mkdtempSync(join(tmpdir(), 'baijin-l4-dry-run-summary-'));
    const artifactPath = join(dir, 'artifact.json');
    const runResultPath = join(dir, 'run-result.json');
    const summaryPath = join(dir, 'summary.md');

    try {
      writeJson(artifactPath, makeArtifact());
      writeJson(runResultPath, makeRunResult());

      const stdout = execFileSync(process.execPath, [
        'scripts/l4/write-dry-run-summary.mjs',
        '--artifact',
        artifactPath,
        '--run-result',
        runResultPath,
        '--out',
        summaryPath
      ], {
        encoding: 'utf8'
      });

      const output = JSON.parse(stdout);
      const summary = readFileSync(summaryPath, 'utf8');

      expect(output.ok).toBe(true);
      expect(output.artifact_id).toBe('artifact-summary-001');
      expect(summary).toContain('## L4 Pipeline Dry Run');
      expect(summary).toContain('`COMPLETED`');
      expect(summary).toContain('`ACCEPTED`');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('fails when required args are missing', () => {
    expect(() => execFileSync(process.execPath, [
      'scripts/l4/write-dry-run-summary.mjs'
    ], {
      encoding: 'utf8',
      stdio: 'pipe'
    })).toThrow();
  });
});
