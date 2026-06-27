import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import {
  getL4EventType,
  l4EventObjectsToMachineEvents,
  runValidatedL4EventObjects
} from '../src/l4/l4-event-input.mjs';

function readJson(path) {
  const raw = readFileSync(resolve(path), 'utf8').replace(/^\\uFEFF/, '');
  return JSON.parse(raw);
}

function makeValidator() {
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);
  return ajv.compile(readJson('schemas/l4-event.schema.json'));
}

function makeEvent(eventType, index) {
  return {
    ...readJson('fixtures/l4/event/valid-minimal.json'),
    event_id: 'event-' + String(index).padStart(2, '0') + '-' + eventType.toLowerCase().replace(/_/g, '-'),
    event_type: eventType,
    created_at: '2026-06-27T00:00:00.000Z'
  };
}

describe('L4 event input validation', () => {
  it('extracts event_type from a valid L4 event object', () => {
    const event = makeEvent('CODE_DETECTED', 1);
    expect(getL4EventType(event)).toBe('CODE_DETECTED');
  });

  it('converts schema-valid L4 event objects to machine events', () => {
    const validate = makeValidator();
    const events = [
      makeEvent('CODE_DETECTED', 1),
      makeEvent('CHECKS_STARTED', 2),
      makeEvent('CHECKS_PASSED', 3)
    ];

    expect(l4EventObjectsToMachineEvents(events, validate)).toEqual([
      'CODE_DETECTED',
      'CHECKS_STARTED',
      'CHECKS_PASSED'
    ]);
  });

  it('runs schema-valid L4 event objects through the state machine', () => {
    const validate = makeValidator();
    const finalState = runValidatedL4EventObjects(
      [
        makeEvent('CODE_DETECTED', 1),
        makeEvent('CHECKS_STARTED', 2),
        makeEvent('CHECKS_PASSED', 3),
        makeEvent('REVIEW_APPROVED', 4),
        makeEvent('GATE_ALLOWED', 5)
      ],
      validate
    );

    expect(finalState).toBe('ACCEPTED');
  });

  it('rejects invalid L4 event fixtures before running the state machine', () => {
    const validate = makeValidator();
    const invalid = readJson('fixtures/l4/event/invalid-bad-event-type.json');

    expect(() => runValidatedL4EventObjects([invalid], validate)).toThrow('invalid L4 event');
  });
});
