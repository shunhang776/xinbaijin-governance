#!/usr/bin/env node

import { appendFileSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

function readJson(path) {
  const raw = readFileSync(resolve(path), 'utf8').replace(/^\uFEFF/, '');
  return JSON.parse(raw);
}

function parseArgs(argv) {
  const args = {
    artifact: null,
    run_result: null,
    out: process.env.GITHUB_STEP_SUMMARY || null
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
    throw new Error('--out is required or GITHUB_STEP_SUMMARY must be set');
  }

  return args;
}

export function buildDryRunSummary(artifact, runResult) {
  return [
    '## L4 Pipeline Dry Run',
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
    '| files | `' + artifact.files.length + '` |',
    '',
    '### Artifact files',
    '',
    ...artifact.files.map((file) => '- `' + file.kind + '`: `' + file.path + '`'),
    ''
  ].join('\n');
}

export function runWriteDryRunSummaryCli(argv) {
  const args = parseArgs(argv);
  const artifact = readJson(args.artifact);
  const runResult = readJson(args.run_result);
  const summary = buildDryRunSummary(artifact, runResult);

  appendFileSync(resolve(args.out), summary + '\n', 'utf8');

  return {
    artifact,
    runResult,
    summary
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
    const { artifact, runResult } = runWriteDryRunSummaryCli(process.argv.slice(2));

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
