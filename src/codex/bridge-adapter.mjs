const RESULT_PROTOCOL = 'baijin-codex-bridge-result/1.0';

function isoNow(options) {
  return options.created_at || new Date().toISOString();
}

function makeBaseResult(request, options = {}) {
  return {
    protocol: RESULT_PROTOCOL,
    result_id: options.result_id || 'result-' + request.request_id,
    request_id: request.request_id,
    bridge_type: request.bridge_type,
    repository: request.repository,
    branch: request.branch,
    codex_role: 'bridge',
    status: 'BLOCKED',
    conclusion: 'CODEX_BRIDGE_MANUAL_REQUIRED',
    next_actor: null,
    candidate_commit: request.candidate_commit ?? null,
    review_commit: request.review_commit ?? null,
    repair_commit: request.repair_commit ?? null,
    verdict: request.verdict ?? null,
    gate_result: null,
    repair_round: request.repair_round ?? 0,
    events: [],
    produced_files: [],
    errors: [],
    created_at: isoNow(options)
  };
}

function block(result, conclusion, error, eventType = 'BRIDGE_BLOCKED') {
  result.status = conclusion === 'CODEX_BRIDGE_MANUAL_REQUIRED' ? 'MANUAL_REQUIRED' : 'BLOCKED';
  result.conclusion = conclusion;
  result.next_actor = conclusion === 'CODEX_BRIDGE_MANUAL_REQUIRED' ? 'human' : null;
  result.errors = error ? [error] : [];
  result.events = [
    {
      event_type: eventType,
      actor: 'codex'
    }
  ];
  return result;
}

function buildReviewBridgeResult(request, options) {
  const result = makeBaseResult(request, options);

  if (request.trigger_key !== 'REVIEW_CLAUDE_LATEST_HANDOFF' && request.trigger_key !== 'REVIEW_MCP_LATEST_HANDOFF') {
    return block(result, 'CODEX_REVIEW_BRIDGE_BLOCKED', 'missing or invalid review trigger_key');
  }

  result.status = 'READY';
  result.conclusion = 'CODEX_REVIEW_BRIDGE_READY';
  result.next_actor = request.expected_next_actor || 'chatgpt-baijin-reviewer';
  result.events = [
    {
      event_type: 'REVIEW_BRIDGE_READY',
      actor: 'codex'
    }
  ];
  result.produced_files = ['.codex/review-bridge-observation.json'];
  return result;
}

function buildRepairBridgeResult(request, options) {
  const result = makeBaseResult(request, options);
  const findings = Array.isArray(request.findings) ? request.findings : [];
  const repairRound = request.repair_round ?? 0;
  const maxRepairRound = request.max_repair_round ?? 2;

  if (request.verdict !== 'changes_requested') {
    return block(result, 'CODEX_REPAIR_BRIDGE_BLOCKED', 'repair bridge requires changes_requested verdict');
  }

  if (repairRound > maxRepairRound) {
    return block(result, 'CODEX_BRIDGE_MANUAL_REQUIRED', 'repair_round exceeded', 'REPAIR_ROUND_EXCEEDED');
  }

  if (findings.length === 0) {
    return block(result, 'CODEX_REPAIR_BRIDGE_BLOCKED', 'repair bridge requires at least one finding');
  }

  result.status = 'READY';
  result.conclusion = 'CODEX_REPAIR_BRIDGE_READY';
  result.next_actor = request.expected_next_actor || 'claude-code';
  result.events = [
    {
      event_type: 'REPAIR_BRIDGE_READY',
      actor: 'codex'
    }
  ];
  result.produced_files = ['.codex/repair-bridge-observation.json'];
  return result;
}

function buildL4LoopBridgeResult(request, options) {
  const result = makeBaseResult(request, options);

  result.status = 'READY';
  result.conclusion = 'CODEX_L4_LOOP_READY';
  result.next_actor = request.expected_next_actor || 'chatgpt-baijin-reviewer';
  result.events = [
    {
      event_type: 'L4_LOOP_BRIDGE_READY',
      actor: 'codex'
    }
  ];
  result.produced_files = ['.codex/l4-loop-smoke-observation.json'];
  return result;
}

export function buildCodexBridgeResult(request, options = {}) {
  if (!request || typeof request !== 'object') {
    throw new TypeError('request must be an object');
  }

  if (request.codex_role !== 'bridge') {
    throw new TypeError('codex_role must be bridge');
  }

  if (request.bridge_type === 'review_bridge') {
    return buildReviewBridgeResult(request, options);
  }

  if (request.bridge_type === 'repair_bridge') {
    return buildRepairBridgeResult(request, options);
  }

  if (request.bridge_type === 'l4_loop_bridge') {
    return buildL4LoopBridgeResult(request, options);
  }

  throw new TypeError('unsupported bridge_type: ' + request.bridge_type);
}
