import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildPhase5Enablement } from '../src/phase5/enablement.mjs';
import {
  assertPhase5ReadyForProduction,
  evaluatePhase5Readiness
} from '../src/phase5/readiness.mjs';

function readJson(path) {
  const raw = readFileSync(resolve(path), 'utf8').replace(/^\uFEFF/, '');
  return JSON.parse(raw);
}

function blockerCodes(readiness) {
  return readiness.blockers.map((blocker) => blocker.code);
}

describe('Phase5 readiness checker', () => {
  it('marks disabled draft enablement as not ready for production', () => {
    const enablement = readJson('fixtures/phase5-enablement/valid-draft-disabled.json');

    const readiness = evaluatePhase5Readiness(enablement, {
      target_mode: 'production_enforcer',
      checked_at: '2026-06-27T00:00:00.000Z'
    });

    expect(readiness.protocol).toBe('baijin-phase5-readiness/1.0');
    expect(readiness.status).toBe('not_ready');
    expect(readiness.ready_for_manual_gate).toBe(false);
    expect(readiness.ready_for_production).toBe(false);
    expect(blockerCodes(readiness)).toContain('production_not_enabled');
    expect(blockerCodes(readiness)).toContain('mode_not_production_enforcer');
    expect(blockerCodes(readiness)).toContain('boundary_rollback_plan_defined_not_ready');
    expect(blockerCodes(readiness)).toContain('approval_owner_approval_not_ready');
  });

  it('marks disabled manual gate enablement as manual gate ready but not production ready', () => {
    const enablement = readJson('fixtures/phase5-enablement/valid-manual-gate-disabled.json');

    const readiness = evaluatePhase5Readiness(enablement, {
      target_mode: 'manual_gate',
      checked_at: '2026-06-27T00:00:00.000Z'
    });

    expect(readiness.status).toBe('manual_gate_ready');
    expect(readiness.ready_for_manual_gate).toBe(true);
    expect(readiness.ready_for_production).toBe(false);
    expect(readiness.blocker_count).toBe(0);
  });

  it('marks production enforcer enablement as production ready only when everything is true', () => {
    const enablement = buildPhase5Enablement({
      enablement_id: 'phase5-readiness-production-001',
      repository: 'shunhang776/xinbaijin-mcp',
      mode: 'production_enforcer',
      production_enabled: true,
      required_boundaries: {
        rollback_plan_defined: true,
        audit_log_defined: true,
        protected_branch_rules_defined: true,
        manual_required_process_defined: true
      },
      approvals: {
        owner_approval: true,
        gate_owner_approval: true,
        rollback_owner_approval: true
      },
      created_at: '2026-06-27T00:00:00.000Z'
    });

    const readiness = evaluatePhase5Readiness(enablement, {
      target_mode: 'production_enforcer',
      checked_at: '2026-06-27T00:00:00.000Z'
    });

    expect(readiness.status).toBe('production_ready');
    expect(readiness.ready_for_manual_gate).toBe(true);
    expect(readiness.ready_for_production).toBe(true);
    expect(readiness.blocker_count).toBe(0);
  });

  it('asserts production readiness for valid production enforcer enablement', () => {
    const enablement = buildPhase5Enablement({
      enablement_id: 'phase5-readiness-assert-production-001',
      repository: 'shunhang776/xinbaijin-mcp',
      mode: 'production_enforcer',
      production_enabled: true,
      required_boundaries: {
        rollback_plan_defined: true,
        audit_log_defined: true,
        protected_branch_rules_defined: true,
        manual_required_process_defined: true
      },
      approvals: {
        owner_approval: true,
        gate_owner_approval: true,
        rollback_owner_approval: true
      },
      created_at: '2026-06-27T00:00:00.000Z'
    });

    const readiness = assertPhase5ReadyForProduction(enablement, {
      checked_at: '2026-06-27T00:00:00.000Z'
    });

    expect(readiness.ready_for_production).toBe(true);
  });

  it('throws when asserting production readiness for draft enablement', () => {
    const enablement = readJson('fixtures/phase5-enablement/valid-draft-disabled.json');

    expect(() => assertPhase5ReadyForProduction(enablement)).toThrow('production readiness blocked');
  });

  it('rejects invalid protocol, target mode, and branch', () => {
    const enablement = readJson('fixtures/phase5-enablement/valid-manual-gate-disabled.json');

    expect(() => evaluatePhase5Readiness({
      ...enablement,
      protocol: 'invalid'
    })).toThrow('protocol');

    expect(() => evaluatePhase5Readiness(enablement, {
      target_mode: 'unknown'
    })).toThrow('target_mode');

    expect(() => evaluatePhase5Readiness({
      ...enablement,
      branch: 'main'
    })).toThrow('dev');
  });
});
