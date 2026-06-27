import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { buildPhase5Enablement } from '../src/phase5/enablement.mjs';

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
  return makeAjv().compile(readJson('schemas/phase5-enablement.schema.json'));
}

function allTrue(object) {
  return Object.values(object).every((value) => value === true);
}

describe('Phase5 enablement builder', () => {
  it('builds a schema-valid disabled draft enablement', () => {
    const validate = makeValidator();

    const enablement = buildPhase5Enablement({
      enablement_id: 'phase5-enablement-builder-draft-001',
      repository: 'shunhang776/xinbaijin-mcp',
      mode: 'draft',
      production_enabled: false,
      created_at: '2026-06-27T00:00:00.000Z'
    });

    expect(enablement.protocol).toBe('baijin-phase5-enablement/1.0');
    expect(enablement.phase).toBe('phase5');
    expect(enablement.repository).toBe('shunhang776/xinbaijin-mcp');
    expect(enablement.branch).toBe('dev');
    expect(enablement.mode).toBe('draft');
    expect(enablement.production_enabled).toBe(false);
    expect(enablement.reviewed_components.chatgpt_review_integration).toBe(true);
    expect(enablement.required_boundaries.rollback_plan_defined).toBe(false);
    expect(enablement.approvals.owner_approval).toBe(false);
    expect(validate(enablement), JSON.stringify(validate.errors)).toBe(true);
  });

  it('builds a schema-valid disabled manual gate enablement', () => {
    const validate = makeValidator();

    const enablement = buildPhase5Enablement({
      enablement_id: 'phase5-enablement-builder-manual-gate-001',
      repository: 'shunhang776/xinbaijin-mcp',
      mode: 'manual_gate',
      production_enabled: false,
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

    expect(enablement.mode).toBe('manual_gate');
    expect(enablement.production_enabled).toBe(false);
    expect(allTrue(enablement.reviewed_components)).toBe(true);
    expect(allTrue(enablement.required_boundaries)).toBe(true);
    expect(allTrue(enablement.approvals)).toBe(true);
    expect(validate(enablement), JSON.stringify(validate.errors)).toBe(true);
  });

  it('builds a schema-valid production enforcer enablement only when everything is approved', () => {
    const validate = makeValidator();

    const enablement = buildPhase5Enablement({
      enablement_id: 'phase5-enablement-builder-production-001',
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

    expect(enablement.mode).toBe('production_enforcer');
    expect(enablement.production_enabled).toBe(true);
    expect(allTrue(enablement.reviewed_components)).toBe(true);
    expect(allTrue(enablement.required_boundaries)).toBe(true);
    expect(allTrue(enablement.approvals)).toBe(true);
    expect(validate(enablement), JSON.stringify(validate.errors)).toBe(true);
  });

  it('rejects production enabled without production_enforcer mode', () => {
    expect(() => buildPhase5Enablement({
      repository: 'shunhang776/xinbaijin-mcp',
      mode: 'manual_gate',
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
      }
    })).toThrow('production_enforcer');
  });

  it('rejects production enforcer without all approvals and boundaries', () => {
    expect(() => buildPhase5Enablement({
      repository: 'shunhang776/xinbaijin-mcp',
      mode: 'production_enforcer',
      production_enabled: true,
      approvals: {
        owner_approval: true,
        gate_owner_approval: false,
        rollback_owner_approval: true
      },
      required_boundaries: {
        rollback_plan_defined: true,
        audit_log_defined: true,
        protected_branch_rules_defined: true,
        manual_required_process_defined: true
      }
    })).toThrow('approvals');

    expect(() => buildPhase5Enablement({
      repository: 'shunhang776/xinbaijin-mcp',
      mode: 'production_enforcer',
      production_enabled: true,
      approvals: {
        owner_approval: true,
        gate_owner_approval: true,
        rollback_owner_approval: true
      }
    })).toThrow('required boundaries');
  });

  it('rejects unsupported repository and non-dev branch', () => {
    expect(() => buildPhase5Enablement({
      repository: 'shunhang776/unknown'
    })).toThrow('unsupported repository');

    expect(() => buildPhase5Enablement({
      repository: 'shunhang776/xinbaijin-mcp',
      branch: 'main'
    })).toThrow('dev');
  });
});
