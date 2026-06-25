import { describe, it, expect } from "vitest";
import { readFileSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  readGitHubEventFromFile,
  normalizePullRequestEvent,
  getLatestCommitSha,
} from "../../src/github/actions-event.mjs";
import { FatalError } from "../../src/github/errors.mjs";

const FIXTURE_DIR = fileURLToPath(
  new URL("../../fixtures/github/", import.meta.url)
);

function loadFixture(name) {
  return JSON.parse(
    readFileSync(join(FIXTURE_DIR, name), "utf8")
  );
}

describe("readGitHubEventFromFile", () => {
  it("reads and parses a valid event file", () => {
    const event = readGitHubEventFromFile(
      join(FIXTURE_DIR, "pull-request-opened.json")
    );
    expect(event).toBeTypeOf("object");
    expect(event.action).toBe("opened");
    expect(event.pull_request.number).toBe(42);
  });

  it("throws FatalError for non-existent file", () => {
    expect(() =>
      readGitHubEventFromFile("/nonexistent/path/event.json")
    ).toThrow(FatalError);
  });

  it("throws FatalError for invalid JSON", () => {
    const dir = mkdtempSync(join(tmpdir(), "event-test-"));
    const badPath = join(dir, "bad.json");
    try {
      writeFileSync(badPath, "not json {{{", "utf8");
      expect(() => readGitHubEventFromFile(badPath)).toThrow(FatalError);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("normalizePullRequestEvent", () => {
  it("normalizes a valid PR opened event", () => {
    const event = loadFixture("pull-request-opened.json");
    const result = normalizePullRequestEvent(event);

    expect(result.action).toBe("opened");
    expect(result.repository).toBe("shunhang776/xinbaijin-mcp");
    expect(result.owner).toBe("shunhang776");
    expect(result.pullNumber).toBe(42);
    expect(result.headSha).toBe(
      "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
    );
    expect(result.baseSha).toBe(
      "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
    );
    expect(result.baseRef).toBe("dev");
    expect(result.headRef).toBe("feature/new-thing");
    expect(result.htmlUrl).toBe(
      "https://github.com/shunhang776/xinbaijin-mcp/pull/42"
    );
    expect(Object.isFrozen(result)).toBe(true);
  });

  it("normalizes a valid PR synchronize event", () => {
    const event = loadFixture("pull-request-synchronize.json");
    const result = normalizePullRequestEvent(event);
    expect(result.action).toBe("synchronize");
    expect(result.headSha).toBe(
      "cccccccccccccccccccccccccccccccccccccccc"
    );
  });

  it("rejects null input", () => {
    expect(() => normalizePullRequestEvent(null)).toThrow(FatalError);
  });

  it("rejects array input", () => {
    expect(() => normalizePullRequestEvent([])).toThrow(FatalError);
  });

  it("rejects missing pull_request field", () => {
    expect(() => normalizePullRequestEvent({ repository: {} })).toThrow(
      FatalError
    );
  });

  it("rejects missing head.sha", () => {
    expect(() =>
      normalizePullRequestEvent({
        pull_request: { head: {}, base: { sha: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" } },
        repository: { full_name: "shunhang776/xinbaijin-mcp" },
      })
    ).toThrow(FatalError);
  });

  it("rejects short SHA for head.sha", () => {
    expect(() =>
      normalizePullRequestEvent({
        pull_request: {
          head: { sha: "abc1234" },
          base: {
            sha: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
            ref: "dev",
          },
        },
        repository: { full_name: "shunhang776/xinbaijin-mcp" },
      })
    ).toThrow(FatalError);
  });

  it("rejects short SHA for base.sha", () => {
    expect(() =>
      normalizePullRequestEvent({
        pull_request: {
          head: {
            sha: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          },
          base: { sha: "short", ref: "dev" },
        },
        repository: { full_name: "shunhang776/xinbaijin-mcp" },
      })
    ).toThrow(FatalError);
  });

  it("rejects missing repository.full_name", () => {
    expect(() =>
      normalizePullRequestEvent({
        pull_request: {
          head: {
            sha: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          },
          base: {
            sha: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
            ref: "dev",
          },
        },
        repository: {},
      })
    ).toThrow(FatalError);
  });
});

describe("getLatestCommitSha", () => {
  it("returns headSha from normalized event", () => {
    const event = loadFixture("pull-request-opened.json");
    const normalized = normalizePullRequestEvent(event);
    expect(getLatestCommitSha(normalized)).toBe(
      "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
    );
  });

  it("throws FatalError for non-object input", () => {
    expect(() => getLatestCommitSha(null)).toThrow(FatalError);
  });

  it("throws FatalError for object without headSha", () => {
    expect(() => getLatestCommitSha({})).toThrow(FatalError);
  });
});
