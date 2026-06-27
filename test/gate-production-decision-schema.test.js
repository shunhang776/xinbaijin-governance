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
  return ajv.compile(readJson('schemas/gate-production-decision.schema.json'));
}

describe('Gate production decision schema', () => {
  it('validates allowed gate production decision fixture', () => {
    const validate = makeValidator();

    expect(validate(readJson('fixtures/gate-production-decision/valid-allowed.json')), JSON.stringify(validate.errors)).toBe(true);
  });

  it('validates denied gate production decision fixture', () => {
    const validate = makeValidator();

    expect(validate(readJson('fixtures/gate-production-decision/valid-denied.json')), JSON.stringify(validate.errors)).toBe(true);
  });

  it('rejects allowed gate decision when any required condition is false', () => {
    const validate = makeValidator();

    expect(validate(readJson('fixtures/gate-production-decision/invalid-allowed-failed-condition.json'))).toBe(false);
  });
});
