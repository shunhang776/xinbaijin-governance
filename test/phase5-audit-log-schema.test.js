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
  return ajv.compile(readJson('schemas/phase5-audit-log.schema.json'));
}

describe('Phase5 audit log schema', () => {
  it('validates draft audit log fixture', () => {
    const validate = makeValidator();

    expect(validate(readJson('fixtures/phase5-audit-log/valid-draft.json')), JSON.stringify(validate.errors)).toBe(true);
  });

  it('validates production enabled audit log fixture', () => {
    const validate = makeValidator();

    expect(validate(readJson('fixtures/phase5-audit-log/valid-production-enabled.json')), JSON.stringify(validate.errors)).toBe(true);
  });

  it('rejects production enabled audit log without all approvals', () => {
    const validate = makeValidator();

    expect(validate(readJson('fixtures/phase5-audit-log/invalid-production-enabled-without-approval.json'))).toBe(false);
  });
});
