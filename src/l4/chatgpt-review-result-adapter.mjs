import { evaluateReviewGuard, reviewGuardToL4EventType } from './review-guard.mjs';

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function requireObject(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(name + ' must be an object');
  }

  return value;
}

function requireNonEmptyString(value, name) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(name + ' must be a non-empty string');
  }

  return value;
}

function makeEventId(prefix, index, eventType) {
  return prefix + '-' + String(index + 1).padStart(2, '0') + '-' + eventType.toLowerCase().replace(/_/g, '-');
}

function reviewResultToReviewEventType(result) {
  if (result.status === 'blocked' || result.verdict === 'blocked') {
    return 'REVIEW_BLOCKED';
  }

  if (result.verdict === 'approved') {
    return 'REVIEW_APPROVED';
  }

  if (result.verdict === 'changes_requested') {
    return 'REVIEW_DENIED';
  }

  throw new Error('unsupported review verdict: ' + result.verdict);
}

function makeL4Event(eventTemplate, eventType, options = {}) {
  requireObject(eventTemplate, 'eventTemplate');

  const event = cloneJson(eventTemplate);
  event.event_id = options.event_id || makeEventId(options.event_id_prefix || 'event-chatgpt-review', options.index || 0, eventType);
  event.event_type = eventType;
  event.created_at = options.created_at || event.created_at || new Date().toISOString();

  if (Object.prototype.hasOwnProperty.call(event, 'actor')) {
    event.actor = options.actor || 'chatgpt-reviewer';
  }

  if (Object.prototype.hasOwnProperty.call(event, 'task_id') && options.task_id) {
    event.task_id = options.task_id;
  }

  if (Object.prototype.hasOwnProperty.call(event, 'run_id') && options.run_id) {
    event.run_id = options.run_id;
  }

  if (Object.prototype.hasOwnProperty.call(event, 'repository') && options.repository) {
    event.repository = options.repository;
  }

  if (Object.prototype.hasOwnProperty.call(event, 'branch') && options.branch) {
    event.branch = options.branch;
  }

  if (Object.prototype.hasOwnProperty.call(event, 'commit') && options.commit) {
    event.commit = options.commit;
  }

  if (Object.prototype.hasOwnProperty.call(event, 'commit_sha') && options.commit) {
    event.commit_sha = options.commit;
  }

  return event;
}

export function chatGptReviewResultToReviewGuard(result, options = {}) {
  requireObject(result, 'result');

  return evaluateReviewGuard({
    task_id: requireNonEmptyString(options.task_id, 'task_id'),
    run_id: options.run_id || null,
    repository: result.repository,
    branch: result.branch,
    reviewed_commit: result.reviewed_commit,
    based_on_branch_head: result.based_on_branch_head,
    current_branch_head: requireNonEmptyString(options.current_branch_head, 'current_branch_head'),
    review_commit: result.review_commit,
    verdict: result.verdict,
    created_at: options.created_at || result.created_at
  }, {
    guard_id: options.guard_id,
    created_at: options.created_at || result.created_at
  });
}

export function chatGptReviewResultToL4EventObjects(result, eventTemplate, options = {}) {
  requireObject(result, 'result');

  const guard = chatGptReviewResultToReviewGuard(result, options);
  const guardEventType = reviewGuardToL4EventType(guard);

  if (guardEventType !== null) {
    return {
      guard,
      events: [
        makeL4Event(eventTemplate, guardEventType, {
          event_id_prefix: options.event_id_prefix || 'event-chatgpt-review-guard',
          index: 0,
          actor: 'system',
          task_id: options.task_id,
          run_id: options.run_id,
          repository: result.repository,
          branch: result.branch,
          commit: options.current_branch_head,
          created_at: options.created_at || result.created_at
        })
      ]
    };
  }

  const reviewEventType = reviewResultToReviewEventType(result);

  return {
    guard,
    events: [
      makeL4Event(eventTemplate, reviewEventType, {
        event_id_prefix: options.event_id_prefix || 'event-chatgpt-review',
        index: 0,
        actor: 'chatgpt-reviewer',
        task_id: options.task_id,
        run_id: options.run_id,
        repository: result.repository,
        branch: result.branch,
        commit: result.reviewed_commit,
        created_at: options.created_at || result.created_at
      })
    ]
  };
}
