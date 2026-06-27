#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { adaptL4AndChatGptReviewToGateDecision } from '../../src/gate/gate-decision-adapter.mjs';

function readJson(path) {
  const raw = readFileSync(resolve(path), 'utf8').replace(/^\uFEFF/, '');
  return JSON.parse(raw);
}

function writeJson(path, value) {
  writeFileSync(resolve(path), JSON.stringify(value, null, 2) + '\n', 'utf8');
}

function parseArgs(argv) {
  const args = {
    run_result: null,
    review_result: null,
    out: null,
    decision_id: 'gate-production-decision-l4-dry-run-001',
    candidate_commit: null,
    created_at: '2026-06-27T00:00:00.000Z'
  };

  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];

    if (key === '--run-result') {
      args.run_result = argv[++i];
      continue;
    }

    if (key === '--review-result') {
      args.review_result = argv[++i];
      continue;
    }

    if (key === '--out') {
      args.out = argv[++i];
      continue;
    }

    if (key === '--decision-id') {
      args.decision_id = argv[++i];
      continue;
    }

    if (key === '--candidate-commit') {
      args.candidate_commit = argv[++i];
      continue;
    }

    if (key === '--created-at') {
      args.created_at = argv[++i];
      continue;
    }

    throw new Error('unknown argument: ' + key);
  }

  if (!args.run_result) {
    throw new Error('--run-result is required');
  }

  if (!args.review_result) {
    throw new Error('--review-result is required');
  }

  if (!args.out) {
    throw new Error('--out is required');
  }

  return args;
}

export function buildDryRunGateDecision(l4RunResult, chatgptReviewResult, options = {}) {
  return adaptL4AndChatGptReviewToGateDecision({
    l4_run_result: l4RunResult,
    chatgpt_review_result: chatgptReviewResult
  }, {
    decision_id: options.decision_id || 'gate-production-decision-l4-dry-run-001',
    candidate_commit: options.candidate_commit || chatgptReviewResult.reviewed_commit,
    created_at: options.created_at || '2026-06-27T00:00:00.000Z'
  });
}

export function runBuildDryRunGateDecisionCli(argv) {
  const args = parseArgs(argv);
  const l4RunResult = readJson(args.run_result);
  const chatgptReviewResult = readJson(args.review_result);

  const decision = buildDryRunGateDecision(l4RunResult, chatgptReviewResult, {
    decision_id: args.decision_id,
    candidate_commit: args.candidate_commit,
    created_at: args.created_at
  });

  writeJson(args.out, decision);
  return decision;
}

function isCliEntryPoint() {
  if (!process.argv[1]) {
    return false;
  }

  return resolve(process.argv[1]) === fileURLToPath(import.meta.url);
}

if (isCliEntryPoint()) {
  try {
    const decision = runBuildDryRunGateDecisionCli(process.argv.slice(2));
    process.stdout.write(JSON.stringify({
      ok: true,
      decision_id: decision.decision_id,
      decision: decision.decision,
      reason_code: decision.reason_code
    }) + '\n');
  } catch (error) {
    process.stderr.write(String(error && error.stack ? error.stack : error) + '\n');
    process.exitCode = 1;
  }
}
