import { calculateComparison } from "./calculate.js";
import { classifyRecommendation } from "./recommendation.js";
import { validateSensitivityInput } from "../schema/validate.js";
import type {
  ComparisonInput,
  ComparisonResult,
  SensitivityResult,
  SensitivityCase,
  ScenarioResult,
} from "./types.js";

/**
 * Analyze sensitivity cases against a base comparison.
 */
export function analyzeSensitivity(
  base: ComparisonInput,
  cases: SensitivityCase[],
): SensitivityResult {
  const validated = validateSensitivityInput(base, cases);
  const baseResult = calculateComparison(validated.base);

  const caseResults: SensitivityResult["cases"] = [];
  const successfulResults: ComparisonResult[] = [];

  for (const c of validated.cases) {
    if ("error" in c) {
      caseResults.push({ id: c.id, label: c.label, error: c.error });
    } else {
      const result = calculateComparison(c.comparison);
      caseResults.push({ id: c.id, label: c.label, result });
      successfulResults.push(result);
    }
  }

  const recommendation = classifyRecommendation(
    findScenario(baseResult, baseResult.lowestOwnedScenarioId),
    findScenario(baseResult, baseResult.lowestCloudScenarioId),
    baseResult.input.materialityThresholdPercent,
    successfulResults,
  );

  return {
    schemaVersion: 1,
    base: baseResult,
    cases: caseResults,
    recommendation,
  };
}

function findScenario(result: ComparisonResult, scenarioId: string): ScenarioResult {
  const found = result.scenarios.find((s) => s.id === scenarioId);
  if (!found) {
    throw new Error(`Scenario "${scenarioId}" not found in comparison result`);
  }
  return found;
}
