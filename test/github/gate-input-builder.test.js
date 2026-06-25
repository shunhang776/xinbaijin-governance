import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createSchemaRegistry } from "../../src/schema-registry.mjs";
import { sha256Utf8 } from "../../src/readback-integrity.mjs";
import { buildGateInput } from "../../src/github/gate-input-builder.mjs";
import { normalizePullRequestEvent } from "../../src/github/actions-event.mjs";
import { FatalError } from "../../src/github/errors.mjs";

const FIXTURE_DIR = fileURLToPath(
  new URL("../../fixtures/github/", import.meta.url)
);

function loadFixture(name) {
  return JSON.parse(readFileSync(join(FIXTURE_DIR, name), "utf8"));
}

function makeReview(repository = "shunhang776/xinbaijin-mcp") {
  return Object.freeze({
    protocol: "xinbaijin-review/1.0",
    repository,
    branch: "dev",
    reviewed_commit: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    based_on_branch_head: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    verdict: "approved",
    summary: "no blocking issues found",
    findings: [],
    reviewer: "ChatGPT",
    reviewed_at: "2026-06-24T12:00:00.000Z",
  });
}

function makeReadback(review, repository = "shunhang776/xinbaijin-mcp") {
  const content = JSON.stringify(review, null, 2) + "\n";
  const bytes = Buffer.from(content, "utf8");
  return Object.freeze({
    protocol: "xinbaijin-file/1.0",
    repository,
    ref: "cccccccccccccccccccccccccccccccccccccccc",
    path: "review.json",
    encoding: "utf-8",
    github_blob_sha: "dddddddddddddddddddddddddddddddddddddddd",
    sha256: sha256Utf8(content),
    byte_length: bytes.byteLength,
    has_trailing_newline: true,
    line_ending: "lf",
    content,
    parsed_review: review,
    integrity_verified: true,
  });
}

function makeValidInput() {
  const event = loadFixture("pull-request-opened.json");
  const normalizedEvent = normalizePullRequestEvent(event);
  const review = makeReview();
  const readback = makeReadback(review);
  const checkRuns = loadFixture("checks-success.json");

  return {
    normalizedEvent,
    review,
    readback,
    checkRuns,
    currentBranchHead: "cccccccccccccccccccccccccccccccccccccccc",
    submissionBaseHead: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    repairRound: 0,
  };
}

describe("buildGateInput", () => {
  it("produces valid gate-input that passes Ajv validation", () => {
    const input = makeValidInput();
    const result = buildGateInput(input);

    const registry = createSchemaRegistry();
    const valid = registry.validateGateInput(result);

    if (!valid) {
      const errors = registry.validateGateInput.errors;
      throw new Error(`Ajv validation failed: ${JSON.stringify(errors, null, 2)}`);
    }

    expect(valid).toBe(true);
    expect(result.protocol).toBe("xinbaijin-gate-input/1.0");
    expect(result.branch).toBe("dev");
    expect(result.repository_key).toBe("xinbaijin-mcp");
    expect(result.candidate_commit).toBe(
      "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
    );
    expect(result.candidate_reachable_from_submission_base).toBe(true);
    expect(result.review_commit_changed_files).toEqual(["review.json"]);
    expect(result.review_commit_parent_sha).toBe(input.submissionBaseHead);
    expect(Object.isFrozen(result)).toBe(true);
  });

  it("does not mutate the review input object", () => {
    const input = makeValidInput();
    const reviewClone = JSON.parse(JSON.stringify(input.review));

    buildGateInput(input);

    expect(input.review).toEqual(reviewClone);
  });

  it("does not mutate the readback input object", () => {
    const input = makeValidInput();
    const readbackClone = JSON.parse(JSON.stringify(input.readback));

    buildGateInput(input);

    expect(input.readback).toEqual(readbackClone);
  });

  it("rejects null normalizedEvent", () => {
    expect(() =>
      buildGateInput({ ...makeValidInput(), normalizedEvent: null })
    ).toThrow(FatalError);
  });

  it("rejects null review", () => {
    expect(() =>
      buildGateInput({ ...makeValidInput(), review: null })
    ).toThrow(FatalError);
  });

  it("rejects null readback", () => {
    expect(() =>
      buildGateInput({ ...makeValidInput(), readback: null })
    ).toThrow(FatalError);
  });

  it("rejects non-array checkRuns", () => {
    expect(() =>
      buildGateInput({ ...makeValidInput(), checkRuns: "not-array" })
    ).toThrow(FatalError);
  });

  it("rejects invalid repository", () => {
    const event = loadFixture("pull-request-opened.json");
    const normalizedEvent = normalizePullRequestEvent(event);
    // override repository to unknown
    const input = {
      ...makeValidInput(),
      normalizedEvent: {
        ...normalizedEvent,
        repository: "unknown/repo",
      },
    };
    expect(() => buildGateInput(input)).toThrow(FatalError);
  });

  it("rejects prototype property repository name", () => {
    const event = loadFixture("pull-request-opened.json");
    const normalizedEvent = normalizePullRequestEvent(event);
    expect(() =>
      buildGateInput({
        ...makeValidInput(),
        normalizedEvent: {
          ...normalizedEvent,
          repository: "constructor",
        },
      })
    ).toThrow(FatalError);
  });

  it("rejects non-dev branch", () => {
    const event = loadFixture("pull-request-opened.json");
    const normalizedEvent = normalizePullRequestEvent(event);
    expect(() =>
      buildGateInput({
        ...makeValidInput(),
        normalizedEvent: {
          ...normalizedEvent,
          baseRef: "main",
        },
      })
    ).toThrow(FatalError);
  });

  it("rejects short SHA for submissionBaseHead", () => {
    expect(() =>
      buildGateInput({
        ...makeValidInput(),
        submissionBaseHead: "abc1234",
      })
    ).toThrow(FatalError);
  });

  it("rejects short SHA for currentBranchHead", () => {
    expect(() =>
      buildGateInput({
        ...makeValidInput(),
        currentBranchHead: "abc1234",
      })
    ).toThrow(FatalError);
  });

  it("filters check runs by candidateCommit", () => {
    const input = makeValidInput();
    // add a check with non-matching commit_sha
    input.checkRuns = [
      ...input.checkRuns,
      {
        name: "other-check",
        commit_sha: "ffffffffffffffffffffffffffffffffffffffff",
        status: "completed",
        conclusion: "success",
      },
    ];
    const result = buildGateInput(input);
    // the non-matching check is filtered out
    expect(result.required_checks).toHaveLength(2);
    expect(
      result.required_checks.every(
        (c) =>
          c.commit_sha ===
          "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
      )
    ).toBe(true);
  });

  it("preserves failed check conclusion", () => {
    const input = makeValidInput();
    input.checkRuns = loadFixture("checks-failed.json");
    const result = buildGateInput(input);

    expect(result.required_checks).toHaveLength(1);
    expect(result.required_checks[0].conclusion).toBe("failure");
  });

  it("passes through explicit requiredCheckNames", () => {
    const input = makeValidInput();
    const result = buildGateInput({
      ...input,
      requiredCheckNames: ["custom-a", "custom-b"],
    });

    expect(result.required_check_names).toEqual(["custom-a", "custom-b"]);
  });

  it("derives requiredCheckNames from checks when not provided", () => {
    const input = makeValidInput();
    const result = buildGateInput(input);

    expect(result.required_check_names).toContain("baijin/build-test");
    expect(result.required_check_names).toContain("baijin/security");
  });

  it("defaults repairRound to 0", () => {
    const input = makeValidInput();
    delete input.repairRound;
    const result = buildGateInput(input);
    expect(result.repair_round).toBe(0);
  });

  it("accepts repairRound 2", () => {
    const input = { ...makeValidInput(), repairRound: 2 };
    const result = buildGateInput(input);
    expect(result.repair_round).toBe(2);
  });
});
