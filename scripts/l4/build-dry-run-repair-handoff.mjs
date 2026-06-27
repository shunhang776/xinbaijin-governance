#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildClaudeRepairHandoff } from '../../src/claude/repair-handoff.mjs';

function readJson(path) {
  const raw = readFileSync(resolve(path), 'utf8').replace(/^\uFEFF/, '');
  return JSON.parse(raw);
}

function writeJson(path, value) {
  writeFileSync(resolve(path), JSON.stringify(value, null, 2) + '\n', 'utf8');
}

function parseArgs(argv) {
  const args = {
    review_result: null,
    out: null,
    handoff_id: null,
    repair_round: 0,
    max_repair_round: 2,
    created_at: '2026-06-27T00:00:00.000Z'
  };

  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];

    if (key === '--review-result') {
      args.review_result = argv[++i];
      continue;
    }

    if (key === '--out') {
      args.out = argv[++i];
      continue;
    }

    if (key === '--handoff-id') {
      args.handoff_id = argv[++i];
      continue;
    }

    if (key === '--repair-round') {
      args.repair_round = Number.parseInt(argv[++i], 10);
      continue;
    }

    if (key === '--max-repair-round') {
      args.max_repair_round = Number.parseInt(argv[++i], 10);
      continue;
    }

    if (key === '--created-at') {
      args.created_at = argv[++i];
      continue;
    }

    throw new Error('unknown argument: ' + key);
  }

  if (!args.review_result) {
    throw new Error('--review-result is required');
  }

  if (!args.out) {
    throw new Error('--out is required');
  }

  return args;
}

export function buildDryRunRepairHandoff(reviewResult, options = {}) {
  return buildClaudeRepairHandoff(reviewResult, {
    handoff_id: options.handoff_id || 'claude-repair-handoff-dry-run-001',
    repair_round: Number.isInteger(options.repair_round) ? options.repair_round : 0,
    max_repair_round: Number.isInteger(options.max_repair_round) ? options.max_repair_round : 2,
    created_at: options.created_at || '2026-06-27T00:00:00.000Z'
  });
}

export function runBuildDryRunRepairHandoffCli(argv) {
  const args = parseArgs(argv);
  const reviewResult = readJson(args.review_result);

  const handoff = buildDryRunRepairHandoff(reviewResult, {
    handoff_id: args.handoff_id,
    repair_round: args.repair_round,
    max_repair_round: args.max_repair_round,
    created_at: args.created_at
  });

  writeJson(args.out, handoff);
  return handoff;
}

function isCliEntryPoint() {
  if (!process.argv[1]) {
    return false;
  }

  return resolve(process.argv[1]) === fileURLToPath(import.meta.url);
}

if (isCliEntryPoint()) {
  try {
    const handoff = runBuildDryRunRepairHandoffCli(process.argv.slice(2));
    process.stdout.write(JSON.stringify({
      ok: true,
      handoff_id: handoff.handoff_id,
      verdict: handoff.verdict,
      target_actor: handoff.target_actor,
      finding_count: handoff.findings.length
    }) + '\n');
  } catch (error) {
    process.stderr.write(String(error && error.stack ? error.stack : error) + '\n');
    process.exitCode = 1;
  }
}
