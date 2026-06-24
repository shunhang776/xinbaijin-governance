import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { createSchemaRegistry } from "../src/schema-registry.mjs";

const fixtures = new URL("../fixtures/", import.meta.url);
const { validateReview, validateGateInput } = createSchemaRegistry();

function values(directory) {
  const url = new URL(directory, fixtures);
  return readdirSync(url)
    .filter((name) => name.endsWith(".json"))
    .sort()
    .map((name) => [name, JSON.parse(readFileSync(new URL(name, url), "utf8"))]);
}

describe("review.schema.json", () => {
  it.each(values("review/valid/"))("accepts %s", (_name, value) => {
    expect(validateReview(value), JSON.stringify(validateReview.errors)).toBe(true);
  });
  it.each(values("review/invalid/"))("rejects %s", (_name, value) => {
    expect(validateReview(value)).toBe(false);
  });
});

describe("gate-input.schema.json", () => {
  it.each(values("gate/valid/"))("accepts %s", (_name, value) => {
    expect(validateGateInput(value), JSON.stringify(validateGateInput.errors)).toBe(true);
  });
  it.each(values("gate/invalid-schema/"))("rejects %s", (_name, value) => {
    expect(validateGateInput(value)).toBe(false);
  });
  it.each(values("gate/denied-policy/"))("accepts policy-invalid but structurally valid %s", (_name, value) => {
    expect(validateGateInput(value), JSON.stringify(validateGateInput.errors)).toBe(true);
  });
});
