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
  return ajv.compile(readJson('schemas/phase5-enablement.schema.json'));
}

describe('Phase5 enablement schema', () => {
  it('validates disabled draft enablement fixture', () => {
    const validate = makeValidator();

    expect(validate(readJson('fixtures/phase5-enablement/valid-draft-disabled.json')), JSON.stringify(validate.errors)).toBe(true);
  });

  it('validates disabled manual gate enablement fixture', () => {
    const validate = makeValidator();

    expect(validate(readJson('fixtures/phase5-enablement/valid-manual-gate-disabled.json')), JSON.stringify(validate.errors)).toBe(true);
  });

  it('rejects production enabled fixture without all approvals and production_enforcer mode', () => {
    const validate = makeValidator();

    expect(validate(readJson('fixtures/phase5-enablement/invalid-enabled-without-approvals.json'))).toBe(false);
  });
});
