import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  codexBridgeResultToL4Events,
  runL4EventsWithCodexResults
} from '../src/l4/codex-result-events.mjs';

function readJson(path) {
  const raw = readFileSync(resolve(path), 'utf8').replace(/^\\uFEFF/, '');
  return JSON.parse(raw);
}

describe('Codex bridge result to L4 events', () => {
  it('maps review bridge ready to REVIEW_REQUESTED', () => {
    const result = readJson('fixtures/codex-bridge-result/valid-review-result.json');
    expect(codexBridgeResultToL4Events(result)).toEqual(['REVIEW_REQUESTED']);
  });

  it('maps repair bridge ready to REPAIR_REQUESTED', () => {
    const result = readJson('fixtures/codex-bridge-result/valid-repair-result.json');
    expect(codexBridgeResultToL4Events(result)).toEqual(['REPAIR_REQUESTED']);
  });

  it('keeps L4 waiting for review after review bridge request', () => {
    const result = readJson('fixtures/codex-bridge-result/valid-review-result.json');

    const finalState = runL4EventsWithCodexResults(
      ['CODE_DETECTED', 'CHECKS_STARTED', 'CHECKS_PASSED'],
      [result]
    );

    expect(finalState).toBe('WAIT_REVIEW');
  });

  it('reaches ACCEPTED when repair bridge result is followed by repair and approved review', () => {
    const result = readJson('fixtures/codex-bridge-result/valid-repair-result.json');

    const finalState = runL4EventsWithCodexResults(
      ['CODE_DETECTED', 'CHECKS_STARTED', 'CHECKS_PASSED', 'REVIEW_DENIED'],
      [result],
      ['REPAIR_SUBMITTED', 'CHECKS_STARTED', 'CHECKS_PASSED', 'REVIEW_APPROVED', 'GATE_ALLOWED']
    );

    expect(finalState).toBe('ACCEPTED');
  });

  it('moves to MANUAL_REQUIRED when Codex bridge result is blocked', () => {
    const result = {
      ...readJson('fixtures/codex-bridge-result/valid-repair-result.json'),
      status: 'BLOCKED',
      conclusion: 'CODEX_REPAIR_BRIDGE_BLOCKED'
    };

    const finalState = runL4EventsWithCodexResults(
      ['CODE_DETECTED', 'CHECKS_STARTED', 'CHECKS_PASSED', 'REVIEW_DENIED'],
      [result]
    );

    expect(finalState).toBe('MANUAL_REQUIRED');
  });
});
