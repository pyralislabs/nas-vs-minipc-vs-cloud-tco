import type { ValidationIssue } from "./types.js";

export class InputValidationError extends Error {
  readonly issues: ValidationIssue[];

  constructor(issues: ValidationIssue[]) {
    const message = issues.map((i) => `${i.code}: ${i.message}`).join("; ");
    super(message);
    this.name = "InputValidationError";
    this.issues = issues;
  }
}

export class SchemaVersionError extends Error {
  constructor(version: unknown) {
    super(`Unsupported schema version: ${String(version)}`);
    this.name = "SchemaVersionError";
  }
}
