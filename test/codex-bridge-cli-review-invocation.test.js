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

function makeInvocationValidator() {
  return makeAjv().compile(readJson('schemas/chatgpt-review-invocation.schema.json'));
}

function makeTempDir() {
  return mkdtempSync(join(tmpdir(), 'baijin-codex-bridge-cli-review-invocation-'));
}

describe('Codex bridge CLI review invocation output', () => {
  it('writes ChatGPT review invocation for review_bridge request', () => {
    const dir = makeTempDir();
    const resultOut = join(dir, 'bridge-result.json');
    const invocationOut = join(dir, 'chatgpt-review-invocation.json');

    try {
      const stdout = execFileSync(process.execPath, [
        'src/codex/bridge-cli.mjs',
        '--request',
        'fixtures/codex-bridge-request/valid-review-bridge.json',
        '--out',
        resultOut,
        '--result-id',
        'result-cli-review-invocation-001',
        '--review-invocation-out',
        invocationOut,
        '--invocation-id',
        'invocation-cli-review-001',
        '--created-at',
        '2026-06-27T00:00:00.000Z'
      ], {
        encoding: 'utf8'
      });

      const summary = JSON.parse(stdout);
      const result = readJson(resultOut);
      const invocation = readJson(invocationOut);
      const validateInvocation = makeInvocationValidator();

      expect(summary.ok).toBe(true);
      expect(summary.result_id).toBe('result-cli-review-invocation-001');
      expect(summary.review_invocation_id).toBe('invocation-cli-review-001');

      expect(result.conclusion).toBe('CODEX_REVIEW_BRIDGE_READY');
      expect(invocation.protocol).toBe('baijin-chatgpt-review-invocation/1.0');
      expect(invocation.invocation_id).toBe('invocation-cli-review-001');
      expect(invocation.repository).toBe('shunhang776/xinbaijin-mcp');
      expect(invocation.branch).toBe('dev');
      expect(invocation.trigger_key).toBe('REVIEW_MCP_LATEST_HANDOFF');
      expect(invocation.exact_trigger_text).toBe('审查 MCP 最新交接');
      expect(invocation.reviewer).toBe('chatgpt-baijin-reviewer');
      expect(validateInvocation(invocation), JSON.stringify(validateInvocation.errors)).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('rejects review invocation output for non-review bridge request', () => {
    const dir = makeTempDir();
    const resultOut = join(dir, 'bridge-result.json');
    const invocationOut = join(dir, 'chatgpt-review-invocation.json');

    try {
      expect(() => execFileSync(process.execPath, [
        'src/codex/bridge-cli.mjs',
        '--request',
        'fixtures/codex-bridge-request/valid-repair-bridge.json',
        '--out',
        resultOut,
        '--review-invocation-out',
        invocationOut
      ], {
        encoding: 'utf8',
        stdio: 'pipe'
      })).toThrow();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
