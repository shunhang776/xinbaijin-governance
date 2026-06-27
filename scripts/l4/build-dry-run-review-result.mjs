#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildChatGptReviewResult } from '../../src/chatgpt/review-result.mjs';

function readJson(path) {
  const raw = readFileSync(resolve(path), 'utf8').replace(/^\uFEFF/, '');
  return JSON.parse(raw);
}

function writeJson(path, value) {
  writeFileSync(resolve(path), JSON.stringify(value, null, 2) + '\n', 'utf8');
}

function parseArgs(argv) {
  const args = {
    invocation: null,
    out: null,
    result_id: null,
    review_commit: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    created_at: '2026-06-27T00:00:00.000Z'
  };

  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];

    if (key === '--invocation') {
      args.invocation = argv[++i];
      continue;
    }

    if (key === '--out') {
      args.out = argv[++i];
      continue;
    }

    if (key === '--result-id') {
      args.result_id = argv[++i];
      continue;
    }

    if (key === '--review-commit') {
      args.review_commit = argv[++i];
      continue;
    }

    if (key === '--created-at') {
      args.created_at = argv[++i];
      continue;
    }

    throw new Error('unknown argument: ' + key);
  }

  if (!args.invocation) {
    throw new Error('--invocation is required');
  }

  if (!args.out) {
    throw new Error('--out is required');
  }

  return args;
}

export function buildDryRunReviewResult(invocation, options = {}) {
  return buildChatGptReviewResult({
    invocation,
    repository: invocation.repository,
    branch: invocation.branch,
    status: 'review_submitted',
    reviewed_commit: invocation.candidate_commit,
    based_on_branch_head: invocation.candidate_commit,
    review_commit: options.review_commit || 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    verdict: 'approved',
    findings: [],
    readback: {
      verified: true,
      reviewed_commit_matches: true,
      based_on_branch_head_matches: true,
      verdict_matches: true,
      findings_match: true,
      utf8_valid: true,
      sha256: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      byte_length: 512,
      line_ending: 'LF',
      final_newline: true
    },
    created_at: options.created_at || '2026-06-27T00:00:00.000Z'
  }, {
    result_id: options.result_id || 'chatgpt-review-result-dry-run-001',
    created_at: options.created_at || '2026-06-27T00:00:00.000Z'
  });
}

export function runBuildDryRunReviewResultCli(argv) {
  const args = parseArgs(argv);
  const invocation = readJson(args.invocation);

  const result = buildDryRunReviewResult(invocation, {
    result_id: args.result_id,
    review_commit: args.review_commit,
    created_at: args.created_at
  });

  writeJson(args.out, result);
  return result;
}

function isCliEntryPoint() {
  if (!process.argv[1]) {
    return false;
  }

  return resolve(process.argv[1]) === fileURLToPath(import.meta.url);
}

if (isCliEntryPoint()) {
  try {
    const result = runBuildDryRunReviewResultCli(process.argv.slice(2));
    process.stdout.write(JSON.stringify({
      ok: true,
      result_id: result.result_id,
      verdict: result.verdict,
      status: result.status
    }) + '\n');
  } catch (error) {
    process.stderr.write(String(error && error.stack ? error.stack : error) + '\n');
    process.exitCode = 1;
  }
}
