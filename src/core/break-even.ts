import { parseMoney } from "./money.js";
import type { ScenarioResult, PairBreakEvenResult } from "./types.js";

function getAt<T>(arr: T[], index: number): T {
  const v = arr[index];
  if (v === undefined) throw new Error(`Index ${index} out of bounds`);
  return v;
}

export function calculateBreakEven(
  owned: ScenarioResult,
  cloud: ScenarioResult,
): PairBreakEvenResult {
  const ownedFlows = owned.monthlyCashFlows;
  const cloudFlows = cloud.monthlyCashFlows;
  const maxMonths = Math.min(ownedFlows.length, cloudFlows.length);

  const ownedCumul: ReturnType<typeof parseMoney>[] = [];
  const cloudCumul: ReturnType<typeof parseMoney>[] = [];
  const deltas: ReturnType<typeof parseMoney>[] = [];

  for (let i = 0; i < maxMonths; i++) {
    const o = parseMoney(getAt(ownedFlows, i).cumulativeGrossCashCost);
    const c = parseMoney(getAt(cloudFlows, i).cumulativeGrossCashCost);
    ownedCumul.push(o);
    cloudCumul.push(c);
    deltas.push(o.minus(c));
  }

  const crossoverMonths: number[] = [];
  for (let m = 1; m < maxMonths; m++) {
    const prevDelta = getAt(deltas, m - 1);
    const currDelta = getAt(deltas, m);
    if (
      prevDelta.greaterThan(0) !== currDelta.greaterThan(0) ||
      prevDelta.isZero() !== currDelta.isZero()
    ) {
      crossoverMonths.push(m);
    }
  }

  let durableBreakEvenMonth: number | null = null;

  for (let m = 0; m < maxMonths; m++) {
    if (getAt(ownedCumul, m).lessThanOrEqualTo(getAt(cloudCumul, m))) {
      let durable = true;
      for (let n = m + 1; n < maxMonths; n++) {
        if (getAt(ownedCumul, n).greaterThan(getAt(cloudCumul, n))) {
          durable = false;
          break;
        }
      }
      if (durable) {
        durableBreakEvenMonth = m;
        break;
      }
    }
  }

  return {
    ownedScenarioId: owned.id,
    cloudScenarioId: cloud.id,
    durableBreakEvenMonth,
    crossoverMonths,
  };
}
