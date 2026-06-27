const REVIEWED_COMPONENT_KEYS = Object.freeze([
  'chatgpt_review_integration',
  'claude_repair_loop',
  'gate_production_decision',
  'l4_production_acceptance'
]);

const REQUIRED_BOUNDARY_KEYS = Object.freeze([
  'no_auto_merge_without_gate',
  'no_auto_push_to_dev',
  'no_submit_review_without_chatgpt',
  'read_only_draft_workflows',
  'rollback_plan_defined',
  'audit_log_defined',
  'protected_branch_rules_defined',
  'manual_required_process_defined'
]);

const APPROVAL_KEYS = Object.freeze([
  'owner_approval',
  'gate_owner_approval',
  'rollback_owner_approval'
]);

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

function requireBooleanObject(value, keys, name) {
  requireObject(value, name);

  for (const key of keys) {
    if (typeof value[key] !== 'boolean') {
      throw new Error(name + '.' + key + ' must be a boolean');
    }
  }

  return value;
}

function makeBlocker(code, category, field, message) {
  return {
    code,
    category,
    field,
    message
  };
}

function collectFalseBooleanBlockers(value, keys, category, name) {
  requireBooleanObject(value, keys, name);

  return keys
    .filter((key) => value[key] !== true)
    .map((key) => {
      return makeBlocker(
        category + '_' + key + '_not_ready',
        category,
        name + '.' + key,
        name + '.' + key + ' must be true'
      );
    });
}

function validatePhase5Enablement(enablement) {
  requireObject(enablement, 'enablement');

  if (enablement.protocol !== 'baijin-phase5-enablement/1.0') {
    throw new Error('enablement protocol must be baijin-phase5-enablement/1.0');
  }

  if (enablement.phase !== 'phase5') {
    throw new Error('enablement phase must be phase5');
  }

  requireNonEmptyString(enablement.enablement_id, 'enablement_id');
  requireNonEmptyString(enablement.repository, 'repository');

  if (enablement.branch !== 'dev') {
    throw new Error('Phase5 readiness requires dev branch');
  }

  if (!['draft', 'manual_gate', 'production_enforcer'].includes(enablement.mode)) {
    throw new Error('unsupported Phase5 enablement mode: ' + enablement.mode);
  }

  if (typeof enablement.production_enabled !== 'boolean') {
    throw new Error('production_enabled must be a boolean');
  }

  requireBooleanObject(enablement.reviewed_components, REVIEWED_COMPONENT_KEYS, 'reviewed_components');
  requireBooleanObject(enablement.required_boundaries, REQUIRED_BOUNDARY_KEYS, 'required_boundaries');
  requireBooleanObject(enablement.approvals, APPROVAL_KEYS, 'approvals');

  return enablement;
}

function allTrue(value, keys) {
  return keys.every((key) => value[key] === true);
}

export function evaluatePhase5Readiness(enablement, options = {}) {
  validatePhase5Enablement(enablement);

  const targetMode = options.target_mode || 'production_enforcer';

  if (!['manual_gate', 'production_enforcer'].includes(targetMode)) {
    throw new Error('unsupported Phase5 readiness target_mode: ' + targetMode);
  }

  const blockers = [
    ...collectFalseBooleanBlockers(
      enablement.reviewed_components,
      REVIEWED_COMPONENT_KEYS,
      'component',
      'reviewed_components'
    ),
    ...collectFalseBooleanBlockers(
      enablement.required_boundaries,
      REQUIRED_BOUNDARY_KEYS,
      'boundary',
      'required_boundaries'
    ),
    ...collectFalseBooleanBlockers(
      enablement.approvals,
      APPROVAL_KEYS,
      'approval',
      'approvals'
    )
  ];

  const componentsReady = allTrue(enablement.reviewed_components, REVIEWED_COMPONENT_KEYS);
  const boundariesReady = allTrue(enablement.required_boundaries, REQUIRED_BOUNDARY_KEYS);
  const approvalsReady = allTrue(enablement.approvals, APPROVAL_KEYS);

  const manualGateReady =
    componentsReady &&
    boundariesReady &&
    approvalsReady &&
    (enablement.mode === 'manual_gate' || enablement.mode === 'production_enforcer');

  if (targetMode === 'production_enforcer') {
    if (enablement.production_enabled !== true) {
      blockers.push(makeBlocker(
        'production_not_enabled',
        'enablement',
        'production_enabled',
        'production_enabled must be true for production_enforcer readiness'
      ));
    }

    if (enablement.mode !== 'production_enforcer') {
      blockers.push(makeBlocker(
        'mode_not_production_enforcer',
        'enablement',
        'mode',
        'mode must be production_enforcer for production readiness'
      ));
    }
  }

  const productionReady =
    targetMode === 'production_enforcer' &&
    enablement.production_enabled === true &&
    enablement.mode === 'production_enforcer' &&
    componentsReady &&
    boundariesReady &&
    approvalsReady &&
    blockers.length === 0;

  let status = 'not_ready';

  if (productionReady) {
    status = 'production_ready';
  } else if (manualGateReady && targetMode === 'manual_gate') {
    status = 'manual_gate_ready';
  }

  return {
    protocol: 'baijin-phase5-readiness/1.0',
    enablement_id: enablement.enablement_id,
    phase: 'phase5',
    repository: enablement.repository,
    branch: enablement.branch,
    mode: enablement.mode,
    target_mode: targetMode,
    production_enabled: enablement.production_enabled,
    status,
    ready_for_manual_gate: manualGateReady,
    ready_for_production: productionReady,
    blocker_count: blockers.length,
    blockers,
    checked_at: options.checked_at || new Date().toISOString()
  };
}

export function assertPhase5ReadyForProduction(enablement, options = {}) {
  const readiness = evaluatePhase5Readiness(enablement, {
    ...options,
    target_mode: 'production_enforcer'
  });

  if (readiness.ready_for_production !== true) {
    const codes = readiness.blockers.map((blocker) => blocker.code).join(', ');
    throw new Error('Phase5 production readiness blocked: ' + codes);
  }

  return readiness;
}
