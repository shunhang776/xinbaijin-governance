import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

function writeJson(path, value) {
  writeFileSync(path, JSON.stringify(value, null, 2) + '\n', 'utf8');
}

function makeArtifact() {
  return {
    protocol: 'baijin-l4-dry-run-artifact/1.0',
    artifact_id: 'artifact-pr-comment-001',
    run_id: 'run-pr-comment-001',
    task_id: 'task-pr-comment-001',
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
    run_id: 'run-pr-comment-001',
    task_id: 'task-pr-comment-001',
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

describe('L4 dry-run PR comment draft', () => {
  it('writes PR comment draft from CLI', () => {
    const dir = mkdtempSync(join(tmpdir(), 'baijin-l4-pr-comment-'));
    const artifactPath = join(dir, 'artifact.json');
    const runResultPath = join(dir, 'run-result.json');
    const outPath = join(dir, 'comment.md');

    try {
      writeJson(artifactPath, makeArtifact());
      writeJson(runResultPath, makeRunResult());

      const stdout = execFileSync(process.execPath, [
        'scripts/l4/write-dry-run-pr-comment.mjs',
        '--artifact',
        artifactPath,
        '--run-result',
        runResultPath,
        '--out',
        outPath
      ], {
        encoding: 'utf8'
      });

      const output = JSON.parse(stdout);
      const comment = readFileSync(outPath, 'utf8');

      expect(output.ok).toBe(true);
      expect(output.artifact_id).toBe('artifact-pr-comment-001');
      expect(output.status).toBe('COMPLETED');
      expect(output.final_state).toBe('ACCEPTED');

      expect(comment).toContain('<!-- baijin-l4-dry-run-comment -->');
      expect(comment).toContain('L4 Pipeline Dry Run');
      expect(comment).toContain('`COMPLETED`');
      expect(comment).toContain('`ACCEPTED`');
      expect(comment).toContain('artifact-pr-comment-001');
      expect(comment).toContain('Dry-run draft only');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('fails when required args are missing', () => {
    expect(() => execFileSync(process.execPath, [
      'scripts/l4/write-dry-run-pr-comment.mjs'
    ], {
      encoding: 'utf8',
      stdio: 'pipe'
    })).toThrow();
  });
});
