#!/usr/bin/env node

import { parseArgs, readInput, validateCliLocale, CliInputError } from "./args.js";
import { formatComparisonResult, formatSensitivityResult } from "./format.js";
import {
  validateComparisonInput,
  validateSensitivityInput,
  checkSchemaVersion,
} from "../schema/validate.js";
import { calculateComparison } from "../core/calculate.js";
import { analyzeSensitivity } from "../core/sensitivity.js";
import { InputValidationError, SchemaVersionError } from "../core/errors.js";
import type { ComparisonInput, SensitivityCase } from "../core/types.js";

const SCHEMA_VERSION = 1;

async function run(): Promise<void> {
  const argv = process.argv.slice(2);

  let parsed;
  try {
    parsed = parseArgs(argv);
  } catch (err) {
    if (err instanceof CliInputError) {
      console.error(err.message);
      process.exit(2);
    }
    console.error("Error parsing arguments:", (err as Error).message);
    process.exit(2);
  }

  const { command, input: inputPath, casesInput, json: useJson, locale, links: showLinks } = parsed;

  try {
    validateCliLocale(locale);
  } catch (err) {
    exitWithError(err, "locale:", 2, useJson);
  }

  try {
    switch (command) {
      case "validate": {
        const inputData = await readInput(inputPath);
        const parsedInput = JSON.parse(inputData) as ComparisonInput;
        checkSchemaVersion(parsedInput.schemaVersion);
        const validated = validateComparisonInput(parsedInput);
        if (useJson) {
          console.log(
            JSON.stringify({ schemaVersion: SCHEMA_VERSION, ok: true, data: { valid: true } }),
          );
        } else {
          console.log(`Validation passed: "${validated.label}"`);
        }
        break;
      }

      case "compare": {
        const inputData = await readInput(inputPath);
        const parsedInput = JSON.parse(inputData) as ComparisonInput;
        checkSchemaVersion(parsedInput.schemaVersion);
        const validated = validateComparisonInput(parsedInput);
        const result = calculateComparison(validated);

        if (useJson) {
          console.log(JSON.stringify({ schemaVersion: SCHEMA_VERSION, ok: true, data: result }));
        } else {
          console.log(formatComparisonResult(result, locale, showLinks));
        }
        break;
      }

      case "sensitivity": {
        const inputData = await readInput(inputPath);
        const parsedInput = JSON.parse(inputData) as ComparisonInput;
        checkSchemaVersion(parsedInput.schemaVersion);

        if (!casesInput) {
          throw new CliInputError("cli:input", "--cases is required for sensitivity command");
        }

        const casesData = await readInput(casesInput);
        const parsedCases = JSON.parse(casesData);

        const validated = validateSensitivityInput(parsedInput, parsedCases);
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
        const result = analyzeSensitivity(validated.base, validated.cases as SensitivityCase[]);

        if (useJson) {
          console.log(JSON.stringify({ schemaVersion: SCHEMA_VERSION, ok: true, data: result }));
        } else {
          console.log(formatSensitivityResult(result, locale, showLinks));
        }

        const hasCaseErrors = result.cases.some((c) => "error" in c);
        if (hasCaseErrors) {
          process.exit(4);
        }
        break;
      }

      default:
        throw new CliInputError("cli:unknown-command", `Unknown command: ${command}`);
    }
  } catch (err) {
    if (err instanceof InputValidationError) {
      exitWithValidationError(err, useJson);
    } else if (err instanceof SchemaVersionError) {
      exitWithSchemaError(err, useJson);
    } else if (err instanceof CliInputError) {
      exitWithInputError(err, useJson);
    } else if (err instanceof SyntaxError) {
      exitWithError(err, "cli:parse", 2, useJson);
    } else {
      exitWithUnexpectedError(err, useJson);
    }
  }
}

function exitWithValidationError(err: InputValidationError, json: boolean): void {
  if (json) {
    console.log(
      JSON.stringify({
        schemaVersion: SCHEMA_VERSION,
        ok: false,
        error: {
          code: "validation:failed",
          message: err.message,
          issues: err.issues,
        },
      }),
    );
  } else {
    console.error("Validation failed:");
    for (const issue of err.issues) {
      console.error(`  ${issue.code} at ${issue.path}: ${issue.message}`);
    }
  }
  process.exit(2);
}

function exitWithSchemaError(err: SchemaVersionError, json: boolean): void {
  if (json) {
    console.log(
      JSON.stringify({
        schemaVersion: SCHEMA_VERSION,
        ok: false,
        error: {
          code: "schema:unsupported-version",
          message: err.message,
        },
      }),
    );
  } else {
    console.error(err.message);
  }
  process.exit(3);
}

function exitWithInputError(err: CliInputError, json: boolean): void {
  if (json) {
    console.log(
      JSON.stringify({
        schemaVersion: SCHEMA_VERSION,
        ok: false,
        error: {
          code: err.code,
          message: err.message,
        },
      }),
    );
  } else {
    console.error(err.message);
  }
  process.exit(2);
}

function sanitizeMessage(raw: string): string {
  // Strip absolute file paths, stack frames, and file:// URLs from error messages
  // before exposing them through the CLI JSON envelope.
  let cleaned = raw;
  cleaned = cleaned.replace(/\s+at\s+\S+:\d+:\d+/g, "");
  cleaned = cleaned.replace(/file:\/\/\S+/g, "");
  cleaned = cleaned.replace(/(?:\/|[A-Za-z]:\\\\)[^\s:]+/g, "<path>");
  cleaned = cleaned.replace(/\s{2,}/g, " ").trim();
  return cleaned;
}

function exitWithError(err: unknown, code: string, exitCode: number, json = false): void {
  const raw = err instanceof Error ? err.message : String(err);
  const message = sanitizeMessage(raw);
  if (json) {
    console.log(
      JSON.stringify({
        schemaVersion: SCHEMA_VERSION,
        ok: false,
        error: { code, message },
      }),
    );
  } else {
    console.error(message);
  }
  process.exit(exitCode);
}

function exitWithUnexpectedError(err: unknown, json: boolean): void {
  const raw = err instanceof Error ? err.message : String(err);
  const message = sanitizeMessage(raw);
  if (json) {
    console.log(
      JSON.stringify({
        schemaVersion: SCHEMA_VERSION,
        ok: false,
        error: { code: "internal:unexpected", message },
      }),
    );
  } else {
    console.error(`Unexpected error: ${message}`);
  }
  process.exit(1);
}

void run();
