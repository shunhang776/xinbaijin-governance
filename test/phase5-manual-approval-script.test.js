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

function makeEnablementValidator() {
  return makeAjv().compile(readJson('schemas/phase5-enablement.schema.json'));
}

describe('Phase5 manual approval script', () => {
  it('builds schema-valid manual gate enablement and readiness artifacts', () => {
    const dir = mkdtempSync(join(tmpdir(), 'baijin-phase5-manual-approval-'));
    const enablementPath = join(dir, 'phase5-enablement.json');
    const readinessPath = join(dir, 'phase5-readiness.json');

    try {
      const stdout = execFileSync(process.execPath, [
        'scripts/phase5/build-phase5-manual-approval.mjs',
        '--repository',
        'shunhang776/xinbaijin-mcp',
        '--mode',
        'manual_gate',
        '--production-enabled',
        'false',
        '--target-mode',
        'manual_gate',
        '--owner-approval',
        'true',
        '--gate-owner-approval',
        'true',
        '--rollback-owner-approval',
        'true',
        '--rollback-plan-defined',
        'true',
        '--audit-log-defined',
        'true',
        '--protected-branch-rules-defined',
        'true',
        '--manual-required-process-defined',
        'true',
        '--enablement-id',
        'phase5-manual-approval-script-001',
        '--out-enablement',
        enablementPath,
        '--out-readiness',
        readinessPath,
        '--created-at',
        '2026-06-27T00:00:00.000Z'
      ], {
        encoding: 'utf8'
      });

      const summary = JSON.parse(stdout);
      const enablement = readJson(enablementPath);
      const readiness = readJson(readinessPath);
      const validateEnablement = makeEnablementValidator();

      expect(summary.ok).toBe(true);
      expect(summary.mode).toBe('manual_gate');
      expect(summary.production_enabled).toBe(false);
      expect(summary.ready_for_manual_gate).toBe(true);
      expect(summary.ready_for_production).toBe(false);

      expect(enablement.protocol).toBe('baijin-phase5-enablement/1.0');
      expect(enablement.mode).toBe('manual_gate');
      expect(enablement.production_enabled).toBe(false);
      expect(validateEnablement(enablement), JSON.stringify(validateEnablement.errors)).toBe(true);

      expect(readiness.protocol).toBe('baijin-phase5-readiness/1.0');
      expect(readiness.status).toBe('manual_gate_ready');
      expect(readiness.ready_for_manual_gate).toBe(true);
      expect(readiness.ready_for_production).toBe(false);
      expect(readiness.blocker_count).toBe(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
