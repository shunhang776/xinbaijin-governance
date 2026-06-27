import { runL4Events } from './l4-machine.mjs';

export function getL4EventType(event) {
  if (!event || typeof event !== 'object') {
    throw new TypeError('event must be an object');
  }

  if (typeof event.event_type !== 'string' || event.event_type.length === 0) {
    throw new Error('event.event_type must be a non-empty string');
  }

  return event.event_type;
}

export function assertValidL4Event(event, validateEvent) {
  if (typeof validateEvent !== 'function') {
    throw new TypeError('validateEvent must be a function');
  }

  const ok = validateEvent(event);

  if (!ok) {
    const errors = JSON.stringify(validateEvent.errors || []);
    throw new Error('invalid L4 event: ' + errors);
  }

  return event;
}

export function l4EventObjectsToMachineEvents(events, validateEvent) {
  if (!Array.isArray(events)) {
    throw new TypeError('events must be an array');
  }

  return events.map((event) => {
    assertValidL4Event(event, validateEvent);
    return getL4EventType(event);
  });
}

export function runValidatedL4EventObjects(events, validateEvent) {
  const machineEvents = l4EventObjectsToMachineEvents(events, validateEvent);
  return runL4Events(machineEvents);
}
