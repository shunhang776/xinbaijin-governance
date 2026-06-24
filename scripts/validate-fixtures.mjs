import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createSchemaRegistry, formatAjvErrors } from "../src/schema-registry.mjs";

const rootUrl = new URL("../fixtures/", import.meta.url);
const root = fileURLToPath(rootUrl);
const { validateReview, validateGateInput } = createSchemaRegistry();

function jsonFiles(relativeDirectory) {
  const directory = join(root, relativeDirectory);
  return readdirSync(directory)
    .filter((name) => name.endsWith(".json"))
    .sort()
    .map((name) => ({ name, path: join(directory, name) }));
}

function parse(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function expectValid(files, validate, label) {
  for (const file of files) {
    const value = parse(file.path);
    if (!validate(value)) {
      throw new Error(`${label}/${file.name} should be valid: ${JSON.stringify(formatAjvErrors(validate.errors))}`);
    }
  }
}

function expectInvalid(files, validate, label) {
  for (const file of files) {
    const value = parse(file.path);
    if (validate(value)) {
      throw new Error(`${label}/${file.name} should be invalid`);
    }
  }
}

expectValid(jsonFiles("review/valid/"), validateReview, "review/valid");
expectInvalid(jsonFiles("review/invalid/"), validateReview, "review/invalid");
expectValid(jsonFiles("gate/valid/"), validateGateInput, "gate/valid");
expectInvalid(jsonFiles("gate/invalid-schema/"), validateGateInput, "gate/invalid-schema");
expectValid(jsonFiles("gate/denied-policy/"), validateGateInput, "gate/denied-policy");

console.log("Schema fixture validation passed.");
