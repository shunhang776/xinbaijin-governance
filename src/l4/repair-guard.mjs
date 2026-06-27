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

function requireIntegerAtLeast(value, min, name) {
  if (!Number.isInteger(value) || value < min) {
    throw new Error(name + ' must be an integer >= ' + min);
  }

  return value;
}

function findingKey(finding) {
  requireObject(finding, 'finding');

  return [
    requireNonEmptyString(finding.file, 'finding.file'),
    requireIntegerAtLeast(finding.line, 1, 'finding.line'),
    requireNonEmptyString(finding.title, 'finding.title')
  ].join(':');
}

function normalizeFindings(findings, name) {
  if (!Array.isArray(findings)) {
    throw new TypeError(name + ' must be an array');
  }

  return findings.map((finding) => {
    requireObject(finding, name + ' item');

    return {
      severity: requireNonEmptyString(finding.severity, 'finding.severity'),
      file: requireNonEmptyString(finding.file, 'finding.file'),
      line: requireIntegerAtLeast(finding.line, 1, 'finding.line'),
      title: requireNonEmptyString(finding.title, 'finding.title'),
      description: typeof finding.description === 'string' ? finding.description : '',
      recommendation: typeof finding.recommendation === 'string' ? finding.recommendation : ''
    };
  });
}

function hasRepeatedFinding(currentFindings, previousFindings) {
  const previousKeys = new Set(previousFindings.map((finding) => findingKey(finding)));

  return currentFindings.some((finding) => previousKeys.has(findingKey(finding)));
}

export function evaluateClaudeRepairHandoffGuard(handoff, options = {}) {
  requireObject(handoff, 'handoff');

  if (handoff.protocol !== 'baijin-claude-repair-handoff/1.0') {
    throw new Error('handoff protocol must be baijin-claude-repair-handoff/1.0');
  }

  if (handoff.verdict !== 'changes_requested') {
    throw new Error('repair guard requires changes_requested handoff');
  }

  const repairRound = requireIntegerAtLeast(handoff.repair_round, 0, 'repair_round');
  const maxRepairRound = requireIntegerAtLeast(handoff.max_repair_round, 1, 'max_repair_round');
  const findings = normalizeFindings(handoff.findings, 'handoff.findings');
  const previousFindings = normalizeFindings(options.previous_findings || [], 'previous_findings');

  if (repairRound >= maxRepairRound) {
    return {
      guard_status: 'repair_round_exceeded',
      event_type: 'REPAIR_ROUND_EXCEEDED',
      reason: 'repair_round has reached max_repair_round',
      handoff_id: handoff.handoff_id,
      repair_round: repairRound,
      max_repair_round: maxRepairRound,
      finding_count: findings.length
    };
  }

  if (previousFindings.length > 0 && hasRepeatedFinding(findings, previousFindings)) {
    return {
      guard_status: 'repeated_finding_detected',
      event_type: 'REPEATED_FINDING_DETECTED',
      reason: 'same finding appeared in previous repair round',
      handoff_id: handoff.handoff_id,
      repair_round: repairRound,
      max_repair_round: maxRepairRound,
      finding_count: findings.length
    };
  }

  return {
    guard_status: 'fresh',
    event_type: null,
    reason: 'repair handoff is eligible for repair request',
    handoff_id: handoff.handoff_id,
    repair_round: repairRound,
    max_repair_round: maxRepairRound,
    finding_count: findings.length
  };
}

export function repairGuardToL4EventObjects(guard, eventTemplate, options = {}) {
  requireObject(guard, 'guard');

  if (guard.event_type === null) {
    return [];
  }

  requireObject(eventTemplate, 'eventTemplate');

  const event = JSON.parse(JSON.stringify(eventTemplate));
  event.event_id = options.event_id || 'event-repair-guard-' + guard.guard_status;
  event.event_type = guard.event_type;
  event.actor = options.actor || 'system';
  event.repair_round = guard.repair_round;
  event.payload = {
    ...(event.payload || {}),
    guard_status: guard.guard_status,
    reason: guard.reason,
    handoff_id: guard.handoff_id,
    repair_round: guard.repair_round,
    max_repair_round: guard.max_repair_round,
    finding_count: guard.finding_count
  };
  event.created_at = options.created_at || event.created_at || new Date().toISOString();

  return [event];
}
