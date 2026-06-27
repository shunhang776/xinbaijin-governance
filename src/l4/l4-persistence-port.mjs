export const L4_PERSISTENCE_METHODS = Object.freeze([
  'loadTaskState',
  'saveTaskState',
  'appendRunResult',
  'appendEvent'
]);

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function requireNonEmptyString(value, name) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(name + ' must be a non-empty string');
  }

  return value;
}

function getTaskId(taskState) {
  if (!taskState || typeof taskState !== 'object') {
    throw new TypeError('taskState must be an object');
  }

  const taskId = taskState.task_id || taskState.taskId || taskState.id;
  return requireNonEmptyString(taskId, 'task_id');
}

export function assertL4PersistencePort(port) {
  if (!port || typeof port !== 'object') {
    throw new TypeError('persistence port must be an object');
  }

  for (const method of L4_PERSISTENCE_METHODS) {
    if (typeof port[method] !== 'function') {
      throw new TypeError('persistence port missing method: ' + method);
    }
  }

  return port;
}

export async function loadTaskState(port, taskId) {
  assertL4PersistencePort(port);
  requireNonEmptyString(taskId, 'task_id');
  return port.loadTaskState(taskId);
}

export async function saveTaskState(port, taskState) {
  assertL4PersistencePort(port);
  getTaskId(taskState);
  return port.saveTaskState(taskState);
}

export async function appendRunResult(port, runResult) {
  assertL4PersistencePort(port);

  if (!runResult || typeof runResult !== 'object') {
    throw new TypeError('runResult must be an object');
  }

  requireNonEmptyString(runResult.run_id, 'run_id');
  return port.appendRunResult(runResult);
}

export async function appendEvent(port, event) {
  assertL4PersistencePort(port);

  if (!event || typeof event !== 'object') {
    throw new TypeError('event must be an object');
  }

  requireNonEmptyString(event.event_id, 'event_id');
  return port.appendEvent(event);
}

export function createMemoryL4PersistencePort(initial = {}) {
  const taskStates = new Map();
  const runResults = [];
  const events = [];

  for (const taskState of initial.taskStates || []) {
    taskStates.set(getTaskId(taskState), cloneJson(taskState));
  }

  return {
    async loadTaskState(taskId) {
      requireNonEmptyString(taskId, 'task_id');
      const taskState = taskStates.get(taskId);
      return taskState ? cloneJson(taskState) : null;
    },

    async saveTaskState(taskState) {
      const taskId = getTaskId(taskState);
      const stored = cloneJson(taskState);
      taskStates.set(taskId, stored);
      return cloneJson(stored);
    },

    async appendRunResult(runResult) {
      requireNonEmptyString(runResult.run_id, 'run_id');
      const stored = cloneJson(runResult);
      runResults.push(stored);
      return cloneJson(stored);
    },

    async appendEvent(event) {
      requireNonEmptyString(event.event_id, 'event_id');
      const stored = cloneJson(event);
      events.push(stored);
      return cloneJson(stored);
    },

    async listRunResults() {
      return cloneJson(runResults);
    },

    async listEvents() {
      return cloneJson(events);
    }
  };
}
