import { evaluatePhase5Readiness } from './readiness.mjs';

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

function readinessToGateEventType(readiness) {
  requireObject(readiness, 'readiness');

  if (readiness.ready_for_production === true) {
    return 'GATE_ALLOWED';
  }

  return 'GATE_DENIED';
}

export function buildPhase5EnablementGateL4Event(enablement, options = {}) {
  requireObject(enablement, 'enablement');

  const readiness = evaluatePhase5Readiness(enablement, {
    target_mode: options.target_mode || 'production_enforcer',
    checked_at: options.checked_at || options.created_at
  });

  const eventType = readinessToGateEventType(readiness);

  return {
    protocol: 'baijin-l4-event/1.0',
    event_id: options.event_id || 'event-phase5-enablement-' + enablement.enablement_id,
    task_id: requireNonEmptyString(options.task_id, 'task_id'),
    repository: requireNonEmptyString(enablement.repository, 'repository'),
    branch: requireNonEmptyString(enablement.branch, 'branch'),
    event_type: eventType,
    actor: options.actor || 'gate',
    repair_round: Number.isInteger(options.repair_round) ? options.repair_round : 0,
    payload: {
      run_id: options.run_id || null,
      enablement_id: requireNonEmptyString(enablement.enablement_id, 'enablement_id'),
      phase: 'phase5',
      mode: requireNonEmptyString(enablement.mode, 'mode'),
      target_mode: readiness.target_mode,
      production_enabled: enablement.production_enabled,
      readiness_status: readiness.status,
      ready_for_manual_gate: readiness.ready_for_manual_gate,
      ready_for_production: readiness.ready_for_production,
      blocker_count: readiness.blocker_count,
      blockers: readiness.blockers
    },
    created_at: options.created_at || readiness.checked_at || new Date().toISOString()
  };
}

export function phase5EnablementToGateL4EventObjects(enablement, options = {}) {
  return [
    buildPhase5EnablementGateL4Event(enablement, options)
  ];
}
