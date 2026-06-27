import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { buildCodexBridgeResult } from '../src/codex/bridge-adapter.mjs';

function readJson(path) {
  const raw = readFileSync(resolve(path), 'utf8').replace(/^\\uFEFF/, '');
  return JSON.parse(raw);
}

function makeValidator() {
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);
  return ajv.compile(readJson('schemas/codex-bridge-result.schema.json'));
}

describe('Codex Bridge Adapter minimal pure function', () => {
  it('builds a review bridge ready result', () => {
    const request = readJson('fixtures/codex-bridge-request/valid-review-bridge.json');
    const validate = makeValidator();

    const result = buildCodexBridgeResult(request, {
      result_id: 'result-review-test',
      created_at: '2026-06-27T00:00:00.000Z'
    });

    expect(result.status).toBe('READY');
    expect(result.conclusion).toBe('CODEX_REVIEW_BRIDGE_READY');
    expect(result.next_actor).toBe('chatgpt-baijin-reviewer');
    expect(validate(result), JSON.stringify(validate.errors)).toBe(true);
  });

  it('builds a repair bridge ready result', () => {
    const request = readJson('fixtures/codex-bridge-request/valid-repair-bridge.json');
    const validate = makeValidator();

    const result = buildCodexBridgeResult(request, {
      result_id: 'result-repair-test',
      created_at: '2026-06-27T00:00:00.000Z'
    });

    expect(result.status).toBe('READY');
    expect(result.conclusion).toBe('CODEX_REPAIR_BRIDGE_READY');
    expect(result.next_actor).toBe('claude-code');
    expect(validate(result), JSON.stringify(validate.errors)).toBe(true);
  });

  it('blocks repair bridge when findings are empty', () => {
    const request = readJson('fixtures/codex-bridge-request/valid-repair-bridge.json');
    const validate = makeValidator();
    request.findings = [];

    const result = buildCodexBridgeResult(request, {
      result_id: 'result-repair-blocked-test',
      created_at: '2026-06-27T00:00:00.000Z'
    });

    expect(result.status).toBe('BLOCKED');
    expect(result.conclusion).toBe('CODEX_REPAIR_BRIDGE_BLOCKED');
    expect(result.errors.length).toBeGreaterThan(0);
    expect(validate(result), JSON.stringify(validate.errors)).toBe(true);
  });

  it('does not mutate the input request', () => {
    const request = readJson('fixtures/codex-bridge-request/valid-review-bridge.json');
    const before = JSON.stringify(request);

    buildCodexBridgeResult(request, {
      result_id: 'result-mutation-test',
      created_at: '2026-06-27T00:00:00.000Z'
    });

    expect(JSON.stringify(request)).toBe(before);
  });
});
