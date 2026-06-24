import { readFileSync } from "node:fs";
import { createSchemaRegistry, formatAjvErrors } from "../src/schema-registry.mjs";

const [path] = process.argv.slice(2);
if (!path) {
  console.error("Usage: node scripts/validate-gate-input.mjs <gate-input.json>");
  process.exit(2);
}
const value = JSON.parse(readFileSync(path, "utf8"));
const { validateGateInput } = createSchemaRegistry();
if (!validateGateInput(value)) {
  console.error(JSON.stringify(formatAjvErrors(validateGateInput.errors), null, 2));
  process.exit(1);
}
console.log("gate-input.json is schema-valid");
