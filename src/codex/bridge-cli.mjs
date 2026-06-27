#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildCodexBridgeResult } from './bridge-adapter.mjs';

function readJson(path) {
  const raw = readFileSync(resolve(path), 'utf8').replace(/^\uFEFF/, '');
  return JSON.parse(raw);
}

function writeJson(path, value) {
  writeFileSync(
    resolve(path),
    JSON.stringify(value, null, 2) + '\n',
    'utf8'
  );
}

function parseArgs(argv) {
  const args = {
    request: null,
    out: null,
    result_id: null,
    created_at: null
  };

  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];

    if (key === '--request') {
      args.request = argv[++i];
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

    if (key === '--created-at') {
      args.created_at = argv[++i];
      continue;
    }

    throw new Error('unknown argument: ' + key);
  }

  if (!args.request) {
    throw new Error('--request is required');
  }

  if (!args.out) {
    throw new Error('--out is required');
  }

  return args;
}

export function runCodexBridgeCli(argv) {
  const args = parseArgs(argv);
  const request = readJson(args.request);

  const result = buildCodexBridgeResult(request, {
    result_id: args.result_id,
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
    const result = runCodexBridgeCli(process.argv.slice(2));
    process.stdout.write(JSON.stringify({
      ok: true,
      result_id: result.result_id,
      conclusion: result.conclusion,
      status: result.status
    }) + '\n');
  } catch (error) {
    process.stderr.write(String(error && error.stack ? error.stack : error) + '\n');
    process.exitCode = 1;
  }
}
