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

describe('Codex bridge request schema', () => {
  it('validates valid bridge request fixtures', () => {
    const ajv = makeAjv();
    const schema = readJson('schemas/codex-bridge-request.schema.json');
    const validate = ajv.compile(schema);

    expect(validate(readJson('fixtures/codex-bridge-request/valid-review-bridge.json'))).toBe(true);
    expect(validate(readJson('fixtures/codex-bridge-request/valid-repair-bridge.json'))).toBe(true);
  });

  it('rejects invalid bridge request fixtures', () => {
    const ajv = makeAjv();
    const schema = readJson('schemas/codex-bridge-request.schema.json');
    const validate = ajv.compile(schema);

    expect(validate(readJson('fixtures/codex-bridge-request/invalid-wrong-role.json'))).toBe(false);
    expect(validate(readJson('fixtures/codex-bridge-request/invalid-bridge-type.json'))).toBe(false);
  });
});
