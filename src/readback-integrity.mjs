import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";

export class ReadbackIntegrityError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "ReadbackIntegrityError";
    this.code = code;
  }
}

export function sha256Utf8(content) {
  return createHash("sha256").update(Buffer.from(content, "utf8")).digest("hex");
}

export function verifyReadbackIntegrity({ readback, expectedReview, expectedRepository, reviewCommit }) {
  if (!readback || typeof readback !== "object" || Array.isArray(readback)) {
    throw new ReadbackIntegrityError("INVALID_READBACK", "readback must be an object");
  }
  if (typeof readback.content !== "string") {
    throw new ReadbackIntegrityError("MISSING_CONTENT", "readback.content must be a string");
  }
  if (readback.encoding !== "utf-8") {
    throw new ReadbackIntegrityError("INVALID_ENCODING", "review.json must be UTF-8");
  }
  if (readback.repository !== expectedRepository) {
    throw new ReadbackIntegrityError("REPOSITORY_MISMATCH", "readback repository mismatch");
  }
  if (readback.ref !== reviewCommit) {
    throw new ReadbackIntegrityError("REF_MISMATCH", "readback ref must equal review_commit");
  }
  if (readback.path !== "review.json") {
    throw new ReadbackIntegrityError("PATH_MISMATCH", "readback path must be review.json");
  }
  if (readback.content.includes("\r")) {
    throw new ReadbackIntegrityError("INVALID_LINE_ENDING", "review.json must use LF only");
  }
  if (!readback.content.endsWith("\n")) {
    throw new ReadbackIntegrityError("MISSING_TRAILING_NEWLINE", "review.json must end with LF");
  }

  const bytes = Buffer.from(readback.content, "utf8");
  const actualSha256 = sha256Utf8(readback.content);
  if (readback.byte_length !== bytes.byteLength) {
    throw new ReadbackIntegrityError("BYTE_LENGTH_MISMATCH", "readback byte_length mismatch");
  }
  if (String(readback.sha256 || "").toLowerCase() !== actualSha256) {
    throw new ReadbackIntegrityError("SHA256_MISMATCH", "readback sha256 mismatch");
  }

  let parsed;
  try {
    parsed = JSON.parse(readback.content);
  } catch (error) {
    throw new ReadbackIntegrityError("INVALID_JSON", `review.json is invalid JSON: ${error.message}`);
  }
  if (!isDeepStrictEqual(parsed, expectedReview)) {
    throw new ReadbackIntegrityError("CONTENT_MISMATCH", "readback JSON differs from expected review");
  }

  return Object.freeze({
    ...readback,
    sha256: actualSha256,
    byte_length: bytes.byteLength,
    has_trailing_newline: true,
    line_ending: "lf",
    parsed_review: parsed,
    integrity_verified: true
  });
}
