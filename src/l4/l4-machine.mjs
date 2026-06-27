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

export function createL4Machine() {
  return createMachine({
    id: 'baijin-l4-loop',
    initial: L4_STATES.WAIT_CODE,
    states: {
      [L4_STATES.WAIT_CODE]: {
        on: {
          CODE_DETECTED: L4_STATES.CODE_SUBMITTED
        }
      },

      [L4_STATES.CODE_SUBMITTED]: {
        on: {
          CHECKS_STARTED: L4_STATES.CHECKS_RUNNING,
          TOOL_ERROR: L4_STATES.MANUAL_REQUIRED
        }
      },

      [L4_STATES.CHECKS_RUNNING]: {
        on: {
          CHECKS_PASSED: L4_STATES.WAIT_REVIEW,
          CHECKS_FAILED: L4_STATES.MANUAL_REQUIRED
        }
      },

      [L4_STATES.WAIT_REVIEW]: {
        on: {
          REVIEW_DENIED: L4_STATES.REVIEW_DENIED,
          REVIEW_APPROVED: L4_STATES.REVIEW_APPROVED,
          REVIEW_BLOCKED: L4_STATES.MANUAL_REQUIRED,
          STALE_REVIEW_DETECTED: L4_STATES.MANUAL_REQUIRED
        }
      },

      [L4_STATES.REVIEW_DENIED]: {
        on: {
          REPAIR_REQUESTED: L4_STATES.REPAIR_REQUESTED,
          REPAIR_ROUND_EXCEEDED: L4_STATES.MANUAL_REQUIRED,
          REPEATED_FINDING_DETECTED: L4_STATES.MANUAL_REQUIRED
        }
      },

      [L4_STATES.REPAIR_REQUESTED]: {
        on: {
          REPAIR_SUBMITTED: L4_STATES.REPAIR_SUBMITTED,
          BRANCH_HEAD_CHANGED: L4_STATES.MANUAL_REQUIRED
        }
      },

      [L4_STATES.REPAIR_SUBMITTED]: {
        on: {
          CHECKS_STARTED: L4_STATES.CHECKS_RUNNING
        }
      },

      [L4_STATES.REVIEW_APPROVED]: {
        on: {
          GATE_ALLOWED: L4_STATES.ACCEPTED,
          GATE_DENIED: L4_STATES.MANUAL_REQUIRED
        }
      },

      [L4_STATES.ACCEPTED]: {
        type: 'final'
      },

      [L4_STATES.MANUAL_REQUIRED]: {
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
