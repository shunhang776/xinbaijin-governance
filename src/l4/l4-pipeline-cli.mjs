#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { runCodexResultL4Pipeline } from './l4-codex-pipeline.mjs';
import { buildL4RunResult } from './l4-run-result.mjs';

function readJson(path) {
  const raw = readFileSync(resolve(path), 'utf8').replace(/^\uFEFF/, '');
  return JSON.parse(raw);
}

function writeJson(path, value) {
  writeFileSync(resolve(path), JSON.stringify(value, null, 2) + '\n', 'utf8');
}

function makeEventValidator(schemaPath) {
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);
  return ajv.compile(readJson(schemaPath));
}

function parseArgs(argv) {
  const args = {
    input: null,
    out: null,
    pipeline_out: null,
    event_schema: 'schemas/l4-event.schema.json'
  };

  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];

    if (key === '--input') {
      args.input = argv[++i];
      continue;
    }

    if (key === '--out') {
      args.out = argv[++i];
      continue;
    }

    if (key === '--pipeline-out') {
      args.pipeline_out = argv[++i];
      continue;
    }

    if (key === '--event-schema') {
      args.event_schema = argv[++i];
      continue;
    }

    throw new Error('unknown argument: ' + key);
  }

  if (!args.input) {
    throw new Error('--input is required');
  }

  if (!args.out) {
    throw new Error('--out is required');
  }

  return args;
}

export function runL4PipelineCli(argv) {
  const args = parseArgs(argv);
  const input = readJson(args.input);
  const validateEvent = makeEventValidator(args.event_schema);

  const pipelineOutput = runCodexResultL4Pipeline({
    baseTaskState: input.baseTaskState,
    initialEvents: input.initialEvents || [],
    codexResults: input.codexResults || [],
    reviewGuards: input.reviewGuards || [],
    tailEvents: input.tailEvents || [],
    eventTemplate: input.eventTemplate,
    validateEvent,
    snapshotOptions: input.snapshotOptions || {}
  });

  const runResult = buildL4RunResult(pipelineOutput, {
    run_id: input.run_id,
    task_id: input.task_id,
    repository: input.repository,
    branch: input.branch,
    created_at: input.created_at,
    errors: input.errors || []
  });

  writeJson(args.out, runResult);

  if (args.pipeline_out) {
    writeJson(args.pipeline_out, pipelineOutput);
  }

  return {
    pipelineOutput,
    runResult
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
    const { runResult } = runL4PipelineCli(process.argv.slice(2));

    process.stdout.write(JSON.stringify({
      ok: true,
      run_id: runResult.run_id,
      status: runResult.status,
      final_state: runResult.final_state
    }) + '\n');
  } catch (error) {
    process.stderr.write(String(error && error.stack ? error.stack : error) + '\n');
    process.exitCode = 1;
  }
}
