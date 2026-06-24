import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { readFileSync } from "node:fs";
import { buildGateInput, REPOSITORY_MAP } from "../src/build-gate-input.mjs";
import { createHash } from "node:crypto";

const valid = JSON.parse(readFileSync(new URL("../fixtures/gate/valid/approved.json", import.meta.url), "utf8"));

function rawEvidence() {
  const { protocol: _protocol, repository_full_name: _full, ...evidence } = structuredClone(valid);
  return evidence;
}

describe("buildGateInput properties", () => {
  it("rejects every repository key outside the frozen map", () => {
    fc.assert(fc.property(fc.string(), (key) => {
      fc.pre(!Object.hasOwn(REPOSITORY_MAP, key));
      const evidence = rawEvidence();
      evidence.repository_key = key;
      expect(() => buildGateInput(evidence)).toThrow(/Unknown repository key/);
    }), { numRuns: 300 });
  });

  it("always derives repository_full_name from the frozen map", () => {
    fc.assert(fc.property(fc.constantFrom("xinbaijin", "xinbaijin-mcp"), (key) => {
      const evidence = rawEvidence();
      evidence.repository_key = key;
      evidence.review.repository = REPOSITORY_MAP[key];
      evidence.readback.repository = REPOSITORY_MAP[key];
      const content = `${JSON.stringify(evidence.review, null, 2)}\n`;
      evidence.readback.content = content;
      evidence.readback.byte_length = Buffer.byteLength(content, "utf8");
      evidence.readback.sha256 = createHash("sha256").update(Buffer.from(content, "utf8")).digest("hex");
      const built = buildGateInput(evidence);
      expect(built.repository_full_name).toBe(REPOSITORY_MAP[key]);
    }), { numRuns: 40 });
  });
});
