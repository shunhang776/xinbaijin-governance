import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  normalizeCheckRuns,
  filterMatchingChecks,
} from "../../src/github/checks-normalizer.mjs";
import { FatalError } from "../../src/github/errors.mjs";

const FIXTURE_DIR = fileURLToPath(
  new URL("../../fixtures/github/", import.meta.url)
);

function loadFixture(name) {
  return JSON.parse(readFileSync(join(FIXTURE_DIR, name), "utf8"));
}

describe("normalizeCheckRuns", () => {
  it("normalizes valid checks-success fixture", () => {
    const raw = loadFixture("checks-success.json");
    const result = normalizeCheckRuns(raw);

    expect(result).toHaveLength(2);
    expect(Object.isFrozen(result)).toBe(true);

    const first = result[0];
    expect(first.name).toBe("baijin/build-test");
    expect(first.commit_sha).toBe(
      "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
    );
    expect(first.status).toBe("completed");
    expect(first.conclusion).toBe("success");
    expect(Object.isFrozen(first)).toBe(true);

    // no extra properties
    expect(Object.keys(first).sort()).toEqual([
      "commit_sha",
      "conclusion",
      "name",
      "status",
    ]);
  });

  it("normalizes valid checks-failed fixture", () => {
    const raw = loadFixture("checks-failed.json");
    const result = normalizeCheckRuns(raw);

    expect(result).toHaveLength(1);
    expect(result[0].conclusion).toBe("failure");
  });

  it("returns frozen empty array for empty input", () => {
    const result = normalizeCheckRuns([]);
    expect(result).toHaveLength(0);
    expect(Object.isFrozen(result)).toBe(true);
  });

  it("rejects null input", () => {
    expect(() => normalizeCheckRuns(null)).toThrow(FatalError);
  });

  it("rejects string input", () => {
    expect(() => normalizeCheckRuns("not an array")).toThrow(FatalError);
  });

  it("rejects number input", () => {
    expect(() => normalizeCheckRuns(42)).toThrow(FatalError);
  });

  it("rejects check with missing name", () => {
    expect(() =>
      normalizeCheckRuns([
        {
          commit_sha: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          status: "completed",
          conclusion: "success",
        },
      ])
    ).toThrow(FatalError);
  });

  it("rejects check with short commit_sha", () => {
    expect(() =>
      normalizeCheckRuns([
        {
          name: "test",
          commit_sha: "abc1234",
          status: "completed",
          conclusion: "success",
        },
      ])
    ).toThrow(FatalError);
  });

  it("rejects check with invalid status", () => {
    expect(() =>
      normalizeCheckRuns([
        {
          name: "test",
          commit_sha: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          status: "unknown",
          conclusion: "success",
        },
      ])
    ).toThrow(FatalError);
  });

  it("rejects check with invalid conclusion", () => {
    expect(() =>
      normalizeCheckRuns([
        {
          name: "test",
          commit_sha: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          status: "completed",
          conclusion: "bogus",
        },
      ])
    ).toThrow(FatalError);
  });

  it("accepts conclusion: null", () => {
    const result = normalizeCheckRuns([
      {
        name: "test",
        commit_sha: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        status: "in_progress",
        conclusion: null,
        extra_field: "should be stripped",
      },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].conclusion).toBeNull();
    // extra_field is stripped by the normalizer
    expect(Object.keys(result[0])).not.toContain("extra_field");
  });

  it("strips unknown properties from checks", () => {
    const result = normalizeCheckRuns([
      {
        name: "test",
        commit_sha: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        status: "completed",
        conclusion: "success",
        extra: "nope",
        another: 123,
      },
    ]);
    expect(Object.keys(result[0]).sort()).toEqual([
      "commit_sha",
      "conclusion",
      "name",
      "status",
    ]);
  });
});

describe("filterMatchingChecks", () => {
  it("returns checks matching candidateCommit", () => {
    const checks = normalizeCheckRuns(loadFixture("checks-success.json"));
    const result = filterMatchingChecks(
      checks,
      "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
    );
    expect(result).toHaveLength(2);
  });

  it("returns empty array for non-matching commit", () => {
    const checks = normalizeCheckRuns(loadFixture("checks-success.json"));
    const result = filterMatchingChecks(
      checks,
      "ffffffffffffffffffffffffffffffffffffffff"
    );
    expect(result).toHaveLength(0);
  });

  it("does not mutate the original array", () => {
    const checks = normalizeCheckRuns(
      JSON.parse(JSON.stringify(loadFixture("checks-success.json")))
    );
    const clone = [...checks];
    filterMatchingChecks(
      checks,
      "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
    );
    // original is unchanged
    expect(checks).toHaveLength(clone.length);
    expect(checks[0].commit_sha).toBe(clone[0].commit_sha);
  });

  it("filters checks with different commit_sha in mixed array", () => {
    const checks = normalizeCheckRuns([
      {
        name: "match",
        commit_sha: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        status: "completed",
        conclusion: "success",
      },
      {
        name: "no-match",
        commit_sha: "ffffffffffffffffffffffffffffffffffffffff",
        status: "completed",
        conclusion: "failure",
      },
    ]);
    const result = filterMatchingChecks(
      checks,
      "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
    );
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("match");
  });

  it("preserves duplicate checks (does not dedup)", () => {
    const checks = normalizeCheckRuns([
      {
        name: "baijin/build-test",
        commit_sha: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        status: "completed",
        conclusion: "success",
      },
      {
        name: "baijin/build-test",
        commit_sha: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        status: "completed",
        conclusion: "success",
      },
    ]);
    const result = filterMatchingChecks(
      checks,
      "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
    );
    // both survive; dedup is the policy layer's responsibility
    expect(result).toHaveLength(2);
  });

  it("rejects non-array input", () => {
    expect(() => filterMatchingChecks(null, "aaaa")).toThrow(FatalError);
  });

  it("rejects empty candidateCommit", () => {
    expect(() => filterMatchingChecks([], "")).toThrow(FatalError);
  });
});
