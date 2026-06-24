import { readFileSync, writeFileSync } from "node:fs";
import { buildGateInput } from "../src/build-gate-input.mjs";
import { createSchemaRegistry, formatAjvErrors } from "../src/schema-registry.mjs";

const [inputPath, outputPath = "gate-input.json"] = process.argv.slice(2);
if (!inputPath) {
  console.error("Usage: node scripts/build-gate-input.mjs <raw-evidence.json> [gate-input.json]");
  process.exit(2);
}

const evidence = JSON.parse(readFileSync(inputPath, "utf8"));
const gateInput = buildGateInput(evidence);
const { validateGateInput } = createSchemaRegistry();
if (!validateGateInput(gateInput)) {
  console.error(JSON.stringify(formatAjvErrors(validateGateInput.errors), null, 2));
  process.exit(1);
}
writeFileSync(outputPath, `${JSON.stringify(gateInput, null, 2)}\n`, "utf8");
console.log(`Wrote ${outputPath}`);
