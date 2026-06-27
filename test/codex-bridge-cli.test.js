import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

function readJson(path) {
  const raw = readFileSync(resolve(path), 'utf8').replace(/^\uFEFF/, '');
  return JSON.parse(raw);
}

function makeTempDir() {
  return mkdtempSync(join(tmpdir(), 'baijin-codex-bridge-cli-'));
}

describe('Codex bridge CLI', () => {
  it('writes a review bridge result JSON file', () => {
    const dir = makeTempDir();
    const out = join(dir, 'result.json');

    try {
      const stdout = execFileSync(process.execPath, [
        'src/codex/bridge-cli.mjs',
        '--request',
        'fixtures/codex-bridge-request/valid-review-bridge.json',
        '--out',
        out,
        '--result-id',
        'result-cli-review-001',
        '--created-at',
        '2026-06-27T00:00:00.000Z'
      ], {
        encoding: 'utf8'
      });

      const summary = JSON.parse(stdout);
      const result = readJson(out);

      expect(summary.ok).toBe(true);
      expect(summary.result_id).toBe('result-cli-review-001');
      expect(summary.conclusion).toBe('CODEX_REVIEW_BRIDGE_READY');

      expect(result.protocol).toBe('baijin-codex-bridge-result/1.0');
      expect(result.result_id).toBe('result-cli-review-001');
      expect(result.status).toBe('READY');
      expect(result.conclusion).toBe('CODEX_REVIEW_BRIDGE_READY');
      expect(result.next_actor).toBe('chatgpt-baijin-reviewer');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('writes a repair bridge result JSON file', () => {
    const dir = makeTempDir();
    const out = join(dir, 'result.json');

    try {
      const stdout = execFileSync(process.execPath, [
        'src/codex/bridge-cli.mjs',
        '--request',
        'fixtures/codex-bridge-request/valid-repair-bridge.json',
        '--out',
        out,
        '--result-id',
        'result-cli-repair-001',
        '--created-at',
        '2026-06-27T00:00:00.000Z'
      ], {
        encoding: 'utf8'
      });

      const summary = JSON.parse(stdout);
      const result = readJson(out);

      expect(summary.ok).toBe(true);
      expect(summary.result_id).toBe('result-cli-repair-001');
      expect(summary.conclusion).toBe('CODEX_REPAIR_BRIDGE_READY');

      expect(result.protocol).toBe('baijin-codex-bridge-result/1.0');
      expect(result.status).toBe('READY');
      expect(result.conclusion).toBe('CODEX_REPAIR_BRIDGE_READY');
      expect(result.next_actor).toBe('claude-code');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('fails when required args are missing', () => {
    expect(() => execFileSync(process.execPath, [
      'src/codex/bridge-cli.mjs'
    ], {
      encoding: 'utf8',
      stdio: 'pipe'
    })).toThrow();
  });
});
