import { describe, expect, it } from 'vitest';
import {
  assertFreshReviewGuard,
  evaluateReviewGuard,
  reviewGuardToL4EventType
} from '../src/l4/review-guard.mjs';

const SHA_A = '1111111111111111111111111111111111111111';
const SHA_B = '2222222222222222222222222222222222222222';
const REVIEW_SHA = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';

function makeInput(overrides = {}) {
  return {
    task_id: 'task-review-guard-001',
    run_id: 'run-review-guard-001',
    repository: 'shunhang776/xinbaijin-mcp',
    branch: 'dev',
    reviewed_commit: SHA_A,
    based_on_branch_head: SHA_A,
    current_branch_head: SHA_A,
    review_commit: REVIEW_SHA,
    verdict: 'approved',
    created_at: '2026-06-27T00:00:00.000Z',
    ...overrides
  };
}

describe('L4 review guard', () => {
  it('marks review as fresh when reviewed commit and branch head match', () => {
    const guard = evaluateReviewGuard(makeInput());

    expect(guard.protocol).toBe('baijin-l4-review-guard/1.0');
    expect(guard.guard_status).toBe('fresh');
    expect(reviewGuardToL4EventType(guard)).toBeNull();
    expect(assertFreshReviewGuard(guard)).toBe(guard);
  });

  it('detects stale review when reviewed_commit does not match current branch head', () => {
    const guard = evaluateReviewGuard(makeInput({
      reviewed_commit: SHA_B,
      based_on_branch_head: SHA_A,
      current_branch_head: SHA_A
    }));

    expect(guard.guard_status).toBe('stale_review');
    expect(reviewGuardToL4EventType(guard)).toBe('STALE_REVIEW_DETECTED');
    expect(() => assertFreshReviewGuard(guard)).toThrow('stale_review');
  });

  it('detects branch head changes before stale review checks', () => {
    const guard = evaluateReviewGuard(makeInput({
      reviewed_commit: SHA_B,
      based_on_branch_head: SHA_A,
      current_branch_head: SHA_B
    }));

    expect(guard.guard_status).toBe('branch_head_changed');
    expect(reviewGuardToL4EventType(guard)).toBe('BRANCH_HEAD_CHANGED');
    expect(() => assertFreshReviewGuard(guard)).toThrow('branch_head_changed');
  });

  it('allows changes_requested and blocked verdicts when commit guard is fresh', () => {
    const changesRequested = evaluateReviewGuard(makeInput({
      verdict: 'changes_requested'
    }));

    const blocked = evaluateReviewGuard(makeInput({
      verdict: 'blocked'
    }));

    expect(changesRequested.guard_status).toBe('fresh');
    expect(blocked.guard_status).toBe('fresh');
  });

  it('rejects invalid commit sha values', () => {
    expect(() => evaluateReviewGuard(makeInput({
      current_branch_head: REVIEW_SHA.toUpperCase()
    }))).toThrow('current_branch_head');

    expect(() => evaluateReviewGuard(makeInput({
      reviewed_commit: 'bad'
    }))).toThrow('reviewed_commit');
  });

  it('rejects invalid verdict values', () => {
    expect(() => evaluateReviewGuard(makeInput({
      verdict: 'unknown'
    }))).toThrow('verdict');
  });
});
