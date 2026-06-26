import { parseMoney, serializeMoney, decimalFromNumber } from "./money.js";
import type {
  ComparisonInput,
  ComparisonResult,
  MonthlyCashFlow,
  OwnedScenarioInput,
  CloudScenarioInput,
  ScenarioInput,
  ScenarioResult,
  PairBreakEvenResult,
} from "./types.js";
import { calculateBreakEven } from "./break-even.js";
import { calculateDepreciation } from "./depreciation.js";
import { classifyRecommendation } from "./recommendation.js";

export function calculateComparison(input: ComparisonInput): ComparisonResult {
  const scenarioResults: ScenarioResult[] = [];
  const ownedResults: ScenarioResult[] = [];
  const cloudResults: ScenarioResult[] = [];

  for (const scenario of input.scenarios) {
    const result = calculateScenario(scenario, input.horizonMonths);
    scenarioResults.push(result);
    if (result.kind === "owned") {
      ownedResults.push(result);
    } else {
      cloudResults.push(result);
    }
  }

  const pairBreakEvens: PairBreakEvenResult[] = [];
  for (const owned of ownedResults) {
    for (const cloud of cloudResults) {
      pairBreakEvens.push(calculateBreakEven(owned, cloud));
    }
  }

  const lowestOwned = findLowestCost(ownedResults);
  const lowestCloud = findLowestCost(cloudResults);

  const tcoDiff = parseMoney(lowestOwned.netCashTco)
    .minus(parseMoney(lowestCloud.netCashTco))
    .abs();
  const tcoDiffStr = serializeMoney(tcoDiff);

  const recommendation = classifyRecommendation(
    lowestOwned,
    lowestCloud,
    input.materialityThresholdPercent,
    [],
  );

  return {
    schemaVersion: 1,
    input: structuredClone(input),
    scenarios: scenarioResults,
    pairBreakEvens,
    lowestOwnedScenarioId: lowestOwned.id,
    lowestCloudScenarioId: lowestCloud.id,
    tcoDifference: tcoDiffStr,
    recommendation,
  };
}

function calculateScenario(scenario: ScenarioInput, horizonMonths: number): ScenarioResult {
  if (scenario.kind === "owned") {
    return calculateOwnedScenario(scenario, horizonMonths);
  }
  return calculateCloudScenario(scenario, horizonMonths);
}

function calculateOwnedScenario(
  scenario: OwnedScenarioInput,
  horizonMonths: number,
): ScenarioResult {
  const flows: MonthlyCashFlow[] = [];
  const initialCapexTotal = scenario.initialCapex.reduce(
    (sum, line) => sum.plus(parseMoney(line.amount)),
    decimalFromNumber(0),
  );

  const annualEnergy = parseMoney(scenario.annualEnergyKwh);
  const electricityRate = parseMoney(scenario.electricityRatePerKwh);
  const baseMonthlyPower = annualEnergy.div(decimalFromNumber(12)).mul(electricityRate);

  const annualMaint = parseMoney(scenario.annualMaintenance);
  const baseMonthlyMaint = annualMaint.div(decimalFromNumber(12));

  let cumulativeGross = decimalFromNumber(0);

  for (let m = 0; m <= horizonMonths; m++) {
    if (m === 0) {
      cumulativeGross = initialCapexTotal;

      flows.push({
        month: 0,
        capitalCost: serializeMoney(initialCapexTotal),
        recurringCost: "0",
        scheduledCost: "0",
        cumulativeGrossCashCost: serializeMoney(cumulativeGross),
      });
    } else {
      const powerEscalated = escalateMonthly(
        baseMonthlyPower,
        scenario.electricityEscalationRate,
        m,
      );
      const maintEscalated = escalateMonthly(
        baseMonthlyMaint,
        scenario.maintenanceEscalationRate,
        m,
      );

      let recurring = powerEscalated.plus(maintEscalated);

      for (const line of scenario.otherMonthlyRecurring ?? []) {
        const lineAmount = parseMoney(line.monthlyAmount);
        recurring = recurring.plus(escalateMonthly(lineAmount, line.annualEscalationRate, m));
      }

      let scheduled = decimalFromNumber(0);
      for (const sc of scenario.scheduledCosts ?? []) {
        if (sc.month === m) {
          scheduled = scheduled.plus(parseMoney(sc.amount));
        }
      }

      cumulativeGross = cumulativeGross.plus(recurring).plus(scheduled);

      flows.push({
        month: m,
        capitalCost: "0",
        recurringCost: serializeMoney(recurring),
        scheduledCost: serializeMoney(scheduled),
        cumulativeGrossCashCost: serializeMoney(cumulativeGross),
      });
    }
  }

  const grossCashTco = cumulativeGross;
  let salvageValue = decimalFromNumber(0);
  if (scenario.salvageValue !== undefined) {
    salvageValue = parseMoney(scenario.salvageValue);
  }
  const netCashTco = grossCashTco.minus(salvageValue);

  const result: ScenarioResult = {
    id: scenario.id,
    label: scenario.label,
    kind: "owned",
    grossCashTco: serializeMoney(grossCashTco),
    netCashTco: serializeMoney(netCashTco),
    salvageValue: serializeMoney(salvageValue),
    monthlyCashFlows: flows,
  };
  if (scenario.depreciation) {
    result.depreciation = calculateDepreciation(scenario, horizonMonths);
  }
  return result;
}

function calculateCloudScenario(
  scenario: CloudScenarioInput,
  horizonMonths: number,
): ScenarioResult {
  const flows: MonthlyCashFlow[] = [];

  const initialCostsTotal = (scenario.initialCosts ?? []).reduce(
    (sum, line) => sum.plus(parseMoney(line.amount)),
    decimalFromNumber(0),
  );

  const monthlyEgress = parseMoney(scenario.monthlyEgressGb);
  const egressRate = parseMoney(scenario.egressRatePerGb);
  const baseMonthlyEgress = monthlyEgress.mul(egressRate);

  let cumulativeGross = decimalFromNumber(0);

  for (let m = 0; m <= horizonMonths; m++) {
    if (m === 0) {
      cumulativeGross = initialCostsTotal;

      flows.push({
        month: 0,
        capitalCost: serializeMoney(initialCostsTotal),
        recurringCost: "0",
        scheduledCost: "0",
        cumulativeGrossCashCost: serializeMoney(cumulativeGross),
      });
    } else {
      let recurring = escalateMonthly(baseMonthlyEgress, scenario.egressEscalationRate, m);

      for (const line of scenario.monthlyRecurring) {
        const lineAmount = parseMoney(line.monthlyAmount);
        recurring = recurring.plus(escalateMonthly(lineAmount, line.annualEscalationRate, m));
      }

      let scheduled = decimalFromNumber(0);
      for (const sc of scenario.scheduledCosts ?? []) {
        if (sc.month === m) {
          scheduled = scheduled.plus(parseMoney(sc.amount));
        }
      }

      cumulativeGross = cumulativeGross.plus(recurring).plus(scheduled);

      flows.push({
        month: m,
        capitalCost: "0",
        recurringCost: serializeMoney(recurring),
        scheduledCost: serializeMoney(scheduled),
        cumulativeGrossCashCost: serializeMoney(cumulativeGross),
      });
    }
  }

  return {
    id: scenario.id,
    label: scenario.label,
    kind: "cloud",
    grossCashTco: serializeMoney(cumulativeGross),
    netCashTco: serializeMoney(cumulativeGross),
    salvageValue: "0",
    monthlyCashFlows: flows,
  };
}

function escalateMonthly(
  base: ReturnType<typeof parseMoney>,
  rateString: string,
  month: number,
): ReturnType<typeof parseMoney> {
  const rate = parseMoney(rateString);
  const exponent = Math.floor((month - 1) / 12);
  return base.mul(decimalFromNumber(1).plus(rate).pow(exponent));
}

function findLowestCost(results: ScenarioResult[]): ScenarioResult {
  if (results.length === 0) {
    throw new Error("No scenarios of this type to compare");
  }
  let lowest = results[0]!;
  let lowestVal = parseMoney(lowest.netCashTco);

  for (const r of results.slice(1)) {
    const val = parseMoney(r.netCashTco);
    if (val.lessThan(lowestVal)) {
      lowest = r;
      lowestVal = val;
    }
  }

  return lowest;
}
