import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

function readJson(path) {
  return JSON.parse(readFileSync(resolve(path), 'utf8'));
}

function makeAjv() {
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);
  return ajv;
}

describe('L4 JSON schemas', () => {
  it('validates task-state fixtures', () => {
    const ajv = makeAjv();
    const schema = readJson('schemas/l4-task-state.schema.json');
    const validate = ajv.compile(schema);

    expect(validate(readJson('fixtures/l4/task-state/valid-minimal.json'))).toBe(true);

    expect(validate(readJson('fixtures/l4/task-state/invalid-missing-state.json'))).toBe(false);
    expect(validate(readJson('fixtures/l4/task-state/invalid-bad-repository.json'))).toBe(false);
  });

  it('validates event fixtures', () => {
    const ajv = makeAjv();
    const schema = readJson('schemas/l4-event.schema.json');
    const validate = ajv.compile(schema);

    expect(validate(readJson('fixtures/l4/event/valid-minimal.json'))).toBe(true);

    expect(validate(readJson('fixtures/l4/event/invalid-bad-event-type.json'))).toBe(false);
    expect(validate(readJson('fixtures/l4/event/invalid-bad-actor.json'))).toBe(false);
  });
});
