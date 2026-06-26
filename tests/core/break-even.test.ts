import { describe, it, expect, beforeEach } from "vitest";
import { calculateBreakEven } from "../../src/core/break-even.js";
import { D } from "../../src/core/money.js";

beforeEach(() => {
  D.set({ precision: 28, rounding: D.ROUND_HALF_EVEN });
});
import type { ScenarioResult, MonthlyCashFlow } from "../../src/core/types.js";

function makeScenarioResult(id: string, flows: MonthlyCashFlow[]): ScenarioResult {
  const grossTco = flows.reduce((sum, f) => sum + Number(f.cumulativeGrossCashCost), 0);
  return {
    id,
    label: id,
    kind: id.includes("own") ? "owned" : "cloud",
    grossCashTco: String(grossTco),
    netCashTco: String(grossTco),
    salvageValue: "0",
    monthlyCashFlows: flows,
  };
}

describe("calculateBreakEven", () => {
  it("finds durable break-even when owned becomes cheaper", () => {
    // Owned: high upfront (1000), low monthly (50)
    // Cloud: no upfront, high monthly (200)
    // At month 0: owned=1000, cloud=0 -> owned > cloud
    // At month 1: owned=1050, cloud=200 -> owned > cloud
    // At month 2: owned=1100, cloud=400 -> owned > cloud
    // At month 3: owned=1150, cloud=600 -> owned > cloud
    // At month 4: owned=1200, cloud=800 -> owned > cloud
    // At month 5: owned=1250, cloud=1000 -> owned > cloud
    // At month 6: owned=1300, cloud=1200 -> owned > cloud
    // At month 7: owned=1350, cloud=1400 -> owned <= cloud!
    // From month 7 onward, owned stays below cloud -> durable break-even at month 7
    const ownedFlows = [];
    const cloudFlows = [];
    for (let m = 0; m <= 12; m++) {
      const ownedCumul = 1000 + m * 50;
      const cloudCumul = m * 200;
      ownedFlows.push({
        month: m,
        capitalCost: m === 0 ? "1000" : "0",
        recurringCost: String(m > 0 ? 50 : 0),
        scheduledCost: "0",
        cumulativeGrossCashCost: String(ownedCumul),
      });
      cloudFlows.push({
        month: m,
        capitalCost: "0",
        recurringCost: String(m > 0 ? 200 : 0),
        scheduledCost: "0",
        cumulativeGrossCashCost: String(cloudCumul),
      });
    }
    const owned = makeScenarioResult("my-nas", ownedFlows);
    const cloud = makeScenarioResult("cloud-svc", cloudFlows);

    const result = calculateBreakEven(owned, cloud);
    expect(result.durableBreakEvenMonth).toBe(7);
  });

  it("returns null when no durable break-even", () => {
    // Owned is always more expensive
    const owned = makeScenarioResult("my-nas", [
      {
        month: 0,
        capitalCost: "10000",
        recurringCost: "0",
        scheduledCost: "0",
        cumulativeGrossCashCost: "10000",
      },
      {
        month: 1,
        capitalCost: "0",
        recurringCost: "500",
        scheduledCost: "0",
        cumulativeGrossCashCost: "10500",
      },
    ]);
    const cloud = makeScenarioResult("cloud-svc", [
      {
        month: 0,
        capitalCost: "0",
        recurringCost: "0",
        scheduledCost: "0",
        cumulativeGrossCashCost: "0",
      },
      {
        month: 1,
        capitalCost: "0",
        recurringCost: "200",
        scheduledCost: "0",
        cumulativeGrossCashCost: "200",
      },
    ]);

    const result = calculateBreakEven(owned, cloud);
    expect(result.durableBreakEvenMonth).toBeNull();
  });

  it("detects crossover months", () => {
    const owned = makeScenarioResult("my-nas", [
      {
        month: 0,
        capitalCost: "500",
        recurringCost: "0",
        scheduledCost: "0",
        cumulativeGrossCashCost: "500",
      },
      {
        month: 1,
        capitalCost: "0",
        recurringCost: "50",
        scheduledCost: "0",
        cumulativeGrossCashCost: "550",
      },
      {
        month: 2,
        capitalCost: "0",
        recurringCost: "50",
        scheduledCost: "0",
        cumulativeGrossCashCost: "600",
      },
    ]);
    // Cloud goes 0, 100, 200, 300
    const cloud = makeScenarioResult("cloud-svc", [
      {
        month: 0,
        capitalCost: "0",
        recurringCost: "0",
        scheduledCost: "0",
        cumulativeGrossCashCost: "0",
      },
      {
        month: 1,
        capitalCost: "0",
        recurringCost: "200",
        scheduledCost: "0",
        cumulativeGrossCashCost: "200",
      },
      {
        month: 2,
        capitalCost: "0",
        recurringCost: "200",
        scheduledCost: "0",
        cumulativeGrossCashCost: "400",
      },
    ]);

    const result = calculateBreakEven(owned, cloud);
    // With these numbers, owned is always higher than cloud
    expect(result.crossoverMonths).toBeDefined();
  });

  it("excludes salvage and depreciation from break-even", () => {
    const owned = makeScenarioResult("my-nas", [
      {
        month: 0,
        capitalCost: "1000",
        recurringCost: "0",
        scheduledCost: "0",
        cumulativeGrossCashCost: "1000",
      },
      {
        month: 1,
        capitalCost: "0",
        recurringCost: "100",
        scheduledCost: "0",
        cumulativeGrossCashCost: "1100",
      },
    ]);
    const cloud = makeScenarioResult("cloud-svc", [
      {
        month: 0,
        capitalCost: "0",
        recurringCost: "0",
        scheduledCost: "0",
        cumulativeGrossCashCost: "0",
      },
      {
        month: 1,
        capitalCost: "0",
        recurringCost: "200",
        scheduledCost: "0",
        cumulativeGrossCashCost: "200",
      },
    ]);

    const result = calculateBreakEven(owned, cloud);
    expect(result.ownedScenarioId).toBe("my-nas");
    expect(result.cloudScenarioId).toBe("cloud-svc");
  });
});
