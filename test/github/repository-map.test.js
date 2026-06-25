import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  REVERSE_REPOSITORY_MAP,
  resolveRepositoryKey,
} from "../../src/github/repository-map.mjs";
import { FatalError } from "../../src/github/errors.mjs";

describe("REVERSE_REPOSITORY_MAP", () => {
  it("has null prototype", () => {
    expect(Object.getPrototypeOf(REVERSE_REPOSITORY_MAP)).toBeNull();
  });

  it("is frozen", () => {
    expect(Object.isFrozen(REVERSE_REPOSITORY_MAP)).toBe(true);
  });

  it("has exact expected entries", () => {
    expect(Object.entries(REVERSE_REPOSITORY_MAP).sort()).toEqual([
      ["shunhang776/xinbaijin", "xinbaijin"],
      ["shunhang776/xinbaijin-mcp", "xinbaijin-mcp"],
    ]);
  });
});

describe("resolveRepositoryKey", () => {
  it('resolves "shunhang776/xinbaijin" to "xinbaijin"', () => {
    expect(resolveRepositoryKey("shunhang776/xinbaijin")).toBe("xinbaijin");
  });

  it('resolves "shunhang776/xinbaijin-mcp" to "xinbaijin-mcp"', () => {
    expect(resolveRepositoryKey("shunhang776/xinbaijin-mcp")).toBe(
      "xinbaijin-mcp"
    );
  });

  it("rejects unknown repository", () => {
    expect(() => resolveRepositoryKey("unknown/repo")).toThrow(FatalError);
    expect(() => resolveRepositoryKey("unknown/repo")).toThrow(
      "Unknown repository"
    );
  });

  it("rejects empty string", () => {
    expect(() => resolveRepositoryKey("")).toThrow(FatalError);
  });

  it("rejects null", () => {
    expect(() => resolveRepositoryKey(null)).toThrow(FatalError);
  });

  it("rejects a number", () => {
    expect(() => resolveRepositoryKey(123)).toThrow(FatalError);
  });

  describe("forbidden keys", () => {
    const forbidden = ["constructor", "prototype", "__proto__", "toString", "valueOf"];

    for (const key of forbidden) {
      it(`rejects forbidden key "${key}"`, () => {
        expect(() => resolveRepositoryKey(key)).toThrow(FatalError);
      });
    }
  });

  it("rejects unknown strings via property test", () => {
    fc.assert(
      fc.property(fc.string(), (s) => {
        if (s === "shunhang776/xinbaijin" || s === "shunhang776/xinbaijin-mcp") {
          return; // skip known valid keys
        }
        expect(() => resolveRepositoryKey(s)).toThrow(FatalError);
      }),
      { numRuns: 300 }
    );
  });
});
