import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

function readJson(path) {
  const raw = readFileSync(resolve(path), 'utf8').replace(/^\uFEFF/, '');
  return JSON.parse(raw);
}

function makeValidator() {
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);
  return ajv.compile(readJson('schemas/claude-repair-submission.schema.json'));
}

describe('Claude repair submission schema', () => {
  it('validates valid Claude repair submission fixture', () => {
    const validate = makeValidator();

    expect(validate(readJson('fixtures/claude-repair-submission/valid-minimal.json')), JSON.stringify(validate.errors)).toBe(true);
  });

  it('rejects repair submission without resolved findings', () => {
    const validate = makeValidator();

    expect(validate(readJson('fixtures/claude-repair-submission/invalid-empty-resolved-findings.json'))).toBe(false);
  });

  it('rejects repair submission from non-Claude actor', () => {
    const validate = makeValidator();

    expect(validate(readJson('fixtures/claude-repair-submission/invalid-wrong-actor.json'))).toBe(false);
  });
});
