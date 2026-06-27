const PHASE5_ENABLEMENT_PROTOCOL = 'baijin-phase5-enablement/1.0';

const DEFAULT_SOURCE_DOCUMENTS = Object.freeze({
  chatgpt_review_acceptance: 'docs/CHATGPT-REVIEW-INTEGRATION-ACCEPTANCE.md',
  claude_repair_acceptance: 'docs/CLAUDE-REPAIR-LOOP-ACCEPTANCE.md',
  gate_acceptance: 'docs/GATE-PRODUCTION-ACCEPTANCE.md',
  gate_boundary: 'docs/GATE-PRODUCTION-ENABLEMENT-BOUNDARY.md',
  l4_production_acceptance: 'docs/L4-PRODUCTION-ACCEPTANCE.md'
});

const DEFAULT_REVIEWED_COMPONENTS = Object.freeze({
  chatgpt_review_integration: true,
  claude_repair_loop: true,
  gate_production_decision: true,
  l4_production_acceptance: true
});

const DEFAULT_DRAFT_BOUNDARIES = Object.freeze({
  no_auto_merge_without_gate: true,
  no_auto_push_to_dev: true,
  no_submit_review_without_chatgpt: true,
  read_only_draft_workflows: true,
  rollback_plan_defined: false,
  audit_log_defined: false,
  protected_branch_rules_defined: false,
  manual_required_process_defined: false
});

const DEFAULT_APPROVALS = Object.freeze({
  owner_approval: false,
  gate_owner_approval: false,
  rollback_owner_approval: false
});

function requireObject(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(name + ' must be an object');
  }

  return value;
}

function requireNonEmptyString(value, name) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(name + ' must be a non-empty string');
  }

  return value;
}

function normalizeRepository(repository) {
  const value = requireNonEmptyString(repository, 'repository');

  if (value !== 'shunhang776/xinbaijin' && value !== 'shunhang776/xinbaijin-mcp') {
    throw new Error('unsupported repository: ' + value);
  }

  return value;
}

function normalizeMode(mode, productionEnabled) {
  const value = mode || 'draft';

  if (!['draft', 'manual_gate', 'production_enforcer'].includes(value)) {
    throw new Error('unsupported Phase5 enablement mode: ' + value);
  }

  if (productionEnabled === true && value !== 'production_enforcer') {
    throw new Error('production_enabled requires production_enforcer mode');
  }

  if (productionEnabled !== true && value === 'production_enforcer') {
    throw new Error('production_enforcer mode requires production_enabled true');
  }

  return value;
}

function normalizeBooleanObject(defaults, overrides, name) {
  const result = {
    ...defaults,
    ...(overrides || {})
  };

  for (const key of Object.keys(defaults)) {
    if (typeof result[key] !== 'boolean') {
      throw new Error(name + '.' + key + ' must be a boolean');
    }
  }

  return result;
}

function allTrue(object) {
  return Object.values(object).every((value) => value === true);
}

function assertProductionEnablementReady(enablement) {
  if (enablement.production_enabled !== true) {
    return;
  }

  if (enablement.mode !== 'production_enforcer') {
    throw new Error('production enablement requires production_enforcer mode');
  }

  if (!allTrue(enablement.reviewed_components)) {
    throw new Error('production enablement requires all reviewed components to be true');
  }

  if (!allTrue(enablement.required_boundaries)) {
    throw new Error('production enablement requires all required boundaries to be true');
  }

  if (!allTrue(enablement.approvals)) {
    throw new Error('production enablement requires all approvals to be true');
  }
}

export function buildPhase5Enablement(options = {}) {
  requireObject(options, 'options');

  const productionEnabled = options.production_enabled === true;
  const mode = normalizeMode(options.mode || (productionEnabled ? 'production_enforcer' : 'draft'), productionEnabled);

  const enablement = {
    protocol: PHASE5_ENABLEMENT_PROTOCOL,
    enablement_id: options.enablement_id || 'phase5-enablement-' + mode,
    phase: 'phase5',
    repository: normalizeRepository(options.repository || 'shunhang776/xinbaijin-mcp'),
    branch: options.branch || 'dev',
    mode,
    production_enabled: productionEnabled,
    reviewed_components: normalizeBooleanObject(
      DEFAULT_REVIEWED_COMPONENTS,
      options.reviewed_components,
      'reviewed_components'
    ),
    required_boundaries: normalizeBooleanObject(
      DEFAULT_DRAFT_BOUNDARIES,
      options.required_boundaries,
      'required_boundaries'
    ),
    approvals: normalizeBooleanObject(
      DEFAULT_APPROVALS,
      options.approvals,
      'approvals'
    ),
    source_documents: {
      ...DEFAULT_SOURCE_DOCUMENTS,
      ...(options.source_documents || {})
    },
    created_at: options.created_at || new Date().toISOString()
  };

  if (enablement.branch !== 'dev') {
    throw new Error('Phase5 enablement branch must be dev');
  }

  for (const [key, value] of Object.entries(enablement.source_documents)) {
    requireNonEmptyString(value, 'source_documents.' + key);
  }

  assertProductionEnablementReady(enablement);

  return enablement;
}
