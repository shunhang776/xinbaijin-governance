#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chatGptReviewResultToL4EventObjects } from '../../src/l4/chatgpt-review-result-adapter.mjs';

function readJson(path) {
  const raw = readFileSync(resolve(path), 'utf8').replace(/^\uFEFF/, '');
  return JSON.parse(raw);
}

function writeJson(path, value) {
  writeFileSync(resolve(path), JSON.stringify(value, null, 2) + '\n', 'utf8');
}

function parseArgs(argv) {
  const args = {
    out: null,
    review_result: null
  };

  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];

    if (key === '--out') {
      args.out = argv[++i];
      continue;
    }

    if (key === '--review-result') {
      args.review_result = argv[++i];
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

export function buildDryRunInput(options = {}) {
  const taskId = 'task-l4-dry-run-001';
  const eventTemplate = makeEventTemplate(taskId);
  let reviewEvents = [];

  if (options.review_result) {
    const reviewResult = readJson(options.review_result);
    const mapped = chatGptReviewResultToL4EventObjects(reviewResult, eventTemplate, {
      task_id: taskId,
      run_id: 'run-l4-dry-run-001',
      current_branch_head: reviewResult.based_on_branch_head,
      created_at: '2026-06-27T00:00:00.000Z'
    });

    reviewEvents = mapped.events;
  } else {
    reviewEvents = [
      makeEvent(taskId, 'REVIEW_APPROVED', 4)
    ];
  }

  return {
    run_id: 'run-l4-dry-run-001',
    task_id: taskId,
    repository: 'shunhang776/xinbaijin-mcp',
    branch: 'dev',
    created_at: '2026-06-27T00:00:00.000Z',
    baseTaskState: makeTaskState(taskId),
    eventTemplate,
    initialEvents: [
      makeEvent(taskId, 'CODE_DETECTED', 1),
      makeEvent(taskId, 'CHECKS_STARTED', 2),
      makeEvent(taskId, 'CHECKS_PASSED', 3)
    ],
    tailEvents: [
      ...reviewEvents,
      makeEvent(taskId, 'GATE_ALLOWED', 5)
    ],
    snapshotOptions: {
      updated_at: '2026-06-27T00:00:00.000Z'
    }
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = parseArgs(process.argv.slice(2));
  writeJson(args.out, buildDryRunInput({
    review_result: args.review_result
  }));
}
