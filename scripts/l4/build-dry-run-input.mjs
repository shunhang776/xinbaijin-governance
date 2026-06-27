#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

function readJson(path) {
  const raw = readFileSync(resolve(path), 'utf8').replace(/^\uFEFF/, '');
  return JSON.parse(raw);
}

function writeJson(path, value) {
  writeFileSync(resolve(path), JSON.stringify(value, null, 2) + '\n', 'utf8');
}

function parseArgs(argv) {
  const args = {
    out: null
  };

  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];

    if (key === '--out') {
      args.out = argv[++i];
      continue;
    }

    throw new Error('unknown argument: ' + key);
  }

  if (!args.out) {
    throw new Error('--out is required');
  }

  return args;
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
    event_id: 'event-dry-run-' + taskId + '-' + String(index).padStart(2, '0') + '-' + eventType.toLowerCase().replace(/_/g, '-'),
    task_id: taskId,
    event_type: eventType,
    actor: 'system',
    repository: 'shunhang776/xinbaijin-mcp',
    branch: 'dev',
    created_at: '2026-06-27T00:00:00.000Z'
  };
}

export function buildDryRunInput() {
  const taskId = 'task-l4-dry-run-001';

  return {
    run_id: 'run-l4-dry-run-001',
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
  };
}

if (resolve(process.argv[1]) === fileURLToPathSafe(import.meta.url)) {
  const args = parseArgs(process.argv.slice(2));
  writeJson(args.out, buildDryRunInput());
}

function fileURLToPathSafe(url) {
  return new URL(url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
}
