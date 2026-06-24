import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { buildGateInput, REPOSITORY_MAP } from "../src/build-gate-input.mjs";

const valid = JSON.parse(
  readFileSync(new URL("../fixtures/gate/valid/approved.json", import.meta.url), "utf8")
);

function rawEvidence() {
  const {
    protocol: _protocol,
    repository_full_name: _repositoryFullName,
    ...evidence
  } = structuredClone(valid);
  return evidence;
}

function updateReviewContent(evidence) {
  const content = `${JSON.stringify(evidence.review, null, 2)}\n`;
  evidence.readback.content = content;
  evidence.readback.byte_length = Buffer.byteLength(content, "utf8");
  evidence.readback.sha256 = createHash("sha256")
    .update(Buffer.from(content, "utf8"))
    .digest("hex");
}

describe("REPOSITORY_MAP", () => {
  it("is a null-prototype frozen allowlist with exactly two entries", () => {
    expect(Object.getPrototypeOf(REPOSITORY_MAP)).toBeNull();
    expect(Object.isFrozen(REPOSITORY_MAP)).toBe(true);
    expect(Object.entries(REPOSITORY_MAP)).toEqual([
      ["xinbaijin", "shunhang776/xinbaijin"],
      ["xinbaijin-mcp", "shunhang776/xinbaijin-mcp"]
    ]);
  });
});

describe("buildGateInput", () => {
  it.each([null, [], "text", 1])("rejects invalid evidence %#", (value) => {
    expect(() => buildGateInput(value)).toThrowError(TypeError);
    expect(() => buildGateInput(value)).toThrow("evidence must be an object");
  });

  it.each(["unknown", "constructor", "toString", "valueOf", "__proto__"])(
    "rejects unknown and inherited repository key %s",
    (key) => {
      const evidence = rawEvidence();
      evidence.repository_key = key;
      expect(() => buildGateInput(evidence)).toThrow(`Unknown repository key: ${key}`);
    }
  );

  it("copies every evidence field and derives only protocol, repository and readback integrity", () => {
    const evidence = rawEvidence();
    const built = buildGateInput(evidence);

    expect(built).toEqual(valid);
    expect(Object.isFrozen(built)).toBe(true);
    expect(built.protocol).toBe("xinbaijin-gate-input/1.0");
    expect(built.repository_full_name).toBe("shunhang776/xinbaijin-mcp");
  });

  it("does not retain mutable array or review references", () => {
    const evidence = rawEvidence();
    const built = buildGateInput(evidence);

    evidence.review_commit_changed_files.push("worker.js");
    evidence.required_check_names.push("other");
    evidence.required_checks[0].conclusion = "failure";
    evidence.review.summary = "mutated";

    expect(built.review_commit_changed_files).toEqual(["review.json"]);
    expect(built.required_check_names).toEqual(["baijin/build-test", "baijin/security"]);
    expect(built.required_checks[0].conclusion).toBe("success");
    expect(built.review.summary).toBe("未发现阻塞问题。");
  });

  it("supports the second frozen repository without trusting caller-supplied full name", () => {
    const evidence = rawEvidence();
    evidence.repository_key = "xinbaijin";
    evidence.review.repository = "shunhang776/xinbaijin";
    evidence.readback.repository = "shunhang776/xinbaijin";
    updateReviewContent(evidence);

    const built = buildGateInput(evidence);
    expect(built.repository_full_name).toBe("shunhang776/xinbaijin");
    expect(built.review.repository).toBe("shunhang776/xinbaijin");
    expect(built.readback.repository).toBe("shunhang776/xinbaijin");
  });
});
