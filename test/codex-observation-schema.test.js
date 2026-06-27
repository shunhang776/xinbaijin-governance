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

describe('Codex observation schema', () => {
  it('validates recorded Phase0 Codex observations', () => {
    const ajv = makeAjv();
    const schema = readJson('schemas/codex-observation.schema.json');
    const validate = ajv.compile(schema);

    const validFiles = [
      '.codex/bridge-observation.json',
      '.codex/review-bridge-observation.json',
      '.codex/repair-bridge-observation.json',
      '.codex/repair-bridge-observation-blocked-invalid-input.json',
      '.codex/l4-loop-smoke-observation.json'
    ];

    for (const file of validFiles) {
      const data = readJson(file);
      expect(validate(data), file + ': ' + JSON.stringify(validate.errors)).toBe(true);
    }
  });

  it('rejects invalid Codex observation fixtures', () => {
    const ajv = makeAjv();
    const schema = readJson('schemas/codex-observation.schema.json');
    const validate = ajv.compile(schema);

    expect(validate(readJson('fixtures/codex-observation/invalid-missing-conclusion.json'))).toBe(false);
    expect(validate(readJson('fixtures/codex-observation/invalid-wrong-role.json'))).toBe(false);
  });
});
