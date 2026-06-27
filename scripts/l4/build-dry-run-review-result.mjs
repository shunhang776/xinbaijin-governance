#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { executeFakeMcpReview } from '../../src/chatgpt/fake-mcp-review-executor.mjs';

const DEFAULT_REVIEW_COMMIT = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const DEFAULT_SHA256 = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';

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
    review_commit: DEFAULT_REVIEW_COMMIT,
    verdict: 'approved',
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

    if (key === '--verdict') {
      args.verdict = argv[++i];
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

function toolRepositoryForInvocation(invocation) {
  if (invocation.repository === 'shunhang776/xinbaijin') {
    return 'xinbaijin';
  }

  if (invocation.repository === 'shunhang776/xinbaijin-mcp') {
    return 'xinbaijin-mcp';
  }

  throw new Error('unsupported invocation repository: ' + invocation.repository);
}

export function createDryRunFakeMcpPort(invocation, options = {}) {
  const toolRepository = toolRepositoryForInvocation(invocation);
  const reviewCommit = options.review_commit || DEFAULT_REVIEW_COMMIT;

  return {
    async get_latest_handoff(args) {
      return {
        repository: args.repository || toolRepository,
        branch: 'dev',
        commit: invocation.candidate_commit,
        commit_message: 'dry-run fake MCP review target',
        changed_files: [
          'worker.js'
        ]
      };
    },

    async get_patch(args) {
      return {
        repository: args.repository,
        commit: args.commit,
        patch: 'diff --git a/worker.js b/worker.js'
      };
    },

    async submit_review(args) {
      return {
        repository: args.repository,
        reviewed_commit: args.commit,
        verdict: args.verdict,
        review_commit: reviewCommit
      };
    },

    async get_file_content(args) {
      return {
        repository: args.repository,
        ref: args.ref,
        path: args.path,
        content: '{}',
        sha256: DEFAULT_SHA256,
        byte_length: 512,
        line_ending: 'LF',
        final_newline: true
      };
    }
  };
}

export async function buildDryRunReviewResult(invocation, options = {}) {
  const output = await executeFakeMcpReview(
    invocation,
    createDryRunFakeMcpPort(invocation, options),
    {
      result_id: options.result_id || 'chatgpt-review-result-dry-run-001',
      review_commit: options.review_commit || DEFAULT_REVIEW_COMMIT,
      verdict: options.verdict || 'approved',
      findings: [],
      created_at: options.created_at || '2026-06-27T00:00:00.000Z'
    }
  );

  return output.result;
}

export async function runBuildDryRunReviewResultCli(argv) {
  const args = parseArgs(argv);
  const invocation = readJson(args.invocation);

  const result = await buildDryRunReviewResult(invocation, {
    result_id: args.result_id,
    review_commit: args.review_commit,
    verdict: args.verdict,
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
    const result = await runBuildDryRunReviewResultCli(process.argv.slice(2));
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
