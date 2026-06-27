#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

function readJson(path) {
  const raw = readFileSync(resolve(path), 'utf8').replace(/^\uFEFF/, '');
  return JSON.parse(raw);
}

function writeText(path, value) {
  writeFileSync(resolve(path), value, 'utf8');
}

function parseArgs(argv) {
  const args = {
    artifact: null,
    run_result: null,
    out: null
  };

  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];

    if (key === '--artifact') {
      args.artifact = argv[++i];
      continue;
    }

    if (key === '--run-result') {
      args.run_result = argv[++i];
      continue;
    }

    if (key === '--out') {
      args.out = argv[++i];
      continue;
    }

    throw new Error('unknown argument: ' + key);
  }

  if (!args.artifact) {
    throw new Error('--artifact is required');
  }

  if (!args.run_result) {
    throw new Error('--run-result is required');
  }

  if (!args.out) {
    throw new Error('--out is required');
  }

  return args;
}

export function buildDryRunPrComment(artifact, runResult) {
  const label = runResult.status === 'COMPLETED' && runResult.final_state === 'ACCEPTED'
    ? '[OK]'
    : '[ATTENTION]';

  return [
    '<!-- baijin-l4-dry-run-comment -->',
    '',
    '## ' + label + ' L4 Pipeline Dry Run',
    '',
    '| Field | Value |',
    '| --- | --- |',
    '| status | `' + runResult.status + '` |',
    '| final_state | `' + runResult.final_state + '` |',
    '| run_id | `' + runResult.run_id + '` |',
    '| task_id | `' + runResult.task_id + '` |',
    '| repository | `' + runResult.repository + '` |',
    '| branch | `' + runResult.branch + '` |',
    '| artifact_id | `' + artifact.artifact_id + '` |',
    '',
    '### Artifact files',
    '',
    ...artifact.files.map((file) => '- `' + file.kind + '`: `' + file.path + '`'),
    '',
    '> Dry-run draft only. This does not approve, reject, merge, comment automatically, write review.json, or call ChatGPT / Claude.',
    ''
  ].join('\n');
}

export function runWriteDryRunPrCommentCli(argv) {
  const args = parseArgs(argv);
  const artifact = readJson(args.artifact);
  const runResult = readJson(args.run_result);
  const comment = buildDryRunPrComment(artifact, runResult);

  writeText(args.out, comment);

  return {
    artifact,
    runResult,
    comment
  };
}

function isCliEntryPoint() {
  if (!process.argv[1]) {
    return false;
  }

  return resolve(process.argv[1]) === fileURLToPath(import.meta.url);
}

if (isCliEntryPoint()) {
  try {
    const { artifact, runResult } = runWriteDryRunPrCommentCli(process.argv.slice(2));

    process.stdout.write(JSON.stringify({
      ok: true,
      artifact_id: artifact.artifact_id,
      status: runResult.status,
      final_state: runResult.final_state
    }) + '\n');
  } catch (error) {
    process.stderr.write(String(error && error.stack ? error.stack : error) + '\n');
    process.exitCode = 1;
  }
}
