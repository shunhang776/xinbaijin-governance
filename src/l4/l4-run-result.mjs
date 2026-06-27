import { L4_STATES } from './l4-machine.mjs';

const RUN_PROTOCOL = 'baijin-l4-run-result/1.0';
const L4_STATE_VALUES = new Set(Object.values(L4_STATES));

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

export function deriveL4RunStatus(finalState) {
  if (finalState === L4_STATES.ACCEPTED) {
    return 'COMPLETED';
  }

  if (finalState === L4_STATES.MANUAL_REQUIRED) {
    return 'MANUAL_REQUIRED';
  }

  return 'IN_PROGRESS';
}

export function buildL4RunResult(pipelineOutput, options = {}) {
  if (!pipelineOutput || typeof pipelineOutput !== 'object') {
    throw new TypeError('pipelineOutput must be an object');
  }

  if (!L4_STATE_VALUES.has(pipelineOutput.final_state)) {
    throw new Error('invalid final_state: ' + pipelineOutput.final_state);
  }

  if (!Array.isArray(pipelineOutput.events)) {
    throw new TypeError('pipelineOutput.events must be an array');
  }

  if (!Array.isArray(pipelineOutput.machine_events)) {
    throw new TypeError('pipelineOutput.machine_events must be an array');
  }

  if (!pipelineOutput.task_state || typeof pipelineOutput.task_state !== 'object') {
    throw new TypeError('pipelineOutput.task_state must be an object');
  }

  if (!options.run_id) {
    throw new Error('run_id is required');
  }

  if (!options.task_id) {
    throw new Error('task_id is required');
  }

  if (!options.repository) {
    throw new Error('repository is required');
  }

  if (!options.branch) {
    throw new Error('branch is required');
  }

  return {
    protocol: RUN_PROTOCOL,
    run_id: options.run_id,
    task_id: options.task_id,
    repository: options.repository,
    branch: options.branch,
    status: options.status || deriveL4RunStatus(pipelineOutput.final_state),
    final_state: pipelineOutput.final_state,
    events: cloneJson(pipelineOutput.events),
    machine_events: cloneJson(pipelineOutput.machine_events),
    task_state: cloneJson(pipelineOutput.task_state),
    errors: Array.isArray(options.errors) ? [...options.errors] : [],
    created_at: options.created_at || new Date().toISOString()
  };
}
