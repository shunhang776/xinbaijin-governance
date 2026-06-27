import { runL4Events } from './l4-machine.mjs';

export function codexBridgeResultToL4Events(result) {
  if (!result || typeof result !== 'object') {
    throw new TypeError('result must be an object');
  }

  if (result.codex_role !== 'bridge') {
    throw new TypeError('codex_role must be bridge');
  }

  if (result.conclusion === 'CODEX_REVIEW_BRIDGE_READY') {
    return ['REVIEW_REQUESTED'];
  }

  if (result.conclusion === 'CODEX_REPAIR_BRIDGE_READY') {
    return ['REPAIR_REQUESTED'];
  }

  if (result.conclusion === 'CODEX_L4_LOOP_READY') {
    return [];
  }

  if (result.conclusion === 'CODEX_BRIDGE_MANUAL_REQUIRED') {
    return ['TOOL_ERROR'];
  }

  if (typeof result.conclusion === 'string' && result.conclusion.endsWith('_BLOCKED')) {
    return ['TOOL_ERROR'];
  }

  return ['TOOL_ERROR'];
}

export function runL4EventsWithCodexResults(events, results, tailEvents = []) {
  const expandedEvents = [...events];

  for (const result of results) {
    expandedEvents.push(...codexBridgeResultToL4Events(result));
  }

  expandedEvents.push(...tailEvents);

  return runL4Events(expandedEvents);
}
