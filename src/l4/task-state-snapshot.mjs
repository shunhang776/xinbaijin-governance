import { L4_STATES, runL4Events } from './l4-machine.mjs';

const STATE_VALUES = new Set(Object.values(L4_STATES));
const STATE_FIELD_CANDIDATES = ['state', 'current_state', 'l4_state'];

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

export function findL4StateField(taskState) {
  if (!taskState || typeof taskState !== 'object') {
    throw new TypeError('taskState must be an object');
  }

  for (const key of STATE_FIELD_CANDIDATES) {
    if (Object.prototype.hasOwnProperty.call(taskState, key)) {
      return key;
    }
  }

  const matchingKeys = Object.keys(taskState).filter((key) => {
    return typeof taskState[key] === 'string' && STATE_VALUES.has(taskState[key]);
  });

  if (matchingKeys.length === 1) {
    return matchingKeys[0];
  }

  throw new Error('unable to determine L4 state field');
}

export function buildL4TaskStateSnapshot(baseTaskState, nextState, options = {}) {
  if (!STATE_VALUES.has(nextState)) {
    throw new Error('invalid L4 state: ' + nextState);
  }

  const snapshot = cloneJson(baseTaskState);
  const stateField = findL4StateField(snapshot);
  snapshot[stateField] = nextState;

  if (Object.prototype.hasOwnProperty.call(snapshot, 'updated_at') && options.updated_at) {
    snapshot.updated_at = options.updated_at;
  }

  if (Object.prototype.hasOwnProperty.call(snapshot, 'last_updated_at') && options.updated_at) {
    snapshot.last_updated_at = options.updated_at;
  }

  if (Object.prototype.hasOwnProperty.call(snapshot, 'repair_round') && Number.isInteger(options.repair_round)) {
    snapshot.repair_round = options.repair_round;
  }

  return snapshot;
}

export function runL4EventsToTaskState(baseTaskState, events, options = {}) {
  const nextState = runL4Events(events);
  return buildL4TaskStateSnapshot(baseTaskState, nextState, options);
}
