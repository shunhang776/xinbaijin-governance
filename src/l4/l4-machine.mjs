import { createMachine, createActor } from 'xstate';

export const L4_STATES = Object.freeze({
  WAIT_CODE: 'WAIT_CODE',
  CODE_SUBMITTED: 'CODE_SUBMITTED',
  CHECKS_RUNNING: 'CHECKS_RUNNING',
  WAIT_REVIEW: 'WAIT_REVIEW',
  REVIEW_DENIED: 'REVIEW_DENIED',
  REPAIR_REQUESTED: 'REPAIR_REQUESTED',
  REPAIR_SUBMITTED: 'REPAIR_SUBMITTED',
  REVIEW_APPROVED: 'REVIEW_APPROVED',
  ACCEPTED: 'ACCEPTED',
  MANUAL_REQUIRED: 'MANUAL_REQUIRED'
});

const ROOT_ID = 'baijin-l4-loop';

function nodeId(state) {
  return ROOT_ID + '.' + state;
}

function target(state) {
  return '#' + ROOT_ID + '.' + state;
}

export function createL4Machine() {
  return createMachine({
    id: ROOT_ID,
    initial: L4_STATES.WAIT_CODE,
    on: {
      TOOL_ERROR: { target: target(L4_STATES.MANUAL_REQUIRED) },
      STALE_REVIEW_DETECTED: { target: target(L4_STATES.MANUAL_REQUIRED) },
      BRANCH_HEAD_CHANGED: { target: target(L4_STATES.MANUAL_REQUIRED) }
    },
    states: {
      [L4_STATES.WAIT_CODE]: {
        id: nodeId(L4_STATES.WAIT_CODE),
        on: {
          CODE_DETECTED: { target: target(L4_STATES.CODE_SUBMITTED) }
        }
      },

      [L4_STATES.CODE_SUBMITTED]: {
        id: nodeId(L4_STATES.CODE_SUBMITTED),
        on: {
          CHECKS_STARTED: { target: target(L4_STATES.CHECKS_RUNNING) },
          TOOL_ERROR: { target: target(L4_STATES.MANUAL_REQUIRED) }
        }
      },

      [L4_STATES.CHECKS_RUNNING]: {
        id: nodeId(L4_STATES.CHECKS_RUNNING),
        on: {
          CHECKS_PASSED: { target: target(L4_STATES.WAIT_REVIEW) },
          CHECKS_FAILED: { target: target(L4_STATES.MANUAL_REQUIRED) },
          TOOL_ERROR: { target: target(L4_STATES.MANUAL_REQUIRED) }
        }
      },

      [L4_STATES.WAIT_REVIEW]: {
        id: nodeId(L4_STATES.WAIT_REVIEW),
        on: {
          REVIEW_REQUESTED: { target: target(L4_STATES.WAIT_REVIEW) },
          REVIEW_DENIED: { target: target(L4_STATES.REVIEW_DENIED) },
          REVIEW_APPROVED: { target: target(L4_STATES.REVIEW_APPROVED) },
          REVIEW_BLOCKED: { target: target(L4_STATES.MANUAL_REQUIRED) },
          STALE_REVIEW_DETECTED: { target: target(L4_STATES.MANUAL_REQUIRED) },
          TOOL_ERROR: { target: target(L4_STATES.MANUAL_REQUIRED) }
        }
      },

      [L4_STATES.REVIEW_DENIED]: {
        id: nodeId(L4_STATES.REVIEW_DENIED),
        on: {
          REPAIR_REQUESTED: { target: target(L4_STATES.REPAIR_REQUESTED) },
          REPAIR_ROUND_EXCEEDED: { target: target(L4_STATES.MANUAL_REQUIRED) },
          REPEATED_FINDING_DETECTED: { target: target(L4_STATES.MANUAL_REQUIRED) },
          TOOL_ERROR: { target: target(L4_STATES.MANUAL_REQUIRED) },
          STALE_REVIEW_DETECTED: { target: target(L4_STATES.MANUAL_REQUIRED) },
          BRANCH_HEAD_CHANGED: { target: target(L4_STATES.MANUAL_REQUIRED) }
        }
      },

      [L4_STATES.REPAIR_REQUESTED]: {
        id: nodeId(L4_STATES.REPAIR_REQUESTED),
        on: {
          REPAIR_SUBMITTED: { target: target(L4_STATES.REPAIR_SUBMITTED) },
          BRANCH_HEAD_CHANGED: { target: target(L4_STATES.MANUAL_REQUIRED) },
          TOOL_ERROR: { target: target(L4_STATES.MANUAL_REQUIRED) }
        }
      },

      [L4_STATES.REPAIR_SUBMITTED]: {
        id: nodeId(L4_STATES.REPAIR_SUBMITTED),
        on: {
          CHECKS_STARTED: { target: target(L4_STATES.CHECKS_RUNNING) },
          TOOL_ERROR: { target: target(L4_STATES.MANUAL_REQUIRED) }
        }
      },

      [L4_STATES.REVIEW_APPROVED]: {
        id: nodeId(L4_STATES.REVIEW_APPROVED),
        on: {
          GATE_ALLOWED: { target: target(L4_STATES.ACCEPTED) },
          GATE_DENIED: { target: target(L4_STATES.MANUAL_REQUIRED) },
          TOOL_ERROR: { target: target(L4_STATES.MANUAL_REQUIRED) }
        }
      },

      [L4_STATES.ACCEPTED]: {
        id: nodeId(L4_STATES.ACCEPTED),
        type: 'final'
      },

      [L4_STATES.MANUAL_REQUIRED]: {
        id: nodeId(L4_STATES.MANUAL_REQUIRED),
        type: 'final'
      }
    }
  });
}

export function runL4Events(events) {
  const actor = createActor(createL4Machine());
  actor.start();

  for (const event of events) {
    actor.send({ type: event });
  }

  return actor.getSnapshot().value;
}
