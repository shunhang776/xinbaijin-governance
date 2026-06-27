import { describe, expect, it } from 'vitest';
import {
  allGateRequiredConditionsPassed,
  evaluateGateProductionRules,
  getGateProductionReasonCode,
  normalizeGateRequiredConditions
} from '../src/gate/production-rules.mjs';

function passingConditions(overrides = {}) {
  return {
    checks_passed: true,
    chatgpt_review_approved: true,
    review_readback_verified: true,
    l4_accepted: true,
    branch_head_unchanged: true,
    no_stale_review: true,
    no_repair_guard_block: true,
    artifacts_verified: true,
    policy_passed: true,
    ...overrides
  };
}

describe('Gate production rules', () => {
  it('allows production when all required conditions pass', () => {
    const result = evaluateGateProductionRules({
      required_conditions: passingConditions(),
      review_verdict: 'approved',
      l4_final_state: 'ACCEPTED'
    });

    expect(result).toEqual({
      decision: 'allowed',
      reason_code: 'all_required_conditions_met'
    });
  });

  it('denies production when ChatGPT review is not approved', () => {
    const result = evaluateGateProductionRules({
      required_conditions: passingConditions({
        chatgpt_review_approved: false,
        l4_accepted: false,
        policy_passed: false
      }),
      review_verdict: 'changes_requested',
      l4_final_state: 'MANUAL_REQUIRED'
    });

    expect(result).toEqual({
      decision: 'denied',
      reason_code: 'chatgpt_review_not_approved'
    });
  });

  it('denies production when readback is not verified', () => {
    const result = evaluateGateProductionRules({
      required_conditions: passingConditions({
        review_readback_verified: false
      }),
      review_verdict: 'approved',
      l4_final_state: 'ACCEPTED'
    });

    expect(result).toEqual({
      decision: 'denied',
      reason_code: 'review_readback_not_verified'
    });
  });

  it('denies production for stale review, branch change, repair guard, and policy violation', () => {
    expect(getGateProductionReasonCode(passingConditions({
      no_stale_review: false
    }), {
      review_verdict: 'approved',
      l4_final_state: 'ACCEPTED'
    })).toBe('stale_review_detected');

    expect(getGateProductionReasonCode(passingConditions({
      branch_head_unchanged: false
    }), {
      review_verdict: 'approved',
      l4_final_state: 'ACCEPTED'
    })).toBe('branch_head_changed');

    expect(getGateProductionReasonCode(passingConditions({
      no_repair_guard_block: false
    }), {
      review_verdict: 'approved',
      l4_final_state: 'ACCEPTED'
    })).toBe('repair_guard_blocked');

    expect(getGateProductionReasonCode(passingConditions({
      policy_passed: false
    }), {
      review_verdict: 'approved',
      l4_final_state: 'ACCEPTED'
    })).toBe('policy_violation');
  });

  it('returns manual_required for missing artifacts and manual override', () => {
    expect(evaluateGateProductionRules({
      required_conditions: passingConditions({
        artifacts_verified: false
      }),
      review_verdict: 'approved',
      l4_final_state: 'ACCEPTED'
    })).toEqual({
      decision: 'manual_required',
      reason_code: 'missing_required_artifact'
    });

    expect(evaluateGateProductionRules({
      required_conditions: passingConditions(),
      review_verdict: 'approved',
      l4_final_state: 'ACCEPTED',
      manual_override_required: true
    })).toEqual({
      decision: 'manual_required',
      reason_code: 'manual_override_required'
    });
  });

  it('normalizes and validates required conditions', () => {
    const conditions = passingConditions();

    expect(normalizeGateRequiredConditions(conditions)).toEqual(conditions);
    expect(allGateRequiredConditionsPassed(conditions)).toBe(true);

    expect(() => normalizeGateRequiredConditions({
      ...conditions,
      checks_passed: 'yes'
    })).toThrow('checks_passed');
  });
});
