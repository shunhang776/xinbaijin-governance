import { readFileSync } from "node:fs";
import { FatalError } from "./errors.mjs";

const SHA1_RE = /^[0-9a-f]{40}$/;

export function readGitHubEventFromFile(path) {
  let raw;
  try {
    raw = readFileSync(path, "utf8");
  } catch (err) {
    if (err.code === "ENOENT") {
      throw new FatalError(`Event file not found: ${path}`);
    }
    throw new FatalError(`Cannot read event file: ${err.message}`);
  }

  try {
    return JSON.parse(raw);
  } catch (err) {
    throw new FatalError(`Invalid JSON in event file: ${err.message}`);
  }
}

export function normalizePullRequestEvent(event) {
  if (!event || typeof event !== "object" || Array.isArray(event)) {
    throw new FatalError("Event must be an object");
  }

  if (!event.pull_request || typeof event.pull_request !== "object") {
    throw new FatalError("Missing pull_request field");
  }

  const pr = event.pull_request;

  if (!pr.head || typeof pr.head !== "object") {
    throw new FatalError("Missing pull_request.head");
  }

  if (!pr.head.sha || typeof pr.head.sha !== "string") {
    throw new FatalError("Missing head.sha");
  }

  if (!SHA1_RE.test(pr.head.sha)) {
    throw new FatalError(
      `head.sha must be a 40-character hex string, got "${pr.head.sha}"`
    );
  }

  if (!pr.base || typeof pr.base !== "object" || !pr.base.sha) {
    throw new FatalError("Missing pull_request.base.sha");
  }

  if (!SHA1_RE.test(pr.base.sha)) {
    throw new FatalError(
      `base.sha must be a 40-character hex string, got "${pr.base.sha}"`
    );
  }

  if (
    !event.repository ||
    typeof event.repository !== "object" ||
    !event.repository.full_name
  ) {
    throw new FatalError("Missing repository.full_name");
  }

  return Object.freeze({
    action: typeof event.action === "string" ? event.action : "",
    repository: event.repository.full_name,
    owner:
      event.repository.owner && typeof event.repository.owner.login === "string"
        ? event.repository.owner.login
        : "",
    pullNumber:
      typeof pr.number === "number" ? pr.number : 0,
    headSha: pr.head.sha,
    baseSha: pr.base.sha,
    baseRef:
      pr.base.ref && typeof pr.base.ref === "string" ? pr.base.ref : "",
    headRef:
      pr.head.ref && typeof pr.head.ref === "string" ? pr.head.ref : "",
    htmlUrl:
      typeof pr.html_url === "string" ? pr.html_url : "",
  });
}

export function getLatestCommitSha(normalizedEvent) {
  if (!normalizedEvent || typeof normalizedEvent !== "object") {
    throw new FatalError("normalizedEvent must be an object");
  }
  if (!normalizedEvent.headSha || typeof normalizedEvent.headSha !== "string") {
    throw new FatalError("normalizedEvent.headSha is missing");
  }
  return normalizedEvent.headSha;
}
