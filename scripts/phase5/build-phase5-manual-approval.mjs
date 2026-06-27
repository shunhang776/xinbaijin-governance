#!/usr/bin/env node

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildPhase5Enablement } from '../../src/phase5/enablement.mjs';
import { evaluatePhase5Readiness } from '../../src/phase5/readiness.mjs';

function parseBoolean(value, name) {
  if (value === true || value === 'true') {
    return true;
  }

  if (value === false || value === 'false') {
    return false;
  }

  throw new Error(name + ' must be true or false');
}

function writeJson(path, value) {
  const fullPath = resolve(path);
  mkdirSync(dirname(fullPath), { recursive: true });
  writeFileSync(fullPath, JSON.stringify(value, null, 2) + '\n', 'utf8');
}

function parseArgs(argv) {
  const args = {
    repository: 'shunhang776/xinbaijin-mcp',
    mode: 'manual_gate',
    production_enabled: false,
    target_mode: 'manual_gate',
    out_enablement: 'artifacts/phase5/phase5-enablement.json',
    out_readiness: 'artifacts/phase5/phase5-readiness.json',
    enablement_id: 'phase5-enablement-manual-approval-draft-001',
    created_at: '2026-06-27T00:00:00.000Z',
    owner_approval: false,
    gate_owner_approval: false,
    rollback_owner_approval: false,
    rollback_plan_defined: false,
    audit_log_defined: false,
    protected_branch_rules_defined: false,
    manual_required_process_defined: false
  };

  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];

    if (key === '--repository') {
      args.repository = argv[++i];
      continue;
    }

    if (key === '--mode') {
      args.mode = argv[++i];
      continue;
    }

    if (key === '--production-enabled') {
      args.production_enabled = parseBoolean(argv[++i], 'production_enabled');
      continue;
    }

    if (key === '--target-mode') {
      args.target_mode = argv[++i];
      continue;
    }

    if (key === '--out-enablement') {
      args.out_enablement = argv[++i];
      continue;
    }

    if (key === '--out-readiness') {
      args.out_readiness = argv[++i];
      continue;
    }

    if (key === '--enablement-id') {
      args.enablement_id = argv[++i];
      continue;
    }

    if (key === '--created-at') {
      args.created_at = argv[++i];
      continue;
    }

    if (key === '--owner-approval') {
      args.owner_approval = parseBoolean(argv[++i], 'owner_approval');
      continue;
    }

    if (key === '--gate-owner-approval') {
      args.gate_owner_approval = parseBoolean(argv[++i], 'gate_owner_approval');
      continue;
    }

    if (key === '--rollback-owner-approval') {
      args.rollback_owner_approval = parseBoolean(argv[++i], 'rollback_owner_approval');
      continue;
    }

    if (key === '--rollback-plan-defined') {
      args.rollback_plan_defined = parseBoolean(argv[++i], 'rollback_plan_defined');
      continue;
    }

    if (key === '--audit-log-defined') {
      args.audit_log_defined = parseBoolean(argv[++i], 'audit_log_defined');
      continue;
    }

    if (key === '--protected-branch-rules-defined') {
      args.protected_branch_rules_defined = parseBoolean(argv[++i], 'protected_branch_rules_defined');
      continue;
    }

    if (key === '--manual-required-process-defined') {
      args.manual_required_process_defined = parseBoolean(argv[++i], 'manual_required_process_defined');
      continue;
    }

    throw new Error('unknown argument: ' + key);
  }

  return args;
}

export function buildPhase5ManualApprovalDraft(options = {}) {
  const enablement = buildPhase5Enablement({
    enablement_id: options.enablement_id || 'phase5-enablement-manual-approval-draft-001',
    repository: options.repository || 'shunhang776/xinbaijin-mcp',
    mode: options.mode || 'manual_gate',
    production_enabled: options.production_enabled === true,
    required_boundaries: {
      rollback_plan_defined: options.rollback_plan_defined === true,
      audit_log_defined: options.audit_log_defined === true,
      protected_branch_rules_defined: options.protected_branch_rules_defined === true,
      manual_required_process_defined: options.manual_required_process_defined === true
    },
    approvals: {
      owner_approval: options.owner_approval === true,
      gate_owner_approval: options.gate_owner_approval === true,
      rollback_owner_approval: options.rollback_owner_approval === true
    },
    created_at: options.created_at || '2026-06-27T00:00:00.000Z'
  });

  const readiness = evaluatePhase5Readiness(enablement, {
    target_mode: options.target_mode || 'manual_gate',
    checked_at: options.created_at || '2026-06-27T00:00:00.000Z'
  });

  return {
    enablement,
    readiness
  };
}

export function runBuildPhase5ManualApprovalCli(argv) {
  const args = parseArgs(argv);
  const output = buildPhase5ManualApprovalDraft(args);

  writeJson(args.out_enablement, output.enablement);
  writeJson(args.out_readiness, output.readiness);

  return output;
}

function isCliEntryPoint() {
  if (!process.argv[1]) {
    return false;
  }

  return resolve(process.argv[1]) === fileURLToPath(import.meta.url);
}

if (isCliEntryPoint()) {
  try {
    const output = runBuildPhase5ManualApprovalCli(process.argv.slice(2));

    process.stdout.write(JSON.stringify({
      ok: true,
      enablement_id: output.enablement.enablement_id,
      mode: output.enablement.mode,
      production_enabled: output.enablement.production_enabled,
      readiness_status: output.readiness.status,
      ready_for_manual_gate: output.readiness.ready_for_manual_gate,
      ready_for_production: output.readiness.ready_for_production,
      blocker_count: output.readiness.blocker_count
    }) + '\n');
  } catch (error) {
    process.stderr.write(String(error && error.stack ? error.stack : error) + '\n');
    process.exitCode = 1;
  }
}
