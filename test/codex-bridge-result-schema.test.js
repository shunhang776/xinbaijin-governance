import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

function readJson(path) {
  const raw = readFileSync(resolve(path), 'utf8').replace(/^\\uFEFF/, '');
  return JSON.parse(raw);
}

function makeAjv() {
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);
  return ajv;
}

describe('Codex bridge result schema', () => {
  it('validates valid bridge result fixtures', () => {
    const ajv = makeAjv();
    const schema = readJson('schemas/codex-bridge-result.schema.json');
    const validate = ajv.compile(schema);

    expect(validate(readJson('fixtures/codex-bridge-result/valid-review-result.json'))).toBe(true);
    expect(validate(readJson('fixtures/codex-bridge-result/valid-repair-result.json'))).toBe(true);
  });

  it('rejects invalid bridge result fixtures', () => {
    const ajv = makeAjv();
    const schema = readJson('schemas/codex-bridge-result.schema.json');
    const validate = ajv.compile(schema);

    expect(validate(readJson('fixtures/codex-bridge-result/invalid-wrong-role.json'))).toBe(false);
    expect(validate(readJson('fixtures/codex-bridge-result/invalid-bad-conclusion.json'))).toBe(false);
  });
});
