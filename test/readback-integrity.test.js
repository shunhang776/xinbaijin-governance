import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { readFileSync } from "node:fs";
import {
  ReadbackIntegrityError,
  sha256Utf8,
  verifyReadbackIntegrity
} from "../src/readback-integrity.mjs";

const gate = JSON.parse(
  readFileSync(new URL("../fixtures/gate/valid/approved.json", import.meta.url), "utf8")
);

function clone(value) {
  return structuredClone(value);
}

function verify(readback = clone(gate.readback), expectedReview = gate.review) {
  return verifyReadbackIntegrity({
    readback,
    expectedReview,
    expectedRepository: gate.repository_full_name,
    reviewCommit: gate.review_commit
  });
}

function expectCode(action, code) {
  try {
    action();
    throw new Error(`Expected ${code}`);
  } catch (error) {
    expect(error).toBeInstanceOf(ReadbackIntegrityError);
    expect(error.code).toBe(code);
  }
}

describe("sha256Utf8", () => {
  it("hashes UTF-8 bytes, including Chinese text", () => {
    expect(sha256Utf8("白槿\n")).toBe("8bbda1d1ecb4498a6f06c209a83cf7586e503a7eac5e8e6c85e3562a2703aab2");
  });
});

describe("verifyReadbackIntegrity", () => {
  it("accepts the valid fixture and derives trusted fields", () => {
    const result = verify();
    expect(result).toMatchObject({
      integrity_verified: true,
      has_trailing_newline: true,
      line_ending: "lf",
      parsed_review: gate.review,
      sha256: gate.readback.sha256,
      byte_length: gate.readback.byte_length
    });
    expect(Object.isFrozen(result)).toBe(true);
  });

  it.each([
    [null, "INVALID_READBACK"],
    [[], "INVALID_READBACK"],
    ["text", "INVALID_READBACK"]
  ])("rejects invalid readback value %#", (value, code) => {
    expectCode(() => verify(value), code);
  });

  it("rejects missing content", () => {
    const readback = clone(gate.readback);
    delete readback.content;
    expectCode(() => verify(readback), "MISSING_CONTENT");
  });

  it("rejects non-string content", () => {
    const readback = clone(gate.readback);
    readback.content = {};
    expectCode(() => verify(readback), "MISSING_CONTENT");
  });

  it("rejects non-UTF-8 metadata", () => {
    const readback = clone(gate.readback);
    readback.encoding = "utf-16";
    expectCode(() => verify(readback), "INVALID_ENCODING");
  });

  it("rejects repository mismatch", () => {
    const readback = clone(gate.readback);
    readback.repository = "shunhang776/xinbaijin";
    expectCode(() => verify(readback), "REPOSITORY_MISMATCH");
  });

  it("rejects review commit ref mismatch", () => {
    const readback = clone(gate.readback);
    readback.ref = "5".repeat(40);
    expectCode(() => verify(readback), "REF_MISMATCH");
  });

  it("rejects any path other than review.json", () => {
    const readback = clone(gate.readback);
    readback.path = "worker.js";
    expectCode(() => verify(readback), "PATH_MISMATCH");
  });

  it("rejects CR and CRLF", () => {
    for (const content of [
      gate.readback.content.replaceAll("\n", "\r\n"),
      gate.readback.content.replaceAll("\n", "\r")
    ]) {
      const readback = clone(gate.readback);
      readback.content = content;
      readback.byte_length = Buffer.byteLength(content, "utf8");
      readback.sha256 = sha256Utf8(content);
      expectCode(() => verify(readback), "INVALID_LINE_ENDING");
    }
  });

  it("rejects missing trailing LF", () => {
    const readback = clone(gate.readback);
    readback.content = readback.content.slice(0, -1);
    readback.byte_length = Buffer.byteLength(readback.content, "utf8");
    readback.sha256 = sha256Utf8(readback.content);
    expectCode(() => verify(readback), "MISSING_TRAILING_NEWLINE");
  });

  it("rejects byte length mismatch", () => {
    const readback = clone(gate.readback);
    readback.byte_length += 1;
    expectCode(() => verify(readback), "BYTE_LENGTH_MISMATCH");
  });

  it("rejects any changed sha256 nibble", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 63 }), (index) => {
        const readback = clone(gate.readback);
        const current = readback.sha256[index];
        const replacement = current === "0" ? "1" : "0";
        readback.sha256 =
          readback.sha256.slice(0, index) + replacement + readback.sha256.slice(index + 1);
        expectCode(() => verify(readback), "SHA256_MISMATCH");
      }),
      { numRuns: 200 }
    );
  });

  it("rejects invalid JSON even when hash and length match", () => {
    const readback = clone(gate.readback);
    readback.content = "{not-json}\n";
    readback.byte_length = Buffer.byteLength(readback.content, "utf8");
    readback.sha256 = sha256Utf8(readback.content);
    expectCode(() => verify(readback), "INVALID_JSON");
  });

  it("rejects arbitrary valid-JSON content tampering", () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1, maxLength: 50 }), (summary) => {
        const tampered = clone(gate.review);
        tampered.summary = summary;
        const readback = clone(gate.readback);
        readback.content = `${JSON.stringify(tampered, null, 2)}\n`;
        readback.byte_length = Buffer.byteLength(readback.content, "utf8");
        readback.sha256 = sha256Utf8(readback.content);
        expectCode(() => verify(readback), "CONTENT_MISMATCH");
      }),
      { numRuns: 100 }
    );
  });
});
