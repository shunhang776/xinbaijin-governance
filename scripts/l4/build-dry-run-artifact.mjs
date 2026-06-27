#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

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
    out: null,
    input_path: 'artifacts/l4/l4-pipeline-input.json',
    output_path: 'artifacts/l4/l4-pipeline-output.json',
    run_result_path: 'artifacts/l4/l4-run-result.json'
  };

  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];

    if (key === '--run-result') {
      args.run_result = argv[++i];
      continue;
    }

    if (key === '--out') {
      args.out = argv[++i];
      continue;
    }

    if (key === '--input-path') {
      args.input_path = argv[++i];
      continue;
    }

    if (key === '--output-path') {
      args.output_path = argv[++i];
      continue;
    }

    if (key === '--run-result-path') {
      args.run_result_path = argv[++i];
      continue;
    }

    throw new Error('unknown argument: ' + key);
  }

  if (!args.run_result) {
    throw new Error('--run-result is required');
  }

  if (!args.out) {
    throw new Error('--out is required');
  }

  return args;
}

export function buildDryRunArtifact(runResult, options = {}) {
  return {
    protocol: 'baijin-l4-dry-run-artifact/1.0',
    artifact_id: options.artifact_id || 'artifact-' + runResult.run_id,
    run_id: runResult.run_id,
    task_id: runResult.task_id,
    repository: runResult.repository,
    branch: runResult.branch,
    status: runResult.status,
    final_state: runResult.final_state,
    files: [
      {
        kind: 'pipeline_input',
        path: options.input_path || 'artifacts/l4/l4-pipeline-input.json'
      },
      {
        kind: 'pipeline_output',
        path: options.output_path || 'artifacts/l4/l4-pipeline-output.json'
      },
      {
        kind: 'run_result',
        path: options.run_result_path || 'artifacts/l4/l4-run-result.json'
      }
    ],
    created_at: options.created_at || runResult.created_at || new Date().toISOString()
  };
}

export function runBuildDryRunArtifactCli(argv) {
  const args = parseArgs(argv);
  const runResult = readJson(args.run_result);

  const artifact = buildDryRunArtifact(runResult, {
    input_path: args.input_path,
    output_path: args.output_path,
    run_result_path: args.run_result_path
  });

  writeJson(args.out, artifact);
  return artifact;
}

function isCliEntryPoint() {
  if (!process.argv[1]) {
    return false;
  }

  return resolve(process.argv[1]) === fileURLToPath(import.meta.url);
}

if (isCliEntryPoint()) {
  try {
    const artifact = runBuildDryRunArtifactCli(process.argv.slice(2));
    process.stdout.write(JSON.stringify({
      ok: true,
      artifact_id: artifact.artifact_id,
      status: artifact.status,
      final_state: artifact.final_state
    }) + '\n');
  } catch (error) {
    process.stderr.write(String(error && error.stack ? error.stack : error) + '\n');
    process.exitCode = 1;
  }
}
