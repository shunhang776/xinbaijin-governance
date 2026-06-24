import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { readFileSync } from "node:fs";

const reviewSchema = JSON.parse(
  readFileSync(new URL("../schemas/review.schema.json", import.meta.url), "utf8")
);
const gateSchema = JSON.parse(
  readFileSync(new URL("../schemas/gate-input.schema.json", import.meta.url), "utf8")
);

export function createSchemaRegistry() {
  const ajv = new Ajv2020({
    allErrors: true,
    strict: true,
    validateFormats: true,
    allowUnionTypes: false
  });
  addFormats(ajv, { mode: "full" });
  ajv.addSchema(reviewSchema);
  ajv.addSchema(gateSchema);

  return Object.freeze({
    ajv,
    validateReview: ajv.getSchema(reviewSchema.$id),
    validateGateInput: ajv.getSchema(gateSchema.$id)
  });
}

export function formatAjvErrors(errors = []) {
  return errors.map((error) => ({
    instancePath: error.instancePath,
    schemaPath: error.schemaPath,
    keyword: error.keyword,
    message: error.message,
    params: error.params
  }));
}
