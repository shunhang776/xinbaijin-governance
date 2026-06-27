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
  return ajv.compile(readJson('schemas/phase5-rollback-plan.schema.json'));
}

describe('Phase5 rollback plan schema', () => {
  it('validates draft rollback plan fixture', () => {
    const validate = makeValidator();

    expect(validate(readJson('fixtures/phase5-rollback-plan/valid-draft.json')), JSON.stringify(validate.errors)).toBe(true);
  });

  it('validates ready rollback plan fixture', () => {
    const validate = makeValidator();

    expect(validate(readJson('fixtures/phase5-rollback-plan/valid-ready.json')), JSON.stringify(validate.errors)).toBe(true);
  });

  it('rejects ready rollback plan without all approvals', () => {
    const validate = makeValidator();

    expect(validate(readJson('fixtures/phase5-rollback-plan/invalid-ready-without-approval.json'))).toBe(false);
  });
});
