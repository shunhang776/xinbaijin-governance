import { codexBridgeResultToL4Events } from './codex-result-events.mjs';
import { l4EventObjectsToMachineEvents } from './l4-event-input.mjs';
import { runL4Events } from './l4-machine.mjs';
import { buildL4TaskStateSnapshot } from './task-state-snapshot.mjs';

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function makeEventId(prefix, index, eventType) {
  return prefix + '-' + String(index + 1).padStart(2, '0') + '-' + eventType.toLowerCase().replace(/_/g, '-');
}

export function codexBridgeResultToL4EventObjects(result, eventTemplate, options = {}) {
  if (!eventTemplate || typeof eventTemplate !== 'object') {
    throw new TypeError('eventTemplate must be an object');
  }

  const eventTypes = codexBridgeResultToL4Events(result);
  const createdAt = options.created_at || result.created_at || new Date().toISOString();
  const prefix = options.event_id_prefix || 'event-codex-' + (result.result_id || 'result');

  return eventTypes.map((eventType, index) => {
    const event = cloneJson(eventTemplate);
    event.event_id = makeEventId(prefix, index, eventType);
    event.event_type = eventType;
    event.created_at = createdAt;

    if (Object.prototype.hasOwnProperty.call(event, 'actor')) {
      event.actor = options.actor || 'codex';
    }

    if (Object.prototype.hasOwnProperty.call(event, 'repository') && result.repository) {
      event.repository = result.repository;
    }

    if (Object.prototype.hasOwnProperty.call(event, 'branch') && result.branch) {
      event.branch = result.branch;
    }

    if (Object.prototype.hasOwnProperty.call(event, 'commit') && result.candidate_commit) {
      event.commit = result.candidate_commit;
    }

    return event;
  });
}

export function runCodexResultL4Pipeline(input) {
  if (!input || typeof input !== 'object') {
    throw new TypeError('input must be an object');
  }

  const {
    baseTaskState,
    initialEvents = [],
    codexResults = [],
    tailEvents = [],
    eventTemplate,
    validateEvent,
    snapshotOptions = {}
  } = input;

  if (!Array.isArray(codexResults)) {
    throw new TypeError('codexResults must be an array');
  }

  const codexEvents = codexResults.flatMap((result, index) => {
    return codexBridgeResultToL4EventObjects(result, eventTemplate, {
      ...snapshotOptions,
      event_id_prefix: 'event-codex-' + String(index + 1).padStart(2, '0')
    });
  });

  const events = [
    ...initialEvents,
    ...codexEvents,
    ...tailEvents
  ];

  const machineEvents = l4EventObjectsToMachineEvents(events, validateEvent);
  const finalState = runL4Events(machineEvents);
  const taskState = buildL4TaskStateSnapshot(baseTaskState, finalState, snapshotOptions);

  return {
    events,
    machine_events: machineEvents,
    final_state: finalState,
    task_state: taskState
  };
}
