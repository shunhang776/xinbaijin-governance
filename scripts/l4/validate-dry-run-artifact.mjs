#!/usr/bin/env node

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

function readJson(path) {
  const raw = readFileSync(resolve(path), 'utf8').replace(/^\uFEFF/, '');
  return JSON.parse(raw);
}

function parseArgs(argv) {
  const args = {
    artifact: null,
    schema: 'schemas/l4-dry-run-artifact.schema.json',
    base_dir: '.'
  };

  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];

    if (key === '--artifact') {
      args.artifact = argv[++i];
      continue;
    }

    if (key === '--schema') {
      args.schema = argv[++i];
      continue;
    }

    if (key === '--base-dir') {
      args.base_dir = argv[++i];
      continue;
    }

    throw new Error('unknown argument: ' + key);
  }

  if (!args.artifact) {
    throw new Error('--artifact is required');
  }

  return args;
}

function makeValidator(schemaPath) {
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);
  return ajv.compile(readJson(schemaPath));
}

export function validateDryRunArtifact(artifact, validate, options = {}) {
  const ok = validate(artifact);

  if (!ok) {
    throw new Error('invalid dry-run artifact: ' + JSON.stringify(validate.errors || []));
  }

  const baseDir = resolve(options.base_dir || '.');
  const missingFiles = [];

  for (const file of artifact.files) {
    const filePath = resolve(baseDir, file.path);

    if (!existsSync(filePath)) {
      missingFiles.push(file.path);
    }
  }

  if (missingFiles.length > 0) {
    throw new Error('dry-run artifact references missing files: ' + missingFiles.join(', '));
  }

  return artifact;
}

export function runValidateDryRunArtifactCli(argv) {
  const args = parseArgs(argv);
  const artifact = readJson(args.artifact);
  const validate = makeValidator(args.schema);

  validateDryRunArtifact(artifact, validate, {
    base_dir: args.base_dir
  });

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
    const artifact = runValidateDryRunArtifactCli(process.argv.slice(2));
    process.stdout.write(JSON.stringify({
      ok: true,
      artifact_id: artifact.artifact_id,
      status: artifact.status,
      final_state: artifact.final_state,
      file_count: artifact.files.length
    }) + '\n');
  } catch (error) {
    process.stderr.write(String(error && error.stack ? error.stack : error) + '\n');
    process.exitCode = 1;
  }
}
