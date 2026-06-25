import { REPOSITORY_MAP } from "../build-gate-input.mjs";
import { FatalError } from "./errors.mjs";

const _reverse = Object.create(null);
for (const [key, value] of Object.entries(REPOSITORY_MAP)) {
  _reverse[value] = key;
}
export const REVERSE_REPOSITORY_MAP = Object.freeze(_reverse);

const FORBIDDEN_KEYS = new Set([
  "constructor",
  "prototype",
  "__proto__",
  "toString",
  "valueOf",
]);

export function resolveRepositoryKey(fullName) {
  if (typeof fullName !== "string") {
    throw new FatalError(
      `repository fullName must be a string, got ${typeof fullName}`
    );
  }
  if (FORBIDDEN_KEYS.has(fullName)) {
    throw new FatalError(`Forbidden repository name: ${String(fullName)}`);
  }
  if (!Object.hasOwn(REVERSE_REPOSITORY_MAP, fullName)) {
    throw new FatalError(`Unknown repository: ${String(fullName)}`);
  }
  return REVERSE_REPOSITORY_MAP[fullName];
}
