import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

function readJson(path) {
  const raw = readFileSync(resolve(path), 'utf8').replace(/^\uFEFF/, '');
  return JSON.parse(raw);
}

describe('L4 dry-run ChatGPT review result artifact', () => {
  it('generates simulated review result and consumes it in dry-run input', () => {
    const dir = mkdtempSync(join(tmpdir(), 'baijin-l4-dry-run-review-result-'));

    try {
      const bridgeResult = join(dir, 'codex-bridge-result.json');
      const invocation = join(dir, 'chatgpt-review-invocation.json');
      const reviewResult = join(dir, 'chatgpt-review-result.json');
      const input = join(dir, 'l4-pipeline-input.json');

      execFileSync(process.execPath, [
        'src/codex/bridge-cli.mjs',
        '--request',
        'fixtures/codex-bridge-request/valid-review-bridge.json',
        '--out',
        bridgeResult,
        '--result-id',
        'result-test-review-001',
        '--review-invocation-out',
        invocation,
        '--invocation-id',
        'invocation-test-review-001',
        '--created-at',
        '2026-06-27T00:00:00.000Z'
      ]);

      execFileSync(process.execPath, [
        'scripts/l4/build-dry-run-review-result.mjs',
        '--invocation',
        invocation,
        '--out',
        reviewResult,
        '--result-id',
        'chatgpt-review-result-test-001',
        '--created-at',
        '2026-06-27T00:00:00.000Z'
      ]);

      execFileSync(process.execPath, [
        'scripts/l4/build-dry-run-input.mjs',
        '--review-result',
        reviewResult,
        '--out',
        input
      ]);

      const result = readJson(reviewResult);
      const dryRunInput = readJson(input);

      expect(result.protocol).toBe('baijin-chatgpt-review-result/1.0');
      expect(result.verdict).toBe('approved');
      expect(dryRunInput.tailEvents.map((event) => event.event_type)).toContain('REVIEW_APPROVED');
      expect(dryRunInput.tailEvents.map((event) => event.event_type)).toContain('GATE_ALLOWED');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
