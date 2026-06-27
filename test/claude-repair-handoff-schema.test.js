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
  return ajv.compile(readJson('schemas/claude-repair-handoff.schema.json'));
}

describe('Claude repair handoff schema', () => {
  it('validates valid Claude repair handoff fixture', () => {
    const validate = makeValidator();

    expect(validate(readJson('fixtures/claude-repair-handoff/valid-minimal.json')), JSON.stringify(validate.errors)).toBe(true);
  });

  it('rejects approved verdict repair handoff', () => {
    const validate = makeValidator();

    expect(validate(readJson('fixtures/claude-repair-handoff/invalid-approved-verdict.json'))).toBe(false);
  });
});
