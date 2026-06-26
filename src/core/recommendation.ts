import { parseMoney, decimalFromNumber } from "./money.js";
import type { ScenarioResult, ComparisonResult, RecommendationCode } from "./types.js";

const DISCLAIMER =
  "This is a cost-only planning estimate. Validate workload equivalence, reliability, support, security, performance, and pricing before deciding.";

export function classifyRecommendation(
  lowestOwned: ScenarioResult,
  lowestCloud: ScenarioResult,
  materialityThresholdPercent: string,
  sensitivityResults: ComparisonResult[],
): ComparisonResult["recommendation"] {
  const ownedTco = parseMoney(lowestOwned.netCashTco);
  const cloudTco = parseMoney(lowestCloud.netCashTco);
  const threshold = parseMoney(materialityThresholdPercent);

  let code: RecommendationCode;
  let explanation: string;

  if (ownedTco.isZero() && cloudTco.isZero()) {
    code = "too-close-to-call";
    explanation = "The modeled cost difference is below your materiality threshold.";
  } else {
    const lowerTco = ownedTco.lessThan(cloudTco) ? ownedTco : cloudTco;
    const materialityAmount = lowerTco.mul(threshold).div(decimalFromNumber(100));
    const tcoDiff = ownedTco.minus(cloudTco).abs();

    if (tcoDiff.lessThanOrEqualTo(materialityAmount)) {
      code = "too-close-to-call";
      explanation = "The modeled cost difference is below your materiality threshold.";
    } else if (ownedTco.lessThan(cloudTco)) {
      code = "cost-favors-owned";
      explanation = "Under these cost assumptions, owning is lower cost over the selected horizon.";
    } else {
      code = "cost-favors-cloud";
      explanation =
        "Under these cost assumptions, cloud rental is lower cost over the selected horizon.";
    }
  }

  const baseCode = code;
  for (const result of sensitivityResults) {
    const ownedResult = result.scenarios.find((s) => s.id === lowestOwned.id);
    const cloudResult = result.scenarios.find((s) => s.id === lowestCloud.id);
    if (!ownedResult || !cloudResult) continue;

    const rOwnedTco = parseMoney(ownedResult.netCashTco);
    const rCloudTco = parseMoney(cloudResult.netCashTco);
    const rThreshold = parseMoney(result.input.materialityThresholdPercent);

    let rCode: RecommendationCode;
    if (rOwnedTco.isZero() && rCloudTco.isZero()) {
      rCode = "too-close-to-call";
    } else {
      const rLower = rOwnedTco.lessThan(rCloudTco) ? rOwnedTco : rCloudTco;
      const rMatAmount = rLower.mul(rThreshold).div(decimalFromNumber(100));
      const rDiff = rOwnedTco.minus(rCloudTco).abs();

      if (rDiff.lessThanOrEqualTo(rMatAmount)) {
        rCode = "too-close-to-call";
      } else if (rOwnedTco.lessThan(rCloudTco)) {
        rCode = "cost-favors-owned";
      } else {
        rCode = "cost-favors-cloud";
      }
    }

    if (rCode !== baseCode) {
      code = "sensitivity-dependent";
      explanation = "The lower-cost option changes when supplied assumptions change.";
      break;
    }
  }

  return { code, explanation, disclaimer: DISCLAIMER };
}
