import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import {
  buildL4TaskStateSnapshot,
  findL4StateField,
  runL4EventsToTaskState
} from '../src/l4/task-state-snapshot.mjs';

function readJson(path) {
  const raw = readFileSync(resolve(path), 'utf8').replace(/^\\uFEFF/, '');
  return JSON.parse(raw);
}

function makeValidator() {
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);
  return ajv.compile(readJson('schemas/l4-task-state.schema.json'));
}

describe('L4 task-state snapshot adapter', () => {
  it('updates a valid task-state snapshot to ACCEPTED and keeps schema valid', () => {
    const base = readJson('fixtures/l4/task-state/valid-minimal.json');
    const validate = makeValidator();

    const snapshot = runL4EventsToTaskState(
      base,
      [
        'CODE_DETECTED',
        'CHECKS_STARTED',
        'CHECKS_PASSED',
        'REVIEW_APPROVED',
        'GATE_ALLOWED'
      ],
      { updated_at: '2026-06-27T00:00:00.000Z' }
    );

    const stateField = findL4StateField(snapshot);
    expect(snapshot).not.toBe(base);
    expect(snapshot[stateField]).toBe('ACCEPTED');
    expect(validate(snapshot), JSON.stringify(validate.errors)).toBe(true);
  });

  it('updates a valid task-state snapshot to MANUAL_REQUIRED and keeps schema valid', () => {
    const base = readJson('fixtures/l4/task-state/valid-minimal.json');
    const validate = makeValidator();

    const snapshot = runL4EventsToTaskState(
      base,
      [
        'CODE_DETECTED',
        'CHECKS_STARTED',
        'CHECKS_PASSED',
        'REVIEW_BLOCKED'
      ],
      { updated_at: '2026-06-27T00:00:00.000Z' }
    );

    const stateField = findL4StateField(snapshot);
    expect(snapshot[stateField]).toBe('MANUAL_REQUIRED');
    expect(validate(snapshot), JSON.stringify(validate.errors)).toBe(true);
  });

  it('rejects unknown L4 state values', () => {
    const base = readJson('fixtures/l4/task-state/valid-minimal.json');
    expect(() => buildL4TaskStateSnapshot(base, 'UNKNOWN_STATE')).toThrow('invalid L4 state');
  });
});
