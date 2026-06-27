import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
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

function makeValidator() {
  return makeAjv().compile(readJson('schemas/phase5-dry-run-acceptance.schema.json'));
}

function buildDryRunAcceptance() {
  const enablement = readJson('fixtures/phase5-enablement/valid-manual-gate-disabled.json');
  const rollbackPlan = readJson('fixtures/phase5-rollback-plan/valid-ready.json');
  const auditLog = readJson('fixtures/phase5-audit-log/valid-draft.json');

  return {
    protocol: 'baijin-phase5-dry-run-acceptance/1.0',
    acceptance_id: 'phase5-dry-run-acceptance-001',
    phase: 'phase5',
    repository: enablement.repository,
    branch: enablement.branch,
    status: 'accepted_dry_run',
    dry_run_only: true,
    production_enforcer_enabled: false,
    enablement: {
      enablement_id: enablement.enablement_id,
      mode: enablement.mode,
      production_enabled: enablement.production_enabled
    },
    readiness: {
      status: 'manual_gate_ready',
      ready_for_manual_gate: true,
      ready_for_production: false,
      blocker_count: 0
    },
    rollback_plan: {
      rollback_plan_id: rollbackPlan.rollback_plan_id,
      rollback_ready: rollbackPlan.rollback_ready,
      mode: rollbackPlan.mode
    },
    audit_log: {
      audit_id: auditLog.audit_id,
      event_type: auditLog.event_type,
      manual_confirmation: auditLog.manual_confirmation
    },
    required_checks: {
      enablement_artifact_valid: true,
      readiness_artifact_valid: true,
      rollback_plan_valid: true,
      audit_log_valid: true,
      production_enforcer_not_enabled: true
    },
    created_at: '2026-06-27T00:00:00.000Z'
  };
}

describe('Phase5 dry-run acceptance', () => {
  it('validates Phase5 dry-run acceptance without enabling production enforcer', () => {
    const validate = makeValidator();
    const acceptance = buildDryRunAcceptance();

    expect(acceptance.status).toBe('accepted_dry_run');
    expect(acceptance.dry_run_only).toBe(true);
    expect(acceptance.production_enforcer_enabled).toBe(false);
    expect(acceptance.enablement.mode).toBe('manual_gate');
    expect(acceptance.enablement.production_enabled).toBe(false);
    expect(acceptance.readiness.ready_for_manual_gate).toBe(true);
    expect(acceptance.readiness.ready_for_production).toBe(false);
    expect(acceptance.rollback_plan.rollback_ready).toBe(true);
    expect(acceptance.required_checks.production_enforcer_not_enabled).toBe(true);
    expect(validate(acceptance), JSON.stringify(validate.errors)).toBe(true);
  });

  it('rejects acceptance if production enforcer is enabled', () => {
    const validate = makeValidator();
    const acceptance = {
      ...buildDryRunAcceptance(),
      production_enforcer_enabled: true
    };

    expect(validate(acceptance)).toBe(false);
  });

  it('rejects acceptance if rollback plan is not ready', () => {
    const validate = makeValidator();
    const acceptance = {
      ...buildDryRunAcceptance(),
      rollback_plan: {
        rollback_plan_id: 'phase5-rollback-plan-draft-001',
        rollback_ready: false,
        mode: 'draft'
      }
    };

    expect(validate(acceptance)).toBe(false);
  });
});
