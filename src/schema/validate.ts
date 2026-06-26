import type { ErrorObject } from "ajv";
const AjvModule = await import("ajv");
interface AjvValidator {
  (data: unknown): boolean;
  errors?: ErrorObject[] | null;
}
interface AjvCompiled {
  compile(schema: unknown): AjvValidator;
}
const Ajv = AjvModule.default as unknown as new (opts?: Record<string, unknown>) => AjvCompiled;
import schema from "./scenario.schema.json" with { type: "json" };
import { SUPPORTED_CURRENCIES } from "./currencies.js";
import { SUPPORTED_LOCALES } from "./locales.js";
import { CLI_INPUT_MAX_BYTES, WIDGET_IMPORT_MAX_BYTES } from "./limits.js";
import type {
  ComparisonInput,
  ScenarioInput,
  OwnedScenarioInput,
  CloudScenarioInput,
  ValidationIssue,
} from "../core/types.js";
import { InputValidationError, SchemaVersionError } from "../core/errors.js";

const ajv = new Ajv({ allErrors: true, validateSchema: false });
const validate = ajv.compile(schema);

/**
 * Validate a comparison input structurally (JSON Schema) and semantically.
 */
export function validateComparisonInput(input: unknown): ComparisonInput {
  const issues: ValidationIssue[] = [];

  if (!validate(input)) {
    for (const err of validate.errors as ErrorObject[]) {
      issues.push(ajvErrorToIssue(err));
    }
    throw new InputValidationError(issues);
  }

  const comparison = input as ComparisonInput;
  issues.push(...validateComparisonSemantics(comparison));

  if (issues.length > 0) {
    throw new InputValidationError(issues);
  }

  return comparison;
}

/** Internal type for sensitivity case validation results. */
export type ValidatedSensitivityCase =
  | { id: string; label: string; comparison: ComparisonInput }
  | { id: string; label: string; error: ValidationIssue };

/**
 * Validate a sensitivity case array.
 */
export function validateSensitivityInput(
  base: unknown,
  cases: unknown,
): { base: ComparisonInput; cases: ValidatedSensitivityCase[] } {
  const validatedBase = validateComparisonInput(base);
  const validatedCases: ValidatedSensitivityCase[] = [];

  if (!Array.isArray(cases)) {
    throw new InputValidationError([
      { code: "sensitivity:type", path: "/cases", message: "Cases must be an array" },
    ]);
  }

  function addError(id: string, label: string, error: ValidationIssue): void {
    validatedCases.push({ id, label, error });
  }

  for (let i = 0; i < cases.length; i++) {
    const c = cases[i] as Record<string, unknown>;
    if (!c || typeof c !== "object") {
      addError(`case-${i}`, `Case ${i}`, {
        code: "sensitivity:type",
        path: `/cases/${i}`,
        message: "Sensitivity case must be an object",
      });
      continue;
    }

    const caseId = typeof c.id === "string" ? c.id : `case-${i}`;
    const caseLabel = typeof c.label === "string" ? c.label : `Case ${i}`;

    if (typeof c.comparison !== "object" || c.comparison === null) {
      addError(caseId, caseLabel, {
        code: "sensitivity:missing-comparison",
        path: `/cases/${i}/comparison`,
        message: "Sensitivity case must have a comparison object",
      });
      continue;
    }

    if (!validate(c.comparison)) {
      const errs = (validate.errors as ErrorObject[]) ?? [];
      const caseIssues: ValidationIssue[] = [];
      for (const err of errs) {
        caseIssues.push(ajvErrorToIssue(err, `/cases/${i}/comparison`));
      }
      addError(caseId, caseLabel, {
        code: "sensitivity:schema",
        path: `/cases/${i}/comparison`,
        message: `Schema validation failed: ${caseIssues.map((e) => e.message).join("; ")}`,
      });
      continue;
    }

    const caseComparison = c.comparison as ComparisonInput;
    const caseErrors = validateSensitivityCaseInvariants(validatedBase, caseComparison, i);
    if (caseErrors.length > 0) {
      addError(caseId, caseLabel, caseErrors[0]!);
      continue;
    }

    validatedCases.push({
      id: caseId,
      label: caseLabel,
      comparison: caseComparison,
    });
  }

  return { base: validatedBase, cases: validatedCases };
}

/**
 * Validate a locale string against the allowlist.
 */
export function validateLocale(locale: string): void {
  if (!SUPPORTED_LOCALES.includes(locale)) {
    throw new InputValidationError([
      {
        code: "locale:unsupported",
        path: "/locale",
        message: `Unsupported locale "${locale}". Supported: ${SUPPORTED_LOCALES.join(", ")}`,
      },
    ]);
  }
}

/**
 * Validate input byte size against limit.
 */
export function validateInputSize(bytes: number, source: "cli" | "widget"): void {
  const limit = source === "cli" ? CLI_INPUT_MAX_BYTES : WIDGET_IMPORT_MAX_BYTES;
  if (bytes > limit) {
    throw new InputValidationError([
      {
        code: "limits:input-size",
        path: "/",
        message: `Input exceeds ${source === "cli" ? "1 MiB" : "256 KiB"} limit (${bytes} bytes)`,
      },
    ]);
  }
}

function ajvErrorToIssue(err: ErrorObject, pathPrefix = ""): ValidationIssue {
  const path = `${pathPrefix}${err.instancePath || "/"}`;
  return {
    code: `schema:${err.keyword}`,
    path: path || "/",
    message: err.message ?? "Schema validation error",
  };
}

function validateComparisonSemantics(comparison: ComparisonInput): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const scenarioIds = new Set<string>();
  let hasOwned = false;
  let hasCloud = false;

  if (!SUPPORTED_CURRENCIES.includes(comparison.currency)) {
    issues.push({
      code: "money:unsupported-currency",
      path: "/currency",
      message: `Unsupported currency "${comparison.currency}". Supported: ${SUPPORTED_CURRENCIES.join(", ")}`,
    });
  }

  const matVal = parseDecimalString(comparison.materialityThresholdPercent);
  if (matVal !== null && (matVal < 0 || matVal > 100)) {
    issues.push({
      code: "materiality:out-of-range",
      path: "/materialityThresholdPercent",
      message: `Materiality threshold must be 0..100, got "${comparison.materialityThresholdPercent}"`,
    });
  }

  for (let si = 0; si < comparison.scenarios.length; si++) {
    const scenario = comparison.scenarios[si]!;

    if (scenarioIds.has(scenario.id)) {
      issues.push({
        code: "id:duplicate-scenario",
        path: `/scenarios/${si}/id`,
        message: `Duplicate scenario ID: "${scenario.id}"`,
      });
    }
    scenarioIds.add(scenario.id);

    if (!/^[a-z][a-z0-9-]*$/.test(scenario.id)) {
      issues.push({
        code: "id:invalid-format",
        path: `/scenarios/${si}/id`,
        message: `Scenario ID must be lowercase kebab-case: "${scenario.id}"`,
      });
    }

    if (scenario.kind === "owned") {
      hasOwned = true;
      issues.push(...validateOwnedScenario(scenario, si, comparison));
    } else if (scenario.kind === "cloud") {
      hasCloud = true;
      issues.push(...validateCloudScenario(scenario, si, comparison));
    }
  }

  if (!hasOwned) {
    issues.push({
      code: "scope:missing-owned",
      path: "/scenarios",
      message: "At least one owned scenario is required",
    });
  }
  if (!hasCloud) {
    issues.push({
      code: "scope:missing-cloud",
      path: "/scenarios",
      message: "At least one cloud scenario is required",
    });
  }

  if (issues.length > 0) return issues;

  if (comparison.priceBasis === "constant") {
    for (let si = 0; si < comparison.scenarios.length; si++) {
      const scenario = comparison.scenarios[si]!;
      issues.push(...validateConstantPriceBasis(scenario, si));
    }
  }

  return issues;
}

function validateOwnedScenario(
  scenario: OwnedScenarioInput,
  index: number,
  comparison: ComparisonInput,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (scenario.salvageValue !== undefined) {
    const salvage = parseDecimalString(scenario.salvageValue);
    if (salvage !== null && salvage < 0) {
      issues.push({
        code: "salvage:negative",
        path: `/scenarios/${index}/salvageValue`,
        message: "Salvage value must be non-negative",
      });
    }
    if (salvage !== null && salvage >= 0) {
      const capexSum = scenario.initialCapex.reduce(
        (s, l) => s + (parseDecimalString(l.amount) ?? 0),
        0,
      );
      const scheduledSum = (scenario.scheduledCosts ?? []).reduce(
        (s, l) => s + (parseDecimalString(l.amount) ?? 0),
        0,
      );
      const cap = capexSum + scheduledSum;
      if (salvage > cap) {
        issues.push({
          code: "salvage:exceeds-cap",
          path: `/scenarios/${index}/salvageValue`,
          message: `Salvage value ${scenario.salvageValue} exceeds capex + scheduled capital ${cap}`,
        });
      }
    }
  }

  for (const sc of scenario.scheduledCosts ?? []) {
    if (sc.month < 1 || sc.month > comparison.horizonMonths) {
      issues.push({
        code: "time:scheduled-month",
        path: `/scenarios/${index}/scheduledCosts`,
        message: `Scheduled cost month ${sc.month} outside 1..${comparison.horizonMonths}`,
      });
    }
  }

  if (scenario.depreciation) {
    const dep = scenario.depreciation;
    const allLineIds = new Set([
      ...scenario.initialCapex.map((l) => l.id),
      ...(scenario.scheduledCosts ?? []).map((l) => l.id),
      ...(scenario.otherMonthlyRecurring ?? []).map((l) => l.id),
    ]);

    for (const cid of dep.depreciableCapitalIds) {
      if (!allLineIds.has(cid)) {
        issues.push({
          code: "capital:unknown-id",
          path: `/scenarios/${index}/depreciation/depreciableCapitalIds`,
          message: `Depreciation references unknown capital ID: "${cid}"`,
        });
      }
    }

    const residual = parseDecimalString(dep.residualValue);
    const basis = dep.depreciableCapitalIds.reduce((sum, cid) => {
      const line = scenario.initialCapex.find((l) => l.id === cid);
      return sum + (line ? (parseDecimalString(line.amount) ?? 0) : 0);
    }, 0);

    if (basis <= 0) {
      issues.push({
        code: "capital:basis-not-positive",
        path: `/scenarios/${index}/depreciation`,
        message: "Depreciable basis must be positive",
      });
    }

    if (residual !== null) {
      if (residual < 0) {
        issues.push({
          code: "capital:residual-negative",
          path: `/scenarios/${index}/depreciation/residualValue`,
          message: "Residual value must be non-negative",
        });
      }
      if (residual > basis) {
        issues.push({
          code: "capital:residual-exceeds-basis",
          path: `/scenarios/${index}/depreciation/residualValue`,
          message: "Residual value exceeds depreciable basis",
        });
      }
    }
  }

  return issues;
}

function validateCloudScenario(
  scenario: CloudScenarioInput,
  index: number,
  comparison: ComparisonInput,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  for (const sc of scenario.scheduledCosts ?? []) {
    if (sc.month < 1 || sc.month > comparison.horizonMonths) {
      issues.push({
        code: "time:scheduled-month",
        path: `/scenarios/${index}/scheduledCosts`,
        message: `Scheduled cost month ${sc.month} outside 1..${comparison.horizonMonths}`,
      });
    }
  }

  return issues;
}

function validateConstantPriceBasis(scenario: ScenarioInput, index: number): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  const checkEscalation = (rate: string, path: string) => {
    const parsed = parseDecimalString(rate);
    if (parsed !== null && parsed !== 0) {
      issues.push({
        code: "pricebasis:non-zero-escalation",
        path: `/scenarios/${index}${path}`,
        message: `Constant price basis requires zero escalation, got "${rate}"`,
      });
    }
  };

  if (scenario.kind === "owned") {
    checkEscalation(scenario.electricityEscalationRate, "/electricityEscalationRate");
    checkEscalation(scenario.maintenanceEscalationRate, "/maintenanceEscalationRate");
    const otherRecurring = scenario.otherMonthlyRecurring ?? [];
    for (let i = 0; i < otherRecurring.length; i++) {
      const line = otherRecurring[i]!;
      checkEscalation(
        line.annualEscalationRate,
        `/otherMonthlyRecurring/${i}/annualEscalationRate`,
      );
    }
  } else if (scenario.kind === "cloud") {
    for (let i = 0; i < scenario.monthlyRecurring.length; i++) {
      const line = scenario.monthlyRecurring[i]!;
      checkEscalation(line.annualEscalationRate, `/monthlyRecurring/${i}/annualEscalationRate`);
    }
    checkEscalation(scenario.egressEscalationRate, "/egressEscalationRate");
  }

  return issues;
}

function validateSensitivityCaseInvariants(
  base: ComparisonInput,
  caseComparison: ComparisonInput,
  index: number,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (caseComparison.schemaVersion !== base.schemaVersion) {
    issues.push({
      code: "sensitivity:schema-version",
      path: `/cases/${index}/comparison/schemaVersion`,
      message: "Sensitivity case must preserve schema version",
    });
  }

  if (caseComparison.currency !== base.currency) {
    issues.push({
      code: "sensitivity:currency",
      path: `/cases/${index}/comparison/currency`,
      message: "Sensitivity case must preserve currency",
    });
  }

  if (caseComparison.scenarios.length !== base.scenarios.length) {
    issues.push({
      code: "sensitivity:scenario-count",
      path: `/cases/${index}/comparison/scenarios`,
      message: "Sensitivity case must preserve scenario count",
    });
  }

  for (let si = 0; si < Math.min(caseComparison.scenarios.length, base.scenarios.length); si++) {
    const baseS = base.scenarios[si]!;
    const caseS = caseComparison.scenarios[si]!;
    if (caseS.kind !== baseS.kind) {
      issues.push({
        code: "sensitivity:scenario-kind",
        path: `/cases/${index}/comparison/scenarios/${si}/kind`,
        message: "Sensitivity case must preserve scenario kind",
      });
    }
    if (caseS.id !== baseS.id) {
      issues.push({
        code: "sensitivity:scenario-id",
        path: `/cases/${index}/comparison/scenarios/${si}/id`,
        message: "Sensitivity case must preserve scenario ID",
      });
    }
  }

  return issues;
}

function parseDecimalString(value: string): number | null {
  const num = Number(value);
  if (isNaN(num) || !isFinite(num)) return null;
  return num;
}

/**
 * Check if a schema version is supported.
 */
export function checkSchemaVersion(version: unknown): void {
  if (version !== 1) {
    throw new SchemaVersionError(version);
  }
}
