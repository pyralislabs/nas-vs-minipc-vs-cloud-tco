import { parseMoney, serializeMoney, decimalFromNumber } from "./money.js";
import type { OwnedScenarioInput, ScenarioResult } from "./types.js";

export function calculateDepreciation(
  scenario: OwnedScenarioInput,
  horizonMonths: number,
): NonNullable<ScenarioResult["depreciation"]> {
  if (!scenario.depreciation) {
    throw new Error("No depreciation policy defined");
  }

  const dep = scenario.depreciation;

  const depreciableBasis = dep.depreciableCapitalIds.reduce((sum, id) => {
    const line = scenario.initialCapex.find((l) => l.id === id);
    return sum.plus(line ? parseMoney(line.amount) : decimalFromNumber(0));
  }, decimalFromNumber(0));

  const residualValue = parseMoney(dep.residualValue);
  const depreciableAmount = depreciableBasis.minus(residualValue);

  if (depreciableAmount.lessThanOrEqualTo(0)) {
    return {
      monthlyDepreciation: "0",
      accumulatedDepreciation: "0",
      endBookValue: serializeMoney(depreciableBasis),
    };
  }

  const monthlyDep = depreciableAmount.div(decimalFromNumber(dep.usefulLifeMonths));
  const effectiveMonths = Math.min(horizonMonths, dep.usefulLifeMonths);
  const accumulated = monthlyDep.mul(decimalFromNumber(effectiveMonths));

  const cappedAccumulated = accumulated.lessThan(depreciableAmount)
    ? accumulated
    : depreciableAmount;

  const endBookValue = depreciableBasis.minus(cappedAccumulated);

  return {
    monthlyDepreciation: serializeMoney(monthlyDep),
    accumulatedDepreciation: serializeMoney(cappedAccumulated),
    endBookValue: serializeMoney(endBookValue),
  };
}
