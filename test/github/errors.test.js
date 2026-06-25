import { describe, it, expect } from "vitest";
import { FatalError } from "../../src/github/errors.mjs";

describe("FatalError", () => {
  it("is an instance of Error", () => {
    const err = new FatalError("something broke");
    expect(err).toBeInstanceOf(Error);
  });

  it("is an instance of FatalError", () => {
    const err = new FatalError("something broke");
    expect(err).toBeInstanceOf(FatalError);
  });

  it("sets name to FatalError", () => {
    const err = new FatalError("something broke");
    expect(err.name).toBe("FatalError");
  });

  it("preserves the message", () => {
    const err = new FatalError("evidence is incomplete");
    expect(err.message).toBe("evidence is incomplete");
  });
});
