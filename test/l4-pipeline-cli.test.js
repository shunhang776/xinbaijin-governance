import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

function readJson(path) {
  const raw = readFileSync(resolve(path), 'utf8').replace(/^\uFEFF/, '');
  return JSON.parse(raw);
}

function writeJson(path, value) {
  writeFileSync(resolve(path), JSON.stringify(value, null, 2) + '\n', 'utf8');
}

function makeTempDir() {
  return mkdtempSync(join(tmpdir(), 'baijin-l4-pipeline-cli-'));
}

function makeTaskState(taskId) {
  return {
    ...readJson('fixtures/l4/task-state/valid-minimal.json'),
    task_id: taskId,
    repository: 'shunhang776/xinbaijin-mcp',
    branch: 'dev',
    state: 'WAIT_CODE',
    repair_round: 0,
    max_repair_round: 2,
    created_at: '2026-06-27T00:00:00.000Z',
    updated_at: '2026-06-27T00:00:00.000Z'
  };
}

function makeEventTemplate(taskId) {
  return {
    ...readJson('fixtures/l4/event/valid-minimal.json'),
    event_id: 'event-template-' + taskId,
    task_id: taskId,
    actor: 'system',
    repository: 'shunhang776/xinbaijin-mcp',
    branch: 'dev',
    created_at: '2026-06-27T00:00:00.000Z'
  };
}

function makeEvent(taskId, eventType, index) {
  return {
    ...readJson('fixtures/l4/event/valid-minimal.json'),
    event_id: 'event-cli-' + taskId + '-' + String(index).padStart(2, '0') + '-' + eventType.toLowerCase().replace(/_/g, '-'),
    task_id: taskId,
    event_type: eventType,
    actor: 'system',
    repository: 'shunhang776/xinbaijin-mcp',
    branch: 'dev',
    created_at: '2026-06-27T00:00:00.000Z'
  };
}

describe('L4 pipeline CLI', () => {
  it('writes an accepted l4 run result JSON file', () => {
    const dir = makeTempDir();
    const taskId = 'task-l4-cli-accepted-001';
    const inputPath = join(dir, 'input.json');
    const outPath = join(dir, 'run-result.json');
    const pipelineOutPath = join(dir, 'pipeline-output.json');

    try {
      writeJson(inputPath, {
        run_id: 'run-l4-cli-accepted-001',
        task_id: taskId,
        repository: 'shunhang776/xinbaijin-mcp',
        branch: 'dev',
        created_at: '2026-06-27T00:00:00.000Z',
        baseTaskState: makeTaskState(taskId),
        eventTemplate: makeEventTemplate(taskId),
        initialEvents: [
          makeEvent(taskId, 'CODE_DETECTED', 1),
          makeEvent(taskId, 'CHECKS_STARTED', 2),
          makeEvent(taskId, 'CHECKS_PASSED', 3)
        ],
        tailEvents: [
          makeEvent(taskId, 'REVIEW_APPROVED', 4),
          makeEvent(taskId, 'GATE_ALLOWED', 5)
        ],
        snapshotOptions: {
          updated_at: '2026-06-27T00:00:00.000Z'
        }
      });

      const stdout = execFileSync(process.execPath, [
        'src/l4/l4-pipeline-cli.mjs',
        '--input',
        inputPath,
        '--out',
        outPath,
        '--pipeline-out',
        pipelineOutPath
      ], {
        encoding: 'utf8'
      });

      const summary = JSON.parse(stdout);
      const runResult = readJson(outPath);
      const pipelineOutput = readJson(pipelineOutPath);

      expect(summary.ok).toBe(true);
      expect(summary.status).toBe('COMPLETED');
      expect(summary.final_state).toBe('ACCEPTED');
      expect(runResult.protocol).toBe('baijin-l4-run-result/1.0');
      expect(runResult.status).toBe('COMPLETED');
      expect(runResult.final_state).toBe('ACCEPTED');
      expect(pipelineOutput.final_state).toBe('ACCEPTED');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('writes a manual-required l4 run result JSON file', () => {
    const dir = makeTempDir();
    const taskId = 'task-l4-cli-manual-001';
    const inputPath = join(dir, 'input.json');
    const outPath = join(dir, 'run-result.json');

    try {
      writeJson(inputPath, {
        run_id: 'run-l4-cli-manual-001',
        task_id: taskId,
        repository: 'shunhang776/xinbaijin-mcp',
        branch: 'dev',
        created_at: '2026-06-27T00:00:00.000Z',
        baseTaskState: makeTaskState(taskId),
        eventTemplate: makeEventTemplate(taskId),
        initialEvents: [
          makeEvent(taskId, 'CODE_DETECTED', 1),
          makeEvent(taskId, 'CHECKS_STARTED', 2),
          makeEvent(taskId, 'CHECKS_PASSED', 3),
          makeEvent(taskId, 'REVIEW_BLOCKED', 4)
        ],
        snapshotOptions: {
          updated_at: '2026-06-27T00:00:00.000Z'
        }
      });

      const stdout = execFileSync(process.execPath, [
        'src/l4/l4-pipeline-cli.mjs',
        '--input',
        inputPath,
        '--out',
        outPath
      ], {
        encoding: 'utf8'
      });

      const summary = JSON.parse(stdout);
      const runResult = readJson(outPath);

      expect(summary.ok).toBe(true);
      expect(summary.status).toBe('MANUAL_REQUIRED');
      expect(summary.final_state).toBe('MANUAL_REQUIRED');
      expect(runResult.status).toBe('MANUAL_REQUIRED');
      expect(runResult.final_state).toBe('MANUAL_REQUIRED');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('fails when required args are missing', () => {
    expect(() => execFileSync(process.execPath, [
      'src/l4/l4-pipeline-cli.mjs'
    ], {
      encoding: 'utf8',
      stdio: 'pipe'
    })).toThrow();
  });
});
