import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

function readJson(path) {
  const raw = readFileSync(resolve(path), 'utf8').replace(/^\\uFEFF/, '');
  return JSON.parse(raw);
}

function makeValidator() {
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);
  return ajv.compile(readJson('schemas/chatgpt-review-invocation.schema.json'));
}

describe('ChatGPT review invocation schema', () => {
  it('validates valid ChatGPT review invocation fixtures', () => {
    const validate = makeValidator();

    expect(validate(readJson('fixtures/chatgpt-review-invocation/valid-mcp.json')), JSON.stringify(validate.errors)).toBe(true);
    expect(validate(readJson('fixtures/chatgpt-review-invocation/valid-claude.json')), JSON.stringify(validate.errors)).toBe(true);
  });

  it('rejects repository and trigger mismatches', () => {
    const validate = makeValidator();

    expect(validate(readJson('fixtures/chatgpt-review-invocation/invalid-repository-trigger-mismatch.json'))).toBe(false);
  });
});
