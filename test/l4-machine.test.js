import { describe, expect, it } from 'vitest';
import { runL4Events } from '../src/l4/l4-machine.mjs';

describe('L4 minimal XState machine', () => {
  it('reaches ACCEPTED through review-repair-review loop', () => {
    const finalState = runL4Events([
      'CODE_DETECTED',
      'CHECKS_STARTED',
      'CHECKS_PASSED',
      'REVIEW_DENIED',
      'REPAIR_REQUESTED',
      'REPAIR_SUBMITTED',
      'CHECKS_STARTED',
      'CHECKS_PASSED',
      'REVIEW_APPROVED',
      'GATE_ALLOWED'
    ]);

    expect(finalState).toBe('ACCEPTED');
  });

  it('moves to MANUAL_REQUIRED on blocked review', () => {
    const finalState = runL4Events([
      'CODE_DETECTED',
      'CHECKS_STARTED',
      'CHECKS_PASSED',
      'REVIEW_BLOCKED'
    ]);

    expect(finalState).toBe('MANUAL_REQUIRED');
  });

  it('moves to MANUAL_REQUIRED when repair round is exceeded', () => {
    const finalState = runL4Events([
      'CODE_DETECTED',
      'CHECKS_STARTED',
      'CHECKS_PASSED',
      'REVIEW_DENIED',
      'REPAIR_ROUND_EXCEEDED'
    ]);

    expect(finalState).toBe('MANUAL_REQUIRED');
  });
});
