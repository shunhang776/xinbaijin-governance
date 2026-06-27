import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

function readJson(path) {
  const raw = readFileSync(resolve(path), 'utf8').replace(/^\uFEFF/, '');
  return JSON.parse(raw);
}

function makeAjv() {
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);
  return ajv;
}

function makeReviewResultValidator() {
  return makeAjv().compile(readJson('schemas/chatgpt-review-result.schema.json'));
}

describe('L4 dry-run fake MCP review result builder', () => {
  it('generates schema-valid ChatGPT review result through fake MCP executor', () => {
    const dir = mkdtempSync(join(tmpdir(), 'baijin-l4-fake-mcp-review-result-'));
    const bridgeResult = join(dir, 'codex-bridge-result.json');
    const invocation = join(dir, 'chatgpt-review-invocation.json');
    const reviewResult = join(dir, 'chatgpt-review-result.json');

    try {
      execFileSync(process.execPath, [
        'src/codex/bridge-cli.mjs',
        '--request',
        'fixtures/codex-bridge-request/valid-review-bridge.json',
        '--out',
        bridgeResult,
        '--result-id',
        'result-fake-mcp-review-001',
        '--review-invocation-out',
        invocation,
        '--invocation-id',
        'invocation-fake-mcp-review-001',
        '--created-at',
        '2026-06-27T00:00:00.000Z'
      ]);

      const stdout = execFileSync(process.execPath, [
        'scripts/l4/build-dry-run-review-result.mjs',
        '--invocation',
        invocation,
        '--out',
        reviewResult,
        '--result-id',
        'chatgpt-review-result-fake-mcp-dry-run-001',
        '--created-at',
        '2026-06-27T00:00:00.000Z'
      ], {
        encoding: 'utf8'
      });

      const summary = JSON.parse(stdout);
      const result = readJson(reviewResult);
      const validate = makeReviewResultValidator();

      expect(summary.ok).toBe(true);
      expect(summary.result_id).toBe('chatgpt-review-result-fake-mcp-dry-run-001');
      expect(summary.status).toBe('review_submitted');
      expect(summary.verdict).toBe('approved');

      expect(result.protocol).toBe('baijin-chatgpt-review-result/1.0');
      expect(result.status).toBe('review_submitted');
      expect(result.verdict).toBe('approved');
      expect(result.review_commit).toBe('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
      expect(result.readback.verified).toBe(true);
      expect(result.readback.sha256).toBe('bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb');
      expect(validate(result), JSON.stringify(validate.errors)).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
